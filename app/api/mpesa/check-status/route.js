/**
 * GET /api/mpesa/check-status?transactionId=<id>
 * Check M-Pesa payment status
 */

import { paymentService } from '@/lib/paymentService.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: 'Transaction ID required' }),
        { status: 400 }
      );
    }

    const status = await paymentService.checkPaymentStatus(transactionId);

    return new Response(
      JSON.stringify({
        success: true,
        status: status.status,
        data: status,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Error checking payment status:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
