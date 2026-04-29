# Implementation Plan: Critical UI Fixes & Admin Dashboard
**Phase 10: Navigation & Admin Features**

## Overview

This implementation plan addresses the critical missing features identified in the system analysis:
1. Dispute Creation UI
2. Navigation improvements (Marketplace & Disputes links)
3. Transaction pre-fill from marketplace
4. Comprehensive Admin Dashboard
5. Dispute Resolution UI for admins

---

## IMPLEMENTATION ORDER

### Phase 1: Quick Navigation Fixes (30 minutes)
1. Add Marketplace link to Navbar
2. Add Disputes link to Navbar

### Phase 2: Transaction Pre-fill (20 minutes)
3. Implement localStorage pre-fill in Transaction Create page

### Phase 3: Dispute Creation UI (45 minutes)
4. Add Dispute Creation button and modal to Transaction Detail page

### Phase 4: Dispute Resolution UI (30 minutes)
5. Add Dispute Resolution form to Dispute Detail page for admins

### Phase 5: Comprehensive Admin Dashboard (2-3 hours)
6. Create Admin Dashboard with full platform management

---

## PHASE 1: QUICK NAVIGATION FIXES

### Task 1.1: Add Marketplace Link to Navbar
**File:** `components/shared/Navbar.js`

**Changes:**
1. Add "Marketplace" link in desktop navigation (before user menu)
2. Add "Marketplace" link in mobile menu
3. Add "Marketplace" link in dropdown menu

**Implementation:**
```javascript
// In desktop navigation div (around line 65-93)
<Link href="/marketplace" className="hover:text-blue-100 transition">
  Marketplace
</Link>

// In mobile menu div (around line 118-131)
<Link
  href="/marketplace"
  className="block text-white hover:text-blue-100 py-2 transition"
>
  Marketplace
</Link>

// In desktop dropdown (around line 136-162)
<Link
  href="/marketplace"
  className="block px-4 py-2 hover:bg-gray-100 transition"
>
  Marketplace
</Link>
```

**Validation:**
- Test navbar as logged out user
- Test navbar as logged in user (all roles)
- Verify links work on mobile and desktop

---

### Task 1.2: Add Disputes Link to Navbar
**File:** `components/shared/Navbar.js`

**Changes:**
1. Add "Disputes" link in desktop dropdown menu
2. Add "Disputes" link in mobile menu

**Implementation:**
```javascript
// In mobile menu div (around line 118-131)
<Link
  href="/dashboard/disputes"
  className="block text-white hover:text-blue-100 py-2 transition"
>
  Disputes
</Link>

// In desktop dropdown (around line 136-162)
<Link
  href="/dashboard/disputes"
  className="block px-4 py-2 hover:bg-gray-100 transition"
>
  Disputes
</Link>
```

**Validation:**
- Test navbar as logged in user
- Verify disputes link works
- Verify link only shows when logged in

---

## PHASE 2: TRANSACTION PRE-FILL

### Task 2.1: Implement localStorage Pre-fill in Transaction Create Page
**File:** `app/dashboard/transactions/create/page.js`

**Changes:**
1. Add useEffect to read from localStorage on page load
2. Pre-fill form fields if data exists
3. Clear localStorage after pre-filling
4. Remove localStorage on form submission

**Implementation:**
```javascript
// Add after existing useEffect (around line 37)
useEffect(() => {
  const prefillData = localStorage.getItem('prefillTransaction');
  if (prefillData) {
    try {
      const data = JSON.parse(prefillData);
      setFormData({
        seller_email: data.seller_email || '',
        amount: data.amount || '',
        description: data.description || '',
      });
      // Clear localStorage after pre-filling
      localStorage.removeItem('prefillTransaction');
    } catch (error) {
      console.error('Error parsing prefill data:', error);
    }
  }
}, []);

// In handleSubmit function (around line 39-69), add:
// Clear localStorage on submit
localStorage.removeItem('prefillTransaction');
```

**Validation:**
- Create a listing
- Click "Buy Now" on public listing page
- Verify form is pre-filled with seller email, amount, description
- Submit form and verify localStorage is cleared
- Test without pre-fill data (should work normally)

---

## PHASE 3: DISPUTE CREATION UI

### Task 3.1: Add Dispute Creation Modal to Transaction Detail Page
**File:** `app/dashboard/transactions/[id]/page.js`

**Changes:**
1. Add state for dispute modal
2. Add "Raise Dispute" button (conditional display)
3. Add dispute creation modal with form
4. Add handleSubmitDispute function
5. Add dispute reason dropdown options

**Implementation:**

**Add state (around line 22):**
```javascript
const [showDisputeModal, setShowDisputeModal] = useState(false);
const [disputeReason, setDisputeReason] = useState('');
const [disputeDescription, setDisputeDescription] = useState('');
```

