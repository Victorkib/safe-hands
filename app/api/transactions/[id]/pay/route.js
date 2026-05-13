import { createClient } from '@supabase/supabase-js';
import { mpesaClient } from '@/lib/mpesaClient';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import { assertMpesaCallbackConfigured } from '@/lib/mpesaPayment';

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
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const callbackCheck = assertMpesaCallbackConfigured();
    if (!callbackCheck.ok) {
      return Response.json(
        { error: callbackCheck.message, code: 'MPESA_CALLBACK_NOT_CONFIGURED' },
        { status: 503 }
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

    // Check transaction status
    if (transaction.status === 'payment_pending' && transaction.mpesa_ref) {
      return Response.json(
        {
          error:
            'A payment prompt is already in progress. Wait for confirmation on this page, or try again after it clears.',
          code: 'CHECKOUT_IN_PROGRESS',
        },
        { status: 409 }
      );
    }

    if (transaction.status !== 'initiated' && transaction.status !== 'seller_approved') {
      return Response.json(
        { error: `Cannot pay for transaction with status: ${transaction.status}` },
        { status: 400 }
      );
    }

    if (transaction.mpesa_ref) {
      return Response.json(
        { error: 'Payment reference still set; refresh and try again or contact support.' },
        { status: 400 }
      );
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

    // Update transaction with M-Pesa reference
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        mpesa_ref: checkoutRequestID,
        status: 'payment_pending',
      })
      .eq('id', id);

    if (updateError) {
      console.error('Transaction update error:', updateError);
      return Response.json(
        { error: 'Payment initiated but failed to update transaction' },
        { status: 500 }
      );
    }

    // Log to transaction history
    await supabase.from('transaction_history').insert({
      transaction_id: id,
      old_status: transaction.status,
      new_status: 'payment_pending',
      changed_by: user.id,
      reason: 'M-Pesa STK Push initiated',
    });

    if (transaction.seller_id) {
      await supabase.from('notifications').insert({
        user_id: transaction.seller_id,
        title: 'Payment Initiated',
        message: `Buyer has initiated payment for KES ${transaction.amount.toLocaleString()}`,
        type: 'payment_initiated',
        related_transaction_id: id,
      });
    }

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
