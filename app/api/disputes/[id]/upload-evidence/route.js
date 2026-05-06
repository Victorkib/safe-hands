import { createClient } from '@supabase/supabase-js';

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

    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return Response.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', id)
      .single();

    if (disputeError || !dispute) {
      return Response.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }

    // Verify user is involved in dispute
    if (dispute.raised_by !== user.id && dispute.raised_against !== user.id) {
      return Response.json(
        { error: 'You can only upload evidence for disputes you are involved in' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('files');

    if (!files || files.length === 0) {
      return Response.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Check file count limit (max 3)
    if (files.length > 3) {
      return Response.json(
        { error: 'Maximum 3 files allowed' },
        { status: 400 }
      );
    }

    // Check current evidence count
    const currentEvidenceCount = dispute.evidence_urls ? dispute.evidence_urls.length : 0;
    if (currentEvidenceCount + files.length > 3) {
      return Response.json(
        { error: `Maximum 3 evidence files allowed. You have ${currentEvidenceCount} already.` },
        { status: 400 }
      );
    }

    // Upload files to Supabase Storage
    const uploadedUrls = [];
    for (const file of files) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return Response.json(
          { error: `Invalid file type: ${file.type}. Only JPEG, PNG, and WebP are allowed.` },
          { status: 400 }
        );
      }

      // Validate file size (max 1MB)
      const maxSize = 1 * 1024 * 1024; // 1MB in bytes
      if (file.size > maxSize) {
        return Response.json(
          { error: `File ${file.name} exceeds 1MB limit` },
          { status: 400 }
        );
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseStorage.storage
        .from('dispute-evidence')
        .upload(fileName, file);

      if (uploadError) {
        console.error('File upload error:', uploadError);
        return Response.json(
          { error: `Failed to upload file ${file.name}` },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseStorage.storage
        .from('dispute-evidence')
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }

    // Update dispute with evidence URLs
    const updatedEvidenceUrls = [...(dispute.evidence_urls || []), ...uploadedUrls];
    const { error: updateError } = await supabase
      .from('disputes')
      .update({
        evidence_urls: updatedEvidenceUrls,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Dispute update error:', updateError);
      return Response.json(
        { error: 'Failed to update dispute with evidence' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: 'Evidence uploaded successfully',
      evidence_urls: uploadedUrls,
    });

  } catch (error) {
    console.error('Evidence upload error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
