import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/transactions/[id]/confirm-delivery
 * Buyer confirms delivery of item
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    // Get request body
    const body = await request.json();
    const { confirmation_comment } = body;

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
        { error: 'Only the buyer can confirm delivery' },
        { status: 403 }
      );
    }

    // Check transaction status
    if (transaction.status !== 'delivered') {
      return Response.json(
        { error: `Cannot confirm delivery for transaction with status: ${transaction.status}` },
        { status: 400 }
      );
    }

    // Update transaction
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'released',
        delivery_confirmed_at: new Date().toISOString(),
        buyer_confirmation: confirmation_comment,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Transaction update error:', updateError);
      return Response.json(
        { error: 'Failed to update transaction' },
        { status: 500 }
      );
    }

    // Log to transaction history
    await supabase.from('transaction_history').insert({
      transaction_id: id,
      old_status: 'delivered',
      new_status: 'released',
      changed_by: user.id,
      reason: `Buyer confirmed delivery: ${confirmation_comment || 'No comment'}`,
    });

    // Update seller's stats
    await supabase
      .from('users')
      .update({
        total_transactions_completed: supabase.raw('total_transactions_completed + 1'),
      })
      .eq('id', transaction.seller_id);

    // Update buyer's stats
    await supabase
      .from('users')
      .update({
        total_transactions_completed: supabase.raw('total_transactions_completed + 1'),
      })
      .eq('id', transaction.buyer_id);

    // Notify seller - funds released
    await supabase.from('notifications').insert({
      user_id: transaction.seller_id,
      title: 'Funds Released',
      message: `Buyer confirmed delivery. Your funds of KES ${transaction.amount.toLocaleString()} have been released.`,
      type: 'funds_released',
      related_transaction_id: id,
    });

    // TODO: Initiate B2C payment to seller's M-Pesa
    // This would use mpesaClient.initiateB2C() to transfer funds to seller

    return Response.json({
      success: true,
      message: 'Delivery confirmed. Funds released to seller.',
    });

  } catch (error) {
    console.error('Delivery confirmation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
