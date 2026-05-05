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
    const { status, admin_override_notes } = await request.json();

    if (!status) {
      return Response.json({ error: 'Status is required' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['initiated', 'escrow', 'delivered', 'released', 'cancelled', 'disputed', 'refunded'];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Get current transaction status for history
    const { data: currentTxn } = await supabase
      .from('transactions')
      .select('status')
      .eq('id', id)
      .single();

    // Update transaction
    const { error } = await supabase
      .from('transactions')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    // Log to transaction history
    await supabase.from('transaction_history').insert({
      transaction_id: id,
      old_status: currentTxn?.status || 'unknown',
      new_status: status,
      changed_by: user.id,
      reason: `Admin override: ${admin_override_notes || 'No notes provided'}`,
    });

    return Response.json({ 
      success: true, 
      message: 'Transaction status overridden successfully' 
    });
  } catch (error) {
    console.error('Override transaction error:', error);
    return Response.json(
      { error: error.message || 'Failed to override transaction' },
      { status: 500 }
    );
  }
}
