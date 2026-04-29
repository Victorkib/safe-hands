import { createClient } from '@supabase/supabase-js';
import { validateListingForm } from '@/lib/validation.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/listings/[id] - Get listing details
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const { data: listing, error } = await supabase
      .from('listings')
      .select(`
        *,
        category:categories(name, slug, description),
        seller:users(id, full_name, email, phone, created_at)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching listing:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Listing not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Increment view count
    await supabase
      .from('listings')
      .update({ view_count: (listing.view_count || 0) + 1 })
      .eq('id', id);

    return new Response(
      JSON.stringify({ success: true, listing }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in GET /api/listings/[id]:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /api/listings/[id] - Update listing (seller only)
 */
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if listing exists and belongs to user
    const { data: existingListing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingListing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Listing not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (existingListing.seller_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'You can only update your own listings' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const title = formData.get('title');
    const description = formData.get('description');
    const price = formData.get('price');
    const category_id = formData.get('category_id');
    const location = formData.get('location');
    const condition = formData.get('condition');
    const status = formData.get('status');
    const images = formData.getAll('images');
    const deleteImages = formData.get('delete_images'); // JSON array of URLs to delete

    // Validate input
    const listingData = {
      title: title || existingListing.title,
      description: description || existingListing.description,
      price: price || existingListing.price,
      category_id: category_id || existingListing.category_id,
      location: location || existingListing.location,
      condition: condition || existingListing.condition,
      status: status || existingListing.status,
      images: images.filter(img => img.size > 0),
    };

    const validationErrors = validateListingForm(listingData);
    if (Object.keys(validationErrors).length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: validationErrors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle images
    let newImageUrls = existingListing.images || [];
    const bucketName = 'listing-images';

    // Delete specified images
    if (deleteImages) {
      const imagesToDelete = JSON.parse(deleteImages);
      newImageUrls = newImageUrls.filter(url => !imagesToDelete.includes(url));
      
      for (const url of imagesToDelete) {
        try {
          const filePath = url.split(`${bucketName}/`)[1];
          await supabase.storage.from(bucketName).remove([filePath]);
        } catch (err) {
          console.error('Error deleting image:', err);
        }
      }
    }

    // Upload new images
    for (const image of listingData.images) {
      if (image.size > 5 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ success: false, error: 'Image size must be less than 5MB' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const fileExt = image.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, image);

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to upload image' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      newImageUrls.push(publicUrl);
    }

    // Update listing in database
    const updateData = {
      title: listingData.title,
      description: listingData.description,
      price: parseFloat(listingData.price),
      category_id: listingData.category_id,
      images: newImageUrls,
      location: listingData.location,
      condition: listingData.condition,
      status: listingData.status,
    };

    // Mark as sold if status changes to sold
    if (listingData.status === 'sold' && existingListing.status !== 'sold') {
      updateData.sold_at = new Date().toISOString();
    }

    const { data: listing, error: updateError } = await supabase
      .from('listings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating listing:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        listing,
        message: 'Listing updated successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in PUT /api/listings/[id]:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/listings/[id] - Delete listing (seller only)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if listing exists and belongs to user
    const { data: existingListing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingListing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Listing not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (existingListing.seller_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'You can only delete your own listings' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete images from storage
    if (existingListing.images && existingListing.images.length > 0) {
      const bucketName = 'listing-images';
      for (const url of existingListing.images) {
        try {
          const filePath = url.split(`${bucketName}/`)[1];
          await supabase.storage.from(bucketName).remove([filePath]);
        } catch (err) {
          console.error('Error deleting image:', err);
        }
      }
    }

    // Delete listing from database (soft delete)
    const { error: deleteError } = await supabase
      .from('listings')
      .update({ status: 'deleted' })
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting listing:', deleteError);
      return new Response(
        JSON.stringify({ success: false, error: deleteError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Listing deleted successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in DELETE /api/listings/[id]:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
