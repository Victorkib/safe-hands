import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/mpesa/b2c-callback
 * Handle M-Pesa B2C (Business to Customer) payment callbacks
 * This endpoint is called by M-Pesa when a B2C payout is completed
 */
export async function POST(request) {
  try {
    const body = await request.json();
    
    console.log('B2C Callback received:', JSON.stringify(body, null, 2));

    // M-Pesa B2C callback structure
    const { Result } = body;
    const {
      ResultType,
      ResultCode,
      ResultDesc,
      OriginatorConversationID,
      ConversationID,
      TransactionID,
      ResultParameters
    } = Result;

    // Find transaction by conversation ID (stored in payout_ref)
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*, seller:users!transactions_seller_id_fkey (id, email, full_name, phone_number)')
      .eq('payout_ref', OriginatorConversationID)
      .single();

    if (transactionError || !transaction) {
      console.error('Transaction not found for B2C callback:', OriginatorConversationID);
      // Still return success to M-Pesa to acknowledge receipt
      return Response.json({
        ResultCode: 0,
        ResultDesc: 'Callback received but transaction not found',
      });
    }

    // Check if payout already processed
    if (transaction.payout_confirmed_at) {
      console.log('Payout already processed for transaction:', transaction.id);
      return Response.json({
        ResultCode: 0,
        ResultDesc: 'Already processed',
      });
    }

    if (ResultCode === 0) {
      // B2C payment successful
      let payoutAmount = null;
      let receiverPhoneNumber = null;
      let transactionReceipt = null;

      // Extract result parameters if available
      if (ResultParameters && ResultParameters.ResultParameter) {
        const params = ResultParameters.ResultParameter;
        payoutAmount = params.find(p => p.Key === 'TransactionAmount')?.Value;
        receiverPhoneNumber = params.find(p => p.Key === 'ReceiverPartyPublicName')?.Value;
        transactionReceipt = params.find(p => p.Key === 'TransactionReceipt')?.Value || TransactionID;
      }

      // Update transaction with payout confirmation
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          payout_confirmed_at: new Date().toISOString(),
          payout_mpesa_ref: transactionReceipt || TransactionID,
          payout_status: 'completed',
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('Failed to update transaction payout status:', updateError);
        return Response.json({
          ResultCode: 1,
          ResultDesc: 'Failed to update transaction',
        });
      }

      // Log to transaction history
      await supabase.from('transaction_history').insert({
        transaction_id: transaction.id,
        old_status: transaction.status,
        new_status: transaction.status,
        changed_by: null,
        reason: `Payout completed. M-Pesa Receipt: ${transactionReceipt || TransactionID}. Amount: KES ${payoutAmount || transaction.amount}`,
      });

      // Notify seller that payout is complete
      await supabase.from('notifications').insert({
        user_id: transaction.seller_id,
        title: 'Payout Received',
        message: `You have received KES ${payoutAmount || transaction.amount} in your M-Pesa account.`,
        type: 'payout_completed',
        related_transaction_id: transaction.id,
      });

      console.log('B2C payout successful for transaction:', transaction.id);

      return Response.json({
        ResultCode: 0,
        ResultDesc: 'Payout processed successfully',
      });

    } else {
      // B2C payment failed
      console.error('B2C payout failed:', ResultDesc);

      // Update transaction payout status
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          payout_status: 'failed',
          payout_error: ResultDesc,
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('Failed to update transaction payout status:', updateError);
      }

      // Log to transaction history
      await supabase.from('transaction_history').insert({
        transaction_id: transaction.id,
        old_status: transaction.status,
        new_status: transaction.status,
        changed_by: null,
        reason: `Payout failed: ${ResultDesc}`,
      });

      // Notify admin about failed payout
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const adminNotifications = admins.map(admin => ({
          user_id: admin.id,
          title: 'Payout Failed',
          message: `B2C payout failed for transaction ${transaction.id}. Reason: ${ResultDesc}`,
          type: 'payout_failed',
          related_transaction_id: transaction.id,
        }));

        await supabase.from('notifications').insert(adminNotifications);
      }

      // Also notify seller
      await supabase.from('notifications').insert({
        user_id: transaction.seller_id,
        title: 'Payout Issue',
        message: `There was an issue processing your payout. Our team has been notified and will resolve this shortly.`,
        type: 'payout_failed',
        related_transaction_id: transaction.id,
      });

      return Response.json({
        ResultCode: 1,
        ResultDesc: 'Payout failed',
      });
    }

  } catch (error) {
    console.error('B2C callback error:', error);
    return Response.json({
      ResultCode: 1,
      ResultDesc: 'Internal server error',
    });
  }
}

/**
 * GET /api/mpesa/b2c-callback
 * M-Pesa sometimes sends GET requests to verify callback URL
 */
export async function GET() {
  return Response.json({
    status: 'ok',
    message: 'B2C callback endpoint is active',
  });
}
