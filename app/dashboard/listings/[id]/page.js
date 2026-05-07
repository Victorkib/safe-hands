'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function EditListing() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { user, loading: authLoading } = useAuth();
  
  const [listing, setListing] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [deleteImages, setDeleteImages] = useState([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category_id: '',
    location: '',
    condition: 'new',
    status: 'active',
  });

  useEffect(() => {
    if (!id || authLoading) return;
    if (!user) {
      router.push('/auth/login');
      setLoading(false);
      return;
    }
    Promise.all([fetchListing(user.id), fetchCategories()])
      .catch((error) => {
        console.error('Error:', error);
        setError('Failed to load data');
      })
      .finally(() => setLoading(false));
  }, [id, authLoading, user, router]);

  const fetchListing = async (userId) => {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .eq('seller_id', userId)
      .single();

    if (error || !data) {
      setError('Listing not found or you do not have permission to edit it');
      return;
    }

    setListing(data);
    setFormData({
      title: data.title,
      description: data.description,
      price: data.price,
      category_id: data.category_id,
      location: data.location || '',
      condition: data.condition || 'new',
      status: data.status,
    });
    setImagePreviews(data.images || []);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    if (!error && data) {
      setCategories(data);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const totalImages = imagePreviews.length + files.length - deleteImages.length;
    
    if (totalImages > 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    const previews = [...imagePreviews];
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => previews.push(e.target.result);
      reader.readAsDataURL(file);
    });

    setImagePreviews(previews);
  };

  const handleRemoveImage = (index) => {
    const newPreviews = [...imagePreviews];
    const removedImage = newPreviews.splice(index, 1)[0];
    setImagePreviews(newPreviews);
    
    // If it's an existing image (not a new upload), mark for deletion
    if (listing.images && listing.images.includes(removedImage)) {
      setDeleteImages([...deleteImages, removedImage]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    let timeoutId = null;

    try {
      const form = e.target;
      const formData = new FormData();
      formData.append('title', form.title.value);
      formData.append('description', form.description.value);
      formData.append('price', form.price.value);
      formData.append('category_id', form.category_id.value);
      formData.append('location', form.location.value);
      formData.append('condition', form.condition.value);
      formData.append('status', form.status.value);

      if (deleteImages.length > 0) {
        formData.append('delete_images', JSON.stringify(deleteImages));
      }

      const imageInput = form.images;
      if (imageInput.files.length > 0) {
        Array.from(imageInput.files).forEach(file => {
          formData.append('images', file);
        });
      }

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(`/api/listings/${id}`, {
        method: 'PUT',
        body: formData,
        credentials: 'same-origin',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      timeoutId = null;

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update listing');
      }

      router.push('/dashboard/listings');
    } catch (error) {
      console.error('Error updating listing:', error);
      setError(error?.name === 'AbortError' ? 'Request timed out. Please try again.' : (error.message || 'Failed to update listing'));
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center bg-white border border-slate-200 shadow-sm rounded-2xl px-8 py-10">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-700 font-medium">Loading listing editor...</p>
        </div>
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <Link href="/dashboard/listings" className="text-blue-600 hover:text-blue-700">
            Back to Listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 shadow-lg">
        <Link href="/dashboard/listings" className="text-slate-300 hover:text-white mb-4 inline-block">
          ← Back to Listings
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Edit Listing</h1>
        <p className="text-slate-300 mt-2">Update content, pricing, status, and media without leaving your workflow.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              name="title"
              required
              minLength={10}
              maxLength={255}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              name="description"
              required
              minLength={50}
              maxLength={5000}
              rows={6}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price (KES) *
              </label>
              <input
                type="number"
                name="price"
                required
                min="1"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                name="category_id"
                required
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Condition *
              </label>
              <select
                name="condition"
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="new">New</option>
                <option value="used_like_new">Used - Like New</option>
                <option value="used_good">Used - Good</option>
                <option value="used_fair">Used - Fair</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="sold">Sold</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Images (Max 5, max 5MB each)
            </label>
            {imagePreviews.length > 0 && (
              <div className="mb-2 grid grid-cols-5 gap-2">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              type="file"
              name="images"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              {5 - imagePreviews.length} more images can be added
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white px-6 py-3.5 rounded-xl hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href="/dashboard/listings"
              className="flex-1 bg-slate-200 text-slate-700 px-6 py-3.5 rounded-xl hover:bg-slate-300 transition font-semibold text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
