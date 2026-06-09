'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin.js';
import { sendVerificationEmail } from '@/lib/emailService.js';
import { createEmailVerificationToken, hashToken } from '@/lib/tokenService.js';

function mapSignupAuthError(message) {
  const msg = String(message || '');
  if (/already.*registered|already exists|duplicate|user already/i.test(msg)) {
    return 'This email is already registered. Please login instead.';
  }
  if (/rate limit|too many requests|email.*limit/i.test(msg)) {
    return 'Registration is temporarily busy. Please try again in a few minutes.';
  }
  return msg || 'Failed to create account';
}

export async function signupUser(formData) {
  try {
    const { email, name, phone, password, role, inviteToken } = formData;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const effectiveRole = inviteToken && role === 'buyer' ? 'buyer_seller' : role;

    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile?.id) {
      return {
        success: false,
        error: 'This email is already registered. Please login instead.',
      };
    }

    // Admin createUser avoids Supabase Auth SMTP rate limits — verification goes via Gmail/Mailjet.
    const { data: authData, error: signUpError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: false,
        user_metadata: {
          full_name: name,
          phone,
          role: effectiveRole,
        },
      });

    if (signUpError) {
      return {
        success: false,
        error: mapSignupAuthError(signUpError.message),
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
      email: normalizedEmail,
      full_name: name,
      phone_number: phone,
      role: effectiveRole,
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

    // If this signup came from seller invitation, accept it and create pending transaction.
    if (inviteToken) {
      const tokenHash = hashToken(inviteToken);
      const nowIso = new Date().toISOString();

      const { data: invitation } = await supabaseAdmin
        .from('seller_invitations')
        .select('*')
        .eq('token_hash', tokenHash)
        .eq('status', 'pending')
        .gt('expires_at', nowIso)
        .single();

      if (
        invitation &&
        invitation.email.toLowerCase() === normalizedEmail
      ) {
        const { data: transaction, error: createTxnError } = await supabaseAdmin
          .from('transactions')
          .insert({
            buyer_id: invitation.invited_by_user_id,
            seller_id: authData.user.id,
            amount: invitation.requested_amount,
            currency: invitation.requested_currency || 'KES',
            description: invitation.requested_description,
            status: 'pending_seller_approval',
            payment_method: 'mpesa',
          })
          .select('id')
          .single();

        if (!createTxnError && transaction) {
          await supabaseAdmin.from('seller_transaction_requests').insert({
            transaction_id: transaction.id,
            seller_id: authData.user.id,
            buyer_id: invitation.invited_by_user_id,
            status: 'pending',
          });

          await supabaseAdmin.from('transaction_history').insert({
            transaction_id: transaction.id,
            old_status: null,
            new_status: 'pending_seller_approval',
            changed_by: invitation.invited_by_user_id,
            reason: 'Transaction created from seller invitation during signup',
          });

          await supabaseAdmin
            .from('seller_invitations')
            .update({
              status: 'accepted',
              accepted_by_user_id: authData.user.id,
              accepted_at: nowIso,
            })
            .eq('id', invitation.id);

          await supabaseAdmin.from('notifications').insert({
            user_id: invitation.invited_by_user_id,
            title: 'Seller Joined and Request Opened',
            message: 'Your invited seller has joined and can now approve the transaction.',
            type: 'seller_invitation_accepted',
            related_transaction_id: transaction.id,
          });
        }
      }
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
        normalizedEmail,
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
      email: normalizedEmail,
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
