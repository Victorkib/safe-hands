/**
 * POST /api/dispute/create
 * Create a new dispute
 */

import { disputeService } from '@/lib/disputeService.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      transaction_id,
      raised_by,
      reason,
      description,
      evidence_urls,
    } = body;

    if (!transaction_id || !raised_by || !reason || !description) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      );
    }

    const dispute = await disputeService.createDispute({
      transaction_id,
      raised_by,
      reason,
      description,
      evidence_urls: evidence_urls || [],
    });

    return new Response(
      JSON.stringify({
        success: true,
        dispute,
        message: 'Dispute created. Admin will review shortly.',
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Error creating dispute:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
