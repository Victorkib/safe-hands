import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function PATCH(request, { params }) {
  const supabase = getSupabase();
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Verify admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { decision, admin_notes } = await request.json();

    if (!decision) {
      return Response.json({ error: 'Decision is required' }, { status: 400 });
    }

    // Update dispute
    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'resolved',
        resolution: decision,
        admin_notes,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    // Get the dispute to find the transaction
    const { data: dispute } = await supabase
      .from('disputes')
      .select('transaction_id')
      .eq('id', id)
      .single();

    if (dispute) {
      // Update transaction status based on decision
      let newStatus = 'disputed'; // Default
      if (decision === 'refund_buyer') {
        newStatus = 'refunded';
      } else if (decision === 'release_to_seller') {
        newStatus = 'released';
      } else if (decision === 'cancelled') {
        newStatus = 'cancelled';
      }

      await supabase
        .from('transactions')
        .update({ 
          status: newStatus,
          is_disputed: false,
          completed_at: new Date().toISOString()
        })
        .eq('id', dispute.transaction_id);

      // Log to transaction history
      await supabase.from('transaction_history').insert({
        transaction_id: dispute.transaction_id,
        old_status: 'disputed',
        new_status: newStatus,
        changed_by: user.id,
        reason: `Dispute resolved by admin. Decision: ${decision}`,
      });
    }

    return Response.json({ success: true, message: 'Dispute resolved successfully' });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    return Response.json(
      { error: error.message || 'Failed to resolve dispute' },
      { status: 500 }
    );
  }
}
