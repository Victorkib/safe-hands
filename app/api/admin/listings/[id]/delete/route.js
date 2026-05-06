import { getServerSupabase } from '@/lib/getServerSupabase';

export async function DELETE(request, { params }) {
  const supabase = await getServerSupabase(request);

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

    const { id } = await params;

    // Delete listing
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return Response.json({ success: true, message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('[v0] Delete listing error:', error);
    return Response.json(
      { error: error.message || 'Failed to delete listing' },
      { status: 500 }
    );
  }
}
