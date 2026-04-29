'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function ListingsManagement() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/auth/login');
          return;
        }

        setUser(authUser);
        fetchListings(authUser.id);
      } catch (error) {
        console.error('Error:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        fetchListings(user.id);
      } else {
        alert(result.error || 'Failed to delete listing');
      }
    } catch (error) {
      console.error('Error deleting listing:', error);
      alert('Failed to delete listing');
    }
  };

  const handleMarkSold = async (listingId) => {
    if (!confirm('Mark this listing as sold?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const formData = new FormData();
      formData.append('status', 'sold');

      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        fetchListings(user.id);
      } else {
        alert(result.error || 'Failed to update listing');
      }
    } catch (error) {
      console.error('Error updating listing:', error);
      alert('Failed to update listing');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading listings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">My Listings</h1>
          <p className="text-gray-600 mt-2">Manage your items for sale</p>
        </div>
        <Link
          href="/dashboard/listings/create"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + Create Listing
        </Link>
      </div>

      <div className="mb-6 p-4 bg-white rounded-lg shadow">
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

      <div className="mb-6 flex flex-wrap gap-2">
        {['all', 'active', 'sold', 'inactive'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg transition font-medium capitalize ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
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
              <thead className="bg-gray-50 border-b">
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
                  <tr key={listing.id} className="border-b hover:bg-gray-50 transition">
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
                          href={`/listings/${listing.id}`}
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
