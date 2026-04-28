/**
 * POST /api/auth/forgot-password
 * Initiates password reset by sending a reset link to user's email
 * Includes rate limiting to prevent abuse
 */

import { supabaseAdmin } from '@/lib/supabaseClient.js';
import { createPasswordResetToken } from '@/lib/tokenService.js';
import { sendPasswordResetEmail } from '@/lib/emailService.js';

// Simple in-memory rate limiting
const forgotAttempts = new Map();

function checkRateLimit(email, limitPerSeconds = 300) {
  const now = Date.now();
  const lastAttempt = forgotAttempts.get(email);

  if (lastAttempt && now - lastAttempt < limitPerSeconds * 1000) {
    return false; // Rate limited
  }

  forgotAttempts.set(email, now);

  // Cleanup old entries
  if (forgotAttempts.size > 1000) {
    const cutoff = now - 30 * 60 * 1000; // Clear entries older than 30 minutes
    for (const [key, value] of forgotAttempts.entries()) {
      if (value < cutoff) {
        forgotAttempts.delete(key);
      }
    }
  }

  return true;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return Response.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log('[v0] /api/auth/forgot-password - Email:', email);

    // Check rate limiting (5 minutes between attempts)
    if (!checkRateLimit(email, 300)) {
      return Response.json(
        { error: 'Please wait 5 minutes before requesting another password reset' },
        { status: 429 }
      );
    }

    // Find user by email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      // Don't reveal whether email exists (security)
      console.warn('[v0] User not found for password reset, email:', email);
      return Response.json({
        success: true,
        message: 'If this email exists in our system, a password reset link will be sent.',
      });
    }

    console.log('[v0] Creating password reset token for user:', user.id);

    // Create password reset token (24-hour expiration)
    const { token, expiresAt } = await createPasswordResetToken(user.id, 24);

    // Build reset link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

    console.log('[v0] Sending password reset email to:', email);

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(user.full_name || 'User', email, resetLink);

    if (!emailResult.success) {
      console.error('[v0] Password reset email sending failed:', emailResult.error);
      return Response.json(
        { error: 'Failed to send password reset email. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[v0] Password reset email sent successfully');

    return Response.json({
      success: true,
      message: 'Password reset link sent to your email. Check your inbox.',
      expiresIn: '24 hours',
    });
  } catch (error) {
    console.error('[v0] Forgot password error:', error.message);
    return Response.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
