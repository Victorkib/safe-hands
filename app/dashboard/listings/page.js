'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function ListingsManagement() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/login');
      setLoading(false);
      return;
    }
    fetchListings(user.id)
      .catch((error) => {
        console.error('Error:', error);
        setError('Failed to load data');
      })
      .finally(() => setLoading(false));
  }, [authLoading, user, router]);

  const fetchListings = async (userId) => {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        category:categories(name)
      `)
      .eq('seller_id', userId)
      .not('status', 'eq', 'deleted')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setListings(data);
    }
  };

  const filteredListings = filter === 'all' 
    ? listings 
    : listings.filter((l) => l.status === filter);

  const statusColors = {
    active: 'bg-green-100 text-green-800',
    sold: 'bg-blue-100 text-blue-800',
    inactive: 'bg-gray-100 text-gray-800',
  };

  const handleDelete = async (listingId) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;

    let timeoutId = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      timeoutId = null;

      const result = await response.json().catch(() => ({}));
      if (result.success) {
        fetchListings(user.id);
      } else {
        alert(result.error || 'Failed to delete listing');
      }
    } catch (error) {
      console.error('Error deleting listing:', error);
      alert(error?.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Failed to delete listing');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const handleMarkSold = async (listingId) => {
    if (!confirm('Mark this listing as sold?')) return;

    let timeoutId = null;
    try {
      const formData = new FormData();
      formData.append('status', 'sold');

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'PUT',
        body: formData,
        credentials: 'same-origin',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      timeoutId = null;

      const result = await response.json().catch(() => ({}));
      if (result.success) {
        fetchListings(user.id);
      } else {
        alert(result.error || 'Failed to update listing');
      }
    } catch (error) {
      console.error('Error updating listing:', error);
      alert(error?.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Failed to update listing');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center bg-white border border-slate-200 shadow-sm rounded-2xl px-8 py-10">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-700 font-medium">Loading your listings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-600 text-white p-8 shadow-lg">
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <div>
            <Link href="/dashboard" className="text-cyan-100 hover:text-white mb-4 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold tracking-tight mt-1">My Listings</h1>
            <p className="text-cyan-100 mt-2">Manage inventory, pricing, and listing performance at a glance.</p>
          </div>
          <Link
            href="/dashboard/listings/create"
            className="bg-white text-blue-700 px-6 py-3 rounded-xl hover:bg-blue-50 transition font-semibold shadow-sm"
          >
            + Create Listing
          </Link>
        </div>
      </div>

      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{listings.length}</p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {listings.filter(l => l.status === 'active').length}
            </p>
            <p className="text-sm text-gray-600">Active</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {listings.filter(l => l.status === 'sold').length}
            </p>
            <p className="text-sm text-gray-600">Sold</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-600">
              {listings.reduce((sum, l) => sum + (l.view_count || 0), 0)}
            </p>
            <p className="text-sm text-gray-600">Total Views</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'active', 'sold', 'inactive'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg transition font-medium capitalize ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {filteredListings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">No listings found</p>
            <Link
              href="/dashboard/listings/create"
              className="text-blue-600 hover:text-blue-700 font-medium mt-2 inline-block"
            >
              Create your first listing
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Listing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredListings.map((listing) => (
                  <tr key={listing.id} className="border-b border-slate-200 hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {listing.images && listing.images.length > 0 && (
                          <img
                            src={listing.images[0]}
                            alt={listing.title}
                            className="w-16 h-16 object-cover rounded-lg mr-3"
                          />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-xs">
                            {listing.title}
                          </p>
                          <p className="text-sm text-gray-500 truncate max-w-xs">
                            {listing.location || 'No location'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {listing.category?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      KES {parseFloat(listing.price).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[listing.status] || 'bg-gray-100'}`}>
                        {listing.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {listing.view_count || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(listing.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <Link
                          href={`/dashboard/marketplace/${listing.id}`}
                          target="_blank"
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View
                        </Link>
                        <Link
                          href={`/dashboard/listings/${listing.id}`}
                          className="text-green-600 hover:text-green-700 font-medium"
                        >
                          Edit
                        </Link>
                        {listing.status === 'active' && (
                          <button
                            onClick={() => handleMarkSold(listing.id)}
                            className="text-purple-600 hover:text-purple-700 font-medium"
                          >
                            Mark Sold
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(listing.id)}
                          className="text-red-600 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
