'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function CreateTransaction() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    seller_email: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/auth/login');
          return;
        }
        setUser(authUser);
      } catch (error) {
        console.error('Error:', error);
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    const prefillData = localStorage.getItem('prefillTransaction');
    if (prefillData) {
      try {
        const data = JSON.parse(prefillData);
        console.log('Prefill data found:', data);
        
        // Fetch seller details to get full name
        const fetchSellerDetails = async () => {
          try {
            const { data: seller } = await supabase
              .from('users')
              .select('full_name, email')
              .eq('email', data.seller_email)
              .single();
            
            console.log('Fetched seller:', seller);
            
            setFormData({
              seller_email: data.seller_email || '',
              amount: data.amount || '',
              description: data.description || '',
            });
          } catch (error) {
            console.error('Error fetching seller details:', error);
            // Still set form data even if seller fetch fails
            setFormData({
              seller_email: data.seller_email || '',
              amount: data.amount || '',
              description: data.description || '',
            });
          }
        };
        
        fetchSellerDetails();
        localStorage.removeItem('prefillTransaction');
      } catch (error) {
        console.error('Error parsing prefill data:', error);
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      console.log('Starting transaction creation with data:', formData);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }

      console.log('Making API call...');
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('API response status:', response.status);
      const result = await response.json();
      console.log('API response data:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create transaction');
      }

      console.log('Transaction created successfully, redirecting...');
      router.push(`/dashboard/transactions/${result.transaction.id}`);
    } catch (error) {
      console.error('Error creating transaction:', error);
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-700 mb-4 inline-block"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Create New Transaction</h1>
        <p className="text-gray-600 mt-2">
          Start a new escrow transaction with a seller
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seller Email *
            </label>
            <input
              type="email"
              required
              value={formData.seller_email}
              onChange={(e) => setFormData({ ...formData, seller_email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="seller@example.com"
            />
            <p className="text-sm text-gray-500 mt-1">
              Enter the email of the seller you want to transact with
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (KES) *
            </label>
            <input
              type="number"
              required
              min="1"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="5000"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe what you're buying (e.g., iPhone 13, 128GB, Black)"
            />
            <p className="text-sm text-gray-500 mt-1">
              Be specific about the item, condition, and any agreements
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create Transaction'}
          </button>
        </form>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
        <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
          <li>Create the transaction with seller details</li>
          <li>Pay via M-Pesa STK Push (funds held in escrow)</li>
          <li>Seller ships the item</li>
          <li>You confirm delivery</li>
          <li>Funds released to seller</li>
        </ol>
      </div>
    </div>
  );
}
