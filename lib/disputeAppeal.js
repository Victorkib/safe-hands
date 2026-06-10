/**
 * Post-verdict appeals — one per user per dispute, time-boxed window.
 */

import {
  creditSellerPartialRemainder,
  isRefundDemoMode,
  processDisputeRefund,
  wasTransactionReleasedToSeller,
} from '@/lib/disputeRefund';
import { getResolutionVerdictLabel } from '@/lib/disputeResolutionLabels';
import { sumReservedWithdrawals } from '@/lib/sellerWithdrawal';

export const APPEAL_GROUNDS = ['new_evidence', 'procedural_error', 'factual_error'];
export const APPEAL_OPEN_STATUSES = ['pending', 'in_review'];
export const APPEAL_TERMINAL_STATUSES = ['upheld', 'denied', 'overturned', 'manual_required'];

export const MIN_APPEAL_DESCRIPTION_LEN = 40;

export function getAppealWindowDays() {
  const n = Number(process.env.DISPUTE_APPEAL_WINDOW_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

/** @param {string|Date} resolvedAt */
export function computeAppealDeadline(resolvedAt) {
  const base = new Date(resolvedAt);
  const ms = getAppealWindowDays() * 24 * 60 * 60 * 1000;
  return new Date(base.getTime() + ms).toISOString();
}

/** @param {{ resolved_at?: string|null }} dispute */
export function isAppealWindowOpen(dispute) {
  if (!dispute?.resolved_at) return false;
  const deadline = computeAppealDeadline(dispute.resolved_at);
  return Date.now() < new Date(deadline).getTime();
}

/**
 * Who lost the original verdict (can file appeal).
 * @param {{ resolution?: string|null; raised_by?: string }} dispute
 * @param {{ buyer_id: string; seller_id: string }} transaction
 * @returns {{ userId: string; role: 'buyer'|'seller' }[]}
 */
export function getAppealEligibleLosers(dispute, transaction) {
  if (!dispute?.resolution || !transaction?.buyer_id) return [];

  const resolution = dispute.resolution;
  const losers = [];

  if (resolution === 'refund_buyer') {
    losers.push({ userId: transaction.seller_id, role: 'seller' });
  } else if (resolution === 'release_to_seller') {
    losers.push({ userId: transaction.buyer_id, role: 'buyer' });
  } else if (resolution === 'partial_refund') {
    losers.push({ userId: transaction.buyer_id, role: 'buyer' });
    losers.push({ userId: transaction.seller_id, role: 'seller' });
  }
  return losers;
}

/**
 * @param {string} userId
 * @param {object} dispute
 * @param {object} transaction
 * @param {Array<{ filed_by: string; status: string }>} existingAppeals
 */
export function canUserFileAppeal(userId, dispute, transaction, existingAppeals = []) {
  if (!['resolved', 'closed'].includes(dispute?.status)) {
    return { ok: false, error: 'Appeals are only available after a dispute is resolved.' };
  }
  if (!dispute?.resolution || dispute.resolution === 'cancelled') {
    return { ok: false, error: 'This outcome cannot be appealed.' };
  }
  if (!isAppealWindowOpen(dispute)) {
    return {
      ok: false,
      error: `The ${getAppealWindowDays()}-day appeal window has closed.`,
    };
  }

  const losers = getAppealEligibleLosers(dispute, transaction);
  const isLoser = losers.some((l) => l.userId === userId);
  if (!isLoser) {
    return { ok: false, error: 'Only the party who did not prevail may request a review.' };
  }

  const mine = (existingAppeals || []).find((a) => a.filed_by === userId);
  if (mine) {
    return { ok: false, error: 'You have already submitted a review request for this case.' };
  }

  const openOther = (existingAppeals || []).some((a) =>
    APPEAL_OPEN_STATUSES.includes(a.status)
  );
  if (openOther && !mine) {
    // allow filing even if another party has open appeal (partial_refund)
  }

  return {
    ok: true,
    role: losers.find((l) => l.userId === userId)?.role,
    deadline: computeAppealDeadline(dispute.resolved_at),
  };
}

export function validateAppealDescription(description) {
  const s = String(description || '').trim();
  if (s.length < MIN_APPEAL_DESCRIPTION_LEN) {
    return {
      ok: false,
      error: `Explain your grounds in at least ${MIN_APPEAL_DESCRIPTION_LEN} characters.`,
    };
  }
  if (s.length > 8000) {
    return { ok: false, error: 'Description is too long (max 8000 characters).' };
  }
  return { ok: true };
}

export function getAppealGroundsLabel(grounds) {
  const map = {
    new_evidence: 'New evidence',
    procedural_error: 'Procedural error (e.g. no fair response window)',
    factual_error: 'Factual / evidence error in the verdict',
  };
  return map[grounds] || grounds;
}

export function getAppealStatusLabel(status) {
  const map = {
    pending: 'Awaiting admin review',
    in_review: 'Under review',
    upheld: 'Original verdict upheld',
    denied: 'Request denied',
    overturned: 'Verdict overturned',
    manual_required: 'Overturn — manual funds steps required',
  };
  return map[status] || status;
}

/**
 * Flip resolution for appellant who lost.
 * @param {string} originalResolution
 * @param {'buyer'|'seller'} appellantRole
 */
export function suggestOverturnResolution(originalResolution, appellantRole) {
  if (originalResolution === 'refund_buyer' && appellantRole === 'seller') {
    return 'release_to_seller';
  }
  if (originalResolution === 'release_to_seller' && appellantRole === 'buyer') {
    return 'refund_buyer';
  }
  if (originalResolution === 'partial_refund') {
    return appellantRole === 'buyer' ? 'refund_buyer' : 'release_to_seller';
  }
  return null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} dispute
 * @param {object} transaction
 * @param {string} newResolution
 */
export async function assessAppealReversalSafety(supabase, dispute, transaction, newResolution) {
  const amount = Number(transaction.amount) || 0;
  const original = dispute.resolution;
  /** @type {string[]} */
  const checklist = [];
  let canAutoReverse = true;

  if (original === newResolution) {
    return {
      canAutoReverse: false,
      mode: 'manual_required',
      checklist: ['New resolution matches original — no reversal needed.'],
    };
  }

  if (original === 'partial_refund' || newResolution === 'partial_refund') {
    checklist.push('Partial refund overturns require manual wallet and M-Pesa reconciliation.');
    return { canAutoReverse: false, mode: 'manual_required', checklist };
  }

  if (original === 'release_to_seller' && newResolution === 'refund_buyer') {
    const settled = await wasTransactionReleasedToSeller(supabase, transaction.id);
    if (!settled) {
      checklist.push('No seller settlement on file — update transaction to refunded and issue refund.');
      return { canAutoReverse: true, mode: 'auto', checklist };
    }

    const { data: seller } = await supabase
      .from('users')
      .select('account_balance')
      .eq('id', transaction.seller_id)
      .single();

    const balance = Number(seller?.account_balance) || 0;
    const reserved = await sumReservedWithdrawals(supabase, transaction.seller_id);

    if (balance - reserved < amount) {
      canAutoReverse = false;
      checklist.push(
        `Seller wallet available KES ${(balance - reserved).toLocaleString()} is less than KES ${amount.toLocaleString()} — clawback may be incomplete.`
      );
    }

    const { data: settlement } = await supabase
      .from('transaction_release_settlements')
      .select('settled_at')
      .eq('transaction_id', transaction.id)
      .maybeSingle();

    if (settlement?.settled_at) {
      const { data: withdrawals } = await supabase
        .from('withdrawal_requests')
        .select('id, amount, status, completed_at')
        .eq('seller_id', transaction.seller_id)
        .eq('status', 'completed')
        .gte('completed_at', settlement.settled_at);

      if ((withdrawals?.length || 0) > 0) {
        canAutoReverse = false;
        checklist.push(
          'Seller completed an M-Pesa withdrawal after release — manual recovery from Safaricom or seller contact required.'
        );
      }
    }

    if (canAutoReverse) {
      checklist.push('Debit seller wallet and process buyer M-Pesa refund.');
    }
  }

  if (original === 'refund_buyer' && newResolution === 'release_to_seller') {
    const { data: refund } = await supabase
      .from('refund_requests')
      .select('id, status, simulated, amount')
      .eq('dispute_id', dispute.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!refund) {
      checklist.push('No refund row found — release funds to seller wallet.');
      return { canAutoReverse: true, mode: 'auto', checklist };
    }

    if (refund.status === 'pending' || refund.status === 'processing') {
      checklist.push('Cancel pending refund and credit seller wallet.');
      return { canAutoReverse: true, mode: 'auto', checklist };
    }

    if (refund.status === 'completed') {
      canAutoReverse = false;
      checklist.push(
        refund.simulated
          ? 'Demo refund already marked completed — manually reverse demo balances and re-settle seller.'
          : 'Buyer refund already sent to M-Pesa — manual reversal with Safaricom required before seller release.'
      );
    }
  }

  return {
    canAutoReverse,
    mode: canAutoReverse ? 'auto' : 'manual_required',
    checklist,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} params
 */
export async function applyAppealAutoReversal(supabase, params) {
  const { dispute, transaction, newResolution, appealId, adminUserId, adminNotes } = params;
  const amount = Number(transaction.amount) || 0;
  const original = dispute.resolution;

  if (original === 'release_to_seller' && newResolution === 'refund_buyer') {
    const settled = await wasTransactionReleasedToSeller(supabase, transaction.id);
    if (settled) {
      const { data: seller } = await supabase
        .from('users')
        .select('account_balance')
        .eq('id', transaction.seller_id)
        .single();
      const bal = Number(seller?.account_balance) || 0;
      if (bal < amount) {
        return { ok: false, error: 'Insufficient seller balance for automatic clawback.' };
      }
      await supabase
        .from('users')
        .update({
          account_balance: bal - amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.seller_id);

      await supabase.from('wallet_ledger_entries').insert({
        user_id: transaction.seller_id,
        transaction_id: transaction.id,
        entry_type: 'adjustment',
        amount,
        currency: 'KES',
        description: `Appeal overturn clawback — dispute ${dispute.id.slice(0, 8)}`,
        metadata: { appeal_id: appealId, direction: 'debit', dispute_id: dispute.id },
      });
    }

    const refundResult = await processDisputeRefund(supabase, {
      disputeId: dispute.id,
      transactionId: transaction.id,
      buyerId: transaction.buyer_id,
      amount,
    });
    if (!refundResult.ok && refundResult.code !== 'REFUND_REQUIRES_MANUAL') {
      return { ok: false, error: refundResult.error || 'Refund failed during appeal overturn' };
    }

    await supabase
      .from('transactions')
      .update({
        status: 'refunded',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);
  }

  if (original === 'refund_buyer' && newResolution === 'release_to_seller') {
    const { data: refund } = await supabase
      .from('refund_requests')
      .select('id, status')
      .eq('dispute_id', dispute.id)
      .in('status', ['pending', 'processing'])
      .maybeSingle();

    if (refund?.id) {
      await supabase
        .from('refund_requests')
        .update({
          status: 'failed',
          result_desc: 'Cancelled — appeal overturned in favour of seller release',
          updated_at: new Date().toISOString(),
        })
        .eq('id', refund.id);
    }

    await supabase
      .from('transactions')
      .update({
        status: 'released',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);
  }

  await supabase.from('transaction_history').insert({
    transaction_id: transaction.id,
    old_status: transaction.status,
    new_status: newResolution === 'refund_buyer' ? 'refunded' : 'released',
    changed_by: adminUserId,
    reason: `Appeal overturn: ${getResolutionVerdictLabel(newResolution)}. ${adminNotes}`,
  });

  return { ok: true, demo: isRefundDemoMode() };
}

export function buildManualReversalChecklistText(checklist) {
  return (checklist || [])
    .map((line, i) => `${i + 1}. ${line}`)
    .join('\n');
}
