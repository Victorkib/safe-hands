import { createClient } from '@supabase/supabase-js';
import { mpesaClient } from '@/lib/mpesaClient';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/transactions/[id]/payment-status
 * Query M-Pesa STK Push status for a transaction
 * This is a fallback mechanism if the callback fails
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return Response.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (transactionError || !transaction) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify user is involved in transaction
    if (transaction.buyer_id !== user.id && transaction.seller_id !== user.id) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // If payment already confirmed, return status
    if (transaction.payment_confirmed_at) {
      return Response.json({
        success: true,
        status: 'confirmed',
        transaction,
        message: 'Payment has been confirmed',
      });
    }

    // If no M-Pesa reference, payment not initiated
    if (!transaction.mpesa_ref) {
      return Response.json({
        success: true,
        status: 'not_initiated',
        transaction,
        message: 'Payment has not been initiated',
      });
    }

    // Query M-Pesa status
    const mpesaResponse = await mpesaClient.querySTKPushStatus(transaction.mpesa_ref);

    if (!mpesaResponse.success) {
      console.error('M-Pesa status query failed:', mpesaResponse.error);
      return Response.json({
        success: true,
        status: 'unknown',
        transaction,
        message: 'Unable to query payment status',
      });
    }

    const resultCode = mpesaResponse.data.ResultCode;
    
    if (resultCode === '0') {
      // Payment successful
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'escrow',
          payment_confirmed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (!updateError) {
        // Log to transaction history
        await supabase.from('transaction_history').insert({
          transaction_id: id,
          old_status: transaction.status,
          new_status: 'escrow',
          changed_by: null,
          reason: 'Payment confirmed via status query',
        });

        // Notify parties
        await supabase.from('notifications').insert([
          {
            user_id: transaction.buyer_id,
            title: 'Payment Confirmed',
            message: 'Your payment has been confirmed and is in escrow',
            type: 'payment_received',
            related_transaction_id: id,
          },
          {
            user_id: transaction.seller_id,
            title: 'Payment Received',
            message: 'Payment has been received. You can now ship the item.',
            type: 'payment_received',
            related_transaction_id: id,
          },
        ]);
      }

      return Response.json({
        success: true,
        status: 'confirmed',
        transaction,
        message: 'Payment confirmed via status query',
      });
    } else if (resultCode === '1032') {
      // Request cancelled by user
      return Response.json({
        success: true,
        status: 'cancelled',
        transaction,
        message: 'Payment was cancelled',
      });
    } else if (resultCode === '1037') {
      // Request timed out
      return Response.json({
        success: true,
        status: 'timeout',
        transaction,
        message: 'Payment request timed out. Please try again.',
      });
    } else {
      // Other error
      return Response.json({
        success: true,
        status: 'failed',
        transaction,
        message: `Payment failed: ${mpesaResponse.data.ResultDesc}`,
      });
    }

  } catch (error) {
    console.error('Payment status query error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
