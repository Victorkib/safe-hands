'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function DisputeDetail() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  
  const [user, setUser] = useState(null);
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolution, setResolution] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/auth/login');
          return;
        }
        setUser(authUser);
        
        // Fetch user role
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', authUser.id)
          .single();
        
        setUserRole(userData?.role || null);
        fetchDispute(authUser.id);
      } catch (error) {
        console.error('Error:', error);
        setError('Failed to load dispute');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [id, router]);

  const fetchDispute = async (userId) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/disputes`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    const result = await response.json();
    if (result.success) {
      const disputeData = result.disputes.find(d => d.id === id);
      if (disputeData) {
        setDispute(disputeData);
      } else {
        setError('Dispute not found');
      }
    }
  };

  const handleEvidenceUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file));

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/disputes/${id}/upload-evidence`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        alert('Evidence uploaded successfully');
        setShowEvidenceModal(false);
        setSelectedFiles([]);
        fetchDispute(user.id);
      } else {
        alert(result.error || 'Failed to upload evidence');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload evidence');
    } finally {
      setUploading(false);
    }
  };

  const handleResolveDispute = async () => {
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/disputes/${id}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resolution,
          admin_notes: adminNotes,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Dispute resolved successfully');
        setShowResolveModal(false);
        setResolution('');
        setAdminNotes('');
        fetchDispute(user.id);
      } else {
        alert(result.error || 'Failed to resolve dispute');
      }
    } catch (error) {
      console.error('Resolution error:', error);
      alert('Failed to resolve dispute');
    } finally {
      setUploading(false);
    }
  };

  const statusColors = {
    open: 'bg-red-100 text-red-800',
    in_review: 'bg-yellow-100 text-yellow-800',
    awaiting_response: 'bg-orange-100 text-orange-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dispute...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <Link href="/dashboard/disputes" className="text-blue-600 hover:text-blue-700">
            Back to Disputes
          </Link>
        </div>
      </div>
    );
  }

  const isInvolved = user && dispute && (dispute.raised_by === user.id || dispute.raised_against === user.id);
  const isAdmin = userRole === 'admin';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/disputes" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
          ← Back to Disputes
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Dispute Details</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-600">Dispute ID</p>
            <p className="font-mono text-lg">{dispute.id.slice(0, 8)}...</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[dispute.status]}`}>
            {dispute.status.replace('_', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Raised By</p>
            <p className="font-medium">{dispute.raised_by_user?.full_name}</p>
            <p className="text-sm text-gray-600">{dispute.raised_by_user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Raised Against</p>
            <p className="font-medium">{dispute.raised_against_user?.full_name}</p>
            <p className="text-sm text-gray-600">{dispute.raised_against_user?.email}</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">Transaction Amount</p>
          <p className="text-2xl font-bold">KES {dispute.transaction?.amount?.toLocaleString() || 'N/A'}</p>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">Reason</p>
          <p className="text-gray-900 capitalize">{dispute.reason.replace('_', ' ')}</p>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">Description</p>
          <p className="text-gray-900">{dispute.description}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-2">Evidence</p>
          {dispute.evidence_urls && dispute.evidence_urls.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {dispute.evidence_urls.map((url, index) => (
                <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Evidence ${index + 1}`} className="w-full h-32 object-cover rounded-lg hover:opacity-80 transition" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No evidence uploaded</p>
          )}
        </div>

        {dispute.resolution && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-gray-600">Resolution</p>
            <p className="font-medium text-green-800 capitalize">{dispute.resolution.replace('_', ' ')}</p>
            {dispute.admin_notes && (
              <p className="text-sm text-gray-600 mt-2">Admin Notes: {dispute.admin_notes}</p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {isInvolved && dispute.status === 'open' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
          {dispute.evidence_urls && dispute.evidence_urls.length < 3 && (
            <button
              onClick={() => setShowEvidenceModal(true)}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium mb-2"
            >
              Upload Evidence (Max {3 - (dispute.evidence_urls?.length || 0)} more)
            </button>
          )}
        </div>
      )}

      {isAdmin && dispute.status === 'open' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Actions</h2>
          <button
            onClick={() => setShowResolveModal(true)}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Resolve Dispute
          </button>
        </div>
      )}

      {/* Evidence Upload Modal */}
      {showEvidenceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Upload Evidence</h3>
            <p className="text-sm text-gray-600 mb-4">
              Max 3 files, max 1MB each. JPEG, PNG, or WebP only.
            </p>
            <form onSubmit={handleEvidenceUpload}>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                className="w-full mb-4"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={uploading || selectedFiles.length === 0}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEvidenceModal(false);
                    setSelectedFiles([]);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolution Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Resolve Dispute</h3>
            <p className="text-gray-600 mb-4">
              Review the evidence and make a fair resolution.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resolution *
              </label>
              <select
                required
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select resolution</option>
                <option value="refund_buyer">Refund to Buyer</option>
                <option value="release_to_seller">Release to Seller</option>
                <option value="partial_refund">Partial Refund</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Notes *
              </label>
              <textarea
                required
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Explain your decision..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResolveDispute}
                disabled={uploading || !resolution || !adminNotes}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {uploading ? 'Processing...' : 'Resolve'}
              </button>
              <button
                onClick={() => {
                  setShowResolveModal(false);
                  setResolution('');
                  setAdminNotes('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
