'use server';

import { getServerSupabase } from '@/lib/getServerSupabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin.js';
import { sendVerificationEmail } from '@/lib/emailService.js';
import { createEmailVerificationToken } from '@/lib/tokenService.js';

export async function signupUser(formData) {
  try {
    const { email, name, phone, password, role } = formData;

    // Sign up with Supabase Auth
    // Note: We handle email verification ourselves via custom emails (Gmail)
    // So we don't use Supabase's built-in email confirmation
    const supabase = await getServerSupabase();
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined, // Don't use Supabase's email redirect
        data: {
          full_name: name,
          phone,
          role,
        },
      },
    });

    if (signUpError) {
      return {
        success: false,
        error: signUpError.message,
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'Failed to create account',
      };
    }

    // Create user profile in database using admin client to bypass RLS
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      full_name: name,
      phone_number: phone,
      role,
      kyc_status: 'pending',
      is_active: true,
      account_balance: 0.0,
      total_transactions_completed: 0,
    });

    if (profileError) {
      console.error('[v0] Profile creation error:', profileError);
      return {
        success: false,
        error:
          'Account created but profile setup failed. Please contact support.',
      };
    }

    // Send verification email
    let emailSent = false;
    let emailError = null;

    try {
      const { token } = await createEmailVerificationToken(
        authData.user.id,
        24,
      );
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const verificationLink = `${baseUrl}/auth/verify-email?token=${token}`;

      const emailResult = await sendVerificationEmail(
        email,
        name,
        verificationLink,
      );

      if (emailResult.success) {
        emailSent = true;
      } else {
        emailError = emailResult.error;
      }
    } catch (error) {
      console.error('[v0] Error sending verification:', error.message);
      emailError = error.message;
    }

    return {
      success: true,
      userId: authData.user.id,
      email,
      name,
      emailSent,
      emailError,
    };
  } catch (error) {
    console.error('[v0] Signup error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}
