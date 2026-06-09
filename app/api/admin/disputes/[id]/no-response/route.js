import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import { resolveDisputeAsAdmin } from '@/lib/disputeResolve';
import { recomputeDisputeRoutingForDispute } from '@/lib/disputeRouting';
import {
  buildNoResponseAdminNotes,
  getResolutionFavoringAccuser,
  hasAccusedResponded,
  isResponseWindowExpired,
} from '@/lib/disputeResponse';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assertAdmin(userId) {
  const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
  if (error || !data || data.role !== 'admin') return false;
  return true;
}

/**
 * POST /api/admin/disputes/[id]/no-response
 * Admin rules in favor of accuser when accused did not respond in time.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();
    if (!(await assertAdmin(user.id))) {
      return Response.json({ error: 'Only admins can apply no-response rulings' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const adminConfirm = body?.confirm === true;

    if (!adminConfirm) {
      return Response.json(
        { error: 'Send { "confirm": true } to confirm the accused did not respond.' },
        { status: 400 }
      );
    }

    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('*, transaction:transactions(*)')
      .eq('id', id)
      .single();

    if (disputeError || !dispute) {
      return Response.json({ error: 'Dispute not found' }, { status: 404 });
    }

    if (['resolved', 'closed'].includes(dispute.status)) {
      return Response.json({ error: 'Dispute already resolved' }, { status: 400 });
    }

    if (hasAccusedResponded(dispute)) {
      return Response.json(
        {
          error:
            'Accused party has already responded — use manual resolve or apply system suggestion instead.',
        },
        { status: 400 }
      );
    }

    if (!isResponseWindowExpired(dispute) && dispute.status === 'awaiting_response') {
      return Response.json(
        {
          error:
            'Response window has not expired yet. Wait for the deadline or use manual resolve if exceptional.',
          response_due_at: dispute.response_due_at,
        },
        { status: 400 }
      );
    }

    const transaction = dispute.transaction;
    const resolution = getResolutionFavoringAccuser(dispute, transaction);
    const admin_notes = buildNoResponseAdminNotes(dispute, transaction);

    await supabase
      .from('disputes')
      .update({
        no_response_ruling: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    const result = await resolveDisputeAsAdmin(supabase, {
      disputeId: id,
      adminUserId: user.id,
      resolution,
      admin_notes,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status || 500 });
    }

    return Response.json({
      success: true,
      message: 'No-response ruling applied in favor of the accuser.',
      resolution: result.resolution,
      verdict_label: result.verdict_label,
    });
  } catch (error) {
    console.error('No-response ruling error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/disputes/[id]/no-response
 * Recompute routing after new evidence (admin trigger).
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();
    if (!(await assertAdmin(user.id))) {
      return Response.json({ error: 'Only admins can recompute routing' }, { status: 403 });
    }

    const recompute = await recomputeDisputeRoutingForDispute(supabase, id);
    if (!recompute.ok) {
      return Response.json({ error: recompute.error || 'Recompute failed' }, { status: 400 });
    }

    return Response.json({
      success: true,
      routing: recompute.routing,
    });
  } catch (error) {
    console.error('Recompute routing error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
