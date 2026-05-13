/**
 * Status to resume after abandoning or rolling back a failed STK checkout.
 * Uses the transaction_history row that recorded the transition into payment_pending.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} transactionId
 * @returns {Promise<string>}
 */
export async function getResumeStatusBeforePaymentPending(supabase, transactionId) {
  const { data } = await supabase
    .from('transaction_history')
    .select('old_status')
    .eq('transaction_id', transactionId)
    .eq('new_status', 'payment_pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const s = data?.old_status;
  if (s && ['seller_approved', 'initiated'].includes(s)) return s;
  return 'seller_approved';
}

/**
 * @param {unknown} v
 * @returns {string}
 */
export function normalizeMpesaCode(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

/**
 * STK query still in flight / not finalized (do not clear mpesa_ref).
 * @param {string} resultCode
 * @param {string} [resultDesc]
 */
export function isMpesaStkStillPending(resultCode, resultDesc) {
  const c = normalizeMpesaCode(resultCode);
  if (c === '4999') return true;
  const d = String(resultDesc || '').toLowerCase();
  if (/(still|under process|being processed|in progress|pending)/i.test(d)) return true;
  return false;
}

/**
 * After a successful STK query response body, whether we should roll back checkout in DB.
 * @param {string} resultCode
 * @param {string} [resultDesc]
 */
export function shouldResetStkCheckoutFromQuery(resultCode, resultDesc) {
  const c = normalizeMpesaCode(resultCode);
  if (c === '' || c === '0') return false;
  if (isMpesaStkStillPending(c, resultDesc)) return false;
  return true;
}

export function assertMpesaCallbackConfigured() {
  const raw = process.env.MPESA_CALLBACK_URL;
  const u = typeof raw === 'string' ? raw.trim() : '';
  if (!u) {
    return {
      ok: false,
      message:
        'MPESA_CALLBACK_URL is not set. STK callbacks will never reach this app (e.g. ngrok must be running and the URL pasted here).',
    };
  }
  try {
    const parsed = new URL(u);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, message: 'MPESA_CALLBACK_URL must be an http(s) URL.' };
    }
  } catch {
    return { ok: false, message: 'MPESA_CALLBACK_URL is not a valid URL.' };
  }
  return { ok: true };
}

/**
 * @param {unknown} metadata
 * @returns {{ amount?: string, mpesaReceipt?: string, phoneNumber?: string }}
 */
export function parseCallbackMetadataItems(metadata) {
  const items = metadata?.Item;
  const list = Array.isArray(items) ? items : [];
  const find = (name) => list.find((item) => item?.Name === name)?.Value;
  return {
    amount: find('Amount'),
    mpesaReceipt: find('MpesaReceiptNumber'),
    phoneNumber: find('PhoneNumber'),
  };
}
