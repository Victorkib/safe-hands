import { getServerSupabase } from '@/lib/getServerSupabase';

export async function DELETE(request, { params }) {
  const supabase = await getServerSupabase(request);

  try {
    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return Response.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('[v0] Delete user error:', error);
    return Response.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}
