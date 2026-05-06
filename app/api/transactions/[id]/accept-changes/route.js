import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .select('id, buyer_id, seller_id, status, amount')
      .eq('id', id)
      .single();

    if (transactionError || !transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.buyer_id !== user.id) {
      return Response.json({ error: 'Only buyer can accept requested changes' }, { status: 403 });
    }

    if (transaction.status !== 'seller_change_requested') {
      return Response.json(
        { error: `Cannot accept changes for transaction with status: ${transaction.status}` },
        { status: 400 }
      );
    }

    const { data: sellerRequest, error: requestError } = await supabaseAdmin
      .from('seller_transaction_requests')
      .select('proposed_amount, seller_message')
      .eq('transaction_id', id)
      .single();

    if (requestError || !sellerRequest) {
      return Response.json({ error: 'Seller change request not found' }, { status: 404 });
    }

    const nextAmount = sellerRequest.proposed_amount || transaction.amount;

    const { error: updateTransactionError } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'seller_approved',
        amount: nextAmount,
      })
      .eq('id', id);

    if (updateTransactionError) {
      return Response.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    await supabaseAdmin
      .from('seller_transaction_requests')
      .update({ status: 'approved' })
      .eq('transaction_id', id);

    await supabaseAdmin.from('transaction_history').insert({
      transaction_id: id,
      old_status: 'seller_change_requested',
      new_status: 'seller_approved',
      changed_by: user.id,
      reason: 'Buyer accepted seller requested changes',
    });

    await supabaseAdmin.from('notifications').insert({
      user_id: transaction.seller_id,
      title: 'Buyer Accepted Requested Changes',
      message: 'Buyer accepted your requested changes. Payment can proceed now.',
      type: 'seller_changes_accepted',
      related_transaction_id: id,
    });

    return Response.json({ success: true, message: 'Changes accepted, ready for payment' });
  } catch (error) {
    console.error('Accept changes error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
