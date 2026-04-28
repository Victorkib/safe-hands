/**
 * Token Service
 * Handles generation, validation, and expiration of secure tokens
 * Used for email verification and password reset
 */

import crypto from 'crypto';
import { supabaseAdmin } from './supabaseClient.js';

/**
 * Generate a secure random token
 * @param {number} length - Token length (default: 32 bytes = 64 hex chars)
 * @returns {string} Secure random token
 */
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token for storage
 * @param {string} token - Plain token
 * @returns {string} Hashed token
 */
export function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

/**
 * Create and store email verification token
 * @param {string} userId - User ID from auth
 * @param {number} expiresInHours - Token expiration in hours (default: 24)
 * @returns {Promise<Object>} Token and expiration details
 */
export async function createEmailVerificationToken(userId, expiresInHours = 24) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    console.log(`[v0] Creating email verification token for user: ${userId}`);

    // Insert token into database
    const { data, error } = await supabaseAdmin
      .from('email_verification_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error('[v0] Error creating verification token:', error);
      throw error;
    }

    console.log('[v0] Email verification token created successfully');

    return {
      token,
      expiresAt,
      tokenId: data.id,
    };
  } catch (error) {
    console.error('[v0] Error in createEmailVerificationToken:', error.message);
    throw error;
  }
}

/**
 * Verify and use email verification token
 * @param {string} token - Token from email link
 * @returns {Promise<Object>} User ID and result
 */
export async function verifyEmailToken(token) {
  try {
    if (!token) {
      throw new Error('Token is required');
    }

    console.log('[v0] Verifying email token...');

    // Get token from database
    const { data, error: selectError } = await supabaseAdmin
      .from('email_verification_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (selectError || !data) {
      console.error('[v0] Token not found or invalid:', selectError?.message);
      throw new Error('Invalid verification token');
    }

    // Check if already used
    if (data.used_at) {
      console.warn('[v0] Token already used');
      throw new Error('This verification link has already been used');
    }

    // Check if expired
    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      console.warn('[v0] Token expired');
      throw new Error('Verification link has expired. Please request a new one.');
    }

    console.log('[v0] Token is valid, marking as used');

    // Mark token as used
    const { error: updateError } = await supabaseAdmin
      .from('email_verification_tokens')
      .update({
        used_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    if (updateError) {
      console.error('[v0] Error marking token as used:', updateError);
      throw updateError;
    }

    // Update user's email_verified_at
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({
        email_verified_at: new Date().toISOString(),
      })
      .eq('id', data.user_id);

    if (userUpdateError) {
      console.error('[v0] Error updating user email verification status:', userUpdateError);
      throw userUpdateError;
    }

    console.log('[v0] Email verified successfully for user:', data.user_id);

    return {
      success: true,
      userId: data.user_id,
      message: 'Email verified successfully',
    };
  } catch (error) {
    console.error('[v0] Error in verifyEmailToken:', error.message);
    throw error;
  }
}

/**
 * Create password reset token
 * @param {string} userId - User ID from auth
 * @param {number} expiresInHours - Token expiration in hours (default: 24)
 * @returns {Promise<Object>} Token and expiration details
 */
export async function createPasswordResetToken(userId, expiresInHours = 24) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    console.log(`[v0] Creating password reset token for user: ${userId}`);

    // Insert token into database
    const { data, error } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error('[v0] Error creating password reset token:', error);
      throw error;
    }

    console.log('[v0] Password reset token created successfully');

    return {
      token,
      expiresAt,
      tokenId: data.id,
    };
  } catch (error) {
    console.error('[v0] Error in createPasswordResetToken:', error.message);
    throw error;
  }
}

/**
 * Verify password reset token
 * @param {string} token - Token from reset email
 * @returns {Promise<Object>} User ID and validity info
 */
export async function verifyPasswordResetToken(token) {
  try {
    if (!token) {
      throw new Error('Token is required');
    }

    console.log('[v0] Verifying password reset token...');

    // Get token from database
    const { data, error: selectError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (selectError || !data) {
      console.error('[v0] Token not found or invalid:', selectError?.message);
      throw new Error('Invalid password reset token');
    }

    // Check if already used
    if (data.used_at) {
      console.warn('[v0] Token already used');
      throw new Error('This password reset link has already been used');
    }

    // Check if expired
    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      console.warn('[v0] Token expired');
      throw new Error('Password reset link has expired. Please request a new one.');
    }

    console.log('[v0] Password reset token is valid');

    return {
      valid: true,
      userId: data.user_id,
      tokenId: data.id,
    };
  } catch (error) {
    console.error('[v0] Error in verifyPasswordResetToken:', error.message);
    throw error;
  }
}

/**
 * Mark password reset token as used
 * @param {string} tokenId - Token ID from database
 * @returns {Promise<Object>} Update result
 */
export async function usePasswordResetToken(tokenId) {
  try {
    if (!tokenId) {
      throw new Error('Token ID is required');
    }

    console.log('[v0] Marking password reset token as used');

    const { error } = await supabaseAdmin
      .from('password_reset_tokens')
      .update({
        used_at: new Date().toISOString(),
      })
      .eq('id', tokenId);

    if (error) {
      console.error('[v0] Error marking token as used:', error);
      throw error;
    }

    console.log('[v0] Password reset token marked as used');

    return { success: true };
  } catch (error) {
    console.error('[v0] Error in usePasswordResetToken:', error.message);
    throw error;
  }
}

/**
 * Cleanup expired tokens (call this periodically)
 * @returns {Promise<Object>} Cleanup results
 */
export async function cleanupExpiredTokens() {
  try {
    console.log('[v0] Cleaning up expired tokens...');

    const now = new Date().toISOString();

    // Delete expired verification tokens
    const { count: verificationCount, error: verificationError } = await supabaseAdmin
      .from('email_verification_tokens')
      .delete()
      .lt('expires_at', now)
      .is('used_at', null);

    if (verificationError) {
      console.error('[v0] Error cleaning verification tokens:', verificationError);
      throw verificationError;
    }

    // Delete expired password reset tokens
    const { count: resetCount, error: resetError } = await supabaseAdmin
      .from('password_reset_tokens')
      .delete()
      .lt('expires_at', now)
      .is('used_at', null);

    if (resetError) {
      console.error('[v0] Error cleaning password reset tokens:', resetError);
      throw resetError;
    }

    console.log(`[v0] Cleaned up ${verificationCount || 0} verification tokens and ${resetCount || 0} reset tokens`);

    return {
      success: true,
      verificationTokensCleaned: verificationCount || 0,
      resetTokensCleaned: resetCount || 0,
    };
  } catch (error) {
    console.error('[v0] Error in cleanupExpiredTokens:', error.message);
    throw error;
  }
}

/**
 * Check if user's email is verified
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if verified
 */
export async function isEmailVerified(userId) {
  try {
    if (!userId) {
      return false;
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email_verified_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[v0] Error checking email verification:', error);
      return false;
    }

    return !!data?.email_verified_at;
  } catch (error) {
    console.error('[v0] Error in isEmailVerified:', error.message);
    return false;
  }
}

export default {
  generateToken,
  hashToken,
  createEmailVerificationToken,
  verifyEmailToken,
  createPasswordResetToken,
  verifyPasswordResetToken,
  usePasswordResetToken,
  cleanupExpiredTokens,
  isEmailVerified,
};
