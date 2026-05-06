import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/transactions/[id]/evidence
 * Get all delivery evidence for a transaction
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    // Get transaction to verify access
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('id, buyer_id, seller_id')
      .eq('id', id)
      .single();

    if (transactionError || !transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Verify user is involved in transaction or is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin';
    const isInvolved = transaction.buyer_id === user.id || transaction.seller_id === user.id;

    if (!isInvolved && !isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch all evidence for this transaction
    const { data: evidence, error: evidenceError } = await supabase
      .from('delivery_evidence')
      .select(`
        *,
        submitter:users!delivery_evidence_submitted_by_fkey (id, full_name, email)
      `)
      .eq('transaction_id', id)
      .order('submitted_at', { ascending: true });

    if (evidenceError) {
      console.error('Evidence fetch error:', evidenceError);
      return Response.json({ error: 'Failed to fetch evidence' }, { status: 500 });
    }

    return Response.json({
      success: true,
      evidence: evidence || [],
    });

  } catch (error) {
    console.error('Evidence API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/transactions/[id]/evidence
 * Submit additional evidence for a transaction
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const { submission_type, notes, photos, tracking_number, courier } = body;

    // Validate submission_type
    const validTypes = ['seller_ship', 'buyer_receive', 'seller_additional', 'buyer_additional'];
    if (!submission_type || !validTypes.includes(submission_type)) {
      return Response.json(
        { error: `Invalid submission_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Get transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (transactionError || !transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Verify user role matches submission type
    const isBuyer = transaction.buyer_id === user.id;
    const isSeller = transaction.seller_id === user.id;

    if (!isBuyer && !isSeller) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate submission type matches user role
    if ((submission_type === 'seller_ship' || submission_type === 'seller_additional') && !isSeller) {
      return Response.json({ error: 'Only seller can submit shipping evidence' }, { status: 403 });
    }
    if ((submission_type === 'buyer_receive' || submission_type === 'buyer_additional') && !isBuyer) {
      return Response.json({ error: 'Only buyer can submit delivery confirmation' }, { status: 403 });
    }

    // Insert evidence record
    const evidenceData = {
      transaction_id: id,
      submitted_by: user.id,
      submission_type,
      notes: notes || null,
      photos: photos || [],
      tracking_number: submission_type === 'seller_ship' ? (tracking_number || null) : null,
      courier: submission_type === 'seller_ship' ? (courier || null) : null,
    };

    const { data: evidence, error: insertError } = await supabase
      .from('delivery_evidence')
      .insert(evidenceData)
      .select()
      .single();

    if (insertError) {
      console.error('Evidence insert error:', insertError);
      return Response.json({ error: 'Failed to submit evidence' }, { status: 500 });
    }

    return Response.json({
      success: true,
      evidence,
      message: 'Evidence submitted successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Evidence API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
