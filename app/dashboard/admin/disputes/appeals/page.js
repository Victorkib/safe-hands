'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  getAppealGroundsLabel,
  getAppealStatusLabel,
  suggestOverturnResolution,
} from '@/lib/disputeAppeal';
import { getResolutionVerdictLabel } from '@/lib/disputeResolutionLabels';

const statusTone = {
  pending: 'bg-amber-100 text-amber-900',
  in_review: 'bg-blue-100 text-blue-900',
  upheld: 'bg-slate-100 text-slate-800',
  denied: 'bg-rose-100 text-rose-900',
  overturned: 'bg-emerald-100 text-emerald-900',
  manual_required: 'bg-orange-100 text-orange-900',
};

export default function AdminAppealsPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState('uphold');
  const [overturnResolution, setOverturnResolution] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [safety, setSafety] = useState(null);
  const [deciding, setDeciding] = useState(false);
  const [showFilter, setShowFilter] = useState('open');

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/disputes/appeals?status=${showFilter}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || 'Failed to load appeals');
        return;
      }
      setMigrationRequired(Boolean(body.migration_required));
      setAppeals(body.appeals || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load appeals');
    } finally {
      setLoading(false);
    }
  }, [showFilter]);

  useEffect(() => {
    if (authLoading) return;
    if (!profile || profile.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    fetchAppeals();
  }, [profile, authLoading, router, fetchAppeals]);

  const openDecideModal = async (appeal) => {
    setSelected(appeal);
    setDecision('uphold');
    setAdminNotes('');
    const suggested = suggestOverturnResolution(
      appeal.original_resolution,
      appeal.appellant_role
    );
    setOverturnResolution(suggested || 'refund_buyer');
    setSafety(null);

    if (suggested) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(
          `/api/admin/disputes/appeals/${appeal.id}/decide?overturn_resolution=${encodeURIComponent(suggested)}`,
          { headers: { Authorization: `Bearer ${session?.access_token || ''}` } }
        );
        const body = await res.json();
        if (body.success) setSafety(body);
      } catch {
        /* preview optional */
      }
    }
  };

  const closeModal = () => {
    if (deciding) return;
    setSelected(null);
    setSafety(null);
  };

  const loadSafetyPreview = async (resolution) => {
    if (!selected) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/admin/disputes/appeals/${selected.id}/decide?overturn_resolution=${encodeURIComponent(resolution)}`,
        { headers: { Authorization: `Bearer ${session?.access_token || ''}` } }
      );
      const body = await res.json();
      if (body.success) setSafety(body);
    } catch {
      /* ignore */
    }
  };

  const submitDecision = async () => {
    if (!selected || adminNotes.trim().length < 10) {
      toast.error('Admin notes required (min 10 characters).');
      return;
    }
    if (decision === 'overturn' && !overturnResolution) {
      toast.error('Select overturn resolution.');
      return;
    }

    setDeciding(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/disputes/appeals/${selected.id}/decide`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision,
          overturn_resolution: decision === 'overturn' ? overturnResolution : undefined,
          admin_notes: adminNotes.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error || 'Decision failed');
        return;
      }
      toast.success(`Appeal ${body.status || decision} recorded`);
      if (body.checklist?.length) {
        console.info('Reversal checklist:', body.checklist);
      }
      closeModal();
      fetchAppeals();
    } catch (e) {
      console.error(e);
      toast.error('Decision failed');
    } finally {
      setDeciding(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-violet-800 via-indigo-800 to-slate-900 p-8 text-white shadow-lg">
        <Link href="/dashboard/admin/disputes" className="text-sm text-violet-200 hover:text-white">
          ← Back to disputes
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Post-verdict reviews</h1>
        <p className="mt-2 max-w-2xl text-violet-100">
          Losing parties may request review within 7 days. Uphold, deny, or overturn — funds change
          only on confirmed overturn (auto when safe).
        </p>
      </div>

      {migrationRequired && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Run <code className="rounded bg-white px-1">scripts/028_dispute_appeals.sql</code> in Supabase
          SQL Editor to enable appeals.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'open', label: 'Open queue' },
          { id: 'all', label: 'All appeals' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setShowFilter(f.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              showFilter === f.id
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {appeals.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-900">No appeals in this view</p>
          <p className="mt-1 text-sm text-slate-600">Resolved disputes with review requests appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appeals.map((appeal) => (
            <article
              key={appeal.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">
                      #{appeal.id.slice(0, 8)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone[appeal.status] || statusTone.pending}`}
                    >
                      {getAppealStatusLabel(appeal.status)}
                    </span>
                    <span className="text-xs text-slate-500">
                      Filed {new Date(appeal.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {getAppealGroundsLabel(appeal.grounds)} ·{' '}
                    {appeal.filer?.full_name || appeal.filer?.email || 'Party'} (
                    {appeal.appellant_role})
                  </p>
                  <p className="text-sm text-slate-700 line-clamp-2">{appeal.description}</p>
                  <p className="text-sm text-violet-800">
                    Original: {getResolutionVerdictLabel(appeal.original_resolution)} · KES{' '}
                    {Number(appeal.transaction?.amount || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  {['pending', 'in_review'].includes(appeal.status) && (
                    <button
                      type="button"
                      onClick={() => openDecideModal(appeal)}
                      className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
                    >
                      Decide
                    </button>
                  )}
                  <Link
                    href={`/dashboard/disputes/${appeal.dispute_id}`}
                    className="text-center text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Open case →
                  </Link>
                </div>
              </div>
              {Array.isArray(appeal.evidence_urls) && appeal.evidence_urls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {appeal.evidence_urls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-16 w-16 overflow-hidden rounded-lg border border-slate-200"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900">Decide review request</h2>
              <p className="mt-1 text-sm text-slate-600 line-clamp-3">{selected.description}</p>
            </div>

            <div className="space-y-4 p-6">
              <div className="space-y-2">
                {[
                  { id: 'uphold', label: 'Uphold original verdict', sub: 'No fund changes' },
                  { id: 'deny', label: 'Deny request', sub: 'Reject without changing verdict wording' },
                  { id: 'overturn', label: 'Overturn verdict', sub: 'Admin confirms new outcome' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                      decision === opt.id
                        ? 'border-violet-400 bg-violet-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value={opt.id}
                      checked={decision === opt.id}
                      onChange={() => setDecision(opt.id)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{opt.label}</p>
                      <p className="text-xs text-slate-600">{opt.sub}</p>
                    </div>
                  </label>
                ))}
              </div>

              {decision === 'overturn' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    New verdict
                  </label>
                  <select
                    value={overturnResolution}
                    onChange={(e) => {
                      setOverturnResolution(e.target.value);
                      loadSafetyPreview(e.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  >
                    <option value="refund_buyer">Refund buyer</option>
                    <option value="release_to_seller">Release to seller</option>
                    <option value="partial_refund">Partial refund (manual follow-up)</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  {safety && (
                    <div
                      className={`mt-3 rounded-lg border p-3 text-sm ${
                        safety.canAutoReverse
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                          : 'border-amber-200 bg-amber-50 text-amber-950'
                      }`}
                    >
                      <p className="font-semibold">
                        {safety.canAutoReverse
                          ? 'Safe for automatic reversal'
                          : 'Manual ops checklist required'}
                      </p>
                      <ul className="mt-2 list-disc pl-5 space-y-1 text-xs">
                        {(safety.checklist || []).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Admin notes (required)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  placeholder="Explain your decision for both parties and audit trail…"
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-200 p-6">
              <button
                type="button"
                onClick={closeModal}
                disabled={deciding}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDecision}
                disabled={deciding}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {deciding ? 'Saving…' : 'Confirm decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
