'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function AdminDashboard() {
  const router = useRouter();
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
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/auth/login');
          return;
        }

        // Check if admin
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', authUser.id)
          .single();

        if (userData?.role !== 'admin') {
          router.push('/dashboard');
          return;
        }

        setUser(authUser);
        fetchStats();
        fetchUsers();
        fetchTransactions();
        fetchDisputes();
        fetchListings();
      } catch (error) {
        console.error('Error:', error);
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

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
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Platform management and oversight</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Total Users</p>
          <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Transactions</p>
          <p className="text-3xl font-bold text-green-600">{stats.totalTransactions}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Listings</p>
          <p className="text-3xl font-bold text-purple-600">{stats.totalListings}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Disputes</p>
          <p className="text-3xl font-bold text-red-600">{stats.totalDisputes}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Revenue</p>
          <p className="text-3xl font-bold text-yellow-600">KES {stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Pending Disputes</p>
          <p className="text-3xl font-bold text-orange-600">{stats.pendingDisputes}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {['overview', 'users', 'transactions', 'disputes', 'listings'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg transition font-medium capitalize ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
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
