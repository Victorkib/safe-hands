import { createClient } from '@supabase/supabase-js';
import {
  getResumeStatusBeforePaymentPending,
  normalizeMpesaCode,
  parseCallbackMetadataItems,
} from '@/lib/mpesaPayment';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** Safaricom / proxies may probe with GET; return 200 so tunnels stay healthy. */
export async function GET() {
  return Response.json({
    ok: true,
    service: 'safe-hands-mpesa-stk-callback',
    methods: ['POST'],
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, OPTIONS',
    },
  });
}

/**
 * POST /api/mpesa/callback
 * M-Pesa STK Push callback (server-to-server).
 */
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { ResultCode: 1, ResultDesc: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback || typeof stkCallback !== 'object') {
      console.warn('M-Pesa callback: missing Body.stkCallback');
      return Response.json(
        { ResultCode: 1, ResultDesc: 'Invalid callback payload' },
        { status: 400 }
      );
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = stkCallback;

    if (!CheckoutRequestID) {
      return Response.json(
        { ResultCode: 1, ResultDesc: 'Missing CheckoutRequestID' },
        { status: 400 }
      );
    }

    console.log('M-Pesa Callback received:', {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
    });

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('mpesa_ref', CheckoutRequestID)
      .maybeSingle();

    if (transactionError || !transaction) {
      console.error('Transaction not found for checkout ID:', CheckoutRequestID);
      return Response.json({
        ResultCode: 0,
        ResultDesc: 'No matching transaction (already cleared or unknown checkout)',
      });
    }

    if (transaction.payment_confirmed_at) {
      console.log('Transaction already processed:', transaction.id);
      return Response.json({
        ResultCode: 0,
        ResultDesc: 'Already processed',
      });
    }

    const rc = normalizeMpesaCode(ResultCode);

    if (rc === '0') {
      const { amount, mpesaReceipt, phoneNumber } = parseCallbackMetadataItems(CallbackMetadata);

      const { data: updatedRows, error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'escrow',
          payment_confirmed_at: new Date().toISOString(),
          mpesa_receipt_number: mpesaReceipt || null,
          ...(phoneNumber ? { mpesa_phone: phoneNumber } : {}),
        })
        .eq('id', transaction.id)
        .is('payment_confirmed_at', null)
        .select('id');

      if (updateError) {
        console.error('Failed to update transaction:', updateError);
        return Response.json({
          ResultCode: 1,
          ResultDesc: 'Failed to update transaction',
        });
      }

      if (!updatedRows || updatedRows.length === 0) {
        return Response.json({
          ResultCode: 0,
          ResultDesc: 'Already processed',
        });
      }

      await supabase.from('transaction_history').insert({
        transaction_id: transaction.id,
        old_status: transaction.status,
        new_status: 'escrow',
        changed_by: null,
        reason: `Payment confirmed via M-Pesa callback. Receipt: ${mpesaReceipt || 'n/a'}`,
      });

      await supabase.from('notifications').insert({
        user_id: transaction.buyer_id,
        title: 'Payment Successful',
        message: `Your payment${amount ? ` of KES ${amount}` : ''} has been received and is now in escrow`,
        type: 'payment_received',
        related_transaction_id: transaction.id,
      });

      if (transaction.seller_id) {
        await supabase.from('notifications').insert({
          user_id: transaction.seller_id,
          title: 'Payment Received',
          message: `Payment${amount ? ` of KES ${amount}` : ''} has been received. You can now ship the item.`,
          type: 'payment_received',
          related_transaction_id: transaction.id,
        });
      }

      console.log('Payment processed successfully for transaction:', transaction.id);

      return Response.json({
        ResultCode: 0,
        ResultDesc: 'Payment processed successfully',
      });
    }

    const resume = await getResumeStatusBeforePaymentPending(supabase, transaction.id);

    const { data: rolled, error: rollError } = await supabase
      .from('transactions')
      .update({
        status: resume,
        mpesa_ref: null,
        mpesa_phone: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id)
      .eq('status', 'payment_pending')
      .is('payment_confirmed_at', null)
      .select('id');

    if (rollError) {
      console.error('Failed to roll back failed STK:', rollError);
    } else if (rolled?.length) {
      await supabase.from('transaction_history').insert({
        transaction_id: transaction.id,
        old_status: 'payment_pending',
        new_status: resume,
        changed_by: null,
        reason: `M-Pesa STK failed (callback). ResultDesc: ${ResultDesc || rc}`,
      });

      await supabase.from('notifications').insert({
        user_id: transaction.buyer_id,
        title: 'Payment Failed',
        message: `Your payment did not complete: ${ResultDesc || `code ${rc}`}. You can try again.`,
        type: 'payment_failed',
        related_transaction_id: transaction.id,
      });
    }

    console.log('Payment failed for transaction:', transaction.id, 'Reason:', ResultDesc);

    return Response.json({
      ResultCode: 0,
      ResultDesc: 'Callback handled',
    });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    return Response.json(
      {
        ResultCode: 1,
        ResultDesc: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
