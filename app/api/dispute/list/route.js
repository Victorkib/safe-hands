/**
 * GET /api/dispute/list?userId=<userId>
 * List user's disputes
 */

import { disputeService } from '@/lib/disputeService.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 400 }
      );
    }

    const disputes = await disputeService.getUserDisputes(userId);

    return new Response(
      JSON.stringify({
        success: true,
        disputes,
        count: disputes?.length || 0,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Error listing disputes:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
