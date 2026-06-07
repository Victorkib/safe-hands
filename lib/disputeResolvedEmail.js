/**
 * Dispute resolution emails — tailored for buyer and seller (winner/loser copy).
 */

import { sendEmail } from '@/lib/emailService';
import {
  getFundMovementSummary,
  getPartyOutcomeMessage,
  getResolutionVerdictLabel,
} from '@/lib/disputeResolutionLabels';

/** @param {unknown} value */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatKes(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'KES 0';
  return `KES ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * @param {'buyer'|'seller'} party
 * @param {string} resolution
 */
function getEmailSubject(party, resolution) {
  const verdict = getResolutionVerdictLabel(resolution);
  if (resolution === 'refund_buyer') {
    return party === 'buyer'
      ? 'Your dispute was resolved in your favour — full refund'
      : `Dispute resolved — ${verdict}`;
  }
  if (resolution === 'release_to_seller') {
    return party === 'seller'
      ? 'Your dispute was resolved in your favour — funds released'
      : `Dispute resolved — ${verdict}`;
  }
  if (resolution === 'partial_refund') {
    return `Dispute resolved — split decision (${party === 'buyer' ? 'partial refund to you' : 'partial credit to your wallet'})`;
  }
  if (resolution === 'cancelled') {
    return 'Dispute closed — Safe Hands Escrow';
  }
  return 'Dispute resolved — Safe Hands Escrow';
}

/**
 * Professional opening line per party and outcome.
 * @param {'buyer'|'seller'} party
 * @param {string} resolution
 */
function getProfessionalIntro(party, resolution) {
  if (resolution === 'refund_buyer') {
    return party === 'buyer'
      ? 'Thank you for your patience while we reviewed this dispute. Our team has completed its review and ruled in your favour.'
      : 'Thank you for participating in the dispute process. After reviewing all evidence and submissions, our team has issued a final decision in the buyer\'s favour.';
  }
  if (resolution === 'release_to_seller') {
    return party === 'seller'
      ? 'Thank you for your patience while we reviewed this dispute. Our team has completed its review and ruled in your favour.'
      : 'Thank you for your patience while we reviewed this dispute. After evaluating the evidence, our team has upheld the seller\'s position in this transaction.';
  }
  if (resolution === 'partial_refund') {
    return party === 'buyer'
      ? 'Thank you for your patience. Our team has reached a split decision that reflects shared responsibility in this transaction.'
      : 'Thank you for your patience. Our team has reached a split decision that reflects shared responsibility in this transaction.';
  }
  if (resolution === 'cancelled') {
    return 'Our team has closed this dispute without changing escrow payout automatically. Please review the admin notes below for next steps, if any.';
  }
  return 'Your dispute has been resolved. Please review the details below.';
}

/**
 * @param {{
 *   recipientName: string;
 *   party: 'buyer'|'seller';
 *   resolution: string;
 *   amount: number;
 *   adminNotes: string;
 *   transaction: { id: string; description?: string; amount?: number };
 *   refundResult?: { mpesa_transaction_id?: string|null; refund_id?: string|null; partial?: boolean }|null;
 *   refundPhone?: string|null;
 *   demoMode?: boolean;
 * }} params
 */
export function buildDisputeResolvedEmailHtml(params) {
  const {
    recipientName,
    party,
    resolution,
    amount,
    adminNotes,
    transaction,
    refundResult,
    refundPhone,
    demoMode = false,
  } = params;

  const baseUrl = appBaseUrl();
  const txnId = transaction?.id || '';
  const txnUrl = `${baseUrl}/dashboard/transactions/${txnId}`;
  const paymentsUrl = refundResult?.refund_id
    ? `${baseUrl}/dashboard/buyer/payments?highlight=${refundResult.refund_id}&tab=refunds`
    : `${baseUrl}/dashboard/buyer/payments?tab=refunds`;
  const walletUrl = `${baseUrl}/dashboard/seller/wallet`;

  const verdict = getResolutionVerdictLabel(resolution);
  const outcomeLine = getPartyOutcomeMessage(resolution, party, amount);
  const fundMovement = getFundMovementSummary(resolution, amount, { simulated: demoMode });
  const half = Math.floor(Number(amount) / 2);
  const sellerShare = Number(amount) - half;

  const showBuyerRefund =
    party === 'buyer' && (resolution === 'refund_buyer' || resolution === 'partial_refund');
  const showSellerWallet =
    party === 'seller' && (resolution === 'release_to_seller' || resolution === 'partial_refund');

  const refundAmount =
    resolution === 'partial_refund' ? half : Number(amount);

  let refundBlock = '';
  if (showBuyerRefund) {
    refundBlock = `
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.04em;">Your refund</p>
        <p style="margin:0 0 6px;color:#064e3b;"><strong>Amount:</strong> ${escapeHtml(formatKes(refundAmount))}</p>
        ${refundPhone ? `<p style="margin:0 0 6px;color:#064e3b;"><strong>M-Pesa phone:</strong> ${escapeHtml(refundPhone)}</p>` : ''}
        ${
          refundResult?.mpesa_transaction_id
            ? `<p style="margin:0 0 6px;color:#064e3b;"><strong>Receipt reference:</strong> <span style="font-family:monospace;">${escapeHtml(refundResult.mpesa_transaction_id)}</span></p>`
            : ''
        }
        <a href="${escapeHtml(paymentsUrl)}" style="display:inline-block;margin-top:12px;background:#059669;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">View refund in Payments</a>
      </div>`;
  }

  let walletBlock = '';
  if (showSellerWallet) {
    const walletAmount = resolution === 'partial_refund' ? sellerShare : Number(amount);
    walletBlock = `
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.04em;">Your earnings</p>
        <p style="margin:0 0 6px;color:#064e3b;"><strong>Amount credited to wallet:</strong> ${escapeHtml(formatKes(walletAmount))}</p>
        <a href="${escapeHtml(walletUrl)}" style="display:inline-block;margin-top:12px;background:#059669;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">View seller wallet</a>
      </div>`;
  }

  const demoNote = demoMode
    ? `<p style="font-size:11px;color:#94a3b8;margin-top:28px;line-height:1.5;">Presentation note: fund movements in this environment may be simulated for demo purposes and do not represent a live M-Pesa transfer.</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;margin:0;padding:0;background:#f1f5f9;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(135deg,#4338ca 0%,#2563eb 100%);color:#fff;padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">Safe Hands Escrow</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;">Dispute resolution</h1>
    </div>
    <div style="background:#fff;padding:28px 24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
      <p style="margin:0 0 16px;">Dear ${escapeHtml(recipientName || 'Customer')},</p>
      <p style="margin:0 0 20px;color:#334155;">${escapeHtml(getProfessionalIntro(party, resolution))}</p>

      <div style="background:#f8fafc;border-left:4px solid #6366f1;padding:16px 18px;margin:0 0 20px;border-radius:0 8px 8px 0;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.05em;">Decision</p>
        <p style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(verdict)}</p>
        <p style="margin:0;color:#475569;">${escapeHtml(outcomeLine)}</p>
      </div>

      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;">Fund movement</p>
        <p style="margin:0;color:#334155;">${escapeHtml(fundMovement)}</p>
        ${
          transaction?.description
            ? `<p style="margin:12px 0 0;color:#64748b;font-size:14px;"><strong>Transaction:</strong> ${escapeHtml(transaction.description)} · ${escapeHtml(formatKes(transaction.amount))}</p>`
            : ''
        }
      </div>

      ${refundBlock}
      ${walletBlock}

      <div style="background:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 24px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;">Admin reasoning</p>
        <p style="margin:0;color:#334155;white-space:pre-wrap;">${escapeHtml(adminNotes)}</p>
      </div>

      <a href="${escapeHtml(txnUrl)}" style="display:inline-block;background:#4338ca;color:#fff;padding:12px 22px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View transaction</a>

      <p style="margin:24px 0 0;color:#64748b;font-size:14px;">If you have questions about this decision, reply to this email or contact our support team through your dashboard.</p>
      <p style="margin:16px 0 0;color:#334155;">Kind regards,<br><strong>Safe Hands Escrow — Dispute Resolution Team</strong></p>
      ${demoNote}
    </div>
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:20px;">&copy; ${new Date().getFullYear()} Safe Hands Escrow. Transaction ID: ${escapeHtml(txnId.slice(0, 8))}…</p>
  </div>
