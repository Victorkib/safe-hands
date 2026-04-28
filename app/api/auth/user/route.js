import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/getServerSupabase';

export async function GET(request) {
  try {
    // Create authenticated client from request (uses Authorization header)
    const supabase = getServerSupabase(request);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the user's profile (RLS will allow only own row)
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        ...(profile || {}),
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
