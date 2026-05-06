'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function SellerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [listings, setListings] = useState([]);
  const [activeTab, setActiveTab] = useState('transactions');
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({
    totalSales: 0,
    earnings: 0,
    pending: 0,
    active: 0,
    totalListings: 0,
    activeListings: 0,
    soldListings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!user) {
          router.push('/auth/login');
          return;
        }

        // Fetch seller transactions
        const { data: txns, error: txnError } = await supabase
          .from('transactions')
          .select('*')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false });

        if (!txnError && txns) {
          setTransactions(txns);
        }

        // Fetch seller listings
        const { data: lstngs, error: listError } = await supabase
          .from('listings')
          .select('*')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false });

        if (!listError && lstngs) {
          setListings(lstngs);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const filteredTransactions =
    filter === 'all' ? transactions : transactions.filter((tx) => tx.status === filter);

  const statusColors = {
    initiated: 'bg-gray-100 text-gray-800',
    escrow: 'bg-blue-100 text-blue-800',
    delivered: 'bg-yellow-100 text-yellow-800',
    released: 'bg-green-100 text-green-800',
    disputed: 'bg-red-100 text-red-800',
    refunded: 'bg-orange-100 text-orange-800',
  };

  // Calculate earnings
  const totalEarnings = transactions
    .filter((tx) => tx.status === 'released')
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  const pendingEarnings = transactions
    .filter((tx) => tx.status === 'escrow')
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Welcome Back, Seller</h1>
        <p className="text-gray-600">Manage your listings and track your earnings</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{transactions.length}</p>
            </div>
            <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Released Earnings</p>
              <p className="text-3xl font-bold text-green-600 mt-2">KES {totalEarnings.toLocaleString()}</p>
            </div>
            <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Earnings</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">KES {pendingEarnings.toLocaleString()}</p>
            </div>
            <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Sales</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{transactions.filter((tx) => tx.status === 'escrow').length}</p>
            </div>
            <div className="w-14 h-14 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link href="/dashboard/listings/create" className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 p-6 group">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-200">
              <svg className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors duration-200" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">Create Listing</h3>
              <p className="text-sm text-gray-600 mt-1">Add a new item to sell</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/listings" className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-purple-300 transition-all duration-200 p-6 group">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-600 transition-colors duration-200">
              <svg className="w-7 h-7 text-purple-600 group-hover:text-white transition-colors duration-200" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors duration-200">Manage Listings</h3>
              <p className="text-sm text-gray-600 mt-1">Edit or remove items</p>
            </div>
          </div>
        </Link>

        <Link href="/marketplace" className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 p-6 group">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-600 transition-colors duration-200">
              <svg className="w-7 h-7 text-orange-600 group-hover:text-white transition-colors duration-200" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-. 9-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-9-2h14V4H5l.94 2H2v2h2.42L5 18z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition-colors duration-200">Browse Marketplace</h3>
              <p className="text-sm text-gray-600 mt-1">See other listings</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {['all', 'initiated', 'escrow', 'delivered', 'released', 'disputed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg transition font-medium capitalize ${
              filter === status
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">No transactions found</p>
            <Link href="/" className="text-green-600 hover:text-green-700 font-medium mt-2 inline-block">
              Start selling today
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">
                      {tx.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">KES {tx.amount}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[tx.status] || 'bg-gray-100'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/dashboard/transactions/${tx.id}`}
                        className="text-green-600 hover:text-green-700 font-medium"
                      >
                        View
                      </Link>
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
