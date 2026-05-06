/**
 * POST /api/auth/reset-password
 * Resets user password using a valid reset token
 * Updates both Supabase Auth and user profile
 */

import { verifyPasswordResetToken, usePasswordResetToken } from '@/lib/tokenService.js';
import { supabase, supabaseAdmin } from '@/lib/supabaseAdmin.js';
import { validatePassword } from '@/lib/validation.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, password, confirmPassword } = body;

    // Validate inputs
    if (!token || !password || !confirmPassword) {
      return Response.json(
        { error: 'Token, password, and confirm password are required' },
        { status: 400 }
      );
    }

    // Validate password format
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return Response.json(
        {
          error: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character',
          details: passwordValidation,
        },
        { status: 400 }
      );
    }

    // Check passwords match
    if (password !== confirmPassword) {
      return Response.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    console.log('[v0] /api/auth/reset-password - Verifying token');

    // Verify reset token
    let tokenVerification;
    try {
      tokenVerification = await verifyPasswordResetToken(token);
    } catch (error) {
      console.error('[v0] Token verification failed:', error.message);
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.log('[v0] Token verified for user:', tokenVerification.userId);

    // Get the user from auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      tokenVerification.userId
    );

    if (authError || !authUser) {
      console.error('[v0] Auth user not found:', authError?.message);
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('[v0] Updating password for auth user');

    // Update password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      tokenVerification.userId,
      { password }
    );

    if (updateError) {
      console.error('[v0] Error updating password:', updateError);
      return Response.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[v0] Password updated in auth');

    // Mark password reset token as used
    try {
      await usePasswordResetToken(tokenVerification.tokenId);
      console.log('[v0] Password reset token marked as used');
    } catch (tokenError) {
      console.warn('[v0] Warning: Could not mark token as used, but password was reset:', tokenError.message);
      // Don't fail even if token cleanup fails
    }

    console.log('[v0] Password reset successful for user:', tokenVerification.userId);

    return Response.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
      userId: tokenVerification.userId,
    });
  } catch (error) {
    console.error('[v0] Reset password error:', error.message);
    return Response.json(
      { error: 'An error occurred during password reset. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/reset-password
 * Validates a password reset token (for frontend validation)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return Response.json(
        { valid: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    console.log('[v0] /api/auth/reset-password GET - Validating token');

    // Verify token exists and is valid
    let verification;
    try {
      verification = await verifyPasswordResetToken(token);
    } catch (error) {
      console.warn('[v0] Invalid token:', error.message);
      return Response.json({
        valid: false,
        error: error.message,
      });
    }

    console.log('[v0] Token is valid');

    return Response.json({
      valid: true,
      userId: verification.userId,
      message: 'Reset token is valid',
    });
  } catch (error) {
    console.error('[v0] Token validation error:', error.message);
    return Response.json(
      { valid: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
