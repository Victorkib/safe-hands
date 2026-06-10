import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import {
  uploadEvidenceFilesToBucket,
  MAX_FILES_DISPUTE_APPEND,
} from '@/lib/evidenceUpload';
import {
  APPEAL_GROUNDS,
  canUserFileAppeal,
  computeAppealDeadline,
  validateAppealDescription,
} from '@/lib/disputeAppeal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseStorage = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function loadDisputeContext(disputeId, userId) {
  const { data: dispute, error } = await supabase
    .from('disputes')
    .select(
      `
      *,
      transaction:transactions (id, amount, status, buyer_id, seller_id, description)
    `
    )
    .eq('id', disputeId)
    .single();

  if (error || !dispute) return { error: 'Dispute not found', status: 404 };

  const isParty =
    dispute.raised_by === userId ||
    dispute.raised_against === userId;

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  const isAdmin = userData?.role === 'admin';
  if (!isParty && !isAdmin) {
    return { error: 'You do not have access to this dispute', status: 403 };
  }

  return { dispute, isAdmin };
}

/**
 * GET /api/disputes/[id]/appeals
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const ctx = await loadDisputeContext(id, user.id);
    if (ctx.error) {
      return Response.json({ error: ctx.error }, { status: ctx.status });
    }

    const { data: appeals, error } = await supabase
      .from('dispute_appeals')
      .select('*')
      .eq('dispute_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      if (String(error.message || '').includes('dispute_appeals')) {
        return Response.json({
          success: true,
          appeals: [],
          migration_required: true,
        });
      }
      return Response.json({ error: 'Failed to load appeals' }, { status: 500 });
    }

    const eligibility = canUserFileAppeal(
      user.id,
      ctx.dispute,
      ctx.dispute.transaction,
      appeals || []
    );

    return Response.json({
      success: true,
      appeals: appeals || [],
      eligibility,
    });
  } catch (e) {
    console.error('GET appeals:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/disputes/[id]/appeals — file post-verdict review request
 */
export async function POST(request, { params }) {
  try {
    const { id: disputeId } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return Response.json(
        { error: 'Submit appeal as multipart/form-data with grounds, description, optional files.' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const grounds = String(formData.get('grounds') || '').trim();
    const description = String(formData.get('description') || '').trim();

    if (!APPEAL_GROUNDS.includes(grounds)) {
      return Response.json(
        { error: `grounds must be one of: ${APPEAL_GROUNDS.join(', ')}` },
        { status: 400 }
      );
    }

    const descCheck = validateAppealDescription(description);
    if (!descCheck.ok) {
      return Response.json({ error: descCheck.error }, { status: 400 });
    }

    const files = formData
      .getAll('files')
      .filter((f) => f && typeof f.arrayBuffer === 'function');

    const ctx = await loadDisputeContext(disputeId, user.id);
    if (ctx.error) {
      return Response.json({ error: ctx.error }, { status: ctx.status });
    }

    const { data: existingAppeals } = await supabase
      .from('dispute_appeals')
      .select('filed_by, status')
      .eq('dispute_id', disputeId);

    const eligibility = canUserFileAppeal(
      user.id,
      ctx.dispute,
      ctx.dispute.transaction,
      existingAppeals || []
    );

    if (!eligibility.ok) {
      return Response.json({ error: eligibility.error }, { status: 400 });
    }

    let evidenceUrls = [];
    if (files.length > 0) {
      const { error: uploadError, urls } = await uploadEvidenceFilesToBucket(
        supabaseStorage,
        user.id,
        files,
        'dispute/appeal',
        { maxFiles: MAX_FILES_DISPUTE_APPEND }
      );
      if (uploadError) {
        return Response.json({ error: uploadError }, { status: 400 });
      }
      evidenceUrls = urls;
    }

    const appealDeadline = computeAppealDeadline(ctx.dispute.resolved_at);

    const { data: appeal, error: insErr } = await supabase
      .from('dispute_appeals')
      .insert({
        dispute_id: disputeId,
        transaction_id: ctx.dispute.transaction_id,
        filed_by: user.id,
        appellant_role: eligibility.role,
        grounds,
        description,
        evidence_urls: evidenceUrls,
        status: 'pending',
        original_resolution: ctx.dispute.resolution,
        appeal_deadline_at: appealDeadline,
      })
      .select('*')
      .single();

    if (insErr) {
      if (String(insErr.message || '').includes('dispute_appeals')) {
        return Response.json(
          {
            error: 'Appeals are not enabled yet. Run scripts/028_dispute_appeals.sql in Supabase.',
          },
          { status: 503 }
        );
      }
      if (insErr.code === '23505') {
        return Response.json({ error: 'You have already filed an appeal for this case.' }, { status: 400 });
      }
      console.error('Appeal insert:', insErr);
      return Response.json({ error: 'Failed to submit appeal' }, { status: 500 });
    }

    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
    for (const admin of admins || []) {
      await supabase.from('notifications').insert({
        user_id: admin.id,
        title: 'Post-verdict review requested',
        message: `A party requested review of dispute #${disputeId.slice(0, 8)} (${grounds.replace(/_/g, ' ')}).`,
        type: 'dispute_appeal_filed',
        related_transaction_id: ctx.dispute.transaction_id,
      });
    }

    const otherParty =
      user.id === ctx.dispute.transaction.buyer_id
        ? ctx.dispute.transaction.seller_id
        : ctx.dispute.transaction.buyer_id;

    await supabase.from('notifications').insert({
      user_id: otherParty,
      title: 'Review request filed',
      message: 'The other party requested a post-verdict review. The original outcome stands until an admin decides.',
      type: 'dispute_appeal_filed',
      related_transaction_id: ctx.dispute.transaction_id,
    });

    return Response.json(
      {
        success: true,
        message: 'Your review request was submitted. An admin will decide — funds do not change until then.',
        appeal,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error('POST appeal:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
