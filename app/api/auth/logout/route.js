import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/getServerSupabase';

export async function POST(request) {
  try {
    // Create authenticated client from request Authorization header
    const supabase = await getServerSupabase(request);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Best practice: clients should clear their own session via supabase.auth.signOut()
    // We attempt to revoke server-side if possible, but success does not
    // depend on it since token is client-held.
    try {
      await supabase.auth.signOut();
    } catch (_) {
      // Ignore server-side signOut errors; client will clear session
    }

    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
