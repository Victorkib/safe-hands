/**
 * POST /api/mpesa/initiate
 * Initiate M-Pesa STK push payment
 */

import { paymentService } from '@/lib/paymentService.js';
import { validatePhoneNumber } from '@/lib/validation.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { transaction_id, buyer_id, phone_number, amount } = body;

    if (!transaction_id || !buyer_id || !phone_number || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      );
    }

    // Validate phone
    if (!validatePhoneNumber(phone_number)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Amount must be greater than 0' }),
        { status: 400 }
      );
    }

    const result = await paymentService.initiatePayment({
      transaction_id,
      buyer_id,
      phone_number,
      amount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        message: 'Payment prompt sent to your phone',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Error initiating payment:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
