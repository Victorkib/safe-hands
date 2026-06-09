import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import {
  uploadEvidenceFilesToBucket,
  MAX_FILES_DISPUTE_APPEND,
} from '@/lib/evidenceUpload';
import { validateDisputeDescription } from '@/lib/disputeCreate';
import { markAccusedResponded } from '@/lib/disputeRouting';
import { isAccusedParty } from '@/lib/disputeResponse';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseStorage = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OPEN_STATUSES = ['open', 'awaiting_response', 'in_review'];

/**
 * POST /api/disputes/[id]/respond
 * Accused party submits written defense + optional evidence (and seller tracking if applicable).
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return Response.json(
        { error: 'Submit defense as multipart/form-data with response_text and optional files.' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const responseTextRaw = formData.get('response_text');
    const responseText = typeof responseTextRaw === 'string' ? responseTextRaw.trim() : '';
    const tracking_number = formData.get('tracking_number');
    const courier = formData.get('courier');

    const files = formData
      .getAll('files')
      .filter((f) => f && typeof f.arrayBuffer === 'function');

    if (!responseText && files.length === 0) {
      return Response.json(
        { error: 'Provide a written defense (at least a few sentences) and/or supporting photos.' },
        { status: 400 }
      );
    }

    if (responseText) {
      const descCheck = validateDisputeDescription(responseText);
      if (!descCheck.ok) {
        return Response.json({ error: descCheck.error }, { status: 400 });
      }
    }

    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('*, transaction:transactions(buyer_id, seller_id, amount)')
      .eq('id', id)
      .single();

    if (disputeError || !dispute) {
      return Response.json({ error: 'Dispute not found' }, { status: 404 });
    }

    if (!isAccusedParty(dispute, user.id)) {
      return Response.json(
        { error: 'Only the accused party in this dispute can submit a defense here.' },
        { status: 403 }
      );
    }

    if (!OPEN_STATUSES.includes(dispute.status)) {
      return Response.json({ error: 'This dispute is no longer open for a defense.' }, { status: 400 });
    }

    if (dispute.accused_responded_at && !responseText && files.length === 0) {
      return Response.json({ error: 'You have already submitted a defense for this dispute.' }, { status: 400 });
    }

    let uploadedUrls = [];
    if (files.length > 0) {
      const currentCount = dispute.evidence_urls ? dispute.evidence_urls.length : 0;
      const remainingSlots = MAX_FILES_DISPUTE_APPEND - currentCount;
      if (remainingSlots < 1) {
        return Response.json(
          { error: 'Maximum evidence files for this dispute have already been uploaded.' },
          { status: 400 }
        );
      }
      if (files.length > remainingSlots) {
        return Response.json(
          {
            error: `You can add at most ${remainingSlots} more file(s) to this dispute.`,
          },
          { status: 400 }
        );
      }

      const { error: uploadError, urls } = await uploadEvidenceFilesToBucket(
        supabaseStorage,
        user.id,
        files,
        'dispute/defense',
        { maxFiles: remainingSlots }
      );

      if (uploadError) {
        return Response.json({ error: uploadError }, { status: 400 });
      }
      uploadedUrls = urls;

      const updatedEvidenceUrls = [...(dispute.evidence_urls || []), ...uploadedUrls];
      await supabase
        .from('disputes')
        .update({ evidence_urls: updatedEvidenceUrls })
        .eq('id', id);
    }

    const transaction = dispute.transaction;
    const isSeller = transaction?.seller_id === user.id;
    const trackingStr = typeof tracking_number === 'string' ? tracking_number.trim() : '';
    const courierStr = typeof courier === 'string' ? courier.trim() : '';

    if (uploadedUrls.length > 0 || responseText) {
      const notesParts = [];
      if (responseText) notesParts.push(`Defense: ${responseText}`);
      if (isSeller && (trackingStr || courierStr)) {
        notesParts.push(
          [trackingStr ? `Tracking: ${trackingStr}` : null, courierStr ? `Courier: ${courierStr}` : null]
            .filter(Boolean)
            .join(' · ')
        );
      }

      await supabase.from('delivery_evidence').insert({
        transaction_id: dispute.transaction_id,
        submitted_by: user.id,
        submission_type: isSeller ? 'seller_additional' : 'buyer_additional',
        photos: uploadedUrls.length > 0 ? uploadedUrls : null,
        tracking_number: isSeller && trackingStr ? trackingStr : null,
        courier: isSeller && courierStr ? courierStr : null,
        notes: notesParts.join('\n\n') || null,
      });
    }

    const markResult = await markAccusedResponded(supabase, id, {
      responseText: responseText || null,
      moveToReview: true,
    });

    if (!markResult.ok) {
      return Response.json(
        {
          error:
            markResult.error ||
            'Defense saved but response tracking failed. Run scripts/027_dispute_response_window.sql.',
        },
        { status: 500 }
      );
    }

    const { data: updated } = await supabase.from('disputes').select('*').eq('id', id).single();

    await supabase.from('notifications').insert({
      user_id: dispute.raised_by,
      title: 'Dispute defense received',
      message: 'The other party submitted a defense. An admin will review both sides.',
      type: 'dispute_review',
      related_transaction_id: dispute.transaction_id,
    });

    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
    for (const admin of admins || []) {
      await supabase.from('notifications').insert({
        user_id: admin.id,
        title: 'Accused party responded',
        message: `Defense submitted on dispute #${id.slice(0, 8)} — review updated system suggestion.`,
        type: 'dispute_review',
        related_transaction_id: dispute.transaction_id,
      });
    }

    return Response.json({
      success: true,
      message: 'Your defense was submitted. The case is now under admin review.',
      dispute: updated,
      routing: markResult.routing,
    });
  } catch (error) {
    console.error('Dispute respond error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
