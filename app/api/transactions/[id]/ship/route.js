import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/transactions/[id]/ship
 * Seller marks item as shipped with structured evidence
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    // Get request body
    const body = await request.json();
    const { 
      delivery_proof_url, 
      tracking_number, 
      courier,
      notes,
      photos,
      estimated_delivery_date 
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

    // Set auto-release date (3 days from now)
    const autoReleaseDate = new Date();
    autoReleaseDate.setDate(autoReleaseDate.getDate() + 3);
    const shippedAt = new Date().toISOString();

    // Update transaction with shipping details
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        delivery_proof_url,
        tracking_number: tracking_number || null,
        courier: courier || null,
        shipped_at: shippedAt,
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

    // Create structured evidence record
    const evidenceData = {
      transaction_id: id,
      submitted_by: user.id,
      submission_type: 'seller_ship',
      tracking_number: tracking_number || null,
      courier: courier || null,
      estimated_delivery_date: estimated_delivery_date || null,
      notes: notes || null,
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
    await supabase.from('transaction_history').insert({
      transaction_id: id,
      old_status: 'escrow',
      new_status: 'delivered',
      changed_by: user.id,
      reason: `Item shipped. Tracking: ${tracking_number || 'N/A'}${courier ? ` via ${courier}` : ''}`,
    });

    // Notify buyer with shipping details
    const trackingInfo = tracking_number 
      ? `Tracking: ${tracking_number}${courier ? ` (${courier})` : ''}`
      : 'No tracking number provided';
    
    await supabase.from('notifications').insert({
      user_id: transaction.buyer_id,
      title: 'Item Shipped',
      message: `Your item has been shipped. ${trackingInfo}. Please confirm delivery within 3 days or raise a dispute if there are issues.`,
      type: 'item_shipped',
      related_transaction_id: id,
    });

    return Response.json({
      success: true,
      message: 'Item marked as shipped',
      auto_release_date: autoReleaseDate.toISOString(),
      shipped_at: shippedAt,
    });

  } catch (error) {
    console.error('Shipping error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
