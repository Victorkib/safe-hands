import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import { APPEAL_OPEN_STATUSES } from '@/lib/disputeAppeal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assertAdmin(userId) {
  const { data } = await supabase.from('users').select('role').eq('id', userId).single();
  return data?.role === 'admin';
}

/**
 * GET /api/admin/disputes/appeals?status=pending|all
 */
export async function GET(request) {
  try {
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();
    if (!(await assertAdmin(user.id))) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'open';

    let query = supabase
      .from('dispute_appeals')
      .select(
        `
        *,
        dispute:disputes (
          id,
          reason,
          resolution,
          resolved_at,
          admin_notes,
          raised_by,
          raised_against
        ),
        transaction:transactions (
          id,
          amount,
          status,
          description,
          buyer_id,
          seller_id
        )
      `
      )
      .order('created_at', { ascending: false });

    if (statusFilter === 'open') {
      query = query.in('status', APPEAL_OPEN_STATUSES);
    }

    const { data, error } = await query;

    if (error) {
      if (String(error.message || '').includes('dispute_appeals')) {
        return Response.json({
          success: true,
          appeals: [],
          migration_required: true,
        });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    const list = data || [];
    const filerIds = [...new Set(list.map((a) => a.filed_by).filter(Boolean))];
    let filerMap = {};
    if (filerIds.length > 0) {
      const { data: filers } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', filerIds);
      filerMap = Object.fromEntries((filers || []).map((u) => [u.id, u]));
    }

    const enriched = list.map((a) => ({
      ...a,
      filer: filerMap[a.filed_by] || null,
    }));

    return Response.json({ success: true, appeals: enriched });
  } catch (e) {
    console.error('Admin GET appeals:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
