import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import { decideDisputeAppeal } from '@/lib/disputeAppealDecide';
import {
  assessAppealReversalSafety,
  suggestOverturnResolution,
} from '@/lib/disputeAppeal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assertAdmin(userId) {
  const { data } = await supabase.from('users').select('role').eq('id', userId).single();
  return data?.role === 'admin';
}

/**
 * POST /api/admin/disputes/appeals/[id]/decide
 * Body: { decision: 'uphold'|'deny'|'overturn', overturn_resolution?, admin_notes }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();
    if (!(await assertAdmin(user.id))) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const decision = body?.decision;
    let overturn_resolution = body?.overturn_resolution;

    if (decision === 'overturn' && !overturn_resolution) {
      const { data: appeal } = await supabase
        .from('dispute_appeals')
        .select('original_resolution, appellant_role')
        .eq('id', id)
        .single();
      if (appeal) {
        overturn_resolution = suggestOverturnResolution(
          appeal.original_resolution,
          appeal.appellant_role
        );
      }
    }

    const result = await decideDisputeAppeal(supabase, {
      appealId: id,
      adminUserId: user.id,
      decision,
      overturn_resolution,
      admin_notes: body?.admin_notes,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status || 500 });
    }

    return Response.json({ success: true, ...result });
  } catch (e) {
    console.error('Appeal decide:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/disputes/appeals/[id]/decide — preview reversal safety for overturn
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();
    if (!(await assertAdmin(user.id))) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const newResolution = searchParams.get('overturn_resolution');

    const { data: appeal } = await supabase
      .from('dispute_appeals')
      .select('*')
      .eq('id', id)
      .single();

    if (!appeal) {
      return Response.json({ error: 'Appeal not found' }, { status: 404 });
    }

    const { data: dispute } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', appeal.dispute_id)
      .single();

    const { data: transaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', appeal.transaction_id)
      .single();

    const suggested =
      newResolution ||
      suggestOverturnResolution(appeal.original_resolution, appeal.appellant_role);

    const safety = await assessAppealReversalSafety(
      supabase,
      dispute,
      transaction,
      suggested
    );

    return Response.json({
      success: true,
      suggested_overturn_resolution: suggested,
      ...safety,
    });
  } catch (e) {
    console.error('Appeal safety preview:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
