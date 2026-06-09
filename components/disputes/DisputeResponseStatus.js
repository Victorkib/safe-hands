'use client';

import { getResponseStatusSummary } from '@/lib/disputeResponse';

const toneClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  pending: 'border-orange-200 bg-orange-50 text-orange-950',
  neutral: 'border-slate-200 bg-slate-50 text-slate-800',
};

/**
 * @param {{ dispute: object; compact?: boolean; className?: string }} props
 */
export default function DisputeResponseStatus({ dispute, compact = false, className = '' }) {
  if (!dispute) return null;

  const summary = getResponseStatusSummary(dispute);
  const tone = toneClasses[summary.tone] || toneClasses.neutral;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone} ${className}`}
        title={summary.detail}
      >
        {summary.label}
      </span>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone} ${className}`}>
      <p className="text-sm font-semibold">{summary.label}</p>
      {summary.detail ? <p className="mt-1 text-sm opacity-90">{summary.detail}</p> : null}
      {dispute.accused_response_text ? (
        <p className="mt-2 text-sm whitespace-pre-wrap rounded-lg bg-white/60 px-3 py-2">
          <span className="font-semibold">Defense: </span>
          {dispute.accused_response_text}
        </p>
      ) : null}
    </div>
  );
}
