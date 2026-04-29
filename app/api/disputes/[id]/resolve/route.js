import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/disputes/[id]/resolve
 * Admin resolves a dispute
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

    // Parse request body
    const body = await request.json();
    const { resolution, admin_notes } = body;

    // Validate resolution
    const validResolutions = ['refund_buyer', 'release_to_seller', 'partial_refund', 'cancelled'];
    if (!resolution || !validResolutions.includes(resolution)) {
      return Response.json(
        { error: `Invalid resolution. Must be one of: ${validResolutions.join(', ')}` },
        { status: 400 }
      );
    }

    // Get dispute with transaction
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

    // Check if dispute is already resolved
    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      return Response.json(
        { error: 'Dispute has already been resolved' },
        { status: 400 }
      );
    }

    // Update dispute
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

    // Update transaction based on resolution
    const transaction = dispute.transaction;
    let transactionStatus = 'disputed';

    if (resolution === 'refund_buyer') {
      transactionStatus = 'refunded';
      // TODO: Initiate B2C refund to buyer via M-Pesa
    } else if (resolution === 'release_to_seller') {
      transactionStatus = 'released';
      // TODO: Initiate B2C payment to seller via M-Pesa
    } else if (resolution === 'cancelled') {
      transactionStatus = 'cancelled';
    } else if (resolution === 'partial_refund') {
      transactionStatus = 'released';
      // TODO: Handle partial refund logic
    }

    await supabase
      .from('transactions')
      .update({
        status: transactionStatus,
        is_disputed: false,
        completed_at: transactionStatus === 'released' || transactionStatus === 'refunded' ? new Date().toISOString() : null,
      })
      .eq('id', transaction.id);

    // Log to transaction history
    await supabase.from('transaction_history').insert({
      transaction_id: transaction.id,
      old_status: transaction.status,
      new_status: transactionStatus,
      changed_by: user.id,
      reason: `Dispute resolved: ${resolution}. ${admin_notes || ''}`,
    });

    // Notify both parties
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
    console.error('Dispute resolution error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
