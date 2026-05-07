import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/admin/disputes/[id]/resolve
 * Admin resolves a dispute using canonical `resolution`.
 *
 * Backwards compatibility:
 * - If `decision` is provided, it will be mapped to `resolution`.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'admin') {
      return Response.json(
        { error: 'Only admins can resolve disputes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { resolution: resolutionFromBody, decision, admin_notes } = body || {};

    // Map legacy decision -> resolution
    const mappedResolution =
      resolutionFromBody ||
      (decision === 'buyer_wins' ? 'refund_buyer'
        : decision === 'seller_wins' ? 'release_to_seller'
        : decision === 'split' ? 'partial_refund'
        : null);

    const validResolutions = ['refund_buyer', 'release_to_seller', 'partial_refund', 'cancelled'];
    const resolution = mappedResolution;

    if (!resolution || !validResolutions.includes(resolution)) {
      return Response.json(
        { error: `Invalid resolution. Must be one of: ${validResolutions.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select(`
        *,
        transaction:transactions (*)
      `)
      .eq('id', id)
      .single();

    if (disputeError || !dispute) {
      return Response.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      return Response.json(
        { error: 'Dispute has already been resolved' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('disputes')
      .update({
        status: 'resolved',
        resolution,
        admin_notes,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Dispute update error:', updateError);
      return Response.json(
        { error: 'Failed to resolve dispute' },
        { status: 500 }
      );
    }

    const transaction = dispute.transaction;
    let transactionStatus = 'disputed';

    if (resolution === 'refund_buyer') {
      transactionStatus = 'refunded';
    } else if (resolution === 'release_to_seller') {
      transactionStatus = 'released';
    } else if (resolution === 'cancelled') {
      transactionStatus = 'cancelled';
    } else if (resolution === 'partial_refund') {
      // For now we treat partial refund as released (TODO: partial refund implementation)
      transactionStatus = 'released';
    }

    await supabase
      .from('transactions')
      .update({
        status: transactionStatus,
        is_disputed: false,
        completed_at: transactionStatus === 'released' || transactionStatus === 'refunded'
          ? new Date().toISOString()
          : null,
      })
      .eq('id', transaction.id);

    await supabase.from('transaction_history').insert({
      transaction_id: transaction.id,
      old_status: transaction.status,
      new_status: transactionStatus,
      changed_by: user.id,
      reason: `Dispute resolved: ${resolution}. ${admin_notes || ''}`,
    });

    await supabase.from('notifications').insert([
      {
        user_id: dispute.raised_by,
        title: 'Dispute Resolved',
        message: `Your dispute has been resolved. Resolution: ${resolution}`,
        type: 'dispute_resolved',
        related_transaction_id: transaction.id,
      },
      {
        user_id: dispute.raised_against,
        title: 'Dispute Resolved',
        message: `The dispute against you has been resolved. Resolution: ${resolution}`,
        type: 'dispute_resolved',
        related_transaction_id: transaction.id,
      },
    ]);

    return Response.json({
      success: true,
      message: 'Dispute resolved successfully',
      resolution,
    });
  } catch (error) {
    console.error('Admin dispute resolution error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
