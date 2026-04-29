/**
 * GET /api/escrow/list?userId=<userId>&role=<buyer|seller|all>
 * List user's transactions
 */

import { escrowService } from '@/lib/escrowService.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role') || 'all';

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 400 }
      );
    }

    const transactions = await escrowService.getUserTransactions(userId, role);

    return new Response(
      JSON.stringify({
        success: true,
        transactions,
        count: transactions?.length || 0,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Error listing transactions:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