</body>
</html>`;
}

/**
 * Plain-text fallback for dispute resolution emails.
 */
export function buildDisputeResolvedEmailText(params) {
  const { recipientName, party, resolution, amount, adminNotes, transaction, demoMode } = params;
  const verdict = getResolutionVerdictLabel(resolution);
  const outcomeLine = getPartyOutcomeMessage(resolution, party, amount);
  const fundMovement = getFundMovementSummary(resolution, amount, { simulated: demoMode });
  const baseUrl = appBaseUrl();
  const txnUrl = `${baseUrl}/dashboard/transactions/${transaction?.id || ''}`;

  return [
    `Dear ${recipientName || 'Customer'},`,
    '',
    getProfessionalIntro(party, resolution),
    '',
    `Decision: ${verdict}`,
    outcomeLine,
    '',
    `Fund movement: ${fundMovement}`,
    transaction?.description ? `Transaction: ${transaction.description}` : '',
    '',
    'Admin reasoning:',
    adminNotes,
    '',
    `View transaction: ${txnUrl}`,
    '',
    'Kind regards,',
    'Safe Hands Escrow — Dispute Resolution Team',
    demoMode ? '\n(Presentation demo mode — simulated fund movement.)' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Send tailored dispute resolution emails to buyer and seller.
 * Does not throw — returns per-recipient send results.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   resolution: string;
 *   amount: number;
 *   adminNotes: string;
 *   transaction: { id: string; buyer_id: string; seller_id: string; description?: string; amount?: number };
 *   refundResult?: { mpesa_transaction_id?: string|null; refund_id?: string|null; partial?: boolean }|null;
 *   demoMode?: boolean;
 * }} input
 */
export async function sendDisputeResolvedEmails(supabase, input) {
  const { resolution, amount, adminNotes, transaction, refundResult, demoMode = false } = input;

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, phone_number')
    .in('id', [transaction.buyer_id, transaction.seller_id]);

  if (error || !users?.length) {
    console.error('sendDisputeResolvedEmails: could not load party emails', error?.message);
    return { ok: false, error: 'Could not load buyer/seller emails', results: [] };
  }

  const buyer = users.find((u) => u.id === transaction.buyer_id);
  const seller = users.find((u) => u.id === transaction.seller_id);

  /** @type {Array<{ party: string; to: string; success: boolean; service?: string; error?: string }>} */
  const results = [];

  const parties = [
    { party: 'buyer', user: buyer, refundPhone: buyer?.phone_number },
    { party: 'seller', user: seller, refundPhone: null },
  ];

  for (const { party, user, refundPhone } of parties) {
    if (!user?.email) {
      results.push({ party, to: '', success: false, error: 'No email on file' });
      continue;
    }

    const subject = `${getEmailSubject(party, resolution)} — Safe Hands Escrow`;
    const html = buildDisputeResolvedEmailHtml({
      recipientName: user.full_name || user.email,
      party,
      resolution,
      amount,
      adminNotes,
      transaction,
      refundResult,
      refundPhone: party === 'buyer' ? refundPhone : null,
      demoMode,
    });
    const text = buildDisputeResolvedEmailText({
      recipientName: user.full_name || user.email,
      party,
      resolution,
      amount,
      adminNotes,
      transaction,
      refundResult,
      demoMode,
    });

    const sent = await sendEmail({ to: user.email, subject, html, text });
    results.push({
      party,
      to: user.email,
      success: Boolean(sent.success),
      service: sent.service,
      error: sent.error,
    });

    if (!sent.success) {
      console.error(`Dispute email failed (${party} → ${user.email}):`, sent.error);
    }
  }

  return {
    ok: results.some((r) => r.success),
    results,
  };
}
