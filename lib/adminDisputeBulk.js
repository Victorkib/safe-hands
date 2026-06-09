import { getResolutionVerdictLabel, getDisputeQueueLabel } from '@/lib/disputeResolutionLabels';

/** Dispute statuses that can still be resolved by an admin */
export const DISPUTE_OPEN_STATUSES = ['open', 'in_review', 'awaiting_response'];

const VALID_SUGGESTED_RESOLUTIONS = [
  'refund_buyer',
  'release_to_seller',
  'partial_refund',
  'cancelled',
];

/** Phase 3: bulk resolve on by default (demos); set NEXT_PUBLIC_DISPUTE_BULK_RESOLVE_ENABLED=false to disable */
export function isBulkResolveFeatureEnabled() {
  const v = process.env.NEXT_PUBLIC_DISPUTE_BULK_RESOLVE_ENABLED;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return true;
}

/**
 * @param {{ status?: string; recommended_resolution?: string|null }} dispute
 */
export function isEligibleForSuggestionResolve(dispute) {
  if (!dispute?.recommended_resolution) return false;
  if (!DISPUTE_OPEN_STATUSES.includes(dispute.status)) return false;
  return VALID_SUGGESTED_RESOLUTIONS.includes(dispute.recommended_resolution);
}

/**
 * Phase 3: stricter rules for bulk — excludes priority/triage routes and thin evidence filing.
 * @param {{ status?: string; recommended_resolution?: string|null; dispute_queue?: string|null; submission_screening?: string|null }} dispute
 */
export function isEligibleForBulkSuggestionResolve(dispute) {
  if (!isEligibleForSuggestionResolve(dispute)) return false;

  const queue = dispute.dispute_queue || 'standard';
  if (queue === 'priority' || queue === 'triage') return false;

  if ((dispute.submission_screening || 'cleared') === 'held') return false;

  return true;
}

/**
 * Human-readable reason when bulk is not allowed (for UI + CSV).
 * @param {object} dispute
 */
export function getBulkIneligibleReason(dispute) {
  if (!dispute?.recommended_resolution) return 'No system suggestion';
  if (!DISPUTE_OPEN_STATUSES.includes(dispute.status)) return 'Dispute is not open for resolution';
  if (!VALID_SUGGESTED_RESOLUTIONS.includes(dispute.recommended_resolution)) {
    return 'Invalid suggested resolution';
  }

  const queue = dispute.dispute_queue || 'standard';
  if (queue === 'priority') return 'Priority queue — requires manual review before bulk';
  if (queue === 'triage') return 'Triage queue — requires manual review before bulk';
  if ((dispute.submission_screening || 'cleared') === 'held') {
    return 'Thin evidence filing — requires manual review before bulk';
  }

  return '';
}

/**
 * @param {Array<{ status?: string; recommended_resolution?: string|null }>} disputes
 */
export function filterEligibleForSuggestionResolve(disputes) {
  return (disputes || []).filter(isEligibleForSuggestionResolve);
}

/**
 * @param {Array<object>} disputes
 */
export function filterEligibleForBulkSuggestionResolve(disputes) {
  return (disputes || []).filter(isEligibleForBulkSuggestionResolve);
}

/**
 * @param {{ recommended_reason?: string|null }} dispute
 * @param {'bulk'|'quick'} mode
 */
export function buildSuggestionAdminNotes(dispute, mode = 'bulk') {
  const prefix =
    mode === 'bulk'
      ? 'Bulk-applied system suggestion (admin confirmed).'
      : 'Quick-applied system suggestion (admin confirmed).';
  const reason = (dispute.recommended_reason || 'System routing recommendation.').trim();
  return `${prefix} ${reason}`;
}

/**
 * Resolve one dispute using its stored system suggestion.
 * @param {string} accessToken
 * @param {{ id: string; recommended_resolution: string; recommended_reason?: string|null }} dispute
 * @param {'bulk'|'quick'} mode
 */
export async function resolveDisputeWithSuggestion(accessToken, dispute, mode = 'quick') {
  const admin_notes = buildSuggestionAdminNotes(dispute, mode);
  const response = await fetch(`/api/admin/disputes/${dispute.id}/resolve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resolution: dispute.recommended_resolution,
      admin_notes,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to resolve dispute');
  }
  return result;
}

/**
 * Resolve disputes sequentially (safe for refunds, email, and logging).
 * @param {string} accessToken
 * @param {Array<{ id: string; recommended_resolution: string; recommended_reason?: string|null }>} disputes
 * @param {(progress: { index: number; total: number; dispute: object; ok: boolean; error?: string }) => void} [onProgress]
 */
export async function resolveDisputesWithSuggestionsSequential(accessToken, disputes, onProgress) {
  const total = disputes.length;
  /** @type {Array<{ disputeId: string; ok: boolean; error?: string; verdict_label?: string }>} */
  const results = [];

  for (let index = 0; index < total; index += 1) {
    const dispute = disputes[index];
    try {
      const result = await resolveDisputeWithSuggestion(accessToken, dispute, 'bulk');
      const row = {
        disputeId: dispute.id,
        ok: true,
        verdict_label: result.verdict_label,
      };
      results.push(row);
      onProgress?.({ index: index + 1, total, dispute, ok: true });
    } catch (err) {
      const row = {
        disputeId: dispute.id,
        ok: false,
        error: err?.message || 'Resolve failed',
      };
      results.push(row);
      onProgress?.({
        index: index + 1,
        total,
        dispute,
        ok: false,
        error: row.error,
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return { results, succeeded, failed, total };
}

function escapeCsvCell(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Phase 2: export dispute suggestion summary for client / admin reporting.
 * @param {Array<object>} disputes
 * @param {string} [filename]
 */
export function downloadSuggestionSummaryCsv(disputes, filename) {
  const list = disputes || [];
  const stamp = new Date().toISOString().slice(0, 10);
  const name = filename || `safe-hands-dispute-suggestions-${stamp}.csv`;

  const headers = [
    'dispute_id',
    'status',
    'amount_kes',
    'buyer_name',
    'buyer_email',
    'seller_name',
    'seller_email',
    'routing_queue',
    'evidence_filing',
    'dispute_reason',
    'suggested_verdict',
    'suggestion_reason',
    'bulk_eligible',
    'bulk_ineligible_reason',
    'filed_at',
  ];

  const rows = list.map((d) => {
    const bulkOk = isEligibleForBulkSuggestionResolve(d);
    return [
      d.id,
      d.status,
      d.transaction?.amount ?? '',
      d.transaction?.buyer?.full_name ?? '',
      d.transaction?.buyer?.email ?? '',
      d.transaction?.seller?.full_name ?? '',
      d.transaction?.seller?.email ?? '',
      getDisputeQueueLabel(d.dispute_queue || 'standard'),
      d.submission_screening || 'cleared',
      d.reason ?? '',
      d.recommended_resolution ? getResolutionVerdictLabel(d.recommended_resolution) : '',
      d.recommended_reason ?? '',
      bulkOk ? 'yes' : 'no',
      bulkOk ? '' : getBulkIneligibleReason(d),
      d.created_at ? new Date(d.created_at).toISOString() : '',
    ];
  });

  const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
