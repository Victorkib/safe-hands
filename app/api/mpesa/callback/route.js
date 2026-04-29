/**
 * POST /api/mpesa/callback
 * Handle M-Pesa payment callback
 */

import { paymentService } from '@/lib/paymentService.js';

export async function POST(request) {
  try {
    const body = await request.json();

    console.log('[v0] M-Pesa callback received:', body);

    // Handle the callback
    const result = await paymentService.handleMpesaCallback(body);

    // M-Pesa expects a specific response format
    return new Response(
      JSON.stringify({
        ResultCode: 0,
        ResultDesc: 'Callback received',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Error processing M-Pesa callback:', error.message);

    // Still return 200 to M-Pesa so they don't retry
    return new Response(
      JSON.stringify({
        ResultCode: 1,
        ResultDesc: 'Error processing callback',
      }),
      { status: 200 }
    );
  }
}
