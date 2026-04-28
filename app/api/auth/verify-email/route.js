/**
 * POST /api/auth/verify-email
 * Verifies an email using a token from the verification link
 */

import { verifyEmailToken } from '@/lib/tokenService.js';
import { sendWelcomeEmail } from '@/lib/emailService.js';
import { supabaseAdmin } from '@/lib/supabaseClient.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return Response.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    console.log('[v0] /api/auth/verify-email - Verifying token');

    // Verify the token and mark email as verified
    const verification = await verifyEmailToken(token);

    // Get user details for welcome email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .eq('id', verification.userId)
      .single();

    if (userError) {
      console.error('[v0] Error fetching user:', userError);
      return Response.json(
        { error: 'Could not fetch user information' },
        { status: 500 }
      );
    }

    // Send welcome email
    try {
      console.log('[v0] Sending welcome email to:', user.email);
      await sendWelcomeEmail(user.email, user.full_name);
    } catch (emailError) {
      console.warn('[v0] Warning: Welcome email failed, but verification succeeded:', emailError.message);
      // Don't fail the verification if welcome email fails
    }

    console.log('[v0] Email verification successful for user:', verification.userId);

    return Response.json({
      success: true,
      message: 'Email verified successfully! You can now login.',
      userId: verification.userId,
    });
  } catch (error) {
    console.error('[v0] Verification error:', error.message);

    // Determine error type for better error messages
    let statusCode = 400;
    let errorMessage = error.message;

    if (error.message.includes('already been used')) {
      statusCode = 400;
      errorMessage = 'This verification link has already been used. Please login instead.';
    } else if (error.message.includes('expired')) {
      statusCode = 400;
      errorMessage = 'Verification link has expired. Please request a new one.';
    } else if (error.message.includes('Invalid')) {
      statusCode = 400;
      errorMessage = 'Invalid verification link. Please check and try again.';
    }

    return Response.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
