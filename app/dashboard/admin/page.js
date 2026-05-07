'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function AdminDashboard() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalListings: 0,
    totalDisputes: 0,
    totalRevenue: 0,
    pendingDisputes: 0,
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [listings, setListings] = useState([]);

  useEffect(() => {
    if (!authLoading) {
      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        setLoading(false);
      } else {
        fetchStats();
        fetchUsers();
        fetchTransactions();
        fetchDisputes();
        fetchListings();
        setLoading(false);
      }
    }
  }, [profile, authLoading, router]);

  const fetchStats = async () => {
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: totalTransactions } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
    const { count: totalListings } = await supabase.from('listings').select('*', { count: 'exact', head: true });
    const { count: totalDisputes } = await supabase.from('disputes').select('*', { count: 'exact', head: true });
    const { data: revenue } = await supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'released');
    const { count: pendingDisputes } = await supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    setStats({
      totalUsers: totalUsers || 0,
      totalTransactions: totalTransactions || 0,
      totalListings: totalListings || 0,
      totalDisputes: totalDisputes || 0,
      totalRevenue: revenue?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0,
      pendingDisputes: pendingDisputes || 0,
    });
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setUsers(data);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*, buyer:users!transactions_buyer_id_fkey(email), seller:users!transactions_seller_id_fkey(email)')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setTransactions(data);
  };

  const fetchDisputes = async () => {
    const { data } = await supabase
      .from('disputes')
      .select('*, transaction:transactions(amount)')
      .order('created_at', { ascending: false });
    if (data) setDisputes(data);
  };

  const fetchListings = async () => {
    const { data } = await supabase
      .from('listings')
      .select('*, seller:users(email)')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setListings(data);
  };

  const handleToggleUserStatus = async (userId, isActive) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_active: !isActive }),
    });
    if (response.ok) {
      fetchUsers();
    } else {
      alert('Failed to update user status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Platform oversight and management tools</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        <Link href="/dashboard/admin/users" className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-lg transition-all hover:border-blue-300 group cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalUsers}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition">
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          </div>
          <button className="w-full px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition font-medium text-xs">
            Manage Users
          </button>
        </Link>

        <Link href="/dashboard/admin/transactions" className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-lg transition-all hover:border-green-300 group cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Transactions</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.totalTransactions}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
              </svg>
            </div>
          </div>
          <button className="w-full px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition font-medium text-xs">
            Manage Transactions
          </button>
        </Link>

        <Link href="/dashboard/admin/listings" className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-lg transition-all hover:border-purple-300 group cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Listings</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{stats.totalListings}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition">
              <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 9.5c0 1.38-1.12 2.5-2.5 2.5S9 13.88 9 12.5 10.12 10 11.5 10 14 11.12 14 12.5zm3 6.5H5v-3.5c0-1.66 2.69-2.5 4-2.5s4 .84 4 2.5V19z" />
              </svg>
            </div>
          </div>
          <button className="w-full px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition font-medium text-xs">
            Moderate Listings
          </button>
        </Link>

        <Link href="/dashboard/admin/disputes" className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-lg transition-all hover:border-red-300 group cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Disputes</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.totalDisputes}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition">
              <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
            </div>
          </div>
          <button className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium text-xs">
            Manage Disputes
          </button>
        </Link>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Platform Revenue</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">KES {stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Disputes</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{stats.pendingDisputes}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6h1.5V7zm0 8H11v1.5h1.5V15z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex flex-wrap gap-1">
          {['overview', 'users', 'transactions', 'disputes', 'listings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 font-medium capitalize text-sm border-b-2 transition-all ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
          <p className="text-gray-600">Recent activity feed would go here</p>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-bold p-6">User Management</h2>
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b">
                  <td className="px-6 py-4 text-sm">{u.email}</td>
                  <td className="px-6 py-4 text-sm">{u.full_name}</td>
                  <td className="px-6 py-4 text-sm capitalize">{u.role}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-bold p-6">Transaction Management</h2>
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Buyer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Seller</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="px-6 py-4 text-sm font-mono">{t.id.slice(0, 8)}...</td>
                  <td className="px-6 py-4 text-sm">{t.buyer?.email}</td>
                  <td className="px-6 py-4 text-sm">{t.seller?.email}</td>
                  <td className="px-6 py-4 text-sm">KES {parseFloat(t.amount).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm capitalize">{t.status}</td>
                  <td className="px-6 py-4 text-sm">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'disputes' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-bold p-6">Dispute Management</h2>
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id} className="border-b">
                  <td className="px-6 py-4 text-sm font-mono">{d.id.slice(0, 8)}...</td>
                  <td className="px-6 py-4 text-sm">KES {d.transaction?.amount?.toLocaleString() || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm capitalize">{d.reason.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-sm capitalize">{d.status}</td>
                  <td className="px-6 py-4 text-sm">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <Link
                      href={`/dashboard/disputes/${d.id}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      View/Resolve
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'listings' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-bold p-6">Listing Management</h2>
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Seller</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Views</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="px-6 py-4 text-sm">{l.title}</td>
                  <td className="px-6 py-4 text-sm">{l.seller?.email}</td>
                  <td className="px-6 py-4 text-sm">KES {parseFloat(l.price).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm capitalize">{l.status}</td>
                  <td className="px-6 py-4 text-sm">{l.view_count || 0}</td>
                  <td className="px-6 py-4 text-sm">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <Link
                      href={`/listings/${l.id}`}
                      target="_blank"
                      className="text-blue-600 hover:text-blue-700"
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
  );
}
