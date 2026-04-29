'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function AdminListingsPage() {
  const { profile } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Check admin access
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      window.location.href = '/dashboard';
    }
  }, [profile]);

  // Fetch categories and listings
  useEffect(() => {
    fetchCategories();
    fetchListings();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error: err } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (err) throw err;
      setCategories(data || []);
    } catch (err) {
      console.error('[v0] Error fetching categories:', err);
    }
  };

  const fetchListings = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('listings')
        .select(`
          *,
          category:category_id(name, slug),
          seller:seller_id(full_name, email, id)
        `)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setListings(data || []);
    } catch (err) {
      console.error('[v0] Error fetching listings:', err);
      setError('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const filteredListings = listings.filter(listing => {
    const matchesSearch = listing.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         listing.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         listing.seller?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || listing.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || listing.category_id === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const openModal = (listing, action) => {
    setSelectedListing(listing);
    setModalAction(action);
    setShowModal(true);
    setActionMessage(null);
    setSuspendReason('');
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedListing(null);
    setModalAction(null);
    setSuspendReason('');
    setActionMessage(null);
  };

  const handleSuspendListing = async () => {
    if (!selectedListing || !suspendReason) {
      setActionMessage({ type: 'error', text: 'Please provide a reason for suspension' });
      return;
    }

    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('listings')
        .update({
          status: 'suspended',
          suspension_reason: suspendReason,
          suspended_at: new Date().toISOString(),
        })
        .eq('id', selectedListing.id);

      if (err) throw err;

      setListings(listings.map(l =>
        l.id === selectedListing.id
          ? { ...l, status: 'suspended', suspension_reason: suspendReason }
          : l
      ));

      setActionMessage({
        type: 'success',
        text: 'Listing suspended successfully'
      });

      setTimeout(closeModal, 1500);
    } catch (err) {
      console.error('[v0] Error suspending listing:', err);
      setActionMessage({ type: 'error', text: 'Failed to suspend listing' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveListing = async () => {
    if (!selectedListing) return;

    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('listings')
        .update({ status: 'active' })
        .eq('id', selectedListing.id);

      if (err) throw err;

      setListings(listings.map(l =>
        l.id === selectedListing.id ? { ...l, status: 'active' } : l
      ));

      setActionMessage({
        type: 'success',
        text: 'Listing approved successfully'
      });

      setTimeout(closeModal, 1500);
    } catch (err) {
      console.error('[v0] Error approving listing:', err);
      setActionMessage({ type: 'error', text: 'Failed to approve listing' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!selectedListing) return;

    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('listings')
        .delete()
        .eq('id', selectedListing.id);

      if (err) throw err;

      setListings(listings.filter(l => l.id !== selectedListing.id));

      setActionMessage({
        type: 'success',
        text: 'Listing deleted successfully'
      });

      setTimeout(closeModal, 1500);
    } catch (err) {
      console.error('[v0] Error deleting listing:', err);
      setActionMessage({ type: 'error', text: 'Failed to delete listing' });
    } finally {
      setActionLoading(false);
    }
  };

  const renderModal = () => {
    if (!showModal || !selectedListing) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
            <h3 className="text-lg font-bold text-gray-900">
              {modalAction === 'suspend' ? 'Suspend Listing' :
               modalAction === 'approve' ? 'Approve Listing' :
               'Delete Listing'}
            </h3>
          </div>

          <div className="p-6 space-y-6">
            {/* Listing Info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold">Listing ID</p>
                  <p className="font-mono text-sm font-semibold text-gray-900">#{selectedListing.id.slice(0, 8)}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedListing.status === 'active' ? 'bg-green-100 text-green-700' :
                  selectedListing.status === 'suspended' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedListing.status}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-600 uppercase font-semibold">Title</p>
                <p className="text-sm text-gray-900">{selectedListing.title}</p>
              </div>

              <div>
                <p className="text-xs text-gray-600 uppercase font-semibold">Description</p>
                <p className="text-sm text-gray-900">{selectedListing.description}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold">Price</p>
                  <p className="font-bold text-gray-900">KES {selectedListing.price?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold">Category</p>
                  <p className="text-sm text-gray-900">{selectedListing.category?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold">Views</p>
                  <p className="text-sm text-gray-900">{selectedListing.view_count || 0}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Seller</p>
                <p className="text-sm font-semibold text-gray-900">{selectedListing.seller?.full_name}</p>
                <p className="text-xs text-gray-600">{selectedListing.seller?.email}</p>
              </div>
            </div>

            {/* Action Form */}
            {modalAction === 'suspend' && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Reason for Suspension</label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Explain why this listing is being suspended..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                  rows="4"
                />
              </div>
            )}

            {modalAction === 'delete' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 font-medium text-sm">
                  Are you sure you want to permanently delete this listing? This action cannot be undone.
                </p>
              </div>
            )}

            {actionMessage && (
              <div className={`p-3 rounded-lg text-sm font-medium ${
                actionMessage.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {actionMessage.text}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={
                  modalAction === 'suspend' ? handleSuspendListing :
                  modalAction === 'approve' ? handleApproveListing :
                  handleDeleteListing
                }
                disabled={actionLoading || (modalAction === 'suspend' && !suspendReason)}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition font-medium disabled:opacity-50 ${
                  modalAction === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {actionLoading ? 'Processing...' :
                 modalAction === 'suspend' ? 'Suspend' :
                 modalAction === 'approve' ? 'Approve' :
                 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading listings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Moderate Listings</h1>
        <p className="text-gray-600 mt-1">Review and manage marketplace listings</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <p className="text-red-700 font-medium text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Search</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Title or seller..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="sold">Sold</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('all');
                setFilterCategory('all');
              }}
              className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg transition font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Listings Grid */}
        {filteredListings.length === 0 ? (
          <div className="py-12 text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-lg font-semibold text-gray-900">No listings found</p>
            <p className="text-sm text-gray-600 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredListings.map((listing) => (
              <div key={listing.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                {listing.images && listing.images.length > 0 && (
                  <div className="w-full h-48 bg-gray-200 overflow-hidden">
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-sm line-clamp-2">{listing.title}</h3>
                      <p className="text-xs text-gray-600 mt-1">{listing.category?.name}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                      listing.status === 'active' ? 'bg-green-100 text-green-700' :
                      listing.status === 'suspended' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {listing.status}
                    </span>
                  </div>

                  <div className="py-2 border-t border-b border-gray-200">
                    <p className="text-lg font-bold text-gray-900">KES {listing.price?.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Views: {listing.view_count || 0}</p>
                  </div>

                  <div className="text-xs text-gray-600">
                    <p className="font-semibold">{listing.seller?.full_name}</p>
                    <p>{listing.seller?.email}</p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {listing.status !== 'active' && (
                      <button
                        onClick={() => openModal(listing, 'approve')}
                        className="flex-1 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition font-medium text-xs"
                      >
                        Approve
                      </button>
                    )}
                    {listing.status !== 'suspended' && (
                      <button
                        onClick={() => openModal(listing, 'suspend')}
                        className="flex-1 px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg transition font-medium text-xs"
                      >
                        Suspend
                      </button>
                    )}
                    <button
                      onClick={() => openModal(listing, 'delete')}
                      className="flex-1 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition font-medium text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="pt-4 border-t border-gray-200 grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{filteredListings.filter(l => l.status === 'active').length}</p>
            <p className="text-sm text-gray-600">Active</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{filteredListings.filter(l => l.status === 'suspended').length}</p>
            <p className="text-sm text-gray-600">Suspended</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-600">{filteredListings.filter(l => l.status === 'sold').length}</p>
            <p className="text-sm text-gray-600">Sold</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{filteredListings.length}</p>
            <p className="text-sm text-gray-600">Shown</p>
          </div>
        </div>
      </div>

      {renderModal()}
    </div>
  );
}
