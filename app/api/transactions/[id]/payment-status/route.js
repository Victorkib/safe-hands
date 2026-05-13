import { createClient } from '@supabase/supabase-js';
import { mpesaClient } from '@/lib/mpesaClient';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import {
  getResumeStatusBeforePaymentPending,
  normalizeMpesaCode,
  parseCallbackMetadataItems,
  shouldResetStkCheckoutFromQuery,
} from '@/lib/mpesaPayment';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchTransactionRow(transactionId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();
  if (error) return { data: null, error };
  return { data, error: null };
}

async function applyEscrowFromStkQuery(transactionId, transaction, mpesaData) {
  const { mpesaReceipt, phoneNumber } = parseCallbackMetadataItems(mpesaData?.CallbackMetadata);

  const { data: updatedRows, error: updateError } = await supabase
    .from('transactions')
    .update({
      status: 'escrow',
      payment_confirmed_at: new Date().toISOString(),
      ...(mpesaReceipt ? { mpesa_receipt_number: mpesaReceipt } : {}),
      ...(phoneNumber ? { mpesa_phone: phoneNumber } : {}),
    })
    .eq('id', transactionId)
    .is('payment_confirmed_at', null)
    .select('id');

  if (updateError || !updatedRows?.length) {
    return { applied: false, error: updateError };
  }

  await supabase.from('transaction_history').insert({
    transaction_id: transactionId,
    old_status: transaction.status,
    new_status: 'escrow',
    changed_by: null,
    reason: 'Payment confirmed via STK status query',
  });

  await supabase.from('notifications').insert([
    {
      user_id: transaction.buyer_id,
      title: 'Payment Confirmed',
      message: 'Your payment has been confirmed and is in escrow',
      type: 'payment_received',
      related_transaction_id: transactionId,
    },
    ...(transaction.seller_id
      ? [
          {
            user_id: transaction.seller_id,
            title: 'Payment Received',
            message: 'Payment has been received. You can now ship the item.',
            type: 'payment_received',
            related_transaction_id: transactionId,
          },
        ]
      : []),
  ]);

  return { applied: true, error: null };
}

async function rollbackStkFromQuery(transactionId, transaction, reason) {
  const resume = await getResumeStatusBeforePaymentPending(supabase, transactionId);

  const { data: updatedRows, error: updateError } = await supabase
    .from('transactions')
    .update({
      status: resume,
      mpesa_ref: null,
      mpesa_phone: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)
    .eq('status', 'payment_pending')
    .is('payment_confirmed_at', null)
    .select('id');

  if (updateError || !updatedRows?.length) {
    return { applied: false, resume, error: updateError };
  }

  await supabase.from('transaction_history').insert({
    transaction_id: transactionId,
    old_status: 'payment_pending',
    new_status: resume,
    changed_by: null,
    reason,
  });

  await supabase.from('notifications').insert({
    user_id: transaction.buyer_id,
    title: 'Payment Not Completed',
    message: reason,
    type: 'payment_failed',
    related_transaction_id: transactionId,
  });

  return { applied: true, resume, error: null };
}

/**
 * GET /api/transactions/[id]/payment-status
 * Poll Daraja STK query; reconcile DB if callback never arrived.
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (transactionError || !transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.buyer_id !== user.id && transaction.seller_id !== user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (transaction.payment_confirmed_at) {
      const { data: fresh } = await fetchTransactionRow(id);
      return Response.json({
        success: true,
        status: 'confirmed',
        transaction: fresh,
        message: 'Payment has been confirmed',
      });
    }

    if (!transaction.mpesa_ref) {
      const { data: fresh } = await fetchTransactionRow(id);
      return Response.json({
        success: true,
        status: 'not_initiated',
        transaction: fresh,
        message: 'Payment has not been initiated',
      });
    }

    const mpesaResponse = await mpesaClient.querySTKPushStatus(transaction.mpesa_ref);

    if (!mpesaResponse.success) {
      console.error('M-Pesa status query failed:', mpesaResponse.error);
      const { data: fresh } = await fetchTransactionRow(id);
      return Response.json({
        success: true,
        status: 'unknown',
        transaction: fresh,
        message: 'Unable to query payment status from Safaricom',
      });
    }

    const data = mpesaResponse.data || {};
    const apiCode = normalizeMpesaCode(data.ResponseCode);
    if (apiCode && apiCode !== '0') {
      const { data: fresh } = await fetchTransactionRow(id);
      return Response.json({
        success: true,
        status: 'query_error',
        transaction: fresh,
        message: data.ResponseDescription || 'STK query rejected by Safaricom',
      });
    }

    const resultCode = normalizeMpesaCode(data.ResultCode);
    const resultDesc = data.ResultDesc || '';

    if (resultCode === '0') {
      const escrowResult = await applyEscrowFromStkQuery(id, transaction, data);
      const { data: fresh } = await fetchTransactionRow(id);
      return Response.json({
        success: true,
        status: 'confirmed',
        transaction: fresh,
        message: escrowResult.applied
          ? 'Payment confirmed via status query'
          : 'Payment already recorded',
      });
    }

    if (shouldResetStkCheckoutFromQuery(resultCode, resultDesc)) {
      const human =
        resultCode === '1032'
          ? 'Payment was cancelled on the phone.'
          : resultCode === '1037'
            ? 'Payment request timed out. You can try again.'
            : `Payment did not complete (${resultDesc || `code ${resultCode}`}). You can try again.`;

      await rollbackStkFromQuery(id, transaction, human);
      const { data: fresh } = await fetchTransactionRow(id);

      let pollStatus = 'failed';
      if (resultCode === '1032') pollStatus = 'cancelled';
      else if (resultCode === '1037') pollStatus = 'timeout';

      return Response.json({
        success: true,
        status: pollStatus,
        transaction: fresh,
        message: human,
      });
    }

    const { data: fresh } = await fetchTransactionRow(id);
    return Response.json({
      success: true,
      status: 'pending_stk',
      transaction: fresh,
      message:
        resultDesc ||
        'Safaricom is still processing this prompt. Keep this page open or wait a moment and try again.',
    });
  } catch (error) {
    console.error('Payment status query error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
