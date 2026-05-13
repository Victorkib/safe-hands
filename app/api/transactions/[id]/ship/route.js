import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';
import {
  uploadEvidenceFilesToBucket,
  MAX_FILES_SHIP,
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
 * POST /api/transactions/[id]/ship
 * Seller marks item as shipped. Requires tracking, courier, and at least one photo (dispatch proof).
 * Accepts application/json (photos as URL strings) or multipart/form-data (files field).
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const contentType = request.headers.get('content-type') || '';
    let tracking_number;
    let courier;
    let notes = null;
    let delivery_proof_url = null;
    let photoUrls = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      tracking_number = formData.get('tracking_number');
      courier = formData.get('courier');
      const notesRaw = formData.get('notes');
      notes = typeof notesRaw === 'string' ? notesRaw : null;
      const proofRaw = formData.get('delivery_proof_url');
      delivery_proof_url = typeof proofRaw === 'string' ? proofRaw : null;
      const files = formData
        .getAll('files')
        .filter((f) => f && typeof f.arrayBuffer === 'function');

      const { error: uploadError, urls } = await uploadEvidenceFilesToBucket(
        supabaseStorage,
        user.id,
        files,
        'delivery/ship',
        { maxFiles: MAX_FILES_SHIP }
      );
      if (uploadError) {
        return Response.json({ error: uploadError }, { status: 400 });
      }
      photoUrls = urls;
    } else {
      const body = await request.json();
      ({
        tracking_number,
        courier,
        notes = null,
        delivery_proof_url = null,
        photos = [],
      } = body || {});
      photoUrls = Array.isArray(photos) ? photos.filter((u) => typeof u === 'string' && u.trim()) : [];
    }

    const tracking = typeof tracking_number === 'string' ? tracking_number.trim() : '';
    const courierName = typeof courier === 'string' ? courier.trim() : '';

    if (!tracking) {
      return Response.json({ error: 'tracking_number is required' }, { status: 400 });
    }

    if (!courierName) {
      return Response.json({ error: 'courier is required' }, { status: 400 });
    }

    if (photoUrls.length < 1) {
      return Response.json(
        {
          error:
            'At least one dispatch photo is required (e.g. packaged item, courier handover, or waybill). Use multipart form field "files" or JSON "photos" URLs.',
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

    if (transaction.seller_id !== user.id) {
      return Response.json({ error: 'Only the seller can mark item as shipped' }, { status: 403 });
    }

    if (transaction.status !== 'escrow') {
      return Response.json(
        { error: `Cannot ship transaction with status: ${transaction.status}` },
        { status: 400 }
      );
    }

    const primaryProof =
      delivery_proof_url && String(delivery_proof_url).trim()
        ? String(delivery_proof_url).trim()
        : photoUrls[0];

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        delivery_proof_url: primaryProof,
        tracking_number: tracking,
        courier: courierName,
        shipped_at: new Date().toISOString(),
        status: 'delivered',
      })
      .eq('id', id);

    if (updateError) {
      console.error('Transaction update error:', updateError);
      return Response.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    await supabase.from('delivery_evidence').insert({
      transaction_id: id,
      submitted_by: user.id,
      submission_type: 'seller_ship',
      tracking_number: tracking,
      courier: courierName,
      notes: notes || null,
      photos: photoUrls,
    });

    await supabase.from('transaction_history').insert({
      transaction_id: id,
      old_status: 'escrow',
      new_status: 'delivered',
      changed_by: user.id,
      reason: `Item shipped. Tracking: ${tracking}`,
    });

    const autoReleaseDate = new Date();
    autoReleaseDate.setDate(autoReleaseDate.getDate() + 3);

    await supabase
      .from('transactions')
      .update({
        auto_release_date: autoReleaseDate.toISOString(),
      })
      .eq('id', id);

    await supabase.from('notifications').insert({
      user_id: transaction.buyer_id,
      title: 'Item Shipped',
      message: `Your item has been shipped via ${courierName} (Tracking: ${tracking}). Please confirm delivery within 3 days.`,
      type: 'item_shipped',
      related_transaction_id: id,
    });

    return Response.json({
      success: true,
      message: 'Item marked as shipped',
      auto_release_date: autoReleaseDate.toISOString(),
    });
  } catch (error) {
    console.error('Shipping error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
