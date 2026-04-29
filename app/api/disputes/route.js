import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/disputes
 * Create a new dispute for a transaction
 */
export async function POST(request) {
  try {
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

    // Parse request body
    const body = await request.json();
    const { transaction_id, reason, description } = body;

    // Validate input
    if (!transaction_id || !reason || !description) {
      return Response.json(
        { error: 'Missing required fields: transaction_id, reason, description' },
        { status: 400 }
      );
    }

    // Validate reason
    const validReasons = ['item_not_received', 'item_not_as_described', 'other'];
    if (!validReasons.includes(reason)) {
      return Response.json(
        { error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      );
    }

    // Get transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (transactionError || !transaction) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify user is involved in transaction
    if (transaction.buyer_id !== user.id && transaction.seller_id !== user.id) {
      return Response.json(
        { error: 'You can only dispute transactions you are involved in' },
        { status: 403 }
      );
    }

    // Check if dispute already exists
    const { data: existingDispute } = await supabase
      .from('disputes')
      .select('*')
      .eq('transaction_id', transaction_id)
      .single();

    if (existingDispute) {
      return Response.json(
        { error: 'A dispute already exists for this transaction' },
        { status: 400 }
      );
    }

    // Determine who is raising the dispute and against whom
    const raised_by = user.id;
    const raised_against = transaction.buyer_id === user.id ? transaction.seller_id : transaction.buyer_id;

    // Create dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .insert({
        transaction_id,
        raised_by,
        raised_against,
        reason,
        description,
        status: 'open',
      })
      .select()
      .single();

    if (disputeError) {
      console.error('Dispute creation error:', disputeError);
      return Response.json(
        { error: 'Failed to create dispute' },
        { status: 500 }
      );
    }

    // Update transaction to mark as disputed
    await supabase
      .from('transactions')
      .update({
        is_disputed: true,
        status: 'disputed',
      })
      .eq('id', transaction_id);

    // Log to transaction history
    await supabase.from('transaction_history').insert({
      transaction_id,
      old_status: transaction.status,
      new_status: 'disputed',
      changed_by: user.id,
      reason: `Dispute raised: ${reason}`,
    });

    // Notify the other party
    await supabase.from('notifications').insert({
      user_id: raised_against,
      title: 'Dispute Raised',
      message: `A dispute has been raised against you for transaction KES ${transaction.amount.toLocaleString()}`,
      type: 'dispute_raised',
      related_transaction_id: transaction_id,
    });

    // Notify admins
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (admins) {
      for (const admin of admins) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          title: 'New Dispute Requires Review',
          message: `A new dispute has been raised for transaction KES ${transaction.amount.toLocaleString()}`,
          type: 'dispute_review',
          related_transaction_id: transaction_id,
        });
      }
    }

    return Response.json({
      success: true,
      dispute,
      message: 'Dispute created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Dispute API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/disputes
 * Get disputes for the authenticated user
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return Response.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Get user's role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    // Build query
    let query = supabase
      .from('disputes')
      .select(`
        *,
        transaction:transactions (id, amount, description, status),
        raised_by_user:users!disputes_raised_by_fkey (id, full_name, email),
        raised_against_user:users!disputes_raised_against_fkey (id, full_name, email)
      `);

    // Filter based on role
    if (userData.role === 'admin') {
      // Admins see all disputes
      if (status) {
        query = query.eq('status', status);
      }
    } else {
      // Users see disputes they're involved in
      query = query.or(`raised_by.eq.${user.id},raised_against.eq.${user.id}`);
      if (status) {
        query = query.eq('status', status);
      }
    }

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    const { data: disputes, error } = await query;

    if (error) {
      console.error('Dispute fetch error:', error);
      return Response.json(
        { error: 'Failed to fetch disputes' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      disputes,
    });

  } catch (error) {
    console.error('Dispute API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
