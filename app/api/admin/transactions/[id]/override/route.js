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
    const { status, admin_override_notes } = await request.json();

    if (!status) {
      return Response.json({ error: 'Status is required' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['initiated', 'escrow', 'delivered', 'released', 'cancelled', 'disputed'];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Update transaction
    const { error } = await supabase
      .from('transactions')
      .update({
        status,
        admin_override_notes,
        admin_override_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    return Response.json({ 
      success: true, 
      message: 'Transaction status overridden successfully' 
    });
  } catch (error) {
    console.error('[v0] Override transaction error:', error);
    return Response.json(
      { error: error.message || 'Failed to override transaction' },
      { status: 500 }
    );
  }
}
