import {
  applyAppealAutoReversal,
  assessAppealReversalSafety,
  buildManualReversalChecklistText,
  getAppealStatusLabel,
} from '@/lib/disputeAppeal';
import { getResolutionVerdictLabel } from '@/lib/disputeResolutionLabels';

const VALID_OVERTURN = ['refund_buyer', 'release_to_seller', 'partial_refund', 'cancelled'];

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   appealId: string;
 *   adminUserId: string;
 *   decision: 'uphold' | 'deny' | 'overturn';
 *   overturn_resolution?: string;
 *   admin_notes: string;
 * }} input
 */
export async function decideDisputeAppeal(supabase, input) {
  const { appealId, adminUserId, decision, admin_notes: notesRaw } = input;
  const admin_notes = String(notesRaw || '').trim();

  if (!['uphold', 'deny', 'overturn'].includes(decision)) {
    return { ok: false, status: 400, error: 'decision must be uphold, deny, or overturn' };
  }
  if (admin_notes.length < 10) {
    return { ok: false, status: 400, error: 'Admin notes required (min 10 characters).' };
  }

  const { data: appeal, error: aErr } = await supabase
    .from('dispute_appeals')
    .select('*')
    .eq('id', appealId)
    .single();

  if (aErr || !appeal) {
    return { ok: false, status: 404, error: 'Appeal not found' };
  }

  if (!['pending', 'in_review'].includes(appeal.status)) {
    return { ok: false, status: 400, error: 'This appeal has already been decided.' };
  }

  const { data: dispute, error: dErr } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', appeal.dispute_id)
    .single();

  if (dErr || !dispute) {
    return { ok: false, status: 404, error: 'Linked dispute not found' };
  }

  const { data: transaction, error: tErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', appeal.transaction_id)
    .single();

  if (tErr || !transaction) {
    return { ok: false, status: 500, error: 'Linked transaction missing' };
  }

  const now = new Date().toISOString();

  if (decision === 'uphold') {
    await supabase
      .from('dispute_appeals')
      .update({
        status: 'upheld',
        admin_notes,
        decided_by: adminUserId,
        decided_at: now,
        reversal_mode: 'not_applicable',
        updated_at: now,
      })
      .eq('id', appealId);

    await notifyAppealParties(supabase, appeal, transaction, {
      title: 'Appeal review complete',
      message: `Your review request was considered. The original verdict stands: ${getResolutionVerdictLabel(dispute.resolution)}.`,
    });

    return { ok: true, status: 'upheld' };
  }

  if (decision === 'deny') {
    await supabase
      .from('dispute_appeals')
      .update({
        status: 'denied',
        admin_notes,
        decided_by: adminUserId,
        decided_at: now,
        reversal_mode: 'not_applicable',
        updated_at: now,
      })
      .eq('id', appealId);

    await notifyAppealParties(supabase, appeal, transaction, {
      title: 'Appeal request denied',
      message: `Your review request was denied. See admin notes on the case for details.`,
    });

    return { ok: true, status: 'denied' };
  }

  const newResolution = input.overturn_resolution;
  if (!newResolution || !VALID_OVERTURN.includes(newResolution)) {
    return {
      ok: false,
      status: 400,
      error: 'overturn_resolution required for overturn (refund_buyer, release_to_seller, etc.)',
    };
  }

  const safety = await assessAppealReversalSafety(supabase, dispute, transaction, newResolution);
  const checklistText = buildManualReversalChecklistText(safety.checklist);

  let reversal_mode = safety.canAutoReverse ? 'auto_applied' : 'manual_required';
  let finalStatus = safety.canAutoReverse ? 'overturned' : 'manual_required';
  let reversal_notes = checklistText;

  if (safety.canAutoReverse) {
    const reversal = await applyAppealAutoReversal(supabase, {
      dispute,
      transaction,
      newResolution,
      appealId,
      adminUserId,
      adminNotes: admin_notes,
    });
    if (!reversal.ok) {
      reversal_mode = 'manual_required';
      finalStatus = 'manual_required';
      reversal_notes = `${checklistText}\n\nAuto-reversal failed: ${reversal.error}`;
    }
  }

  const disputePatch = {
    resolution: newResolution,
    admin_notes: `${dispute.admin_notes || ''}\n\n[Appeal overturn ${now}] ${admin_notes}`.trim(),
    updated_at: now,
  };

  await supabase.from('disputes').update(disputePatch).eq('id', dispute.id);

  await supabase
    .from('dispute_appeals')
    .update({
      status: finalStatus,
      overturn_resolution: newResolution,
      reversal_mode,
      reversal_notes,
      admin_notes,
      decided_by: adminUserId,
      decided_at: now,
      updated_at: now,
    })
    .eq('id', appealId);

  const outcomeLabel = getResolutionVerdictLabel(newResolution);
  await notifyAppealParties(supabase, appeal, transaction, {
    title:
      finalStatus === 'overturned'
        ? 'Appeal granted — verdict overturned'
        : 'Appeal granted — manual fund steps required',
    message:
      finalStatus === 'overturned'
        ? `New verdict: ${outcomeLabel}. Fund adjustments were applied automatically where possible.`
        : `New verdict: ${outcomeLabel}. Our team must complete manual fund steps — see case notes.`,
  });

  return {
    ok: true,
    status: finalStatus,
    overturn_resolution: newResolution,
    reversal_mode,
    reversal_notes,
    checklist: safety.checklist,
  };
}

async function notifyAppealParties(supabase, appeal, transaction, payload) {
  const otherParty =
    appeal.filed_by === transaction.buyer_id ? transaction.seller_id : transaction.buyer_id;

  await supabase.from('notifications').insert([
    {
      user_id: appeal.filed_by,
      title: payload.title,
      message: payload.message,
      type: 'dispute_appeal_decided',
      related_transaction_id: transaction.id,
    },
    {
      user_id: otherParty,
      title: 'Dispute appeal decided',
      message: `A review request on your transaction was decided. ${payload.message}`,
      type: 'dispute_appeal_decided',
      related_transaction_id: transaction.id,
    },
  ]);
}
