import { createClient } from '@supabase/supabase-js';
import { mpesaClient } from '@/lib/mpesaClient';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/transactions/[id]/pay
 * Initiate M-Pesa STK Push payment for a transaction
 */
export async function POST(request, { params }) {
  try {
    const { id } = params;

    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return Response.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get user's phone number
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('phone_number')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!userData.phone_number) {
      return Response.json(
        { error: 'Phone number not set. Please update your profile.' },
        { status: 400 }
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

    // Verify user is the buyer
    if (transaction.buyer_id !== user.id) {
      return Response.json(
        { error: 'Only the buyer can initiate payment' },
        { status: 403 }
      );
    }

    // Check transaction status - allow initiated or cancelled (for retry)
    if (transaction.status !== 'initiated' && transaction.status !== 'cancelled') {
      return Response.json(
        { error: `Cannot pay for transaction with status: ${transaction.status}` },
        { status: 400 }
      );
    }

    // Check if payment already confirmed (in escrow)
    if (transaction.payment_confirmed_at) {
      return Response.json(
        { error: 'Payment has already been confirmed' },
        { status: 400 }
      );
    }
    
    // Get retry flag from request body (optional)
    let isRetry = false;
    try {
      const body = await request.json();
      isRetry = body?.retry === true;
    } catch {
      // No body or not JSON - that's fine
    }

    // If there's an existing mpesa_ref and not a retry, check if we should allow retry
    if (transaction.mpesa_ref && !isRetry) {
      // Check how old the payment request is (allow retry after 2 minutes)
      const lastUpdate = new Date(transaction.updated_at);
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      
      if (lastUpdate > twoMinutesAgo) {
        return Response.json(
          { 
            error: 'Payment already in progress. Please wait for the M-Pesa prompt or try again in 2 minutes.',
            canRetry: true,
            retryAfter: new Date(lastUpdate.getTime() + 2 * 60 * 1000).toISOString()
          },
          { status: 400 }
        );
      }
    }
    
    // If retrying, reset cancelled status back to initiated
    if (transaction.status === 'cancelled') {
      await supabase
        .from('transactions')
        .update({ status: 'initiated' })
        .eq('id', id);
        
      await supabase.from('transaction_history').insert({
        transaction_id: id,
        old_status: 'cancelled',
        new_status: 'initiated',
        changed_by: user.id,
        reason: 'Transaction reactivated for payment retry',
      });
    }

    // Initiate STK Push
    const mpesaResponse = await mpesaClient.initiateSTKPush({
      phoneNumber: userData.phone_number,
      amount: transaction.amount,
      accountReference: transaction.id,
      transactionDesc: `Safe Hands Escrow - ${transaction.description.substring(0, 30)}`,
    });

    if (!mpesaResponse.success) {
      console.error('M-Pesa STK Push failed:', mpesaResponse.error);
      return Response.json(
        { error: 'Failed to initiate M-Pesa payment', details: mpesaResponse.error },
        { status: 500 }
      );
    }

    // Extract checkout request ID
    const checkoutRequestID = mpesaResponse.data.CheckoutRequestID;
    const merchantRequestID = mpesaResponse.data.MerchantRequestID;

    // Update transaction with M-Pesa checkout request ID
    // IMPORTANT: Status stays as 'initiated' until callback confirms payment
    // We use mpesa_ref to store the checkout request ID for status polling
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        mpesa_ref: checkoutRequestID,
        // Status stays 'initiated' - will be set to 'escrow' only when callback confirms payment
      })
      .eq('id', id);

    if (updateError) {
      console.error('Transaction update error:', updateError);
      return Response.json(
        { error: 'Payment initiated but failed to update transaction' },
        { status: 500 }
      );
    }

    // Log to transaction history - payment initiated, awaiting confirmation
    await supabase.from('transaction_history').insert({
      transaction_id: id,
      old_status: 'initiated',
      new_status: 'initiated', // Status unchanged, just recording STK push was sent
      changed_by: user.id,
      reason: `M-Pesa STK Push initiated. CheckoutRequestID: ${checkoutRequestID}`,
    });

    // Notify seller
    await supabase.from('notifications').insert({
      user_id: transaction.seller_id,
      title: 'Payment Initiated',
      message: `Buyer has initiated payment for KES ${transaction.amount.toLocaleString()}`,
      type: 'payment_initiated',
      related_transaction_id: id,
    });

    return Response.json({
      success: true,
      message: 'Payment initiated. Check your phone for M-Pesa prompt.',
      checkoutRequestID,
      merchantRequestID,
    });

  } catch (error) {
    console.error('Payment initiation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
