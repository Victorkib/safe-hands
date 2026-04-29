import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function PATCH(request, { params }) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
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

    const { id } = params;
    const { decision, admin_notes } = await request.json();

    if (!decision) {
      return Response.json({ error: 'Decision is required' }, { status: 400 });
    }

    // Update dispute
    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'resolved',
        decision,
        admin_notes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    // If buyer wins or split, handle refund logic here
    if (decision === 'buyer_wins' || decision === 'split') {
      const { data: dispute } = await supabase
        .from('disputes')
        .select('transaction_id')
        .eq('id', id)
        .single();

      if (dispute) {
        // Update transaction status to cancelled or mark for refund
        await supabase
          .from('transactions')
          .update({ status: 'cancelled' })
          .eq('id', dispute.transaction_id);
      }
    }

    return Response.json({ success: true, message: 'Dispute resolved successfully' });
  } catch (error) {
    console.error('[v0] Resolve dispute error:', error);
    return Response.json(
      { error: error.message || 'Failed to resolve dispute' },
      { status: 500 }
    );
  }
}
