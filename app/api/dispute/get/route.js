/**
 * GET /api/dispute/get?id=<disputeId>
 * Get dispute details
 */

import { disputeService } from '@/lib/disputeService.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const disputeId = searchParams.get('id');

    if (!disputeId) {
      return new Response(
        JSON.stringify({ error: 'Dispute ID required' }),
        { status: 400 }
      );
    }

    const dispute = await disputeService.getDispute(disputeId);

    if (!dispute) {
      return new Response(
        JSON.stringify({ error: 'Dispute not found' }),
        { status: 404 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        dispute,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Error getting dispute:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
