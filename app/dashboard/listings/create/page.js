'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function CreateListing() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category_id: '',
    location: '',
    condition: 'new',
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/login');
      setLoading(false);
      return;
    }
    if (profile?.role !== 'seller' && profile?.role !== 'buyer_seller') {
      router.push('/dashboard');
      setLoading(false);
      return;
    }
    fetchCategories().finally(() => setLoading(false));
  }, [authLoading, user, profile, router]);

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
    if (files.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    const previews = [];
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

      const imageInput = form.images;
      if (imageInput.files.length > 0) {
        Array.from(imageInput.files).forEach(file => {
          formData.append('images', file);
        });
      }

      console.log('Starting listing creation...');

      console.log('Making API call to create listing...');
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch('/api/listings', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      timeoutId = null;

      console.log('API response status:', response.status);
      const result = await response.json().catch(() => ({}));
      console.log('API response data:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create listing');
      }

      console.log('Listing created successfully, redirecting...');
      router.push('/dashboard/listings');
    } catch (error) {
      console.error('Error creating listing:', error);
      setError(error?.name === 'AbortError' ? 'Request timed out. Please try again.' : (error.message || 'Failed to create listing'));
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
          <p className="text-slate-700 font-medium">Preparing listing editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 text-white p-8 shadow-lg">
        <Link href="/dashboard" className="text-blue-100 hover:text-white mb-4 inline-block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Create New Listing</h1>
        <p className="text-blue-100 mt-2">Showcase your item with clear details and quality visuals to boost buyer trust.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
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
              placeholder="What are you selling? (min 10 characters)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">Be descriptive and specific</p>
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
              placeholder="Describe your item in detail (min 50 characters)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">Include condition, features, and any defects</p>
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
                placeholder="5000"
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
                Location
              </label>
              <input
                type="text"
                name="location"
                placeholder="Nairobi, Kenya"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Images (Max 5, max 5MB each)
            </label>
            <input
              type="file"
              name="images"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {imagePreviews.length > 0 && (
              <div className="mt-2 grid grid-cols-5 gap-2">
                {imagePreviews.map((preview, index) => (
                  <img
                    key={index}
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg border"
                  />
                ))}
              </div>
            )}
            <p className="text-sm text-gray-500 mt-1">High-quality images help sell faster</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white px-6 py-3.5 rounded-xl hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create Listing'}
          </button>
          </form>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 h-fit">
          <h3 className="font-semibold text-slate-900 mb-4">Listing Quality Checklist</h3>
          <ul className="text-sm text-slate-700 space-y-2">
            <li>Use at least 3 clear photos.</li>
            <li>Mention exact condition and defects.</li>
            <li>Set realistic price range in KES.</li>
            <li>Add accurate pickup/delivery location.</li>
            <li>Include accessories and warranty info.</li>
          </ul>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h3 className="font-medium text-blue-900 mb-2">Tips for successful listings:</h3>
        <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
          <li>Use clear, well-lit photos from multiple angles</li>
          <li>Be honest about the condition of the item</li>
          <li>Include all relevant details in the description</li>
          <li>Set a competitive price based on market research</li>
          <li>Respond quickly to buyer inquiries</li>
        </ul>
      </div>
    </div>
  );
}
