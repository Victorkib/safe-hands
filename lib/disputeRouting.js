/**
 * Dispute routing & decision-support. Suggestions apply only after both sides heard (see disputeResponse.js).
 */

import {
  canApplyAutomatedSuggestion,
  isResponseWindowExpired,
  hasAccusedResponded,
  computeResponseDueAt,
} from '@/lib/disputeResponse';

export function getDisputePriorityAmountKes() {
  const n = Number(process.env.DISPUTE_PRIORITY_AMOUNT_KES);
  return Number.isFinite(n) && n > 0 ? n : 50000;
}

/**
 * @param {Array<{ submission_type?: string; tracking_number?: string|null; courier?: string|null; photos?: string[]|null }>} rows
 */
export function hasSellerDispatchProof(rows) {
  if (!rows?.length) return false;
  return rows.some((row) => {
    if (row.submission_type === 'seller_ship') return true;
    if (row.submission_type !== 'seller_additional') return false;
    const photoCount = Array.isArray(row.photos) ? row.photos.length : 0;
    return photoCount > 0 || Boolean(row.tracking_number) || Boolean(row.courier);
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} transactionId
 */
export async function loadDisputeEvidenceSignals(supabase, transactionId) {
  const { data: sellerRows } = await supabase
    .from('delivery_evidence')
    .select('id, submission_type, tracking_number, courier, photos')
    .eq('transaction_id', transactionId)
    .in('submission_type', ['seller_ship', 'seller_additional']);

  const { data: buyerReceiveRows } = await supabase
    .from('delivery_evidence')
    .select('id')
    .eq('transaction_id', transactionId)
    .eq('submission_type', 'buyer_receive')
    .limit(1);

  return {
    hasSellerShip: hasSellerDispatchProof(sellerRows || []),
    hasBuyerReceive: (buyerReceiveRows?.length || 0) > 0,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   reason: string;
 *   amount: number;
 *   screening: 'cleared'|'held';
 *   transaction_id: string;
 *   evidenceCount: number;
 *   dispute?: { accused_responded_at?: string|null; response_due_at?: string|null; no_response_ruling?: boolean|null }|null;
 *   allowSuggestion?: boolean;
 * }} input
 */
export async function computeDisputeRouting(supabase, input) {
  const {
    reason,
    amount,
    screening,
    transaction_id,
    evidenceCount,
    dispute = null,
    allowSuggestion,
  } = input;

  const { hasSellerShip, hasBuyerReceive } = await loadDisputeEvidenceSignals(
    supabase,
    transaction_id
  );

  const amt = Number(amount) || 0;
  const suggestionsAllowed =
    typeof allowSuggestion === 'boolean'
      ? allowSuggestion
      : !dispute || canApplyAutomatedSuggestion(dispute);

  /** @type {'standard'|'priority'|'triage'|'auto_suggest'} */
  let dispute_queue = 'standard';
  let recommended_resolution = null;
  let recommended_reason = null;

  if (screening === 'held') {
    dispute_queue = 'triage';
  }

  if (['payment_issue', 'other'].includes(reason)) {
    dispute_queue = 'priority';
    recommended_reason = 'Ambiguous reason category — admin review required.';
  } else if (amt >= getDisputePriorityAmountKes()) {
    dispute_queue = dispute_queue === 'triage' ? 'triage' : 'priority';
    recommended_reason =
      recommended_reason || `Amount KES ${amt.toLocaleString()} exceeds priority threshold.`;
  }

  if (suggestionsAllowed) {
    if (reason === 'item_not_received' && !hasSellerShip) {
      dispute_queue = dispute_queue === 'priority' ? 'priority' : 'auto_suggest';
      recommended_resolution = 'refund_buyer';
      recommended_reason =
        'No seller dispatch evidence on file — objective signal favours buyer not-received claim.';
    } else if (reason === 'item_not_received' && hasSellerShip) {
      dispute_queue = dispute_queue === 'triage' ? 'triage' : 'auto_suggest';
      recommended_resolution = 'release_to_seller';
      recommended_reason =
        'Seller provided dispatch/delivery proof — lean toward seller unless buyer evidence shows non-delivery.';
    } else if (
      reason === 'item_not_as_described' &&
      hasSellerShip &&
      hasBuyerReceive &&
      evidenceCount >= 2
    ) {
      dispute_queue = dispute_queue === 'triage' ? 'triage' : 'auto_suggest';
      recommended_resolution = 'release_to_seller';
      recommended_reason =
        'Seller shipped and buyer confirmed delivery with photos — lean toward seller unless description mismatch is clear.';
    }
  } else if (!hasAccusedResponded(dispute) && !isResponseWindowExpired(dispute)) {
    recommended_reason =
      recommended_reason ||
      `Awaiting response from accused party (deadline ${dispute?.response_due_at ? new Date(dispute.response_due_at).toLocaleString() : 'pending'}). System suggestion will update after defense or deadline.`;
  }

  return {
    dispute_queue,
    recommended_resolution,
    recommended_reason,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} disputeId
 * @param {ReturnType<typeof computeDisputeRouting> extends Promise<infer R> ? R : never} routing
 */
export async function applyDisputeRouting(supabase, disputeId, routing) {
  const { error } = await supabase
    .from('disputes')
    .update({
      dispute_queue: routing.dispute_queue,
      recommended_resolution: routing.recommended_resolution,
      recommended_reason: routing.recommended_reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', disputeId);

  if (error && !String(error.message || '').toLowerCase().includes('dispute_queue')) {
    console.warn('[disputeRouting] apply failed:', error.message);
  }
  return { ok: !error || String(error.message || '').toLowerCase().includes('dispute_queue') };
}

/**
 * Recompute routing after accused response or new evidence.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} disputeId
 */
export async function recomputeDisputeRoutingForDispute(supabase, disputeId) {
  const { data: dispute, error } = await supabase
    .from('disputes')
    .select(
      '*, transaction:transactions(id, amount, buyer_id, seller_id)'
    )
    .eq('id', disputeId)
    .single();

  if (error || !dispute) {
    return { ok: false, error: error?.message || 'Dispute not found' };
  }

  if (['resolved', 'closed'].includes(dispute.status)) {
    return { ok: false, error: 'Dispute already closed' };
  }

  const evidenceCount = Array.isArray(dispute.evidence_urls) ? dispute.evidence_urls.length : 0;
  const routing = await computeDisputeRouting(supabase, {
    reason: dispute.reason,
    amount: dispute.transaction?.amount,
    screening: dispute.submission_screening || 'cleared',
    transaction_id: dispute.transaction_id,
    evidenceCount,
    dispute,
  });

  await applyDisputeRouting(supabase, disputeId, routing);
  return { ok: true, routing };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} disputeId
 * @param {{ responseText?: string|null; moveToReview?: boolean }} [opts]
 */
export async function markAccusedResponded(supabase, disputeId, opts = {}) {
  const { responseText = null, moveToReview = true } = opts;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('disputes')
    .select('accused_responded_at, accused_response_text, status')
    .eq('id', disputeId)
    .single();

  if (!existing) return { ok: false, error: 'Dispute not found' };
  if (existing.accused_responded_at) {
    const recompute = await recomputeDisputeRoutingForDispute(supabase, disputeId);
    return { ok: true, alreadyResponded: true, routing: recompute.routing };
  }

  const patch = {
    accused_responded_at: now,
    updated_at: now,
  };

  if (typeof responseText === 'string' && responseText.trim()) {
    patch.accused_response_text = responseText.trim();
  }

  if (moveToReview && ['open', 'awaiting_response'].includes(existing.status)) {
    patch.status = 'in_review';
  }

  const { error: updateError } = await supabase.from('disputes').update(patch).eq('id', disputeId);

  if (updateError) {
    const msg = String(updateError.message || '');
    if (msg.toLowerCase().includes('accused_responded_at')) {
      return { ok: true, skippedColumns: true };
    }
    return { ok: false, error: updateError.message };
  }

  const recompute = await recomputeDisputeRoutingForDispute(supabase, disputeId);
  return { ok: true, routing: recompute.routing };
}

/**
 * Initialize response window on newly created dispute.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} disputeId
 * @param {string} [createdAt]
 */
export async function initializeDisputeResponseWindow(supabase, disputeId, createdAt) {
  const responseDueAt = computeResponseDueAt(createdAt);
  const { error } = await supabase
    .from('disputes')
    .update({
      status: 'awaiting_response',
      response_due_at: responseDueAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', disputeId);

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('response_due_at') || msg.includes('awaiting_response')) {
      return { ok: false, missingMigration: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, response_due_at: responseDueAt };
}

export { computeResponseDueAt };
