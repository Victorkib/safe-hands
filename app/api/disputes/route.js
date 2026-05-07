import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseStorage = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/disputes
 * Create a new dispute for a transaction
 */
export async function POST(request) {
  try {
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    // Parse request body (JSON or multipart/form-data for evidence uploads)
    const contentType = request.headers.get('content-type') || '';
    const uploadedEvidenceUrls = [];

    let transaction_id;
    let reason;
    let description;
    let amount_impact = null;
    let timeline_notes = null;
    let check_not_received = false;
    let check_condition_mismatch = false;
    let check_timeline_discrepancy = false;

    const parseAndUpload = async () => {
      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        transaction_id = formData.get('transaction_id');
        reason = formData.get('reason');
        description = formData.get('description');

        amount_impact = formData.get('amount_impact');
        timeline_notes = formData.get('timeline_notes');

        check_not_received = formData.get('check_not_received') === 'true';
        check_condition_mismatch = formData.get('check_condition_mismatch') === 'true';
        check_timeline_discrepancy = formData.get('check_timeline_discrepancy') === 'true';

        const files = formData.getAll('files');
        if (files && files.length > 0) {
          if (files.length > 3) {
            return Response.json(
              { error: 'Maximum 3 evidence files allowed' },
              { status: 400 }
            );
          }

          for (const file of files) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
              return Response.json(
                { error: `Invalid file type: ${file.type}. Only JPEG, PNG, and WebP are allowed.` },
                { status: 400 }
              );
            }

            const maxSize = 1 * 1024 * 1024; // 1MB
            if (file.size > maxSize) {
              return Response.json(
                { error: `File ${file.name} exceeds 1MB limit` },
                { status: 400 }
              );
            }

            const fileExt = file.name.split('.').pop();
            const safeExt = fileExt ? fileExt.toLowerCase() : 'img';
            const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${safeExt}`;

            const { error: uploadError } = await supabaseStorage.storage
              .from('dispute-evidence')
              .upload(fileName, file);

            if (uploadError) {
              console.error('Dispute evidence upload error:', uploadError);
              return Response.json(
                { error: `Failed to upload evidence file: ${file.name}` },
                { status: 500 }
              );
            }

            const { data: { publicUrl } } = supabaseStorage.storage
              .from('dispute-evidence')
              .getPublicUrl(fileName);

            uploadedEvidenceUrls.push(publicUrl);
          }
        }
        return null;
      }

      const body = await request.json();
      ({ transaction_id, reason, description } = body || {});
      amount_impact = body?.amount_impact ?? null;
      timeline_notes = body?.timeline_notes ?? null;
      check_not_received = body?.check_not_received ?? false;
      check_condition_mismatch = body?.check_condition_mismatch ?? false;
      check_timeline_discrepancy = body?.check_timeline_discrepancy ?? false;
      return null;
    };

    const parseResult = await parseAndUpload();
    if (parseResult) return parseResult;

    // Validate input
    if (!transaction_id || !reason || !description) {
      return Response.json(
        { error: 'Missing required fields: transaction_id, reason, description' },
        { status: 400 }
      );
    }

    // Validate reason (include payment_issue used in UI)
    const validReasons = ['item_not_received', 'item_not_as_described', 'payment_issue', 'other'];
    if (!validReasons.includes(reason)) {
      return Response.json(
        { error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      );
    }

    // Get transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (transactionError || !transaction) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify user is involved in transaction
    if (transaction.buyer_id !== user.id && transaction.seller_id !== user.id) {
      return Response.json(
        { error: 'You can only dispute transactions you are involved in' },
        { status: 403 }
      );
    }

    // Check if dispute already exists
    const { data: existingDispute } = await supabase
      .from('disputes')
      .select('*')
      .eq('transaction_id', transaction_id)
      .single();

    if (existingDispute) {
      return Response.json(
        { error: 'A dispute already exists for this transaction' },
        { status: 400 }
      );
    }

    // Determine who is raising the dispute and against whom
    const raised_by = user.id;
    const raised_against = transaction.buyer_id === user.id ? transaction.seller_id : transaction.buyer_id;

    // Create dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .insert({
        transaction_id,
        raised_by,
        raised_against,
        reason,
        description,
        evidence_urls: uploadedEvidenceUrls,
        status: 'open',
      })
      .select()
      .single();

    if (disputeError) {
      console.error('Dispute creation error:', disputeError);
      return Response.json(
        { error: 'Failed to create dispute' },
        { status: 500 }
      );
    }

    const disputeEvidenceNotes = [
      description,
      amount_impact ? `Amount impact: ${amount_impact}` : null,
      check_not_received ? 'Checklist: Not received' : null,
      check_condition_mismatch ? 'Checklist: Condition mismatch / not as described' : null,
      check_timeline_discrepancy ? 'Checklist: Timeline discrepancy' : null,
      timeline_notes ? `Timeline notes: ${timeline_notes}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    // Seed structured evidence record for the initial dispute narrative
    await supabase.from('delivery_evidence').insert({
      transaction_id,
      submitted_by: user.id,
      submission_type: transaction.buyer_id === user.id ? 'buyer_additional' : 'seller_additional',
      notes: disputeEvidenceNotes,
      photos: uploadedEvidenceUrls,
    });

    // Update transaction to mark as disputed
    await supabase
      .from('transactions')
      .update({
        is_disputed: true,
        status: 'disputed',
      })
      .eq('id', transaction_id);

    // Log to transaction history
    await supabase.from('transaction_history').insert({
      transaction_id,
      old_status: transaction.status,
      new_status: 'disputed',
      changed_by: user.id,
      reason: `Dispute raised: ${reason}`,
    });

    // Notify the other party
    await supabase.from('notifications').insert({
      user_id: raised_against,
      title: 'Dispute Raised',
      message: `A dispute has been raised against you for transaction KES ${transaction.amount.toLocaleString()}`,
      type: 'dispute_raised',
      related_transaction_id: transaction_id,
    });

    // Notify admins
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (admins) {
      for (const admin of admins) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          title: 'New Dispute Requires Review',
          message: `A new dispute has been raised for transaction KES ${transaction.amount.toLocaleString()}`,
          type: 'dispute_review',
          related_transaction_id: transaction_id,
        });
      }
    }

    return Response.json({
      success: true,
      dispute,
      message: 'Dispute created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Dispute API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/disputes
 * Get disputes for the authenticated user
 */
export async function GET(request) {
  try {
    const { user } = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Get user's role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    // Build query
    let query = supabase
      .from('disputes')
      .select(`
        *,
        transaction:transactions (id, amount, description, status),
        raised_by_user:users!disputes_raised_by_fkey (id, full_name, email),
        raised_against_user:users!disputes_raised_against_fkey (id, full_name, email)
      `);

    // Filter based on role
    if (userData.role === 'admin') {
      // Admins see all disputes
      if (status) {
        query = query.eq('status', status);
      }
    } else {
      // Users see disputes they're involved in
      query = query.or(`raised_by.eq.${user.id},raised_against.eq.${user.id}`);
      if (status) {
        query = query.eq('status', status);
      }
    }

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    const { data: disputes, error } = await query;

    if (error) {
      console.error('Dispute fetch error:', error);
      return Response.json(
        { error: 'Failed to fetch disputes' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      disputes,
    });

  } catch (error) {
    console.error('Dispute API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
