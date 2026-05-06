import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/transactions/[id]/confirm-delivery
 * Buyer confirms delivery of item with structured evidence
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    // Get request body
    const body = await request.json();
    const { 
      confirmation_comment,
      condition_rating,
      item_matches_description,
      notes,
      photos
    } = body;

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

    const confirmedAt = new Date().toISOString();

    // Update transaction
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'released',
        delivery_confirmed_at: confirmedAt,
        buyer_confirmation: confirmation_comment || notes || null,
        completed_at: confirmedAt,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Transaction update error:', updateError);
      return Response.json(
        { error: 'Failed to update transaction' },
        { status: 500 }
      );
    }

    // Create structured evidence record for buyer confirmation
    const evidenceData = {
      transaction_id: id,
      submitted_by: user.id,
      submission_type: 'buyer_receive',
      condition_rating: condition_rating || null,
      item_matches_description: item_matches_description !== undefined ? item_matches_description : null,
      notes: notes || confirmation_comment || null,
      photos: photos || [],
    };

    const { error: evidenceError } = await supabase
      .from('delivery_evidence')
      .insert(evidenceData);

    if (evidenceError) {
      // Log but don't fail - main transaction is already updated
      console.error('Evidence insert error (non-fatal):', evidenceError);
    }

    // Log to transaction history
    const ratingInfo = condition_rating ? ` (Condition: ${condition_rating}/5)` : '';
    await supabase.from('transaction_history').insert({
      transaction_id: id,
      old_status: 'delivered',
      new_status: 'released',
      changed_by: user.id,
      reason: `Buyer confirmed delivery${ratingInfo}: ${confirmation_comment || notes || 'No comment'}`,
    });

    // Update seller's stats using RPC or direct increment
    await supabase.rpc('increment_user_transactions', { user_id: transaction.seller_id }).catch(() => {
      // Fallback: direct update if RPC doesn't exist
      return supabase
        .from('users')
        .update({ total_transactions_completed: (transaction.seller?.total_transactions_completed || 0) + 1 })
        .eq('id', transaction.seller_id);
    });

    // Update buyer's stats
    await supabase.rpc('increment_user_transactions', { user_id: transaction.buyer_id }).catch(() => {
      return supabase
        .from('users')
        .update({ total_transactions_completed: (transaction.buyer?.total_transactions_completed || 0) + 1 })
        .eq('id', transaction.buyer_id);
    });

    // Notify seller - funds released
    await supabase.from('notifications').insert({
      user_id: transaction.seller_id,
      title: 'Funds Released',
      message: `Buyer confirmed delivery${ratingInfo}. Your funds of KES ${transaction.amount.toLocaleString()} have been released.`,
      type: 'funds_released',
      related_transaction_id: id,
    });

    // Notify buyer - confirmation recorded
    await supabase.from('notifications').insert({
      user_id: transaction.buyer_id,
      title: 'Delivery Confirmed',
      message: `You have confirmed delivery for transaction KES ${transaction.amount.toLocaleString()}. The transaction is now complete.`,
      type: 'delivery_confirmed',
      related_transaction_id: id,
    });

    // TODO: Initiate B2C payment to seller's M-Pesa
    // This would use mpesaClient.initiateB2C() to transfer funds to seller

    return Response.json({
      success: true,
      message: 'Delivery confirmed. Funds released to seller.',
      confirmed_at: confirmedAt,
    });

  } catch (error) {
    console.error('Delivery confirmation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
