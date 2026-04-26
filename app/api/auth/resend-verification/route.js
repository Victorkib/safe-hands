/**
 * POST /api/auth/resend-verification
 * Resends the email verification link to a user
 * Includes rate limiting to prevent abuse
 */

import { supabaseAdmin } from '@/lib/supabaseClient.js';
import { createEmailVerificationToken } from '@/lib/tokenService.js';
import { sendVerificationEmail } from '@/lib/emailService.js';

// Simple in-memory rate limiting (in production, use Redis)
const resendAttempts = new Map();

function checkRateLimit(email, limitPerSeconds = 60) {
  const now = Date.now();
  const lastAttempt = resendAttempts.get(email);

  if (lastAttempt && now - lastAttempt < limitPerSeconds * 1000) {
    return false; // Rate limited
  }

  resendAttempts.set(email, now);

  // Cleanup old entries occasionally
  if (resendAttempts.size > 1000) {
    const cutoff = now - 5 * 60 * 1000; // Clear entries older than 5 minutes
    for (const [key, value] of resendAttempts.entries()) {
      if (value < cutoff) {
        resendAttempts.delete(key);
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

    console.log('[v0] /api/auth/resend-verification - Email:', email);

    // Check rate limiting
    if (!checkRateLimit(email, 60)) {
      return Response.json(
        { error: 'Please wait 60 seconds before requesting another verification email' },
        { status: 429 }
      );
    }

    // Find user by email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email_verified_at')
      .eq('email', email)
      .single();

    if (userError || !user) {
      // Don't reveal whether email exists (security)
      console.warn('[v0] User not found for email:', email);
      return Response.json({
        success: true,
        message: 'If this email exists, a verification link will be sent.',
      });
    }

    // Check if already verified
    if (user.email_verified_at) {
      return Response.json(
        { error: 'This email is already verified. Please login.' },
        { status: 400 }
      );
    }

    console.log('[v0] Creating new verification token for user:', user.id);

    // Create new verification token
    const { token, expiresAt } = await createEmailVerificationToken(user.id, 24);

    // Build verification link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationLink = `${baseUrl}/auth/verify-email?token=${token}`;

    console.log('[v0] Sending verification email to:', email);

    // Send verification email
    const emailResult = await sendVerificationEmail(user.full_name || 'User', email, verificationLink);

    if (!emailResult.success) {
      console.error('[v0] Email sending failed:', emailResult.error);
      return Response.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[v0] Verification email sent successfully');

    return Response.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
      expiresIn: '24 hours',
    });
  } catch (error) {
    console.error('[v0] Resend verification error:', error.message);
    return Response.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
