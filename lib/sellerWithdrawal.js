import { randomUUID } from 'crypto';

/**
 * Local / pitch mode: complete withdrawals instantly without calling Daraja B2C.
 */
export function isWithdrawDemoMode() {
  const v = process.env.WITHDRAW_DEMO_MODE;
  return v === 'true' || v === '1' || v === 'yes';
}

export function getWithdrawalMinKes() {
  const n = Number(process.env.WITHDRAWAL_MIN_KES);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Public URL Safaricom will POST B2C results to (must be HTTPS in real env; ngrok for dev).
 * @returns {string|null}
 */
export function getB2cCallbackPublicUrl() {
  const explicit =
    process.env.MPESA_B2C_RESULT_URL?.trim() ||
    process.env.MPESA_B2C_CALLBACK_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
  if (!base) return null;
  return `${base}/api/mpesa/b2c-result`;
}

export function getB2cQueueTimeoutPublicUrl() {
  const explicit = process.env.MPESA_B2C_QUEUE_TIMEOUT_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return getB2cCallbackPublicUrl();
}

export function isWithdrawalRequestsTableMissing(err) {
  if (!err) return false;
  const c = String(err.code || '');
  const m = String(err.message || '').toLowerCase();
  if (c === '42P01' || c === 'PGRST205') return true;
  if (!m.includes('withdrawal_request')) return false;
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find')
  );
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} sellerId
 */
export async function sumReservedWithdrawals(supabase, sellerId) {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('amount')
    .eq('seller_id', sellerId)
    .in('status', ['pending', 'processing']);

  if (error || !data) return 0;
  return data.reduce((s, row) => s + (Number(row.amount) || 0), 0);
}

/**
 * Stable OriginatorConversationID for Daraja (we store the same on withdrawal_requests).
 * @param {string} withdrawalId UUID
 */
export function buildWithdrawalOriginatorId(withdrawalId) {
  return `SXW${withdrawalId.replace(/-/g, '')}`;
}

/**
 * Debit seller wallet once per withdrawal; idempotent.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} withdrawalId
 * @param {{ conversationId?: string|null, resultCode?: string|null, resultDesc?: string|null, mpesaTransactionId?: string|null, simulated?: boolean }} meta
 */
export async function finalizeWithdrawalDebit(supabase, withdrawalId, meta = {}) {
  const { data: w, error: wErr } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('id', withdrawalId)
    .single();

  if (wErr || !w) {
    return { ok: false, error: 'Withdrawal not found' };
  }

  if (w.status === 'completed') {
    return { ok: true, idempotent: true };
  }

  if (w.status === 'failed') {
    return { ok: false, error: 'Withdrawal already failed' };
  }

  const { data: dup } = await supabase
    .from('wallet_ledger_entries')
    .select('id')
    .eq('withdrawal_request_id', withdrawalId)
    .eq('entry_type', 'debit_withdrawal')
    .maybeSingle();

  if (dup?.id) {
    await supabase
      .from('withdrawal_requests')
      .update({
        status: 'completed',
        conversation_id: meta.conversationId ?? w.conversation_id,
        result_code: meta.resultCode ?? w.result_code,
        result_desc: meta.resultDesc ?? w.result_desc,
        mpesa_transaction_id: meta.mpesaTransactionId ?? w.mpesa_transaction_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId);
    return { ok: true, idempotent: true };
  }

  const { data: seller, error: sErr } = await supabase
    .from('users')
    .select('account_balance')
    .eq('id', w.seller_id)
    .single();

  if (sErr || !seller) {
    return { ok: false, error: 'Seller not found' };
  }

  const bal = Number(seller.account_balance);
  const amt = Number(w.amount);
  if (!Number.isFinite(bal) || !Number.isFinite(amt) || bal < amt) {
    await supabase
      .from('withdrawal_requests')
      .update({
        status: 'failed',
        result_code: 'LOCAL',
        result_desc: 'Insufficient balance at payout time',
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId);
    return { ok: false, error: 'Insufficient balance' };
  }

  const newBal = bal - amt;

  const { error: uErr } = await supabase
    .from('users')
    .update({ account_balance: newBal, updated_at: new Date().toISOString() })
    .eq('id', w.seller_id);

  if (uErr) {
    return { ok: false, error: uErr.message };
  }

  const { error: lErr } = await supabase.from('wallet_ledger_entries').insert({
    user_id: w.seller_id,
    transaction_id: null,
    withdrawal_request_id: withdrawalId,
    entry_type: 'debit_withdrawal',
    amount: amt,
    currency: 'KES',
    description: meta.simulated
      ? `Withdrawal to M-Pesa (demo) — ${w.phone}`
      : `Withdrawal to M-Pesa — ${w.phone}`,
    metadata: {
      conversation_id: meta.conversationId ?? null,
      mpesa_transaction_id: meta.mpesaTransactionId ?? null,
      simulated: Boolean(meta.simulated),
    },
  });

  if (lErr) {
    await supabase
      .from('users')
      .update({ account_balance: bal, updated_at: new Date().toISOString() })
      .eq('id', w.seller_id);
    return { ok: false, error: lErr.message };
  }

  await supabase
    .from('withdrawal_requests')
    .update({
      status: 'completed',
      conversation_id: meta.conversationId ?? w.conversation_id,
      result_code: meta.resultCode ?? w.result_code,
      result_desc: meta.resultDesc ?? w.result_desc,
      mpesa_transaction_id: meta.mpesaTransactionId ?? w.mpesa_transaction_id,
      simulated: Boolean(meta.simulated),
      updated_at: new Date().toISOString(),
    })
    .eq('id', withdrawalId);

  await supabase.from('notifications').insert({
    user_id: w.seller_id,
    title: 'Withdrawal sent',
    message: meta.simulated
      ? `Demo mode: KES ${amt.toLocaleString()} marked as paid out to ${w.phone}.`
      : `KES ${amt.toLocaleString()} has been sent to your M-Pesa (${w.phone}).`,
    type: 'withdrawal_completed',
    related_transaction_id: null,
  });

  return { ok: true };
}

/**
 * @returns {{ withdrawalId: string, originatorConversationId: string }}
 */
export function newWithdrawalIds() {
  const withdrawalId = randomUUID();
  return {
    withdrawalId,
    originatorConversationId: buildWithdrawalOriginatorId(withdrawalId),
  };
}

/**
 * Reverse {@link buildWithdrawalOriginatorId} for debugging / lookups.
 * @param {string} originatorConversationId
 * @returns {string|null} UUID
 */
export function withdrawalIdFromOriginator(originatorConversationId) {
  if (!originatorConversationId || !originatorConversationId.startsWith('SXW')) return null;
  const raw = originatorConversationId.slice(3);
  if (raw.length !== 32) return null;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20, 32)}`;
}

/**
 * Mark withdrawal failed (B2C declined / timeout). No wallet debit.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} originatorConversationId
 * @param {{ resultCode?: string|null, resultDesc?: string|null, conversationId?: string|null }} meta
 */
export async function markWithdrawalFailedByOriginator(supabase, originatorConversationId, meta = {}) {
  if (!originatorConversationId) return { ok: false, error: 'Missing originator' };
  const { error } = await supabase
    .from('withdrawal_requests')
    .update({
      status: 'failed',
      result_code: meta.resultCode != null ? String(meta.resultCode) : 'UNKNOWN',
      result_desc: meta.resultDesc ?? 'Payout failed',
      conversation_id: meta.conversationId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('originator_conversation_id', originatorConversationId)
    .in('status', ['pending', 'processing']);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
