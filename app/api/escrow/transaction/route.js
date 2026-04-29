/**
 * GET /api/escrow/transaction?id=<transactionId>
 * Get transaction details
 */

import { escrowService } from '@/lib/escrowService.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('id');

    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: 'Transaction ID required' }),
        { status: 400 }
      );
    }

    const transaction = await escrowService.getTransaction(transactionId);

    if (!transaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Error getting transaction:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
