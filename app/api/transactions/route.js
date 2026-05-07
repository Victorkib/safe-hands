import { getServerSupabase } from '@/lib/getServerSupabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin.js';
import { validateTransactionForm } from '@/lib/validation';
import { generateToken, hashToken } from '@/lib/tokenService';
import { sendSellerInvitationEmail } from '@/lib/emailService';

/**
 * POST /api/transactions
 * Create a new escrow transaction
 */
export async function POST(request) {
  try {
    console.log('=== TRANSACTION API CALL STARTED ===');
    
    // Authenticate via cookie-based server client
    const supabase = await getServerSupabase(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('User authenticated:', user.id);

    // Get user's role from database
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, phone_number')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { seller_id, amount, description, seller_email } = body;

    // Validate input
    const validationErrors = validateTransactionForm(body);
    if (Object.keys(validationErrors).length > 0) {
      return Response.json(
        { error: Object.values(validationErrors)[0] }, // Return first error message
        { status: 400 }
      );
    }

    // Check if user can create transactions (must be buyer or buyer_seller)
    if (userData.role !== 'buyer' && userData.role !== 'buyer_seller') {
      return Response.json(
        { error: 'Only buyers can create transactions' },
        { status: 403 }
      );
    }

    // Find seller by email if seller_id not provided
    let targetSellerId = seller_id;
    if (!seller_id && seller_email) {
      const { data: sellerData } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', seller_email)
        .single();

      if (!sellerData) {
        const invitationToken = generateToken(32);
        const tokenHash = hashToken(invitationToken);
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        const normalizedSellerEmail = String(seller_email).trim().toLowerCase();

        const { data: invitation, error: invitationError } = await supabaseAdmin
          .from('seller_invitations')
          .insert({
            email: normalizedSellerEmail,
            invited_by_user_id: user.id,
            token_hash: tokenHash,
            expires_at: expiresAt,
            status: 'pending',
            requested_amount: parseFloat(amount),
            requested_currency: 'KES',
            requested_description: description,
          })
          .select('id')
          .single();

        if (invitationError || !invitation) {
          return Response.json(
            { error: 'Seller not found and invitation could not be created' },
            { status: 500 }
          );
        }

        const { data: buyerProfile } = await supabaseAdmin
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single();

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const invitationLink = `${baseUrl}/auth/signup?invite=${encodeURIComponent(invitationToken)}`;
        const emailResult = await sendSellerInvitationEmail(
          normalizedSellerEmail,
          buyerProfile?.full_name || 'A buyer',
          invitationLink,
          amount,
          description
        );

        return Response.json(
          {
            success: true,
            invitation_created: true,
            invitation_id: invitation.id,
            email_sent: !!emailResult?.success,
            message: 'Seller has no account yet. Invitation sent for onboarding.',
          },
          { status: 202 }
        );
      }
      targetSellerId = sellerData.id;
    }

    // Verify seller exists and has valid role
    const { data: sellerData, error: sellerError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', targetSellerId)
      .single();

    if (sellerError || !sellerData) {
      return Response.json(
        { error: 'Seller not found' },
        { status: 404 }
      );
    }

    if (sellerData.role !== 'seller' && sellerData.role !== 'buyer_seller') {
      return Response.json(
        { error: 'Invalid seller role' },
        { status: 400 }
      );
    }

    // Prevent self-transactions
    if (targetSellerId === user.id) {
      return Response.json(
        { error: 'Cannot create transaction with yourself' },
        { status: 400 }
      );
    }

    // Create transaction
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        buyer_id: user.id,
        seller_id: targetSellerId,
        amount: parseFloat(amount),
        currency: 'KES',
        description,
        status: 'pending_seller_approval',
        payment_method: 'mpesa',
        mpesa_phone: userData.phone_number,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Transaction creation error:', transactionError);
      return Response.json(
        { error: 'Failed to create transaction' },
        { status: 500 }
      );
    }

    // Log to audit trail
    await supabaseAdmin.from('transaction_history').insert({
      transaction_id: transaction.id,
      old_status: null,
      new_status: 'pending_seller_approval',
      changed_by: user.id,
      reason: 'Transaction created and awaiting seller approval',
    });

    await supabaseAdmin.from('seller_transaction_requests').insert({
      transaction_id: transaction.id,
      seller_id: targetSellerId,
      buyer_id: user.id,
      status: 'pending',
      seller_message: null,
      proposed_amount: null,
    });

    // Create notification for seller
    await supabaseAdmin.from('notifications').insert({
      user_id: targetSellerId,
      title: 'Transaction Approval Needed',
      message: `You have a new transaction request awaiting approval for KES ${amount.toLocaleString()}`,
      type: 'transaction_created',
      related_transaction_id: transaction.id,
    });

    return Response.json({
      success: true,
      transaction,
      message: 'Transaction created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Transaction API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transactions
 * Get transactions for the authenticated user
 */
export async function GET(request) {
  try {
    const supabase = await getServerSupabase(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role'); // 'buyer' or 'seller'

    // Build query
    let query = supabaseAdmin
      .from('transactions')
      .select(`
        *,
        buyer:users!transactions_buyer_id_fkey (id, email, full_name),
        seller:users!transactions_seller_id_fkey (id, email, full_name)
      `);

    // Filter by user's role in transaction
    if (role === 'buyer') {
      query = query.eq('buyer_id', user.id);
    } else if (role === 'seller') {
      query = query.eq('seller_id', user.id);
    } else {
      // Get all transactions where user is either buyer or seller
      query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Transaction fetch error:', error);
      return Response.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      transactions,
    });

  } catch (error) {
    console.error('Transaction API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
