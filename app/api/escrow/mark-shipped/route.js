/**
 * POST /api/escrow/mark-shipped
 * Seller marks transaction as shipped
 */

import { escrowService } from '@/lib/escrowService.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      transaction_id,
      seller_id,
      delivery_proof_url,
      shipping_note,
    } = body;

    if (!transaction_id || !seller_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      );
    }

    const transaction = await escrowService.markAsShipped({
      transaction_id,
      seller_id,
      delivery_proof_url,
      shipping_note,
    });

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
        message: 'Item marked as shipped',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Error marking as shipped:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
