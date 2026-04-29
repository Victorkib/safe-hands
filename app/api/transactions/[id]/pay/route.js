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

    // Check transaction status
    if (transaction.status !== 'initiated') {
      return Response.json(
        { error: `Cannot pay for transaction with status: ${transaction.status}` },
        { status: 400 }
      );
    }

    // Check if payment already initiated
    if (transaction.mpesa_ref) {
      return Response.json(
        { error: 'Payment already initiated' },
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
        status: 'escrow', // Will be updated to 'escrow' when payment is confirmed via callback
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
      old_status: 'initiated',
      new_status: 'escrow',
      changed_by: user.id,
      reason: 'M-Pesa STK Push initiated',
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
