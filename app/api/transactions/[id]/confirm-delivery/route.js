import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import {
  uploadEvidenceFilesToBucket,
  MAX_FILES_CONFIRM_DELIVERY,
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
 * POST /api/transactions/[id]/confirm-delivery
 * Buyer confirms delivery. Requires at least one photo (receipt / item condition).
 * Accepts application/json or multipart/form-data.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const contentType = request.headers.get('content-type') || '';
    let confirmation_comment = null;
    let condition_rating;
    let item_matches_description;
    let photoUrls = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const commentRaw = formData.get('confirmation_comment');
      confirmation_comment = typeof commentRaw === 'string' ? commentRaw : null;
      const ratingRaw = formData.get('condition_rating');
      condition_rating = ratingRaw != null ? Number(ratingRaw) : NaN;
      const matchRaw = formData.get('item_matches_description');
      item_matches_description = matchRaw === 'true' || matchRaw === true;

      const files = formData
        .getAll('files')
        .filter((f) => f && typeof f.arrayBuffer === 'function');

      const { error: uploadError, urls } = await uploadEvidenceFilesToBucket(
        supabaseStorage,
        user.id,
        files,
        'delivery/confirm',
        { maxFiles: MAX_FILES_CONFIRM_DELIVERY }
      );
      if (uploadError) {
        return Response.json({ error: uploadError }, { status: 400 });
      }
      photoUrls = urls;
    } else {
      const body = await request.json();
      ({
        confirmation_comment = null,
        condition_rating,
        item_matches_description,
        photos = [],
      } = body || {});
      photoUrls = Array.isArray(photos) ? photos.filter((u) => typeof u === 'string' && u.trim()) : [];
    }

    if (!Number.isFinite(condition_rating) || condition_rating < 1 || condition_rating > 5) {
      return Response.json(
        { error: 'condition_rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    if (typeof item_matches_description !== 'boolean') {
      return Response.json(
        { error: 'item_matches_description must be true or false' },
        { status: 400 }
      );
    }

    if (photoUrls.length < 1) {
      return Response.json(
        {
          error:
            'At least one photo is required to confirm delivery (e.g. item received, packaging). Use multipart field "files" or JSON "photos" URLs.',
        },
        { status: 400 }
      );
    }

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (transactionError || !transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.buyer_id !== user.id) {
      return Response.json({ error: 'Only the buyer can confirm delivery' }, { status: 403 });
    }

    if (transaction.status !== 'delivered') {
      return Response.json(
        { error: `Cannot confirm delivery for transaction with status: ${transaction.status}` },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'released',
        delivery_confirmed_at: new Date().toISOString(),
        buyer_confirmation: confirmation_comment,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Transaction update error:', updateError);
      return Response.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    await supabase.from('delivery_evidence').insert({
      transaction_id: id,
      submitted_by: user.id,
      submission_type: 'buyer_receive',
      condition_rating,
      item_matches_description,
      notes: confirmation_comment || null,
      photos: photoUrls,
    });

    await supabase.from('transaction_history').insert({
      transaction_id: id,
      old_status: 'delivered',
      new_status: 'released',
      changed_by: user.id,
      reason: `Buyer confirmed delivery: ${confirmation_comment || 'No comment'}`,
    });

    // Wallet credit + completion counts: handled idempotently by DB trigger
    // fn_settle_transaction_on_release (see scripts/019_seller_wallet_release_settlement.sql).

    await supabase.from('notifications').insert({
      user_id: transaction.seller_id,
      title: 'Funds Released',
      message: `Buyer confirmed delivery. Your funds of KES ${transaction.amount.toLocaleString()} have been released.`,
      type: 'funds_released',
      related_transaction_id: id,
    });

    return Response.json({
      success: true,
      message: 'Delivery confirmed. Funds released to seller.',
    });
  } catch (error) {
    console.error('Delivery confirmation error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
