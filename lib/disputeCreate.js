export const MIN_DESCRIPTION_LEN = 40;
export const MAX_DESCRIPTION_LEN = 8000;

/**
 * @param {string} description
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateDisputeDescription(description) {
  const s = typeof description === 'string' ? description.trim() : '';
  if (s.length < MIN_DESCRIPTION_LEN) {
    return {
      ok: false,
      error: `Description must be at least ${MIN_DESCRIPTION_LEN} characters so admins have enough context.`,
    };
  }
  if (s.length > MAX_DESCRIPTION_LEN) {
    return {
      ok: false,
      error: `Description must be at most ${MAX_DESCRIPTION_LEN} characters.`,
    };
  }
  return { ok: true };
}

/**
 * Try RPC first; on failure fall back to sequential writes (same result, weaker atomicity).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase service-role client
 * @param {{
 *   transaction_id: string;
 *   raised_by: string;
 *   raised_against: string;
 *   reason: string;
 *   description: string;
 *   evidence_urls: string[];
 *   dispute_evidence_notes: string;
 *   submission_type: 'buyer_additional' | 'seller_additional';
 *   old_tx_status: string;
 *   screening?: 'cleared' | 'held';
 * }} payload
 * @returns {Promise<{ disputeId: string, usedRpc: boolean, error?: string }>}
 */
export async function createDisputeWithRpcOrFallback(supabase, payload) {
  const screening = payload.screening === 'held' ? 'held' : 'cleared';

  const { data: rpcId, error: rpcError } = await supabase.rpc('create_dispute_atomic', {
    p_transaction_id: payload.transaction_id,
    p_raised_by: payload.raised_by,
    p_raised_against: payload.raised_against,
    p_reason: payload.reason,
    p_description: payload.description,
    p_evidence_urls: payload.evidence_urls,
    p_dispute_evidence_notes: payload.dispute_evidence_notes,
    p_submission_type: payload.submission_type,
    p_old_tx_status: payload.old_tx_status,
    p_screening: screening,
  });

  if (!rpcError && rpcId) {
    return { disputeId: rpcId, usedRpc: true, error: null };
  }

  if (rpcError) {
    console.warn('[disputes] create_dispute_atomic RPC unavailable, using fallback:', rpcError.message || rpcError);
  }

  const baseRow = {
    transaction_id: payload.transaction_id,
    raised_by: payload.raised_by,
    raised_against: payload.raised_against,
    reason: payload.reason,
    description: payload.description,
    evidence_urls: payload.evidence_urls,
    status: 'open',
  };

  let dispute;
  let disputeError;
  let first = await supabase
    .from('disputes')
    .insert({ ...baseRow, submission_screening: screening })
    .select('id')
    .single();
  dispute = first.data;
  disputeError = first.error;

  if (
    disputeError &&
    String(disputeError.message || '').toLowerCase().includes('submission_screening')
  ) {
    const second = await supabase.from('disputes').insert(baseRow).select('id').single();
    dispute = second.data;
    disputeError = second.error;
  }

  if (disputeError || !dispute) {
    return {
      disputeId: null,
      usedRpc: false,
      error: disputeError?.message || 'Failed to create dispute',
    };
  }

  const { error: evErr } = await supabase.from('delivery_evidence').insert({
    transaction_id: payload.transaction_id,
    submitted_by: payload.raised_by,
    submission_type: payload.submission_type,
    notes: payload.dispute_evidence_notes,
    photos: payload.evidence_urls,
  });
  if (evErr) {
    return { disputeId: null, usedRpc: false, error: evErr.message || 'Failed to save evidence' };
  }

  const { error: txErr } = await supabase
    .from('transactions')
    .update({
      is_disputed: true,
      status: 'disputed',
    })
    .eq('id', payload.transaction_id);
  if (txErr) {
    return { disputeId: null, usedRpc: false, error: txErr.message || 'Failed to update transaction' };
  }

  const { error: histErr } = await supabase.from('transaction_history').insert({
    transaction_id: payload.transaction_id,
    old_status: payload.old_tx_status,
    new_status: 'disputed',
    changed_by: payload.raised_by,
    reason: `Dispute raised: ${payload.reason}`,
  });
  if (histErr) {
    return { disputeId: null, usedRpc: false, error: histErr.message || 'Failed to write history' };
  }

  return { disputeId: dispute.id, usedRpc: false, error: null };
}
