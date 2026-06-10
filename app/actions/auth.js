'use server';

import { hasServiceRoleKey, supabaseAdmin } from '@/lib/supabaseAdmin.js';
import { sendVerificationEmail } from '@/lib/emailService.js';
import { createEmailVerificationToken, hashToken } from '@/lib/tokenService.js';

const ALLOWED_ROLES = new Set(['buyer', 'seller', 'admin', 'buyer_seller']);

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

function mapProfileError(error) {
  const msg = String(error?.message || '');
  const details = String(error?.details || '');

  if (error?.code === '23505') {
    if (/phone_number|phone/i.test(msg + details)) {
      return 'This phone number is already registered. Use a different number or log in.';
    }
    if (/email/i.test(msg + details)) {
      return 'This email is already registered. Please log in instead.';
    }
  }
  if (error?.code === '23514' && /role/i.test(msg)) {
    return 'Invalid account type selected. Please try again or contact support.';
  }
  if (error?.code === '42501') {
    return 'Registration is temporarily unavailable (server config). Please contact support.';
  }
  return null;
}

async function findAuthUserByEmail(normalizedEmail) {
  let page = 1;
  const perPage = 200;

  while (page <= 5) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      console.error('[v0] listUsers error:', error.message);
      return null;
    }

    const match = (data?.users || []).find(
      (u) => u.email?.toLowerCase() === normalizedEmail,
    );
    if (match) return match;

    if (!data?.users?.length || data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function insertUserProfile({
  userId,
  normalizedEmail,
  name,
  phone,
  effectiveRole,
}) {
  if (!ALLOWED_ROLES.has(effectiveRole)) {
    return {
      error: {
        code: '23514',
        message: 'invalid role',
        details: 'role',
      },
    };
  }

  return supabaseAdmin.from('users').insert({
    id: userId,
    email: normalizedEmail,
    full_name: name,
    phone_number: phone,
    role: effectiveRole,
    kyc_status: 'pending',
    is_active: true,
    account_balance: 0.0,
    total_transactions_completed: 0,
  });
}

async function rollbackAuthUser(userId) {
  if (!userId) return;
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[v0] Failed to rollback auth user:', error.message);
  }
}

export async function signupUser(formData) {
  try {
    if (!hasServiceRoleKey()) {
      return {
        success: false,
        error:
          'Registration is temporarily unavailable (server config). Please contact support.',
      };
    }

    const { email, name, phone, password, role, inviteToken } = formData;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const effectiveRole = inviteToken && role === 'buyer' ? 'buyer_seller' : role;

    if (!ALLOWED_ROLES.has(effectiveRole)) {
      return {
        success: false,
        error: 'Invalid account type selected. Please try again.',
      };
    }

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

    if (phone) {
      const { data: existingPhone } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('phone_number', phone)
        .maybeSingle();

      if (existingPhone?.id) {
        return {
          success: false,
          error:
            'This phone number is already registered. Use a different number or log in.',
        };
      }
    }

    let authUser = null;
    let createdAuthThisRequest = false;

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
      const duplicateEmail = /already.*registered|already exists|duplicate|user already/i.test(
        signUpError.message || '',
      );

      if (duplicateEmail) {
        const existingAuth = await findAuthUserByEmail(normalizedEmail);
        if (existingAuth?.id) {
          authUser = existingAuth;
        } else {
          return {
            success: false,
            error: mapSignupAuthError(signUpError.message),
          };
        }
      } else {
        return {
          success: false,
          error: mapSignupAuthError(signUpError.message),
        };
      }
    } else if (authData?.user) {
      authUser = authData.user;
      createdAuthThisRequest = true;
    }

    if (!authUser) {
      return {
        success: false,
        error: 'Failed to create account',
      };
    }

    const { error: profileError } = await insertUserProfile({
      userId: authUser.id,
      normalizedEmail,
      name,
      phone,
      effectiveRole,
    });

    if (profileError) {
      console.error('[v0] Profile creation error:', profileError);
      if (createdAuthThisRequest) {
        await rollbackAuthUser(authUser.id);
      }
      return {
        success: false,
        error:
          mapProfileError(profileError) ||
          'Could not complete registration. Please try again or contact support.',
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
            seller_id: authUser.id,
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
            seller_id: authUser.id,
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
              accepted_by_user_id: authUser.id,
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
      const { token } = await createEmailVerificationToken(authUser.id, 24);
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
      userId: authUser.id,
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
