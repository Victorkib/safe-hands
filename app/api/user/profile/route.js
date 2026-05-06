/**
 * GET /api/user/profile
 * Returns the current user's complete profile
 * Merges auth data with application data
 */

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/getServerSupabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin.js';

export async function GET(request) {
  try {
    // Get authenticated Supabase client
    const supabase = await getServerSupabase(request);

    // Get the user from the session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[v0] Auth error:', authError?.message);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get application user data
    const { data: appUser, error: appError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (appError) {
      console.error('[v0] Error getting app user:', appError.message);
    }

    // Merge data
    const profile = mergeUserData(user, appUser);

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('[v0] Error fetching user profile:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 },
    );
  }
}

function mergeUserData(authUser, appUser) {
  return {
    id: authUser.id,
    email: authUser.email,
    email_verified: authUser.email_confirmed_at ? true : false,
    full_name:
      appUser?.full_name || authUser.user_metadata?.full_name || 'Not provided',
    phone_number:
      appUser?.phone_number || authUser.user_metadata?.phone || 'Not provided',
    role: appUser?.role || authUser.user_metadata?.role || 'buyer',
    profile_picture_url: appUser?.profile_picture_url || null,
    bio: appUser?.bio || 'Not provided',
    kyc_status: appUser?.kyc_status || 'pending',
    kyc_data: appUser?.kyc_data || null,
    is_active: appUser?.is_active ?? true,
    account_balance: appUser?.account_balance || 0.0,
    total_transactions_completed: appUser?.total_transactions_completed || 0,
    avg_rating: appUser?.avg_rating || null,
    created_at: appUser?.created_at || authUser.created_at,
    updated_at: appUser?.updated_at || authUser.updated_at,
    last_login: appUser?.last_login || authUser.last_sign_in_at,
    email_verified_at:
      appUser?.email_verified_at || authUser.email_confirmed_at,
  };
}

/**
 * PUT /api/user/profile
 * Updates the current user's profile
 */
export async function PUT(request) {
  try {
    // Get authenticated Supabase client and user
    const supabase = await getServerSupabase(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { full_name, phone, bio, profile_picture_url } = body;

    // Validate input
    if (!full_name && !phone && !bio && !profile_picture_url) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 },
      );
    }

    // Build updates object for app database
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (bio !== undefined) updates.bio = bio;
    if (profile_picture_url !== undefined)
      updates.profile_picture_url = profile_picture_url;

    // Update auth metadata if needed
    const authUpdates = {};
    if (full_name !== undefined) authUpdates.full_name = full_name;
    if (phone !== undefined) authUpdates.phone = phone;

    // Update auth metadata
    if (Object.keys(authUpdates).length > 0) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        data: authUpdates,
      });
    }

    // Update app database
    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from('users').update(updates).eq('id', user.id);
    }

    // Get updated profile
    const { data: appUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    const profile = mergeUserData(user, appUser);

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: profile,
    });
  } catch (error) {
    console.error('[v0] Error updating profile:', error.message);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 },
    );
  }
}
