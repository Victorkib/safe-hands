import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/transactions/[id]/ship
 * Seller marks item as shipped
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

    // Get request body
    const body = await request.json();
    const { delivery_proof_url, tracking_number } = body;

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

    // Verify user is the seller
    if (transaction.seller_id !== user.id) {
      return Response.json(
        { error: 'Only the seller can mark item as shipped' },
        { status: 403 }
      );
    }

    // Check transaction status
    if (transaction.status !== 'escrow') {
      return Response.json(
        { error: `Cannot ship transaction with status: ${transaction.status}` },
        { status: 400 }
      );
    }

    // Set auto-release date (3 days from now for buyer to confirm or dispute)
    const autoReleaseDate = new Date();
    autoReleaseDate.setDate(autoReleaseDate.getDate() + 3);

    // Update transaction in single query
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        delivery_proof_url,
        status: 'delivered', // Item shipped, waiting for buyer confirmation
        auto_release_date: autoReleaseDate.toISOString(),
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
      old_status: 'escrow',
      new_status: 'delivered',
      changed_by: user.id,
      reason: `Item shipped. Tracking: ${tracking_number || 'N/A'}. Auto-release: ${autoReleaseDate.toISOString()}`,
    });

    // Notify buyer
    await supabase.from('notifications').insert({
      user_id: transaction.buyer_id,
      title: 'Item Shipped',
      message: `Your item has been shipped. Please confirm delivery within 3 days.`,
      type: 'item_shipped',
      related_transaction_id: id,
    });

    return Response.json({
      success: true,
      message: 'Item marked as shipped',
      auto_release_date: autoReleaseDate.toISOString(),
    });

  } catch (error) {
    console.error('Shipping error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
