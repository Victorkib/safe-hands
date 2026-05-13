import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import { mpesaClient } from '@/lib/mpesaClient';
import {
  finalizeWithdrawalDebit,
  getB2cCallbackPublicUrl,
  getB2cQueueTimeoutPublicUrl,
  getWithdrawalMinKes,
  isWithdrawDemoMode,
  isWithdrawalRequestsTableMissing,
  newWithdrawalIds,
  sumReservedWithdrawals,
} from '@/lib/sellerWithdrawal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/seller/withdraw
 * Body: { amount: number, phone?: string } — phone defaults to profile phone_number.
 *
 * WITHDRAW_DEMO_MODE=true → completes immediately (for pitches / localhost without B2C URLs).
 * Otherwise calls Daraja B2C sandbox/production; debit happens in /api/mpesa/b2c-result when Result is success.
 */
export async function POST(request) {
  try {
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, role, account_balance, phone_number')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!['seller', 'buyer_seller'].includes(profile.role)) {
      return Response.json({ error: 'Only sellers can withdraw' }, { status: 403 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const minKes = getWithdrawalMinKes();
    if (amount < minKes) {
      return Response.json(
        { error: `Minimum withdrawal is KES ${minKes.toLocaleString()}` },
        { status: 400 }
      );
    }

    const rawPhone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : profile.phone_number;
    if (!rawPhone) {
      return Response.json(
        { error: 'Set a phone number on your profile or pass phone in the request body.' },
        { status: 400 }
      );
    }

    const phone = mpesaClient.formatPhoneNumber(rawPhone);

    const { error: tblErr } = await supabase.from('withdrawal_requests').select('id').limit(1);
    if (tblErr) {
      if (isWithdrawalRequestsTableMissing(tblErr)) {
        return Response.json(
          {
            error: 'Run scripts/020_withdrawal_requests.sql in Supabase SQL Editor (same project as your .env).',
            code: 'WITHDRAWAL_MIGRATION_REQUIRED',
          },
          { status: 503 }
        );
      }
      console.error('[seller/withdraw] withdrawal_requests probe:', tblErr);
      const payload = {
        error: 'Could not verify withdrawal setup',
        code: tblErr.code,
        hint:
          process.env.NODE_ENV === 'development'
            ? tblErr.message || String(tblErr)
            : 'Check Supabase URL and service role key; see server logs.',
      };
      return Response.json(payload, { status: 500 });
    }

    const balance = Number(profile.account_balance);
    const safeBalance = Number.isFinite(balance) ? balance : 0;
    const reserved = await sumReservedWithdrawals(supabase, user.id);
    const available = safeBalance - reserved;

    if (amount > available + 1e-9) {
      return Response.json(
        {
          error: `Insufficient available balance. Available: KES ${available.toLocaleString()} (KES ${reserved.toLocaleString()} in pending payouts).`,
          available,
          reserved,
        },
        { status: 400 }
      );
    }

    const demo = isWithdrawDemoMode();
    const resultUrl = getB2cCallbackPublicUrl();
    const queueUrl = getB2cQueueTimeoutPublicUrl();

    if (!demo && !resultUrl) {
      return Response.json(
        {
          error:
            'Set NEXT_PUBLIC_APP_URL to your public base URL (e.g. https://xxxx.ngrok-free.app) so M-Pesa B2C can call /api/mpesa/b2c-result. Or set WITHDRAW_DEMO_MODE=true for instant demo payouts without Daraja.',
          code: 'B2C_URL_REQUIRED',
        },
        { status: 503 }
      );
    }

    const { withdrawalId, originatorConversationId } = newWithdrawalIds();

    const { error: insErr } = await supabase.from('withdrawal_requests').insert({
      id: withdrawalId,
      seller_id: user.id,
      amount,
      phone,
      status: 'pending',
      originator_conversation_id: originatorConversationId,
      simulated: demo,
    });

    if (insErr) {
      if (insErr.code === '23505') {
        return Response.json({ error: 'Duplicate payout request — try again.' }, { status: 409 });
      }
      console.error('withdraw insert:', insErr);
      return Response.json({ error: 'Could not create withdrawal' }, { status: 500 });
    }

    if (demo) {
      const fin = await finalizeWithdrawalDebit(supabase, withdrawalId, {
        simulated: true,
        resultCode: '0',
        resultDesc: 'WITHDRAW_DEMO_MODE — no Daraja call',
      });
      if (!fin.ok) {
        return Response.json({ error: fin.error || 'Demo withdrawal failed' }, { status: 500 });
      }
      return Response.json({
        success: true,
        mode: 'demo',
        message: 'Demo withdrawal completed. Balance updated (no M-Pesa call).',
        withdrawal_id: withdrawalId,
      });
    }

    const mpesa = await mpesaClient.initiateB2C({
      phoneNumber: phone,
      amount,
      remarks: `SafeHands WD ${withdrawalId.slice(0, 8)}`,
      originatorConversationId,
      resultURL: resultUrl,
      queueTimeOutURL: queueUrl || resultUrl,
    });

    const d = mpesa.data || {};
    const accepted = mpesa.success && String(d.ResponseCode ?? d.responseCode ?? '') === '0';

    if (!accepted) {
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'failed',
          result_code: String(d.ResponseCode ?? 'ERR'),
          result_desc: d.ResponseDescription || d.errorMessage || mpesa.error || 'B2C rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawalId);

      return Response.json(
        {
          error: d.ResponseDescription || d.errorMessage || mpesa.error || 'M-Pesa did not accept the B2C request',
          details: d,
        },
        { status: 502 }
      );
    }

    await supabase
      .from('withdrawal_requests')
      .update({
        status: 'processing',
        conversation_id: d.ConversationID || d.conversationID || null,
        result_code: String(d.ResponseCode ?? '0'),
        result_desc: d.ResponseDescription || 'B2C accepted — awaiting result callback',
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId);

    return Response.json({
      success: true,
      mode: 'live',
      message:
        'Payout initiated with Safaricom. Your balance will update when the B2C result callback arrives (keep ngrok running and NEXT_PUBLIC_APP_URL matching the tunnel).',
      withdrawal_id: withdrawalId,
      conversation_id: d.ConversationID || null,
    });
  } catch (e) {
    console.error('POST /api/seller/withdraw:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
