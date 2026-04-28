/**
 * User Service - Unified User Data Access Layer
 * Provides a single source of truth for user data by merging
 * Supabase Auth data with custom users table data
 */

import { supabase, supabaseAdmin } from '@/lib/supabaseClient.js';

/**
 * Get current user's complete profile
 * Merges auth data with application data
 * @returns {Promise<Object|null>} Complete user profile or null
 */
export async function getCurrentUserProfile() {
  try {
    // Get auth user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error('[v0] Error getting auth user:', authError?.message);
      return null;
    }

    // Get application user data
    const { data: appUser, error: appError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (appError) {
      console.error('[v0] Error getting app user:', appError.message);
      // Return auth data even if app data is missing
      return formatAuthUserData(authUser);
    }

    // Merge data with app data as primary source
    return mergeUserData(authUser, appUser);
  } catch (error) {
    console.error('[v0] Error in getCurrentUserProfile:', error.message);
    return null;
  }
}

/**
 * Get user profile by ID (for admin operations)
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Complete user profile or null
 */
export async function getUserProfileById(userId) {
  try {
    // Get auth user (admin only)
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError || !authUser) {
      console.error('[v0] Error getting auth user:', authError?.message);
      return null;
    }

    // Get application user data
    const { data: appUser, error: appError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (appError) {
      console.error('[v0] Error getting app user:', appError.message);
      return formatAuthUserData(authUser.user);
    }

    return mergeUserData(authUser.user, appUser);
  } catch (error) {
    console.error('[v0] Error in getUserProfileById:', error.message);
    return null;
  }
}

/**
 * Update user profile
 * Updates both auth metadata and application data
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user profile
 */
export async function updateUserProfile(userId, updates) {
  try {
    // Separate auth metadata updates from app data updates
    const authUpdates = {};
    const appUpdates = {};

    // Fields that go to auth metadata
    if (updates.full_name !== undefined)
      authUpdates.full_name = updates.full_name;
    if (updates.phone !== undefined) authUpdates.phone = updates.phone;
    if (updates.role !== undefined) authUpdates.role = updates.role;

    // Fields that go to app database
    if (updates.bio !== undefined) appUpdates.bio = updates.bio;
    if (updates.profile_picture_url !== undefined)
      appUpdates.profile_picture_url = updates.profile_picture_url;
    // ... other app-specific fields

    // Update auth metadata if needed
    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } =
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          data: authUpdates,
        });

      if (authError) {
        console.error('[v0] Error updating auth metadata:', authError.message);
        throw authError;
      }
    }

    // Update app database if needed
    if (Object.keys(appUpdates).length > 0) {
      const { error: appError } = await supabaseAdmin
        .from('users')
        .update(appUpdates)
        .eq('id', userId);

      if (appError) {
        console.error('[v0] Error updating app user:', appError.message);
        throw appError;
      }
    }

    // Return updated profile
    return await getUserProfileById(userId);
  } catch (error) {
    console.error('[v0] Error in updateUserProfile:', error.message);
    throw error;
  }
}

/**
 * Merge auth and app user data
 * App data takes precedence for overlapping fields
 * @param {Object} authUser - Supabase auth user
 * @param {Object} appUser - Application user data
 * @returns {Object} Merged user profile
 */
function mergeUserData(authUser, appUser) {
  return {
    // Core identity (from auth)
    id: authUser.id,
    email: authUser.email,
    email_verified: authUser.email_confirmed_at ? true : false,

    // Application data (primary source)
    full_name:
      appUser.full_name || authUser.user_metadata?.full_name || 'Not provided',
    phone_number:
      appUser.phone_number || authUser.user_metadata?.phone || 'Not provided',
    role: appUser.role || authUser.user_metadata?.role || 'buyer',

    // Profile data (app only)
    profile_picture_url: appUser.profile_picture_url || null,
    bio: appUser.bio || 'Not provided',
    kyc_status: appUser.kyc_status || 'pending',
    kyc_data: appUser.kyc_data || null,

    // Account stats (app only)
    is_active: appUser.is_active ?? true,
    account_balance: appUser.account_balance || 0.0,
    total_transactions_completed: appUser.total_transactions_completed || 0,
    avg_rating: appUser.avg_rating || null,

    // Timestamps
    created_at: appUser.created_at || authUser.created_at,
    updated_at: appUser.updated_at || authUser.updated_at,
    last_login: appUser.last_login || authUser.last_sign_in_at,
    email_verified_at: appUser.email_verified_at || authUser.email_confirmed_at,

    // Auth metadata (for reference)
    auth_metadata: {
      provider: authUser.app_metadata?.provider || 'email',
      confirmed_at: authUser.email_confirmed_at,
      last_sign_in_at: authUser.last_sign_in_at,
    },
  };
}

/**
 * Format auth user data when app data is not available
 * @param {Object} authUser - Supabase auth user
 * @returns {Object} Formatted user profile
 */
function formatAuthUserData(authUser) {
  return {
    id: authUser.id,
    email: authUser.email,
    email_verified: authUser.email_confirmed_at ? true : false,
    full_name: authUser.user_metadata?.full_name || 'Not provided',
    phone_number: authUser.user_metadata?.phone || 'Not provided',
    role: authUser.user_metadata?.role || 'buyer',
    profile_picture_url: null,
    bio: 'Not provided',
    kyc_status: 'pending',
    kyc_data: null,
    is_active: true,
    account_balance: 0.0,
    total_transactions_completed: 0,
    avg_rating: null,
    created_at: authUser.created_at,
    updated_at: authUser.updated_at,
    last_login: authUser.last_sign_in_at,
    email_verified_at: authUser.email_confirmed_at,
    auth_metadata: {
      provider: authUser.app_metadata?.provider || 'email',
      confirmed_at: authUser.email_confirmed_at,
      last_sign_in_at: authUser.last_sign_in_at,
    },
  };
}

/**
 * Check if user's email is verified
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if verified
 */
export async function isEmailVerified(userId) {
  try {
    // Check in auth first (most reliable)
    const { data: authUser } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUser?.user?.email_confirmed_at) {
      return true;
    }

    // Fallback to app database
    const { data: appUser } = await supabaseAdmin
      .from('users')
      .select('email_verified_at')
      .eq('id', userId)
      .single();

    return !!appUser?.email_verified_at;
  } catch (error) {
    console.error('[v0] Error checking email verification:', error.message);
    return false;
  }
}

export default {
  getCurrentUserProfile,
  getUserProfileById,
  updateUserProfile,
  isEmailVerified,
};
