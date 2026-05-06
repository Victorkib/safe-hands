import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json().catch(() => ({}));
    const sellerMessage = body?.seller_message || null;
    const proposedAmount = body?.proposed_amount ? Number(body.proposed_amount) : null;

    if (!sellerMessage) {
      return Response.json(
        { error: 'seller_message is required when requesting changes' },
        { status: 400 }
      );
    }

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .select('id, seller_id, buyer_id, status')
      .eq('id', id)
      .single();

    if (transactionError || !transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.seller_id !== user.id) {
      return Response.json({ error: 'Only seller can request changes' }, { status: 403 });
    }

    if (transaction.status !== 'pending_seller_approval') {
      return Response.json(
        { error: `Cannot request changes for transaction with status: ${transaction.status}` },
        { status: 400 }
      );
    }

    const { error: requestUpdateError } = await supabaseAdmin
      .from('seller_transaction_requests')
      .update({
        status: 'change_requested',
        seller_message: sellerMessage,
        proposed_amount: proposedAmount,
      })
      .eq('transaction_id', id)
      .eq('seller_id', user.id);

    if (requestUpdateError) {
      return Response.json({ error: 'Failed to update seller request' }, { status: 500 });
    }

    const { error: txnUpdateError } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'seller_change_requested' })
      .eq('id', id);

    if (txnUpdateError) {
      return Response.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    await supabaseAdmin.from('transaction_history').insert({
      transaction_id: id,
      old_status: 'pending_seller_approval',
      new_status: 'seller_change_requested',
      changed_by: user.id,
      reason: `Seller requested changes: ${sellerMessage}`,
    });

    await supabaseAdmin.from('notifications').insert({
      user_id: transaction.buyer_id,
      title: 'Seller Requested Changes',
      message: sellerMessage,
      type: 'seller_change_requested',
      related_transaction_id: id,
    });

    return Response.json({ success: true, message: 'Change request submitted' });
  } catch (error) {
    console.error('Request changes error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
