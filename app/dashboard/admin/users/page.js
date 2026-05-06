'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function AdminUsersPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Check admin access and fetch users
  useEffect(() => {
    if (authLoading) return;
    
    if (!profile || profile.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    
    fetchUsers();
  }, [profile, authLoading, router]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setUsers(data || []);
    } catch (err) {
      console.error('[v0] Error fetching users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && user.is_active) ||
                         (filterStatus === 'inactive' && !user.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const openModal = (user, action) => {
    setSelectedUser(user);
    setModalAction(action);
    setShowModal(true);
    setActionMessage(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setModalAction(null);
    setActionMessage(null);
  };

  const handleToggleStatus = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('users')
        .update({ is_active: !selectedUser.is_active })
        .eq('id', selectedUser.id);

      if (err) throw err;

      setUsers(users.map(u => 
        u.id === selectedUser.id ? { ...u, is_active: !u.is_active } : u
      ));
      setActionMessage({
        type: 'success',
        text: `User ${!selectedUser.is_active ? 'activated' : 'deactivated'} successfully`
      });
      setTimeout(closeModal, 1500);
    } catch (err) {
      console.error('[v0] Error toggling status:', err);
      setActionMessage({ type: 'error', text: 'Failed to update user status' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedUser.id);

      if (err) throw err;

      setUsers(users.filter(u => u.id !== selectedUser.id));
      setActionMessage({
        type: 'success',
        text: 'User deleted successfully'
      });
      setTimeout(closeModal, 1500);
    } catch (err) {
      console.error('[v0] Error deleting user:', err);
      setActionMessage({ type: 'error', text: 'Failed to delete user' });
    } finally {
      setActionLoading(false);
    }
  };

  const renderModal = () => {
    if (!showModal || !selectedUser) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">
              {modalAction === 'toggle' ? 'Confirm Status Change' : 'Confirm Delete User'}
            </h3>
          </div>

          <div className="p-6">
            <p className="text-gray-600 mb-4">
              {modalAction === 'toggle' 
                ? `Are you sure you want to ${selectedUser.is_active ? 'deactivate' : 'activate'} ${selectedUser.full_name}?`
                : `Are you sure you want to permanently delete ${selectedUser.full_name}? This cannot be undone.`}
            </p>

            {actionMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
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
                onClick={modalAction === 'toggle' ? handleToggleStatus : handleDeleteUser}
                disabled={actionLoading}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition disabled:opacity-50 ${
                  modalAction === 'delete' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {actionLoading ? 'Processing...' : modalAction === 'delete' ? 'Delete' : 'Confirm'}
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
          <p className="text-gray-600 font-medium">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
        <p className="text-gray-600 mt-1">Control user accounts, roles, and permissions</p>
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
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Search</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="buyer_seller">Buyer & Seller</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterRole('all');
                setFilterStatus('all');
              }}
              className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg transition font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6 20h12a6 6 0 00-6-6 6 6 0 00-6 6v2h12v-2z" />
              </svg>
              <p className="text-lg font-semibold text-gray-900">No users found</p>
              <p className="text-sm text-gray-600 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{user.full_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        user.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button
                        onClick={() => openModal(user, 'toggle')}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition font-medium text-xs"
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => openModal(user, 'delete')}
                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Stats */}
        <div className="pt-4 border-t border-gray-200 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{filteredUsers.length}</p>
            <p className="text-sm text-gray-600">Shown</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{filteredUsers.filter(u => u.is_active).length}</p>
            <p className="text-sm text-gray-600">Active</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
        </div>
      </div>

      {renderModal()}
    </div>
  );
}
