/**
 * POST /api/escrow/confirm-delivery
 * Buyer confirms delivery and triggers fund release
 */

import { escrowService } from '@/lib/escrowService.js';
import { paymentService } from '@/lib/paymentService.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      transaction_id,
      buyer_id,
      delivery_confirmation_text,
      rating,
    } = body;

    if (!transaction_id || !buyer_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      );
    }

    const transaction = await escrowService.confirmDelivery({
      transaction_id,
      buyer_id,
      delivery_confirmation_text,
      rating,
    });

    // Release funds to seller
    await paymentService.releasePayment(transaction_id);

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
        message: 'Delivery confirmed. Funds released to seller.',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Error confirming delivery:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
