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

      // Update transaction
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
      // Payment failed
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'cancelled',
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('Failed to update transaction:', updateError);
      }

      // Log to transaction history
      await supabase.from('transaction_history').insert({
        transaction_id: transaction.id,
        old_status: 'initiated',
        new_status: 'cancelled',
        changed_by: null,
        reason: `Payment failed: ${ResultDesc}`,
      });

      // Notify buyer
      await supabase.from('notifications').insert({
        user_id: transaction.buyer_id,
        title: 'Payment Failed',
        message: `Your payment failed: ${ResultDesc}. Please try again.`,
        type: 'payment_failed',
        related_transaction_id: transaction.id,
      });

      console.log('Payment failed for transaction:', transaction.id, 'Reason:', ResultDesc);

      return Response.json({
        ResultCode: 1,
        ResultDesc: 'Payment failed',
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
