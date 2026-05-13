'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

function formatKes(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return `KES ${x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadge(status) {
  const map = {
    completed: 'bg-emerald-100 text-emerald-900',
    processing: 'bg-amber-100 text-amber-900',
    pending: 'bg-slate-100 text-slate-800',
    failed: 'bg-rose-100 text-rose-900',
  };
  return map[status] || 'bg-slate-100 text-slate-800';
}

export default function SellerWalletPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [migrationHint, setMigrationHint] = useState(false);
  const [withdrawMigrationHint, setWithdrawMigrationHint] = useState(false);
  const [data, setData] = useState({
    balance: 0,
    available_balance: 0,
    reserved_for_payouts: 0,
    currency: 'KES',
    ledger: [],
    withdrawals: [],
    withdraw_demo_mode: false,
    withdraw_b2c_callback_configured: false,
    withdrawal_min_kes: 1,
    phone_number: null,
  });
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const loadWallet = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/seller/wallet', {
      headers: {
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (body?.code === 'WALLET_MIGRATION_REQUIRED') {
        setMigrationHint(true);
        setError(body.error || 'Run wallet migration.');
      } else {
        setError(body.error || 'Could not load wallet');
      }
      return;
    }
    setMigrationHint(false);
    setError(null);
    if (body.withdrawals_error === 'WITHDRAWAL_MIGRATION_REQUIRED') {
      setWithdrawMigrationHint(true);
    } else {
      setWithdrawMigrationHint(false);
    }
    setData({
      balance: body.balance ?? 0,
      available_balance: body.available_balance ?? body.balance ?? 0,
      reserved_for_payouts: body.reserved_for_payouts ?? 0,
      currency: body.currency || 'KES',
      ledger: Array.isArray(body.ledger) ? body.ledger : [],
      withdrawals: Array.isArray(body.withdrawals) ? body.withdrawals : [],
      withdraw_demo_mode: Boolean(body.withdraw_demo_mode),
      withdraw_b2c_callback_configured: Boolean(body.withdraw_b2c_callback_configured),
      withdrawal_min_kes: body.withdrawal_min_kes ?? 1,
      phone_number: body.phone_number ?? null,
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/auth/login');
      return;
    }

    const role = profile?.role;
    if (role === 'admin') {
      router.push('/dashboard/admin');
      return;
    }
    if (role !== 'seller' && role !== 'buyer_seller') {
      router.push('/dashboard/buyer');
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setMigrationHint(false);
      try {
        if (!cancelled) await loadWallet();
      } catch {
        if (!cancelled) setError('Something went wrong loading your wallet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, profile?.role, router, loadWallet]);

  useEffect(() => {
    if (profile?.phone_number) {
      setPhone((prev) => (prev.trim() ? prev : String(profile.phone_number)));
    }
  }, [profile?.phone_number]);

  const submitWithdraw = async (e) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setWithdrawing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/seller/withdraw', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: n,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body?.code === 'WITHDRAWAL_MIGRATION_REQUIRED') {
          setWithdrawMigrationHint(true);
        }
        toast.error(body.error || 'Withdrawal failed');
        return;
      }
      toast.success(body.message || 'Withdrawal processed');
      setAmount('');
      await loadWallet();
    } catch {
      toast.error('Network error');
    } finally {
      setWithdrawing(false);
    }
  };

  if (authLoading || (loading && !error && !migrationHint)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Seller</p>
          <h1 className="text-3xl font-bold text-slate-900">Earnings & balance</h1>
          <p className="mt-1 max-w-xl text-slate-600">
            Completed sales credit your balance. Withdraw to your M-Pesa using sandbox Daraja in development, or use
            demo mode for instant payouts during demos.
          </p>
        </div>
        <Link
          href="/dashboard/seller"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          ← Back to seller dashboard
        </Link>
      </div>

      {migrationHint && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
          <p className="font-semibold">Wallet migration required</p>
          <p className="mt-2 text-sm leading-relaxed">
            Run <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">scripts/019_seller_wallet_release_settlement.sql</code>{' '}
            in Supabase, then refresh.
          </p>
        </div>
      )}

      {withdrawMigrationHint && !migrationHint && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
          <p className="font-semibold">Withdrawals migration</p>
          <p className="mt-2 text-sm leading-relaxed">
            Run <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">scripts/020_withdrawal_requests.sql</code>{' '}
            in Supabase to enable payouts, then refresh.
          </p>
        </div>
      )}

      {error && !migrationHint && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">{error}</div>
      )}

      {!error && !migrationHint && (
        <>
          {data.withdraw_demo_mode && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950 shadow-sm">
              <p className="font-semibold">Demo withdrawal mode is ON</p>
              <p className="mt-1 text-sm">
                <code className="rounded bg-white/80 px-1">WITHDRAW_DEMO_MODE=true</code> — payouts complete instantly
                without calling Safaricom. Turn it off and set <code className="rounded bg-white/80 px-1">NEXT_PUBLIC_APP_URL</code> to your ngrok URL for real sandbox B2C.
              </p>
            </div>
          )}

          {!data.withdraw_demo_mode && !data.withdraw_b2c_callback_configured && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
              <p className="font-semibold">B2C callback URL not set</p>
              <p className="mt-1 text-sm">
                Set <code className="rounded bg-white/80 px-1">NEXT_PUBLIC_APP_URL</code> to your public HTTPS base (e.g. ngrok) so
                Safaricom can POST to <code className="rounded bg-white/80 px-1">/api/mpesa/b2c-result</code>. Or enable demo mode for presentations.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 text-white shadow-lg">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-200/90">Wallet balance</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{formatKes(data.balance)}</p>
              <p className="mt-3 text-xs text-slate-400">Gross credited from released escrow sales.</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-900">Available to withdraw</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">{formatKes(data.available_balance)}</p>
              {data.reserved_for_payouts > 0 && (
                <p className="mt-2 text-xs text-emerald-800">
                  KES {data.reserved_for_payouts.toLocaleString()} reserved for in-flight B2C payouts.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Withdraw to M-Pesa</h2>
            <p className="mt-1 text-sm text-slate-600">
              Minimum <strong>KES {Number(data.withdrawal_min_kes).toLocaleString()}</strong>. Uses Daraja B2C when not in
              demo mode (sandbox credentials in <code className="text-xs">.env</code>).
            </p>
            <form onSubmit={submitWithdraw} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Amount (KES)</label>
                <input
                  type="number"
                  min={data.withdrawal_min_kes}
                  step="0.01"
                  value={amount}
                  onChange={(ev) => setAmount(ev.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder={`e.g. ${Math.min(100, Math.floor(data.available_balance)) || 10}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">M-Pesa phone (optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(ev) => setPhone(ev.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder={data.phone_number || '2547XXXXXXXX'}
                />
                <p className="mt-1 text-xs text-slate-500">Defaults to your profile phone if left blank.</p>
              </div>
              <button
                type="submit"
                disabled={withdrawing || data.available_balance < data.withdrawal_min_kes}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {withdrawing ? 'Processing…' : 'Request payout'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Recent payouts</h2>
            {data.withdrawals.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No withdrawal requests yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {data.withdrawals.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{formatKes(w.amount)} → {w.phone}</p>
                      <p className="text-xs text-slate-500">
                        {w.created_at ? new Date(w.created_at).toLocaleString() : ''}
                        {w.simulated ? ' · demo' : ''}
                      </p>
                      {w.result_desc && w.status === 'failed' && (
                        <p className="text-xs text-rose-600">{w.result_desc}</p>
                      )}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(w.status)}`}>
                      {w.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Activity</h2>
            <p className="mt-1 text-sm text-slate-600">Credits and debits on your wallet.</p>
            {data.ledger.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                No ledger lines yet.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {data.ledger.map((row) => {
                  const isDebit = row.entry_type === 'debit_withdrawal';
                  const label =
                    row.entry_type === 'credit_sale_release'
                      ? 'Sale proceeds'
                      : row.entry_type === 'debit_withdrawal'
                        ? 'Withdrawal'
                        : row.entry_type;
                  return (
                    <li key={row.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{label}</p>
                        <p className="text-xs text-slate-500">
                          {row.description || '—'}
                          {row.transaction_id && (
                            <>
                              {' · '}
                              <Link
                                href={`/dashboard/transactions/${row.transaction_id}`}
                                className="font-medium text-emerald-700 hover:underline"
                              >
                                Transaction
                              </Link>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                        </p>
                      </div>
                      <p className={`text-lg font-bold ${isDebit ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {isDebit ? '−' : '+'}
                        {formatKes(row.amount)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
