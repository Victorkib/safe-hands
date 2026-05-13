import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import {
  getB2cCallbackPublicUrl,
  getWithdrawalMinKes,
  isWithdrawDemoMode,
  sumReservedWithdrawals,
} from '@/lib/sellerWithdrawal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/seller/wallet
 * Balance, ledger, recent withdrawals, and payout mode hints for the UI.
 */
export async function GET(request) {
  try {
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role, account_balance, full_name, phone_number')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!['seller', 'buyer_seller'].includes(profile.role)) {
      return Response.json(
        { error: 'The earnings wallet is available for seller accounts.' },
        { status: 403 }
      );
    }

    const { data: ledger, error: ledgerError } = await supabase
      .from('wallet_ledger_entries')
      .select('id, transaction_id, entry_type, amount, currency, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (ledgerError) {
      const msg = ledgerError.message || '';
      const missing =
        msg.includes('does not exist') ||
        msg.includes('schema cache') ||
        ledgerError.code === '42P01';
      if (missing) {
        return Response.json(
          {
            error:
              'Wallet tables are not installed yet. Run scripts/019_seller_wallet_release_settlement.sql in the Supabase SQL editor.',
            code: 'WALLET_MIGRATION_REQUIRED',
          },
          { status: 503 }
        );
      }
      console.error('wallet ledger fetch:', ledgerError);
      return Response.json({ error: 'Could not load wallet activity' }, { status: 500 });
    }

    const balance = Number(profile.account_balance);
    const safeBalance = Number.isFinite(balance) ? balance : 0;

    let withdrawals = [];
    let withdrawalsError = null;
    const { data: wd, error: wdErr } = await supabase
      .from('withdrawal_requests')
      .select(
        'id, amount, phone, status, originator_conversation_id, conversation_id, result_desc, simulated, created_at, updated_at'
      )
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (wdErr) {
      const msg = wdErr.message || '';
      if (msg.includes('does not exist') || wdErr.code === '42P01') {
        withdrawalsError = 'WITHDRAWAL_MIGRATION_REQUIRED';
      } else {
        withdrawalsError = wdErr.message;
      }
    } else {
      withdrawals = wd || [];
    }

    const reserved = withdrawalsError ? 0 : await sumReservedWithdrawals(supabase, user.id);
    const available = Math.max(0, safeBalance - reserved);
    const demo = isWithdrawDemoMode();
    const b2cUrlOk = Boolean(getB2cCallbackPublicUrl());

    return Response.json({
      balance: safeBalance,
      available_balance: available,
      reserved_for_payouts: reserved,
      currency: 'KES',
      full_name: profile.full_name,
      phone_number: profile.phone_number,
      ledger: ledger || [],
      withdrawals,
      withdrawals_error: withdrawalsError,
      withdraw_demo_mode: demo,
      withdraw_b2c_callback_configured: b2cUrlOk,
      withdrawal_min_kes: getWithdrawalMinKes(),
    });
  } catch (e) {
    console.error('GET /api/seller/wallet:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