**Add handleSubmitDispute function (after confirmDelivery function, around line 165):**
```javascript
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
```

**Add "Raise Dispute" button in Actions section (around line 345):**
```javascript
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
```

**Add Dispute Modal (after Delivery Confirmation Modal, around line 454):**
```javascript
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
```

**Validation:**
- Login as buyer
- Create transaction and pay (status = escrow)
- Verify "Raise Dispute" button appears
- Click button and verify modal appears
- Fill form and submit
- Verify dispute is created
- Check disputes page to see new dispute
- Repeat with seller role

---

## PHASE 4: DISPUTE RESOLUTION UI

### Task 4.1: Add Dispute Resolution Form to Dispute Detail Page
**File:** `app/dashboard/disputes/[id]/page.js`

**Changes:**
1. Add state for resolution modal
2. Add "Resolve Dispute" button (admin only)
3. Add resolution form with options
4. Add handleResolveDispute function
5. Add admin notes field

**Implementation:**

**Add state (around line 19):**
```javascript
const [showResolveModal, setShowResolveModal] = useState(false);
const [resolution, setResolution] = useState('');
const [adminNotes, setAdminNotes] = useState('');
```

**Add handleResolveDispute function (after handleEvidenceUpload, around line 90):**
```javascript
const handleResolveDispute = async () => {
  setActionLoading(true);
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
    setActionLoading(false);
  }
};
```

**Modify isAdmin check (around line 125) to properly check role:**
```javascript
const isAdmin = user && profile?.role === 'admin';
```

**Add "Resolve Dispute" button in Actions section (around line 214):**
```javascript
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
```

**Add Resolution Modal (after Evidence Upload Modal, around line 254):**
```javascript
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
          disabled={actionLoading || !resolution || !adminNotes}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {actionLoading ? 'Processing...' : 'Resolve'}
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
```

**Validation:**
- Create admin account (update users table directly)
- Login as admin
- Navigate to disputes page
- Click on an open dispute
- Verify "Resolve Dispute" button appears
- Click button and verify modal appears
- Fill form and submit
- Verify dispute is resolved
- Check that transaction status is updated accordingly

---

## PHASE 5: COMPREHENSIVE ADMIN DASHBOARD

### Task 5.1: Create Admin Dashboard Page
**File:** `app/dashboard/admin/page.js` (NEW FILE)

**Features:**
1. Platform statistics overview
2. User management table
3. Transaction management table
4. Dispute management with quick resolution
5. Listing management
6. Recent activity feed
7. Revenue analytics

**Implementation:**

```javascript
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
    const { data: users } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { data: transactions } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
    const { data: listings } = await supabase.from('listings').select('*', { count: 'exact', head: true });
    const { data: disputes } = await supabase.from('disputes').select('*', { count: 'exact', head: true });
    const { data: revenue } = await supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'released');
    const { data: pending } = await supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    setStats({
      totalUsers: users || 0,
      totalTransactions: transactions || 0,
      totalListings: listings || 0,
      totalDisputes: disputes || 0,
      totalRevenue: revenue?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0,
      pendingDisputes: pending || 0,
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
```

---

### Task 5.2: Add Admin Link to Navbar
**File:** `components/shared/Navbar.js`

**Changes:**
Add admin dashboard link to dropdown menu (only for admin role)

**Implementation:**
```javascript
// In useEffect, fetch user role to check if admin
const [userRole, setUserRole] = useState(null);

// After fetching user, fetch role
const fetchUserRole = async () => {
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (data) setUserRole(data.role);
  }
};
useEffect(() => {
  fetchUserRole();
}, [user]);

// In desktop dropdown (around line 136-162)
{userRole === 'admin' && (
  <Link
    href="/dashboard/admin"
    className="block px-4 py-2 hover:bg-gray-100 transition"
  >
    Admin Dashboard
  </Link>
)}
```

---

### Task 5.3: Create Admin API Routes
**File:** `app/api/admin/users/[id]/route.js` (NEW FILE)

**Purpose:** Allow admins to activate/deactivate users

**Implementation:**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), { status: 401 });
    }

    // Check if admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 });
    }

    const { is_active } = await request.json();

    const { data, error } = await supabase
      .from('users')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), { status: 500 });
  }
}
```

---

### Task 5.4: Update Navbar with Admin Link
**File:** `components/shared/Navbar.js`

**Changes:**
Add admin dashboard link to dropdown menu (only visible for admin role)

**Implementation:**
```javascript
// Add state for user role
const [userRole, setUserRole] = useState(null);

// In useEffect, after fetching user, fetch role
useEffect(() => {
  const getUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        setUserRole(data?.role || null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };
  getUser();
}, []);

