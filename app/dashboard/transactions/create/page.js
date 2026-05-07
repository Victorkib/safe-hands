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

      if (response.status === 202 && result.invitation_created) {
        alert('Seller not found yet. Invitation sent successfully. You will be notified when they join.');
        router.push('/dashboard/buyer');
        return;
      }

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center bg-white border border-slate-200 shadow-sm rounded-2xl px-8 py-10">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-700 font-medium">Preparing transaction workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white p-8 shadow-lg">
        <button
          onClick={() => router.back()}
          className="mb-5 inline-flex items-center gap-2 text-blue-100 hover:text-white transition"
        >
          <span>←</span>
          <span className="text-sm font-medium">Back</span>
        </button>
        <h1 className="text-3xl font-bold tracking-tight">Create New Transaction</h1>
        <p className="text-blue-100 mt-2 max-w-2xl">
          Start a protected escrow trade in under a minute. Seller approval and payment safety checks are built in automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Seller Email *
              </label>
              <input
                type="email"
                required
                value={formData.seller_email}
                onChange={(e) => setFormData({ ...formData, seller_email: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="seller@example.com"
              />
              <p className="text-xs text-slate-500 mt-2">
                If the seller is new, we will auto-send an invitation to join and continue this deal.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Amount (KES) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="5000"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Item / Service Description *
              </label>
              <textarea
                required
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe exactly what is being sold, condition, inclusions, and agreed terms..."
              />
              <p className="text-xs text-slate-500 mt-2">
                Clear detail now reduces disputes later.
              </p>
            </div>

          <button
            type="submit"
            disabled={submitting}
              className="w-full bg-blue-600 text-white px-6 py-3.5 rounded-xl hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
              {submitting ? 'Creating Transaction...' : 'Create Secure Transaction'}
          </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-fit">
          <h3 className="font-semibold text-slate-900 mb-4">Flow Preview</h3>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center mt-0.5">1</span><span className="text-slate-700">Buyer creates request</span></li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center mt-0.5">2</span><span className="text-slate-700">Seller approves terms</span></li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center mt-0.5">3</span><span className="text-slate-700">M-Pesa payment enters escrow</span></li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center mt-0.5">4</span><span className="text-slate-700">Shipping + delivery evidence recorded</span></li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center mt-0.5">5</span><span className="text-slate-700">Funds released after confirmation</span></li>
          </ol>
        </div>
      </div>
    </div>
  );
}
