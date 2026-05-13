import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import { getResumeStatusBeforePaymentPending } from '@/lib/mpesaPayment';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** STK requests older than this can be abandoned by the buyer (Safaricom-side usually dead). */
const STALE_MS = 8 * 60 * 1000;

/**
 * POST /api/transactions/[id]/abandon-checkout
 * Buyer clears a stuck payment_pending STK so they can initiate a new push.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (transactionError || !transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.buyer_id !== user.id) {
      return Response.json({ error: 'Only the buyer can abandon a checkout' }, { status: 403 });
    }

    if (transaction.status !== 'payment_pending') {
      return Response.json(
        { error: `Nothing to abandon (status is ${transaction.status})` },
        { status: 400 }
      );
    }

    if (!transaction.mpesa_ref) {
      return Response.json({ error: 'No pending checkout reference' }, { status: 400 });
    }

    if (transaction.payment_confirmed_at) {
      return Response.json({ error: 'Payment already confirmed' }, { status: 400 });
    }

    const updatedAt = transaction.updated_at ? new Date(transaction.updated_at).getTime() : 0;
    if (Date.now() - updatedAt < STALE_MS) {
      return Response.json(
        {
          error:
            'This checkout is still fresh. Wait a few minutes for Safaricom to confirm, or use automatic status checks on the page.',
          retryAfterMs: STALE_MS - (Date.now() - updatedAt),
        },
        { status: 409 }
      );
    }

    const resume = await getResumeStatusBeforePaymentPending(supabase, id);

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: resume,
        mpesa_ref: null,
        mpesa_phone: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'payment_pending')
      .is('payment_confirmed_at', null);

    if (updateError) {
      console.error('Abandon checkout error:', updateError);
      return Response.json({ error: 'Failed to reset checkout' }, { status: 500 });
    }

    await supabase.from('transaction_history').insert({
      transaction_id: id,
      old_status: 'payment_pending',
      new_status: resume,
      changed_by: user.id,
      reason: 'Buyer abandoned stale STK checkout (callback unreachable or timed out).',
    });

    return Response.json({
      success: true,
      message: 'Checkout cleared. You can try paying again.',
      status: resume,
    });
  } catch (error) {
    console.error('abandon-checkout error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
