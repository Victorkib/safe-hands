/**
 * POST /api/admin/dispute/resolve
 * Admin resolves a dispute
 */

import { disputeService } from '@/lib/disputeService.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      dispute_id,
      admin_id,
      resolution,
      admin_notes,
    } = body;

    if (!dispute_id || !admin_id || !resolution) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      );
    }

    const validResolutions = [
      'refund_buyer',
      'release_to_seller',
      'partial_refund',
      'cancelled',
    ];
    if (!validResolutions.includes(resolution)) {
      return new Response(
        JSON.stringify({ error: 'Invalid resolution type' }),
        { status: 400 }
      );
    }

    const dispute = await disputeService.resolveDispute({
      dispute_id,
      admin_id,
      resolution,
      admin_notes,
    });

    return new Response(
      JSON.stringify({
        success: true,
        dispute,
        message: 'Dispute resolved successfully',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Error resolving dispute:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
