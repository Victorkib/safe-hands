import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import { hashToken } from '@/lib/tokenService';

export async function POST(request) {
  try {
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return Response.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const nowIso = new Date().toISOString();

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('seller_invitations')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .single();

    if (invitationError || !invitation) {
      return Response.json({ error: 'Invalid or expired invitation' }, { status: 400 });
    }

    // Ensure invited email matches account email.
    if (invitation.email.toLowerCase() !== (user.email || '').toLowerCase()) {
      return Response.json(
        { error: 'Invitation email does not match authenticated user email' },
        { status: 403 }
      );
    }

    const { data: sellerProfile } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!sellerProfile) {
      return Response.json({ error: 'Seller profile not found' }, { status: 404 });
    }

    if (sellerProfile.role !== 'seller' && sellerProfile.role !== 'buyer_seller') {
      await supabaseAdmin
        .from('users')
        .update({ role: 'buyer_seller' })
        .eq('id', user.id);
    }

    const { data: existingTransaction } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('buyer_id', invitation.invited_by_user_id)
      .eq('seller_id', user.id)
      .eq('description', invitation.requested_description)
      .eq('amount', invitation.requested_amount)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let transactionId = existingTransaction?.id || null;

    if (!transactionId) {
      const { data: transaction, error: createTxnError } = await supabaseAdmin
        .from('transactions')
        .insert({
          buyer_id: invitation.invited_by_user_id,
          seller_id: user.id,
          amount: invitation.requested_amount,
          currency: invitation.requested_currency || 'KES',
          description: invitation.requested_description,
          status: 'pending_seller_approval',
          payment_method: 'mpesa',
        })
        .select('id')
        .single();

      if (createTxnError || !transaction) {
        console.error('Failed creating invited transaction:', createTxnError);
        return Response.json({ error: 'Failed to create invited transaction' }, { status: 500 });
      }

      transactionId = transaction.id;

      await supabaseAdmin.from('seller_transaction_requests').insert({
        transaction_id: transactionId,
        seller_id: user.id,
        buyer_id: invitation.invited_by_user_id,
        status: 'pending',
      });

      await supabaseAdmin.from('transaction_history').insert({
        transaction_id: transactionId,
        old_status: null,
        new_status: 'pending_seller_approval',
        changed_by: invitation.invited_by_user_id,
        reason: 'Transaction created from seller invitation',
      });
    }

    await supabaseAdmin
      .from('seller_invitations')
      .update({
        status: 'accepted',
        accepted_by_user_id: user.id,
        accepted_at: nowIso,
      })
      .eq('id', invitation.id);

    await supabaseAdmin.from('notifications').insert({
      user_id: invitation.invited_by_user_id,
      title: 'Seller Joined and Request Opened',
      message: 'Your invited seller has joined and can now approve the transaction.',
      type: 'seller_invitation_accepted',
      related_transaction_id: transactionId,
    });

    return Response.json({
      success: true,
      transactionId,
      message: 'Invitation accepted',
    });
  } catch (error) {
    console.error('Accept invitation API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
