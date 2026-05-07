'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function TransactionDetail() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { user: authUser, loading: authLoading } = useAuth();
  
  const [user, setUser] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [confirmationComment, setConfirmationComment] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeFiles, setDisputeFiles] = useState([]);
  const [amountImpact, setAmountImpact] = useState('');
  const [checkNotReceived, setCheckNotReceived] = useState(false);
  const [checkConditionMismatch, setCheckConditionMismatch] = useState(false);
  const [checkTimelineDiscrepancy, setCheckTimelineDiscrepancy] = useState(false);
  const [timelineNotes, setTimelineNotes] = useState('');
  const [sellerRequest, setSellerRequest] = useState(null);
  const [sellerMessage, setSellerMessage] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  const [courier, setCourier] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [conditionRating, setConditionRating] = useState(5);
  const [itemMatchesDescription, setItemMatchesDescription] = useState(true);
  const [evidenceTimeline, setEvidenceTimeline] = useState([]);
  const [disputeError, setDisputeError] = useState(null);

  useEffect(() => {
    if (!id || authLoading) return;
    if (!authUser) {
      router.push('/auth/login');
      setLoading(false);
      return;
    }

    setUser(authUser);
    fetchTransaction(authUser.id);
  }, [id, router, authUser, authLoading]);

  const fetchTransaction = async (userId) => {
    try {
      const { data: txn, error } = await supabase
        .from('transactions')
        .select(`
          *,
          buyer:users!transactions_buyer_id_fkey (id, email, full_name),
          seller:users!transactions_seller_id_fkey (id, email, full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Check if user is involved in transaction
      if (txn.buyer_id !== userId && txn.seller_id !== userId) {
        setError('Unauthorized');
        setLoading(false);
        return;
      }

      setTransaction(txn);

      const { data: requestData } = await supabase
        .from('seller_transaction_requests')
        .select('*')
        .eq('transaction_id', id)
        .maybeSingle();

      setSellerRequest(requestData || null);

      const { data: { session } } = await supabase.auth.getSession();
      const evidenceResponse = await fetch(`/api/transactions/${id}/evidence`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });
      if (evidenceResponse.ok) {
        const evidenceData = await evidenceResponse.json();
        setEvidenceTimeline(evidenceData.evidence || []);
      }
    } catch (error) {
      console.error('Error fetching transaction:', error);
      setError('Transaction not found');
    } finally {
      setLoading(false);
    }
  };

  const initiatePayment = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/transactions/${id}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      
      if (result.success) {
        alert(result.message);
        setShowPaymentModal(false);
        fetchTransaction(user.id);
      } else {
        alert(result.error || 'Payment failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to initiate payment');
    } finally {
      setActionLoading(false);
    }
  };

  const markAsShipped = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/transactions/${id}/ship`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracking_number: trackingNumber || null,
          courier: courier || null,
          notes: shippingNotes || null,
          photos: [],
          delivery_proof_url: '',
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(result.message);
        setShowShippingModal(false);
        setTrackingNumber('');
        setCourier('');
        setShippingNotes('');
        fetchTransaction(user.id);
      } else {
        alert(result.error || 'Failed to mark as shipped');
      }
    } catch (error) {
      console.error('Shipping error:', error);
      alert('Failed to mark as shipped');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelivery = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/transactions/${id}/confirm-delivery`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmation_comment: confirmationComment,
          condition_rating: conditionRating,
          item_matches_description: itemMatchesDescription,
          photos: [],
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(result.message);
        setShowConfirmModal(false);
        setConfirmationComment('');
        fetchTransaction(user.id);
      } else {
        alert(result.error || 'Failed to confirm delivery');
      }
    } catch (error) {
      console.error('Confirmation error:', error);
      alert('Failed to confirm delivery');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRaiseDispute = async () => {
    setDisputeError(null);
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append('transaction_id', id);
      formData.append('reason', disputeReason);
      formData.append('description', disputeDescription);

      if (amountImpact.trim()) formData.append('amount_impact', amountImpact.trim());
      if (timelineNotes.trim()) formData.append('timeline_notes', timelineNotes.trim());

      formData.append('check_not_received', checkNotReceived ? 'true' : 'false');
      formData.append('check_condition_mismatch', checkConditionMismatch ? 'true' : 'false');
      formData.append('check_timeline_discrepancy', checkTimelineDiscrepancy ? 'true' : 'false');

      for (const file of disputeFiles) {
        formData.append('files', file);
      }

      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        alert('Dispute raised successfully');
        setShowDisputeModal(false);
        setDisputeReason('');
        setDisputeDescription('');
        setDisputeFiles([]);
        setAmountImpact('');
        setCheckNotReceived(false);
        setCheckConditionMismatch(false);
        setCheckTimelineDiscrepancy(false);
        setTimelineNotes('');
        fetchTransaction(user.id);
      } else {
        setDisputeError(result.error || 'Failed to raise dispute');
      }
    } catch (error) {
      console.error('Dispute error:', error);
      setDisputeError('Failed to raise dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const submitSellerDecision = async (actionType) => {
    if (!transaction) return;
    setActionLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {};

      if (sellerMessage.trim()) {
        payload.seller_message = sellerMessage.trim();
      }
      if (actionType === 'request-changes' && proposedAmount.trim()) {
        payload.proposed_amount = proposedAmount.trim();
      }

      const response = await fetch(`/api/transactions/${id}/${actionType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        alert(result.error || `Failed to ${actionType}`);
        return;
      }

      setSellerMessage('');
      setProposedAmount('');
      fetchTransaction(user.id);
    } catch (err) {
      console.error(`${actionType} error:`, err);
      alert('Failed to submit seller decision');
    } finally {
      setActionLoading(false);
    }
  };

  const acceptSellerChanges = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/transactions/${id}/accept-changes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        alert(result.error || 'Failed to accept changes');
        return;
      }
      fetchTransaction(user.id);
    } catch (error) {
      console.error('Accept changes error:', error);
      alert('Failed to accept seller changes');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      initiated: 'bg-gray-100 text-gray-800',
      pending_seller_approval: 'bg-purple-100 text-purple-800',
      seller_approved: 'bg-indigo-100 text-indigo-800',
      seller_rejected: 'bg-rose-100 text-rose-800',
      seller_change_requested: 'bg-orange-100 text-orange-800',
      payment_pending: 'bg-amber-100 text-amber-800',
      escrow: 'bg-blue-100 text-blue-800',
      delivered: 'bg-yellow-100 text-yellow-800',
      released: 'bg-green-100 text-green-800',
      disputed: 'bg-red-100 text-red-800',
      refunded: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-gray-300 text-gray-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const flowStages = [
    'pending_seller_approval',
    'seller_approved',
    'payment_pending',
    'escrow',
    'delivered',
    'released',
  ];

  const currentStageIndex = Math.max(flowStages.indexOf(transaction?.status), 0);
  const progressPercent = transaction?.status === 'released'
    ? 100
    : Math.max(((currentStageIndex + 1) / flowStages.length) * 100, 10);

  const stageLabelMap = {
    pending_seller_approval: 'Awaiting Seller Approval',
    seller_approved: 'Seller Approved',
    payment_pending: 'Payment Pending',
    escrow: 'Funds in Escrow',
    delivered: 'Delivered',
    released: 'Completed',
  };

  const isBuyer = user && transaction && transaction.buyer_id === user.id;
  const isSeller = user && transaction && transaction.seller_id === user.id;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading transaction...</p>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-lg p-6 md:p-8 mb-6 text-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-300">Transaction ID</p>
            <p className="font-mono text-lg">{transaction.id.slice(0, 8)}...</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(transaction.status)}`}>
            {transaction.status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-300">Amount</p>
            <p className="text-3xl font-bold">KES {transaction.amount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-300">Created</p>
            <p className="text-slate-100">{new Date(transaction.created_at).toLocaleString()}</p>
          </div>
        </div>

        <div className="mb-5">
          <p className="text-xs uppercase tracking-wide text-slate-300">Description</p>
          <p className="text-slate-100">{transaction.description}</p>
        </div>

        <div className="mb-5">
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Current stage: {stageLabelMap[transaction.status] || transaction.status}
          </p>
        </div>

        {/* Parties */}
        <div className="border-t border-slate-700 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-300 mb-1">Buyer</p>
              <p className="font-medium text-white">{transaction.buyer?.full_name || 'Loading...'}</p>
              <p className="text-sm text-slate-300">{transaction.buyer?.email || 'Loading...'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-300 mb-1">Seller</p>
              <p className="font-medium text-white">{transaction.seller?.full_name || 'Loading...'}</p>
              <p className="text-sm text-slate-300">{transaction.seller?.email || 'Loading...'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Payment Method</p>
            <p className="text-gray-900 capitalize">{transaction.payment_method}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">M-Pesa Reference</p>
            <p className="text-gray-900 font-mono">{transaction.mpesa_ref || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Payment Confirmed</p>
            <p className="text-gray-900">
              {transaction.payment_confirmed_at 
                ? new Date(transaction.payment_confirmed_at).toLocaleString() 
                : 'Pending'}
            </p>
          </div>
        </div>
      </div>

      {/* Delivery Information */}
      {(transaction.status === 'delivered' || transaction.status === 'released') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Delivery Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Delivery Confirmed At</p>
              <p className="text-gray-900">
                {transaction.delivery_confirmed_at 
                  ? new Date(transaction.delivery_confirmed_at).toLocaleString() 
                  : 'Pending'}
              </p>
            </div>
            {transaction.auto_release_date && (
              <div>
                <p className="text-sm text-gray-600">Auto-Release Date</p>
                <p className="text-gray-900">
                  {new Date(transaction.auto_release_date).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          {transaction.buyer_confirmation && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">Buyer's Confirmation</p>
              <p className="text-gray-900">{transaction.buyer_confirmation}</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Evidence Timeline</h2>
        {evidenceTimeline.length === 0 ? (
          <p className="text-sm text-gray-600">No delivery evidence submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {evidenceTimeline.map((evidence) => (
              <div
                key={evidence.id}
                className={`border rounded-lg p-4 ${
                  evidence.submission_type === 'seller_ship'
                    ? 'border-blue-200 bg-blue-50'
                    : evidence.submission_type === 'buyer_receive'
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {evidence.submission_type === 'seller_ship'
                      ? 'Seller Shipping Evidence'
                      : evidence.submission_type === 'buyer_receive'
                      ? 'Buyer Delivery Confirmation'
                      : evidence.submission_type}
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(evidence.submitted_at).toLocaleString()}
                  </p>
                </div>
                <p className="text-xs text-gray-700 mb-1">
                  Submitted by: {evidence.submitter?.full_name || evidence.submitter?.email || 'Unknown user'}
                </p>
                {evidence.tracking_number && (
                  <p className="text-sm text-gray-800">Tracking: {evidence.tracking_number}</p>
                )}
                {evidence.courier && (
                  <p className="text-sm text-gray-800">Courier: {evidence.courier}</p>
                )}
                {evidence.condition_rating && (
                  <p className="text-sm text-gray-800">Condition rating: {evidence.condition_rating}/5</p>
                )}
                {typeof evidence.item_matches_description === 'boolean' && (
                  <p className="text-sm text-gray-800">
                    Matches description: {evidence.item_matches_description ? 'Yes' : 'No'}
                  </p>
                )}
                {evidence.notes && (
                  <p className="text-sm text-gray-800 mt-1">{evidence.notes}</p>
                )}

                {evidence.photos && evidence.photos.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {evidence.photos.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={url}
                          alt={`Evidence photo ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg border border-gray-100 hover:opacity-90 transition"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
        
        {isBuyer && (transaction.status === 'seller_approved' || transaction.status === 'initiated') && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium mb-2"
          >
            Pay with M-Pesa
          </button>
        )}

        {isSeller && transaction.status === 'pending_seller_approval' && (
          <div className="space-y-3 mb-2">
            <p className="text-sm text-gray-700">
              Buyer is waiting for your approval before payment.
            </p>
            <textarea
              value={sellerMessage}
              onChange={(e) => setSellerMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows="3"
              placeholder="Optional message for buyer (or required for change request)"
            />
            <input
              type="number"
              min="1"
              step="0.01"
              value={proposedAmount}
              onChange={(e) => setProposedAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Optional proposed amount for change request"
            />
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => submitSellerDecision('approve')}
                disabled={actionLoading}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium"
              >
                Approve Transaction
              </button>
              <button
                onClick={() => submitSellerDecision('request-changes')}
                disabled={actionLoading || !sellerMessage.trim()}
                className="w-full bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition font-medium disabled:opacity-50"
              >
                Request Changes
              </button>
              <button
                onClick={() => submitSellerDecision('reject')}
                disabled={actionLoading}
                className="w-full bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-medium"
              >
                Reject Transaction
              </button>
            </div>
          </div>
        )}

        {isBuyer && transaction.status === 'pending_seller_approval' && (
          <p className="text-purple-700 text-sm mb-2">
            Waiting for seller approval before payment can be made.
          </p>
        )}

        {isBuyer && transaction.status === 'seller_change_requested' && (
          <div className="text-sm text-orange-700 mb-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <p className="font-medium">Seller requested changes before approval.</p>
            {sellerRequest?.seller_message && <p className="mt-1">{sellerRequest.seller_message}</p>}
            {sellerRequest?.proposed_amount && (
              <p className="mt-1">Proposed amount: KES {Number(sellerRequest.proposed_amount).toLocaleString()}</p>
            )}
            <button
              onClick={acceptSellerChanges}
              disabled={actionLoading}
              className="mt-3 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition font-medium disabled:opacity-50"
            >
              Accept Changes
            </button>
          </div>
        )}

        {isSeller && transaction.status === 'escrow' && (
          <button
            onClick={() => setShowShippingModal(true)}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium mb-2"
          >
            Mark as Shipped
          </button>
        )}

        {isBuyer && transaction.status === 'delivered' && (
          <button
            onClick={() => setShowConfirmModal(true)}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium mb-2"
          >
            Confirm Delivery
          </button>
        )}

        {isBuyer && transaction.status === 'escrow' && (
          <button
            onClick={() => setShowDisputeModal(true)}
            className="w-full bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-medium mb-2"
          >
            Raise Dispute
          </button>
        )}

        {isSeller && transaction.status === 'escrow' && (
          <button
            onClick={() => setShowDisputeModal(true)}
            className="w-full bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-medium mb-2"
          >
            Raise Dispute
          </button>
        )}

        {transaction.status === 'released' && (
          <p className="text-green-600 text-center font-semibold">
            ✓ Transaction completed successfully
          </p>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm M-Pesa Payment</h3>
            <p className="text-slate-600 mb-5">
              You will receive an M-Pesa prompt on your phone to confirm payment of KES {transaction.amount.toLocaleString()}.
            </p>
            <div className="flex gap-2">
              <button
                onClick={initiatePayment}
                disabled={actionLoading}
                className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition font-semibold"
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-300 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Modal */}
      {showShippingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Submit Shipping Evidence</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tracking Number *
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter tracking number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Courier *
              </label>
              <input
                type="text"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. G4S Kenya"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shipping Notes (optional)
              </label>
              <textarea
                value={shippingNotes}
                onChange={(e) => setShippingNotes(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Packaging and dispatch details"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={markAsShipped}
                disabled={actionLoading || !trackingNumber.trim() || !courier.trim()}
                className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-xl hover:bg-green-700 transition font-semibold"
              >
                {actionLoading ? 'Processing...' : 'Confirm Shipment'}
              </button>
              <button
                onClick={() => setShowShippingModal(false)}
                className="flex-1 bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-300 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm Delivery</h3>
            <p className="text-slate-600 mb-4">
              Confirming delivery will release the funds to the seller. This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Condition Rating *
              </label>
              <select
                value={conditionRating}
                onChange={(e) => setConditionRating(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Fair</option>
                <option value={2}>2 - Poor</option>
                <option value={1}>1 - Bad</option>
              </select>
            </div>
            <div className="mb-4 flex items-center gap-2">
              <input
                id="itemMatches"
                type="checkbox"
                checked={itemMatchesDescription}
                onChange={(e) => setItemMatchesDescription(e.target.checked)}
              />
              <label htmlFor="itemMatches" className="text-sm text-gray-700">
                Item matches the agreed description
              </label>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmation Comment (optional)
              </label>
              <textarea
                value={confirmationComment}
                onChange={(e) => setConfirmationComment(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Add any comments about the delivery"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmDelivery}
                disabled={actionLoading}
                className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-xl hover:bg-green-700 transition font-semibold"
              >
                {actionLoading ? 'Processing...' : 'Confirm Delivery'}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-300 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Raise Dispute</h3>
            <p className="text-slate-600 mb-4">
              Please provide details about the issue. Our admin team will review your dispute.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason *
              </label>
              <select
                required
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a reason</option>
                <option value="item_not_received">Item not received</option>
                <option value="item_not_as_described">Item not as described</option>
                <option value="payment_issue">Payment issue</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                required
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
                rows="4"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe the issue in detail..."
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Initial Evidence (optional, up to 3 images)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  setDisputeFiles(files.slice(0, 3));
                }}
                className="w-full"
              />
              {disputeFiles.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Selected: {disputeFiles.length} file{disputeFiles.length === 1 ? '' : 's'}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount Impact (optional)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={amountImpact}
                onChange={(e) => setAmountImpact(e.target.value)}
                placeholder="e.g. 2500"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Structured Checklist (optional)</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={checkNotReceived}
                    onChange={(e) => setCheckNotReceived(e.target.checked)}
                  />
                  Not received
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={checkConditionMismatch}
                    onChange={(e) => setCheckConditionMismatch(e.target.checked)}
                  />
                  Condition mismatch / not as described
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={checkTimelineDiscrepancy}
                    onChange={(e) => setCheckTimelineDiscrepancy(e.target.checked)}
                  />
                  Timeline discrepancy
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timeline Notes (optional)
              </label>
              <textarea
                value={timelineNotes}
                onChange={(e) => setTimelineNotes(e.target.value)}
                rows="2"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Key dates, communication milestones, or expected delivery window..."
              />
            </div>

            {disputeError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {disputeError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleRaiseDispute}
                disabled={actionLoading || !disputeReason || !disputeDescription}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl hover:bg-red-700 transition font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Submitting...' : 'Submit Dispute'}
              </button>
              <button
                onClick={() => {
                  setShowDisputeModal(false);
                  setDisputeReason('');
                  setDisputeDescription('');
                  setDisputeFiles([]);
                  setAmountImpact('');
                  setCheckNotReceived(false);
                  setCheckConditionMismatch(false);
                  setCheckTimelineDiscrepancy(false);
                  setTimelineNotes('');
                }}
                className="flex-1 bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-300 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
