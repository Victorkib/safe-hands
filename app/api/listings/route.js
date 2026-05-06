import { getServerSupabase } from '@/lib/getServerSupabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin.js';
import { validateListingForm } from '@/lib/validation.js';

/**
 * GET /api/listings - Browse listings (public)
 * Query params: category, min_price, max_price, search, page, limit, sort
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const sort = searchParams.get('sort') || 'newest'; // newest, price_low, price_high
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('listings')
      .select(`
        *,
        category:category_id(name, slug),
        seller:seller_id(id, full_name, email)
      `, { count: 'exact' })
      .eq('status', 'active');

    // Apply filters
    if (category) {
      query = query.eq('category_id', category);
    }

    if (minPrice) {
      query = query.gte('price', minPrice);
    }

    if (maxPrice) {
      query = query.lte('price', maxPrice);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sort) {
      case 'price_low':
        query = query.order('price', { ascending: true });
        break;
      case 'price_high':
        query = query.order('price', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: listings, error, count } = await query;

    if (error) {
      console.error('Error fetching listings:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Debug: Log listings with image info
    console.log('=== MARKETPLACE DEBUG INFO ===');
    console.log('Total listings:', listings?.length || 0);
    listings?.forEach((listing, index) => {
      console.log(`Listing ${index + 1}:`, {
        id: listing.id,
        title: listing.title,
        hasImages: listing.images && listing.images.length > 0,
        imageCount: listing.images?.length || 0,
        firstImage: listing.images?.[0]
      });
    });
    console.log('==============================');

    return new Response(
      JSON.stringify({
        success: true,
        listings,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in GET /api/listings:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/listings - Create listing (sellers only)
 */
export async function POST(request) {
  try {
    const supabase = await getServerSupabase(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a seller
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (userData.role !== 'seller' && userData.role !== 'buyer_seller') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only sellers can create listings' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse form data with images
    const formData = await request.formData();
    const title = formData.get('title');
    const description = formData.get('description');
    const price = formData.get('price');
    const category_id = formData.get('category_id');
    const location = formData.get('location');
    const condition = formData.get('condition');
    const images = formData.getAll('images');

    // Validate input
    const listingData = {
      title,
      description,
      price,
      category_id,
      images: images.filter(img => img.size > 0),
      location,
      condition,
    };

    const validationErrors = validateListingForm(listingData);
    if (Object.keys(validationErrors).length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: validationErrors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Upload images to Supabase Storage
    const imageUrls = [];
    const bucketName = 'listing-images';

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

      const { error: uploadError } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(filePath, image);

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to upload image' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      imageUrls.push(publicUrl);
    }

    // Create listing in database
    const { data: listing, error: insertError } = await supabaseAdmin
      .from('listings')
      .insert({
        seller_id: user.id,
        category_id,
        title,
        description,
        price: parseFloat(price),
        images: imageUrls,
        location,
        condition,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating listing:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        listing,
        message: 'Listing created successfully',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in POST /api/listings:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
