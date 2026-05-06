import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import { generateToken, hashToken } from '@/lib/tokenService';
import { sendSellerInvitationEmail } from '@/lib/emailService';

export async function POST(request) {
  try {
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const { email, amount, description } = body;

    if (!email || !amount || !description) {
      return Response.json(
        { error: 'email, amount, and description are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const invitationToken = generateToken(32);
    const tokenHash = hashToken(invitationToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const { data: buyer } = await supabaseAdmin
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('seller_invitations')
      .insert({
        email: normalizedEmail,
        invited_by_user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        status: 'pending',
        requested_amount: Number(amount),
        requested_currency: 'KES',
        requested_description: description,
      })
      .select('*')
      .single();

    if (invitationError || !invitation) {
      console.error('Invitation creation error:', invitationError);
      return Response.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const invitationLink = `${baseUrl}/auth/signup?invite=${encodeURIComponent(invitationToken)}`;

    const emailResult = await sendSellerInvitationEmail(
      normalizedEmail,
      buyer?.full_name || 'A buyer',
      invitationLink,
      amount,
      description,
    );

    return Response.json({
      success: true,
      invitationId: invitation.id,
      emailSent: !!emailResult?.success,
      message: 'Seller invitation created',
    });
  } catch (error) {
    console.error('Seller invitation API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
