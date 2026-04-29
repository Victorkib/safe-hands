import { createClient } from '@supabase/supabase-js';
import { validateTransactionInput } from '@/lib/validation';

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/transactions
 * Create a new escrow transaction
 */
export async function POST(request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return Response.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get user's role from database
    const { data: userData, error: userError } = await supabase
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
    const validationError = validateTransactionInput(body);
    if (validationError) {
      return Response.json(
        { error: validationError },
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
      const { data: sellerData } = await supabase
        .from('users')
        .select('id')
        .eq('email', seller_email)
        .single();

      if (!sellerData) {
        return Response.json(
          { error: 'Seller not found' },
          { status: 404 }
        );
      }
      targetSellerId = sellerData.id;
    }

    // Verify seller exists and has valid role
    const { data: sellerData, error: sellerError } = await supabase
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
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        buyer_id: user.id,
        seller_id: targetSellerId,
        amount: parseFloat(amount),
        currency: 'KES',
        description,
        status: 'initiated',
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
    await supabase.from('transaction_history').insert({
      transaction_id: transaction.id,
      old_status: null,
      new_status: 'initiated',
      changed_by: user.id,
      reason: 'Transaction created',
    });

    // Create notification for seller
    await supabase.from('notifications').insert({
      user_id: targetSellerId,
      title: 'New Transaction Request',
      message: `You have a new transaction request for KES ${amount.toLocaleString()}`,
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
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return Response.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role'); // 'buyer' or 'seller'

    // Build query
    let query = supabase
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
