/**
 * POST /api/escrow/create-transaction
 * Create a new escrow transaction
 */

import { supabase } from '@/lib/supabaseClient.js';
import { escrowService } from '@/lib/escrowService.js';
import { validateTransactionInput } from '@/lib/validation.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      buyer_id,
      seller_id,
      amount,
      description,
      seller_phone,
      seller_email,
    } = body;

    // Validate input
    const validation = validateTransactionInput({
      buyer_id,
      seller_id,
      amount,
      description,
    });

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.errors }),
        { status: 400 }
      );
    }

    // Verify seller exists
    const { data: seller, error: sellerError } = await supabase
      .from('users')
      .select('id, email, phone_number')
      .eq('id', seller_id)
      .single();

    if (sellerError || !seller) {
      return new Response(
        JSON.stringify({ error: 'Seller not found' }),
        { status: 404 }
      );
    }

    // Create transaction
    const transaction = await escrowService.createTransaction({
      buyer_id,
      seller_id,
      amount,
      description,
      seller_phone: seller_phone || seller.phone_number,
      seller_email: seller_email || seller.email,
    });

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
        message: 'Transaction created. Proceed to payment.',
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Error creating transaction:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
