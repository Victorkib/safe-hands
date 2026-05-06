'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function TransactionDetail() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  
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
  const [sellerRequest, setSellerRequest] = useState(null);
  const [sellerMessage, setSellerMessage] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  
  // Evidence-related state
  const [evidence, setEvidence] = useState([]);
  const [courier, setCourier] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [conditionRating, setConditionRating] = useState(5);
  const [itemMatchesDescription, setItemMatchesDescription] = useState(true);
  
  // Dispute window countdown
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Countdown timer for dispute window
  useEffect(() => {
    if (!transaction?.auto_release_date || transaction.status !== 'delivered') {
      setTimeRemaining(null);
      return;
    }

    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const releaseTime = new Date(transaction.auto_release_date).getTime();
      const diff = releaseTime - now;

      if (diff <= 0) {
        setTimeRemaining({ expired: true, text: 'Expired', hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({
        expired: false,
        hours,
        minutes,
        seconds,
        text: `${hours}h ${minutes}m ${seconds}s`,
        isUrgent: hours < 24,
        isCritical: hours < 6,
      });
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [transaction?.auto_release_date, transaction?.status]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/auth/login');
          return;
        }
        setUser(authUser);
        fetchTransaction(authUser.id);
      } catch (error) {
        console.error('Error:', error);
        setError('Failed to load transaction');
        setLoading(false);
      }
    };

    if (id) {
      checkAuth();
    }
  }, [id, router]);

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

      // Fetch evidence
      fetchEvidence();
    } catch (error) {
      console.error('Error fetching transaction:', error);
      setError('Transaction not found');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvidence = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/transactions/${id}/evidence`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setEvidence(result.evidence || []);
      }
    } catch (error) {
      console.error('Error fetching evidence:', error);
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
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(result.message);
        setShowConfirmModal(false);
        setConfirmationComment('');
        setConditionRating(5);
        setItemMatchesDescription(true);
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
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id: id,
          reason: disputeReason,
          description: disputeDescription,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Dispute raised successfully');
        setShowDisputeModal(false);
        setDisputeReason('');
        setDisputeDescription('');
        fetchTransaction(user.id);
      } else {
        alert(result.error || 'Failed to raise dispute');
      }
    } catch (error) {
      console.error('Dispute error:', error);
      alert('Failed to raise dispute');
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

  const isBuyer = user && transaction && transaction.buyer_id === user.id;
  const isSeller = user && transaction && transaction.seller_id === user.id;
  const userRole = user?.user_metadata?.role || 'buyer';

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
      {/* Dispute Window Banner */}
      {transaction.status === 'delivered' && timeRemaining && !timeRemaining.expired && (
        <div className={`rounded-lg shadow p-4 mb-6 ${
          timeRemaining.isCritical 
            ? 'bg-red-50 border-2 border-red-400' 
            : timeRemaining.isUrgent 
              ? 'bg-orange-50 border-2 border-orange-400'
              : 'bg-blue-50 border-2 border-blue-400'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                timeRemaining.isCritical 
                  ? 'bg-red-100 text-red-600' 
                  : timeRemaining.isUrgent 
                    ? 'bg-orange-100 text-orange-600'
                    : 'bg-blue-100 text-blue-600'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className={`font-bold ${
                  timeRemaining.isCritical 
                    ? 'text-red-800' 
                    : timeRemaining.isUrgent 
                      ? 'text-orange-800'
                      : 'text-blue-800'
                }`}>
                  {timeRemaining.isCritical 
                    ? 'URGENT: Dispute Window Closing Soon!' 
                    : timeRemaining.isUrgent 
                      ? 'Dispute Window Closing in 24h'
                      : 'Dispute Window Active'}
                </h3>
                <p className={`text-sm ${
                  timeRemaining.isCritical 
                    ? 'text-red-700' 
                    : timeRemaining.isUrgent 
                      ? 'text-orange-700'
                      : 'text-blue-700'
                }`}>
                  {isBuyer 
                    ? 'Confirm delivery or raise a dispute before funds are automatically released.' 
                    : 'Buyer has until the timer expires to confirm or dispute.'}
                </p>
              </div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-mono font-bold ${
                timeRemaining.isCritical 
                  ? 'text-red-600' 
                  : timeRemaining.isUrgent 
                    ? 'text-orange-600'
                    : 'text-blue-600'
              }`}>
                {String(timeRemaining.hours).padStart(2, '0')}:
                {String(timeRemaining.minutes).padStart(2, '0')}:
                {String(timeRemaining.seconds).padStart(2, '0')}
              </div>
              <p className="text-xs text-gray-600 uppercase">Time Remaining</p>
            </div>
          </div>
          {isBuyer && (
            <div className="mt-4 flex gap-2 flex-wrap">
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
              >
                Confirm Delivery
              </button>
              <button
                onClick={() => setShowDisputeModal(true)}
                className={`px-4 py-2 rounded-lg transition text-sm font-medium ${
                  timeRemaining.isCritical 
                    ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse' 
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                Raise Dispute
              </button>
            </div>
          )}
        </div>
      )}

      {/* Expired Dispute Window Notice */}
      {transaction.status === 'delivered' && timeRemaining?.expired && (
        <div className="bg-gray-100 border-2 border-gray-300 rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Dispute Window Expired</h3>
              <p className="text-sm text-gray-600">
                Funds will be released to the seller shortly via automatic processing.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-600">Transaction ID</p>
            <p className="font-mono text-lg">{transaction.id.slice(0, 8)}...</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(transaction.status)}`}>
            {transaction.status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Amount</p>
            <p className="text-2xl font-bold text-gray-900">KES {transaction.amount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Created</p>
            <p className="text-gray-900">{new Date(transaction.created_at).toLocaleString()}</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">Description</p>
          <p className="text-gray-900">{transaction.description}</p>
        </div>

        {/* Parties */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Buyer</p>
              <p className="font-medium text-gray-900">{transaction.buyer?.full_name || 'Loading...'}</p>
              <p className="text-sm text-gray-600">{transaction.buyer?.email || 'Loading...'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Seller</p>
              <p className="font-medium text-gray-900">{transaction.seller?.full_name || 'Loading...'}</p>
              <p className="text-sm text-gray-600">{transaction.seller?.email || 'Loading...'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
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
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Delivery Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Shipped At</p>
              <p className="text-gray-900">
                {transaction.shipped_at 
                  ? new Date(transaction.shipped_at).toLocaleString() 
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Delivery Confirmed At</p>
              <p className="text-gray-900">
                {transaction.delivery_confirmed_at 
                  ? new Date(transaction.delivery_confirmed_at).toLocaleString() 
                  : 'Pending'}
              </p>
            </div>
            {transaction.tracking_number && (
              <div>
                <p className="text-sm text-gray-600">Tracking Number</p>
                <p className="text-gray-900 font-mono">{transaction.tracking_number}</p>
              </div>
            )}
            {transaction.courier && (
              <div>
                <p className="text-sm text-gray-600">Courier</p>
                <p className="text-gray-900">{transaction.courier}</p>
              </div>
            )}
            {transaction.auto_release_date && transaction.status === 'delivered' && (
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Auto-Release Date</p>
                <p className="text-gray-900">
                  {new Date(transaction.auto_release_date).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          {transaction.buyer_confirmation && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">Buyer&apos;s Confirmation</p>
              <p className="text-gray-900">{transaction.buyer_confirmation}</p>
            </div>
          )}
        </div>
      )}

      {/* Evidence Timeline */}
      {evidence.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Evidence Timeline</h2>
          <div className="space-y-4">
            {evidence.map((item) => (
              <div 
                key={item.id} 
                className={`border-l-4 pl-4 py-2 ${
                  item.submission_type.startsWith('seller') 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-green-500 bg-green-50'
                } rounded-r-lg`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.submission_type === 'seller_ship' && 'Seller Shipped Item'}
                      {item.submission_type === 'buyer_receive' && 'Buyer Confirmed Delivery'}
                      {item.submission_type === 'seller_additional' && 'Seller Additional Evidence'}
                      {item.submission_type === 'buyer_additional' && 'Buyer Additional Evidence'}
                    </p>
                    <p className="text-sm text-gray-600">
                      By {item.submitter?.full_name || 'Unknown'} on {new Date(item.submitted_at).toLocaleString()}
                    </p>
                  </div>
                  {item.condition_rating && (
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-medium">
                      {item.condition_rating}/5 Stars
                    </span>
                  )}
                </div>
                {item.tracking_number && (
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-medium">Tracking:</span> {item.tracking_number}
                    {item.courier && ` (${item.courier})`}
                  </p>
                )}
                {item.notes && (
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-medium">Notes:</span> {item.notes}
                  </p>
                )}
                {item.item_matches_description !== null && (
                  <p className="text-sm mt-1">
                    <span className="font-medium">Item matches description:</span>{' '}
                    <span className={item.item_matches_description ? 'text-green-600' : 'text-red-600'}>
                      {item.item_matches_description ? 'Yes' : 'No'}
                    </span>
                  </p>
                )}
                {item.photos && item.photos.length > 0 && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {item.photos.map((photo, idx) => (
                      <a 
                        key={idx} 
                        href={photo} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        Photo {idx + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow p-6">
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
          <p className="text-green-600 text-center font-medium">
            ✓ Transaction completed successfully
          </p>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Confirm Payment</h3>
            <p className="text-gray-600 mb-4">
              You will receive an M-Pesa prompt on your phone to confirm payment of KES {transaction.amount.toLocaleString()}.
            </p>
            <div className="flex gap-2">
              <button
                onClick={initiatePayment}
                disabled={actionLoading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Modal */}
      {showShippingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Mark as Shipped</h3>
            <p className="text-sm text-gray-600 mb-4">
              Provide shipping details to help the buyer track their order.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tracking Number (optional)
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter tracking number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Courier / Delivery Service (optional)
                </label>
                <select
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select courier</option>
                  <option value="G4S Kenya">G4S Kenya</option>
                  <option value="Wells Fargo">Wells Fargo</option>
                  <option value="Sendy">Sendy</option>
                  <option value="Fargo Courier">Fargo Courier</option>
                  <option value="Posta Kenya">Posta Kenya</option>
                  <option value="DHL">DHL</option>
                  <option value="FedEx">FedEx</option>
                  <option value="Personal Delivery">Personal Delivery</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shipping Notes (optional)
                </label>
                <textarea
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                  placeholder="Any additional details about the shipment..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={markAsShipped}
                disabled={actionLoading}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                {actionLoading ? 'Processing...' : 'Confirm Shipment'}
              </button>
              <button
                onClick={() => {
                  setShowShippingModal(false);
                  setTrackingNumber('');
                  setCourier('');
                  setShippingNotes('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Confirm Delivery</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-yellow-800 text-sm">
                Confirming delivery will release the funds to the seller. This action cannot be undone. Only confirm if you have received the item and are satisfied.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Condition Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setConditionRating(star)}
                      className={`w-10 h-10 rounded-full border-2 font-bold transition ${
                        star <= conditionRating
                          ? 'bg-yellow-400 border-yellow-500 text-white'
                          : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {star}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {conditionRating === 5 && 'Excellent - As described'}
                  {conditionRating === 4 && 'Good - Minor issues'}
                  {conditionRating === 3 && 'Average - Some issues'}
                  {conditionRating === 2 && 'Poor - Major issues'}
                  {conditionRating === 1 && 'Very Poor - Not as expected'}
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemMatchesDescription}
                    onChange={(e) => setItemMatchesDescription(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Item matches the description provided
                  </span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmation Comment (optional)
                </label>
                <textarea
                  value={confirmationComment}
                  onChange={(e) => setConfirmationComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                  placeholder="Add any comments about the delivery..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={confirmDelivery}
                disabled={actionLoading}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                {actionLoading ? 'Processing...' : 'Confirm Delivery'}
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmationComment('');
                  setConditionRating(5);
                  setItemMatchesDescription(true);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Raise Dispute</h3>
            <p className="text-gray-600 mb-4">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe the issue in detail..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRaiseDispute}
                disabled={actionLoading || !disputeReason || !disputeDescription}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {actionLoading ? 'Submitting...' : 'Submit Dispute'}
              </button>
              <button
                onClick={() => {
                  setShowDisputeModal(false);
                  setDisputeReason('');
                  setDisputeDescription('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
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
