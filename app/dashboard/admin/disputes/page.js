'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

const statusColors = {
  open: 'bg-blue-100 text-blue-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  awaiting_response: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
};

export default function AdminDisputesPage() {
  const { profile } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Check admin access
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      window.location.href = '/dashboard';
    }
  }, [profile]);

  // Fetch disputes
  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('disputes')
        .select(`
          *,
          transaction:transaction_id(id, amount, buyer_id, seller_id, status),
          buyer:buyer_id(full_name, email),
          seller:seller_id(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setDisputes(data || []);
    } catch (err) {
      console.error('[v0] Error fetching disputes:', err);
      setError('Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  const filteredDisputes = disputes.filter(dispute => {
    if (filterStatus === 'all') return true;
    return dispute.status === filterStatus;
  });

  const openModal = (dispute) => {
    setSelectedDispute(dispute);
    setShowModal(true);
    setActionMessage(null);
    setDecision('');
    setNotes('');
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedDispute(null);
    setDecision('');
    setNotes('');
    setActionMessage(null);
  };

  const handleResolveDispute = async () => {
    if (!selectedDispute || !decision) {
      setActionMessage({ type: 'error', text: 'Please select a decision' });
      return;
    }

    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          decision,
          admin_notes: notes,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', selectedDispute.id);

      if (err) throw err;

      setDisputes(disputes.map(d =>
        d.id === selectedDispute.id
          ? { ...d, status: 'resolved', decision, admin_notes: notes }
          : d
      ));

      setActionMessage({
        type: 'success',
        text: 'Dispute resolved successfully'
      });

      setTimeout(closeModal, 1500);
    } catch (err) {
      console.error('[v0] Error resolving dispute:', err);
      setActionMessage({ type: 'error', text: 'Failed to resolve dispute' });
    } finally {
      setActionLoading(false);
    }
  };

  const renderModal = () => {
    if (!showModal || !selectedDispute) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
            <h3 className="text-lg font-bold text-gray-900">Resolve Dispute</h3>
          </div>

          <div className="p-6 space-y-6">
            {/* Dispute Info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold">Dispute ID</p>
                  <p className="font-mono text-sm font-semibold text-gray-900">#{selectedDispute.id.slice(0, 8)}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[selectedDispute.status]}`}>
                  {selectedDispute.status.replace('_', ' ')}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-600 uppercase font-semibold">Reason</p>
                <p className="text-sm text-gray-900">{selectedDispute.reason}</p>
              </div>

              <div>
                <p className="text-xs text-gray-600 uppercase font-semibold">Transaction Amount</p>
                <p className="text-lg font-bold text-gray-900">KES {selectedDispute.transaction?.amount?.toLocaleString() || 'N/A'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Buyer</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedDispute.buyer?.full_name}</p>
                  <p className="text-xs text-gray-600">{selectedDispute.buyer?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Seller</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedDispute.seller?.full_name}</p>
                  <p className="text-xs text-gray-600">{selectedDispute.seller?.email}</p>
                </div>
              </div>
            </div>

            {/* Decision Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Decision</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                    <input
                      type="radio"
                      name="decision"
                      value="buyer_wins"
                      checked={decision === 'buyer_wins'}
                      onChange={(e) => setDecision(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Buyer Wins</p>
                      <p className="text-xs text-gray-600">Refund buyer, no payment to seller</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                    <input
                      type="radio"
                      name="decision"
                      value="seller_wins"
                      checked={decision === 'seller_wins'}
                      onChange={(e) => setDecision(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Seller Wins</p>
                      <p className="text-xs text-gray-600">Release funds to seller, no refund</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                    <input
                      type="radio"
                      name="decision"
                      value="split"
                      checked={decision === 'split'}
                      onChange={(e) => setDecision(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Split 50/50</p>
                      <p className="text-xs text-gray-600">Divide funds equally between both parties</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Admin Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explain your decision..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                  rows="4"
                />
              </div>
            </div>

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
                onClick={handleResolveDispute}
                disabled={actionLoading || !decision}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Resolve Dispute'}
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
          <p className="text-gray-600 font-medium">Loading disputes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manage Disputes</h1>
        <p className="text-gray-600 mt-1">Review and resolve transaction disputes</p>
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
        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          {['all', 'open', 'in_review', 'awaiting_response', 'resolved', 'closed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2.5 rounded-lg font-medium text-sm transition ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Disputes List */}
        {filteredDisputes.length === 0 ? (
          <div className="py-12 text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-semibold text-gray-900">No disputes found</p>
            <p className="text-sm text-gray-600 mt-1">All transactions are progressing smoothly</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDisputes.map((dispute) => (
              <div key={dispute.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono font-semibold text-gray-900">#{dispute.id.slice(0, 8)}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[dispute.status]}`}>
                        {dispute.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{dispute.reason}</p>
                  </div>
                  <button
                    onClick={() => openModal(dispute)}
                    disabled={dispute.status === 'resolved' || dispute.status === 'closed'}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {dispute.status === 'resolved' ? 'Resolved' : dispute.status === 'closed' ? 'Closed' : 'Review'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-1">Amount</p>
                    <p className="font-bold text-gray-900">KES {dispute.transaction?.amount?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-1">Buyer</p>
                    <p className="text-gray-900">{dispute.buyer?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-1">Seller</p>
                    <p className="text-gray-900">{dispute.seller?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-1">Filed</p>
                    <p className="text-gray-900">{new Date(dispute.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="pt-4 border-t border-gray-200 grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{filteredDisputes.filter(d => d.status === 'open').length}</p>
            <p className="text-sm text-gray-600">Open</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">{filteredDisputes.filter(d => d.status === 'in_review').length}</p>
            <p className="text-sm text-gray-600">In Review</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{filteredDisputes.filter(d => d.status === 'resolved').length}</p>
            <p className="text-sm text-gray-600">Resolved</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{filteredDisputes.length}</p>
            <p className="text-sm text-gray-600">Shown</p>
          </div>
        </div>
      </div>

      {renderModal()}
    </div>
  );
}
