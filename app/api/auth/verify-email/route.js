/**
 * POST /api/auth/verify-email
 * Verifies an email using a token from the verification link
 * This updates BOTH our custom users table AND Supabase Auth's confirmed_at
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
        { status: 400 },
      );
    }

    console.log('[v0] /api/auth/verify-email - Verifying token');

    // Verify the token and mark email as verified in our custom table
    const verification = await verifyEmailToken(token);

    console.log('[v0] Token verified for user:', verification.userId);

    // CRITICAL: Also confirm the user in Supabase Auth
    // This sets the confirmed_at field so they can login
    console.log('[v0] Confirming user in Supabase Auth...');

    let authConfirmed = false;
    try {
      const { data: authUser, error: confirmError } =
        await supabaseAdmin.auth.admin.updateUserById(verification.userId, {
          email_confirm: true, // This confirms the email in Supabase Auth
        });

      if (confirmError) {
        console.error(
          '[v0] Error confirming user in Supabase Auth:',
          confirmError.message,
        );
        // Don't fail completely - the custom verification succeeded
        // But log this as a warning
      } else {
        console.log(
          '[v0] User confirmed in Supabase Auth:',
          authUser.user?.email,
        );
        authConfirmed = true;
      }
    } catch (authError) {
      console.error('[v0] Auth confirmation error:', authError.message);
      // Continue - custom verification is still valid
    }

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
        { status: 500 },
      );
    }

    // Send welcome email
    try {
      console.log('[v0] Sending welcome email to:', user.email);
      await sendWelcomeEmail(user.email, user.full_name);
    } catch (emailError) {
      console.warn(
        '[v0] Warning: Welcome email failed, but verification succeeded:',
        emailError.message,
      );
      // Don't fail the verification if welcome email fails
    }

    console.log(
      '[v0] Email verification complete for user:',
      verification.userId,
    );

    return Response.json({
      success: true,
      message: 'Email verified successfully! You can now login.',
      userId: verification.userId,
      authConfirmed: authConfirmed, // Indicate if Supabase Auth was also confirmed
    });
  } catch (error) {
    console.error('[v0] Verification error:', error.message);

    // Determine error type for better error messages
    let statusCode = 400;
    let errorMessage = error.message;

    if (error.message.includes('already been used')) {
      statusCode = 400;
      errorMessage =
        'This verification link has already been used. Please login instead.';
    } else if (error.message.includes('expired')) {
      statusCode = 400;
      errorMessage = 'Verification link has expired. Please request a new one.';
    } else if (error.message.includes('Invalid')) {
      statusCode = 400;
      errorMessage = 'Invalid verification link. Please check and try again.';
    }

    return Response.json({ error: errorMessage }, { status: statusCode });
  }
}
