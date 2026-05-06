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
          tracking_number,
          delivery_proof_url: '',
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(result.message);
        setShowShippingModal(false);
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
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(result.message);
        setShowConfirmModal(false);
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

  const getStatusColor = (status) => {
    const colors = {
      initiated: 'bg-gray-100 text-gray-800',
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
      {transaction.status === 'delivered' || transaction.status === 'released' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
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

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
        
        {isBuyer && transaction.status === 'initiated' && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium mb-2"
          >
            Pay with M-Pesa
          </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Mark as Shipped</h3>
            <div className="mb-4">
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
            <div className="flex gap-2">
              <button
                onClick={markAsShipped}
                disabled={actionLoading}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                {actionLoading ? 'Processing...' : 'Confirm Shipment'}
              </button>
              <button
                onClick={() => setShowShippingModal(false)}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Confirm Delivery</h3>
            <p className="text-gray-600 mb-4">
              Confirming delivery will release the funds to the seller. This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmation Comment (optional)
              </label>
              <textarea
                value={confirmationComment}
                onChange={(e) => setConfirmationComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Add any comments about the delivery"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmDelivery}
                disabled={actionLoading}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                {actionLoading ? 'Processing...' : 'Confirm Delivery'}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
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
