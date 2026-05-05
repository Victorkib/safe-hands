import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/mpesa/callback
 * Handle M-Pesa STK Push callbacks
 * This endpoint is called by M-Pesa when a payment is completed
 */
export async function POST(request) {
  try {
    const body = await request.json();
    
    // M-Pesa callback structure
    const { Body } = body;
    const { stkCallback } = Body;
    const { 
      MerchantRequestID, 
      CheckoutRequestID, 
      ResultCode, 
      ResultDesc, 
      CallbackMetadata 
    } = stkCallback;

    console.log('M-Pesa Callback received:', {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
    });

    // Find transaction by checkout request ID
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('mpesa_ref', CheckoutRequestID)
      .single();

    if (transactionError || !transaction) {
      console.error('Transaction not found for checkout ID:', CheckoutRequestID);
      return Response.json({
        ResultCode: 1,
        ResultDesc: 'Transaction not found',
      });
    }

    // Check if transaction is already processed
    if (transaction.payment_confirmed_at) {
      console.log('Transaction already processed:', transaction.id);
      return Response.json({
        ResultCode: 0,
        ResultDesc: 'Already processed',
      });
    }

    // Process payment result
    if (ResultCode === 0) {
      // Payment successful
      const amount = CallbackMetadata.Item.find(item => item.Name === 'Amount')?.Value;
      const mpesaReceipt = CallbackMetadata.Item.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = CallbackMetadata.Item.find(item => item.Name === 'TransactionDate')?.Value;
      const phoneNumber = CallbackMetadata.Item.find(item => item.Name === 'PhoneNumber')?.Value;

      // Calculate auto-release date (3 days after payment for buyer protection)
      // If buyer doesn't confirm or dispute within 3 days after delivery, funds auto-release
      // Note: auto_release_date will be recalculated when seller marks as shipped
      
      // Update transaction - NOW set status to 'escrow' since payment is confirmed
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'escrow',
          payment_confirmed_at: new Date().toISOString(),
          mpesa_ref: mpesaReceipt || CheckoutRequestID,
          mpesa_phone: phoneNumber,
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('Failed to update transaction:', updateError);
        return Response.json({
          ResultCode: 1,
          ResultDesc: 'Failed to update transaction',
        });
      }

      // Log to transaction history
      await supabase.from('transaction_history').insert({
        transaction_id: transaction.id,
        old_status: 'initiated',
        new_status: 'escrow',
        changed_by: null, // System action
        reason: `Payment confirmed via M-Pesa. Receipt: ${mpesaReceipt}`,
      });

      // Notify buyer
      await supabase.from('notifications').insert({
        user_id: transaction.buyer_id,
        title: 'Payment Successful',
        message: `Your payment of KES ${amount} has been received and is now in escrow`,
        type: 'payment_received',
        related_transaction_id: transaction.id,
      });

      // Notify seller
      await supabase.from('notifications').insert({
        user_id: transaction.seller_id,
        title: 'Payment Received',
        message: `Payment of KES ${amount} has been received. You can now ship the item.`,
        type: 'payment_received',
        related_transaction_id: transaction.id,
      });

      console.log('Payment processed successfully for transaction:', transaction.id);

      return Response.json({
        ResultCode: 0,
        ResultDesc: 'Payment processed successfully',
      });

    } else {
      // Payment failed - clear mpesa_ref so user can retry, but keep status as 'initiated'
      // Common ResultCodes: 1032 = Request cancelled by user, 1037 = Timeout, 1 = Insufficient funds
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          mpesa_ref: null, // Clear so user can retry
          // Status stays as 'initiated' to allow retry
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('Failed to update transaction:', updateError);
      }

      // Log to transaction history
      await supabase.from('transaction_history').insert({
        transaction_id: transaction.id,
        old_status: transaction.status,
        new_status: transaction.status, // Status unchanged
        changed_by: null,
        reason: `Payment failed: ${ResultDesc}. Transaction remains active for retry.`,
      });

      // Notify buyer with appropriate message based on result code
      let failureMessage = `Your payment failed: ${ResultDesc}. Please try again.`;
      if (ResultCode === 1032) {
        failureMessage = 'Payment was cancelled. You can try again when ready.';
      } else if (ResultCode === 1037) {
        failureMessage = 'Payment request timed out. Please try again.';
      } else if (ResultCode === 1) {
        failureMessage = 'Payment failed due to insufficient funds. Please try again.';
      }

      await supabase.from('notifications').insert({
        user_id: transaction.buyer_id,
        title: 'Payment Not Completed',
        message: failureMessage,
        type: 'payment_failed',
        related_transaction_id: transaction.id,
      });

      console.log('Payment failed for transaction:', transaction.id, 'ResultCode:', ResultCode, 'Reason:', ResultDesc);

      return Response.json({
        ResultCode: 0, // Return 0 to acknowledge receipt
        ResultDesc: 'Payment failure recorded',
      });
    }

  } catch (error) {
    console.error('M-Pesa callback error:', error);
    return Response.json({
      ResultCode: 1,
      ResultDesc: 'Internal server error',
    });
  }
}