// In desktop dropdown (around line 136-162), add:
{userRole === 'admin' && (
  <>
    <Link
      href="/dashboard/admin"
      className="block px-4 py-2 hover:bg-gray-100 transition"
    >
      Admin Dashboard
    </Link>
    <hr className="my-2" />
  </>
)}
```

---

## VALIDATION CHECKLIST

### Phase 1: Navigation
- [ ] Marketplace link appears in navbar (logged out)
- [ ] Marketplace link appears in navbar (logged in)
- [ ] Marketplace link works on mobile
- [ ] Marketplace link works on desktop
- [ ] Disputes link appears in navbar (logged in)
- [ ] Disputes link works on mobile
- [ ] Disputes link works on desktop

### Phase 2: Transaction Pre-fill
- [ ] Click "Buy Now" on listing
- [ ] Transaction form is pre-filled
- [ ] Can modify pre-filled values
- [ ] localStorage is cleared after pre-fill
- [ ] Works without pre-fill data

### Phase 3: Dispute Creation
- [ ] "Raise Dispute" button appears for buyer (escrow status)
- [ ] "Raise Dispute" button appears for seller (escrow status)
- [ ] Dispute modal opens correctly
- [ ] Form validation works
- [ ] Dispute is created successfully
- [ ] Transaction status updates to disputed
- [ ] Dispute appears in disputes list

### Phase 4: Dispute Resolution
- [ ] "Resolve Dispute" button appears for admin
- [ ] Resolution modal opens correctly
- [ ] Form validation works
- [ ] Dispute is resolved successfully
- [ ] Transaction status updates based on resolution
- [ ] Admin notes are saved

### Phase 5: Admin Dashboard
- [ ] Admin dashboard loads for admin role
- [ ] Non-admin users are redirected
- [ ] Stats display correctly
- [ ] User management tab works
- [ ] Can activate/deactivate users
- [ ] Transaction management tab works
- [ ] Dispute management tab works
- [ ] Listing management tab works
- [ ] Admin link appears in navbar for admin

---

## DEPENDENCIES

### Phase 1
- None (independent)

### Phase 2
- None (independent)

### Phase 3
- Dispute API must exist (✅ already implemented)

### Phase 4
- Dispute Resolution API must exist (✅ already implemented)
- Admin role must exist in database

### Phase 5
- Users table with role field
- Transactions table
- Disputes table
- Listings table
- Admin API routes (to be created)

---

## ERROR PREVENTION

### Common Issues & Solutions

1. **localStorage pre-fill not working**
   - Ensure localStorage key matches between pages
   - Clear localStorage after use to prevent stale data
   - Handle JSON parsing errors

2. **Dispute button not appearing**
   - Verify transaction status is 'escrow'
   - Verify user is buyer or seller
   - Check user role in database

3. **Admin dashboard access denied**
   - Verify user role is 'admin' in database
   - Check RLS policies on users table
   - Ensure service role key is used for admin operations

4. **Admin API permission errors**
   - Use SUPABASE_SERVICE_ROLE_KEY for admin operations
   - Verify RLS policies allow admin updates
   - Check role verification logic

---

## TESTING STRATEGY

### Unit Testing
- Test localStorage pre-fill logic
- Test dispute creation form validation
- Test resolution form validation
- Test admin role verification

### Integration Testing
- Test full dispute flow (create → upload evidence → resolve)
- Test full transaction flow with pre-fill
- Test admin user management
- Test navigation across all roles

### Edge Cases
- Test with no pre-fill data
- Test dispute creation on non-escrow transactions
- Test admin operations on non-existent users
- Test navigation when logged out

---

## SUCCESS CRITERIA

### Phase 1 Complete
- Marketplace and Disputes links visible in navbar
- Links work on mobile and desktop
- Links only show when appropriate

### Phase 2 Complete
- "Buy Now" pre-fills transaction form
- localStorage is managed correctly
- Form works with and without pre-fill

### Phase 3 Complete
- Users can raise disputes from transaction detail
- Dispute creation works for both buyer and seller
- Dispute appears in disputes list
- Transaction status updates

### Phase 4 Complete
- Admins can resolve disputes from dispute detail
- Resolution form validates correctly
- Transaction status updates based on resolution

### Phase 5 Complete
- Admin dashboard loads for admin users
- All tabs work correctly
- User management works
- Stats display accurately
- Admin link appears in navbar

---

## ROLLBACK PLAN

If any phase fails:
1. Revert the specific file changes
2. Remove database changes (if any)
3. Document the issue
4. Proceed with next phase (independent phases)

---

## ESTIMATED TIME

- Phase 1: 30 minutes
- Phase 2: 20 minutes
- Phase 3: 45 minutes
- Phase 4: 30 minutes
- Phase 5: 2-3 hours

**Total Estimated Time:** 4-5 hours
