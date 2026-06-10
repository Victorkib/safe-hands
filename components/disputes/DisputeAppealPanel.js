'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import EvidenceUploadPanel from '@/components/evidence/EvidenceUploadPanel';
import {
  APPEAL_GROUNDS,
  MIN_APPEAL_DESCRIPTION_LEN,
  canUserFileAppeal,
  computeAppealDeadline,
  getAppealGroundsLabel,
  getAppealStatusLabel,
  getAppealWindowDays,
  isAppealWindowOpen,
} from '@/lib/disputeAppeal';
import { getResolutionVerdictLabel } from '@/lib/disputeResolutionLabels';

function daysRemaining(resolvedAt) {
  const deadline = new Date(computeAppealDeadline(resolvedAt));
  const ms = deadline.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * Post-verdict review request UI for losing party.
 * @param {{
 *   dispute: object;
 *   transaction: object;
 *   userId: string;
 *   appeals: object[];
 *   onRefresh: () => void;
 * }} props
 */
export default function DisputeAppealPanel({ dispute, transaction, userId, appeals, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [grounds, setGrounds] = useState('new_evidence');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const myAppeal = useMemo(
    () => (appeals || []).find((a) => a.filed_by === userId),
    [appeals, userId]
  );

  const eligibility = useMemo(
    () => canUserFileAppeal(userId, dispute, transaction, appeals || []),
    [userId, dispute, transaction, appeals]
  );

  if (!['resolved', 'closed'].includes(dispute?.status) || !dispute?.resolution) {
    return null;
  }

  if (dispute.resolution === 'cancelled') {
    return null;
  }

  const windowOpen = isAppealWindowOpen(dispute);
  const daysLeft = dispute.resolved_at ? daysRemaining(dispute.resolved_at) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = description.trim();
    if (trimmed.length < MIN_APPEAL_DESCRIPTION_LEN) {
      toast.error(`Explain your grounds in at least ${MIN_APPEAL_DESCRIPTION_LEN} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('grounds', grounds);
      formData.append('description', trimmed);
      files.forEach((f) => formData.append('files', f));

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`/api/disputes/${dispute.id}/appeals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
        body: formData,
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error || 'Could not submit review request');
        return;
      }
      toast.success(body.message || 'Review request submitted');
      setShowModal(false);
      setDescription('');
      setFiles([]);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit review request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Post-verdict review</p>
          <h2 className="text-lg font-bold text-slate-900 mt-1">Request a second look</h2>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            If you did not prevail, you may ask an admin to review within{' '}
            <strong>{getAppealWindowDays()} days</strong> of the verdict. Funds stay as-is until an
            admin confirms any change.
          </p>
        </div>
        {windowOpen && !myAppeal && (
          <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">
            {daysLeft} day{daysLeft === 1 ? '' : 's'} left
          </span>
        )}
      </div>

      {myAppeal ? (
        <div className="rounded-xl border border-violet-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Your review request</span>
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-900">
              {getAppealStatusLabel(myAppeal.status)}
            </span>
          </div>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Grounds:</span> {getAppealGroundsLabel(myAppeal.grounds)}
          </p>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{myAppeal.description}</p>
          {myAppeal.reversal_notes && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-semibold mb-1">Manual steps (if any)</p>
              <pre className="whitespace-pre-wrap font-sans text-xs">{myAppeal.reversal_notes}</pre>
            </div>
          )}
          {myAppeal.overturn_resolution && (
            <p className="text-sm font-medium text-emerald-800">
              New verdict: {getResolutionVerdictLabel(myAppeal.overturn_resolution)}
            </p>
          )}
          {myAppeal.admin_notes && (
            <p className="text-sm text-slate-600">
              <span className="font-semibold">Admin:</span> {myAppeal.admin_notes}
            </p>
          )}
        </div>
      ) : eligibility.ok ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full sm:w-auto rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700 transition"
        >
          Request review of verdict
        </button>
      ) : (
        <p className="text-sm text-slate-600 rounded-lg border border-slate-200 bg-white/80 px-4 py-3">
          {eligibility.error ||
            (!windowOpen
              ? `The ${getAppealWindowDays()}-day review window has closed.`
              : 'You cannot request a review on this case.')}
        </p>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Valid grounds: new evidence, procedural error (e.g. unfair process), or factual error — not
        general dissatisfaction.{' '}
        <Link href="/dashboard/disputes" className="text-violet-700 underline font-medium">
          All disputes
        </Link>
      </p>

      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900">Request verdict review</h3>
            <p className="mt-1 text-sm text-slate-600">
              Original outcome:{' '}
              <strong>{getResolutionVerdictLabel(dispute.resolution)}</strong>. Submit before{' '}
              {dispute.resolved_at
                ? new Date(computeAppealDeadline(dispute.resolved_at)).toLocaleString()
                : 'deadline'}.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grounds</label>
                <select
                  value={grounds}
                  onChange={(e) => setGrounds(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                >
                  {APPEAL_GROUNDS.map((g) => (
                    <option key={g} value={g}>
                      {getAppealGroundsLabel(g)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Your explanation (min {MIN_APPEAL_DESCRIPTION_LEN} chars)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  placeholder="What new facts or process issues should the admin consider?"
                />
              </div>

              <EvidenceUploadPanel
                id="appeal-evidence"
                files={files}
                onChange={setFiles}
                maxFiles={3}
                label="New evidence (optional)"
                helpText="Photos or screenshots not shown at original resolution. Max 3 files."
              />

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                No money moves automatically when you submit. An admin must uphold, deny, or overturn
                the verdict.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit request'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
