/**
 * Dispute response window — accused party must be heard before automated suggestions apply.
 */

export function getDisputeResponseWindowHours() {
  const n = Number(process.env.DISPUTE_RESPONSE_WINDOW_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 72;
}

/** @param {Date|string} [from] */
export function computeResponseDueAt(from) {
  const base = from ? new Date(from) : new Date();
  const ms = getDisputeResponseWindowHours() * 60 * 60 * 1000;
  return new Date(base.getTime() + ms).toISOString();
}

/**
 * @param {{ accused_responded_at?: string|null }} dispute
 */
export function hasAccusedResponded(dispute) {
  return Boolean(dispute?.accused_responded_at);
}

/**
 * @param {{ response_due_at?: string|null }} dispute
 */
export function isResponseWindowExpired(dispute) {
  if (!dispute?.response_due_at) return false;
  return Date.now() >= new Date(dispute.response_due_at).getTime();
}

/**
 * Both sides heard OR deadline passed OR admin marked no-response.
 * @param {{ accused_responded_at?: string|null; response_due_at?: string|null; no_response_ruling?: boolean|null }} dispute
 */
export function canApplyAutomatedSuggestion(dispute) {
  if (Boolean(dispute?.no_response_ruling)) return true;
  if (hasAccusedResponded(dispute)) return true;
  return isResponseWindowExpired(dispute);
}

/**
 * @param {{ raised_by?: string; raised_against?: string; accused_responded_at?: string|null; response_due_at?: string|null; no_response_ruling?: boolean|null; status?: string }} dispute
 */
export function getResponseStatusSummary(dispute) {
  if (hasAccusedResponded(dispute)) {
    return {
      key: 'responded',
      label: 'Accused responded',
      tone: 'success',
      detail: dispute.accused_responded_at
        ? `Defense received ${new Date(dispute.accused_responded_at).toLocaleString()}`
        : 'Defense on file',
    };
  }
  if (Boolean(dispute?.no_response_ruling)) {
    return {
      key: 'no_response',
      label: 'No response — accuser favored',
      tone: 'warning',
      detail: 'Admin confirmed the accused did not respond in time.',
    };
  }
  if (isResponseWindowExpired(dispute)) {
    return {
      key: 'expired',
      label: 'Response window expired',
      tone: 'warning',
      detail: dispute.response_due_at
        ? `Deadline was ${new Date(dispute.response_due_at).toLocaleString()}`
        : 'Waiting period ended',
    };
  }
  if (dispute?.status === 'awaiting_response' || !hasAccusedResponded(dispute)) {
    return {
      key: 'waiting',
      label: 'Awaiting accused response',
      tone: 'pending',
      detail: dispute.response_due_at
        ? `Respond by ${new Date(dispute.response_due_at).toLocaleString()}`
        : `Respond within ${getDisputeResponseWindowHours()} hours`,
    };
  }
  return {
    key: 'unknown',
    label: 'Response status unknown',
    tone: 'neutral',
    detail: '',
  };
}

/**
 * Verdict favoring whoever filed the dispute (raised_by).
 * @param {{ raised_by: string }} dispute
 * @param {{ buyer_id: string; seller_id: string }} transaction
 */
export function getResolutionFavoringAccuser(dispute, transaction) {
  if (!dispute?.raised_by || !transaction?.buyer_id) return 'refund_buyer';
  return dispute.raised_by === transaction.buyer_id ? 'refund_buyer' : 'release_to_seller';
}

/**
 * @param {{ raised_by?: string; raised_against?: string }} dispute
 * @param {string} userId
 */
export function isAccusedParty(dispute, userId) {
  return Boolean(dispute?.raised_against && userId && dispute.raised_against === userId);
}

/**
 * @param {{ raised_by?: string }} dispute
 * @param {string} userId
 */
export function isAccuserParty(dispute, userId) {
  return Boolean(dispute?.raised_by && userId && dispute.raised_by === userId);
}

/**
 * @param {{ status?: string }} dispute
 */
export function isDisputeAwaitingDefense(dispute) {
  if (!dispute) return false;
  if (['resolved', 'closed'].includes(dispute.status)) return false;
  return !hasAccusedResponded(dispute);
}

export function buildNoResponseAdminNotes(dispute, transaction) {
  const accuserSide =
    dispute.raised_by === transaction?.buyer_id ? 'buyer (claimant)' : 'seller (claimant)';
  const verdict = getResolutionFavoringAccuser(dispute, transaction);
  const verdictLabel =
    verdict === 'refund_buyer' ? 'refund to buyer' : 'release to seller';
  const deadline = dispute.response_due_at
    ? new Date(dispute.response_due_at).toLocaleString()
    : 'the response deadline';
  return (
    `No-response ruling: the accused party did not submit a defense before ${deadline}. ` +
    `Verdict favors the ${accuserSide} — ${verdictLabel}. Admin confirmed no meaningful response was received.`
  );
}

export function getAutomatedSuggestionBlockReason(dispute) {
  if (canApplyAutomatedSuggestion(dispute)) return '';
  const summary = getResponseStatusSummary(dispute);
  return `Waiting for accused response — ${summary.detail || summary.label}. Bulk/quick apply blocked until they respond or the window expires.`;
}
