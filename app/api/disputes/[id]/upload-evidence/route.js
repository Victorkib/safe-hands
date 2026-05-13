import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import {
  uploadEvidenceFilesToBucket,
  MAX_FILES_DISPUTE_APPEND,
} from '@/lib/evidenceUpload';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseStorage = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/disputes/[id]/upload-evidence
 * Upload evidence images for a dispute
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', id)
      .single();

    if (disputeError || !dispute) {
      return Response.json({ error: 'Dispute not found' }, { status: 404 });
    }

    if (dispute.raised_by !== user.id && dispute.raised_against !== user.id) {
      return Response.json(
        { error: 'You can only upload evidence for disputes you are involved in' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const files = formData
      .getAll('files')
      .filter((f) => f && typeof f.arrayBuffer === 'function');

    if (!files || files.length === 0) {
      return Response.json({ error: 'No files provided' }, { status: 400 });
    }

    const currentEvidenceCount = dispute.evidence_urls ? dispute.evidence_urls.length : 0;
    const remainingSlots = MAX_FILES_DISPUTE_APPEND - currentEvidenceCount;
    if (remainingSlots < 1) {
      return Response.json(
        { error: 'Maximum evidence files for this dispute have already been uploaded.' },
        { status: 400 }
      );
    }
    if (files.length > remainingSlots) {
      return Response.json(
        {
          error: `You can add at most ${remainingSlots} more file(s). This dispute already has ${currentEvidenceCount} of ${MAX_FILES_DISPUTE_APPEND} allowed.`,
        },
        { status: 400 }
      );
    }

    const { error: uploadError, urls: uploadedUrls } = await uploadEvidenceFilesToBucket(
      supabaseStorage,
      user.id,
      files,
      'dispute/append',
      { maxFiles: remainingSlots }
    );

    if (uploadError) {
      return Response.json({ error: uploadError }, { status: 400 });
    }

    const updatedEvidenceUrls = [...(dispute.evidence_urls || []), ...uploadedUrls];
    const { error: updateError } = await supabase
      .from('disputes')
      .update({
        evidence_urls: updatedEvidenceUrls,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Dispute update error:', updateError);
      return Response.json({ error: 'Failed to update dispute with evidence' }, { status: 500 });
    }

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('buyer_id, seller_id')
      .eq('id', dispute.transaction_id)
      .single();

    if (!transactionError && transaction) {
      const submission_type =
        transaction.buyer_id === user.id ? 'buyer_additional' : 'seller_additional';

      await supabase.from('delivery_evidence').insert({
        transaction_id: dispute.transaction_id,
        submitted_by: user.id,
        submission_type,
        photos: uploadedUrls,
        notes: null,
      });
    }

    return Response.json({
      success: true,
      message: 'Evidence uploaded successfully',
      evidence_urls: uploadedUrls,
    });
  } catch (error) {
    console.error('Evidence upload error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
