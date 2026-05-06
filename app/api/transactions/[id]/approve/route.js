import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json().catch(() => ({}));
    const sellerMessage = body?.seller_message || null;

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .select('id, seller_id, buyer_id, status')
      .eq('id', id)
      .single();

    if (transactionError || !transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.seller_id !== user.id) {
      return Response.json({ error: 'Only seller can approve transaction' }, { status: 403 });
    }

    if (transaction.status !== 'pending_seller_approval') {
      return Response.json({ error: `Cannot approve transaction with status: ${transaction.status}` }, { status: 400 });
    }

    const { error: requestUpdateError } = await supabaseAdmin
      .from('seller_transaction_requests')
      .update({
        status: 'approved',
        seller_message: sellerMessage,
        proposed_amount: null,
      })
      .eq('transaction_id', id)
      .eq('seller_id', user.id);

    if (requestUpdateError) {
      return Response.json({ error: 'Failed to update seller request' }, { status: 500 });
    }

    const { error: txnUpdateError } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'seller_approved' })
      .eq('id', id);

    if (txnUpdateError) {
      return Response.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    await supabaseAdmin.from('transaction_history').insert({
      transaction_id: id,
      old_status: 'pending_seller_approval',
      new_status: 'seller_approved',
      changed_by: user.id,
      reason: sellerMessage ? `Seller approved: ${sellerMessage}` : 'Seller approved transaction',
    });

    await supabaseAdmin.from('notifications').insert({
      user_id: transaction.buyer_id,
      title: 'Seller Approved Transaction',
      message: 'Seller approved your transaction. You can now proceed with payment.',
      type: 'seller_approved',
      related_transaction_id: id,
    });

    return Response.json({ success: true, message: 'Transaction approved' });
  } catch (error) {
    console.error('Approve transaction error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
