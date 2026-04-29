# Safe Hands Escrow - Functionality Testing Guide

## Pre-Testing Checklist

Before running tests, ensure:
- [ ] All dependencies installed (`npm install` or `pnpm install`)
- [ ] Database migrations run successfully
- [ ] Supabase credentials set in environment variables
- [ ] Dev server running (`npm run dev`)
- [ ] No console errors on initial page load

---

## Test Suite 1: Authentication & Navigation

### Test 1.1: Login and Dashboard Access
**Steps:**
1. Go to `/auth/login`
2. Enter valid credentials (buyer account)
3. Should redirect to `/dashboard/buyer` without errors
4. Open browser DevTools → Console
5. Verify NO "Lock was released" errors appear

**Expected:** ✅ Dashboard loads, user name visible in TopNav, no auth errors

---

### Test 1.2: Role-Based Routing
**Steps:**
1. Login as seller account
2. Dashboard should route to `/dashboard/seller`
3. Check TopNav shows seller menu items

**Expected:** ✅ Correct dashboard loads based on role

---

## Test Suite 2: Marketplace Functionality

### Test 2.1: Initial Load & Listing Display
**Steps:**
1. Go to `/marketplace`
2. Wait for "Loading listings..." spinner to disappear
3. Check that listings appear in grid (4 columns on desktop)
4. Hover over a listing → should show scale effect
5. Click a listing → should go to detail page

**Expected:** ✅ Listings display, no errors in console

---

### Test 2.2: Pagination
**Steps:**
1. On marketplace, scroll to bottom
2. Check pagination buttons exist
3. Verify page number shows (e.g., "1 2 3 4 5")
4. Click page 2 → should load new listings
5. Click "Next" button → page should increment
6. Click "Previous" → page should decrement
7. Verify "Previous" button disabled on page 1

**Expected:** ✅ Pagination works, correct listings per page shown

---

### Test 2.3: Filtering
**Steps:**
1. Select a category from dropdown
2. Verify listings update (should filter by category)
3. Enter min price (e.g., "1000")
4. Verify only listings >= 1000 show
5. Enter max price (e.g., "50000")
6. Verify only listings 1000-50000 show
7. Click "Clear Filters" → should reset everything
8. Verify all listings show again

**Expected:** ✅ All filters work, UI reflects changes immediately

---

### Test 2.4: Search
**Steps:**
1. Type in search box (e.g., "iPhone")
2. Press "Search" button
3. Verify listings with "iPhone" in title/description show
4. Try search with no results (e.g., "xyz123")
5. Should show "No listings found" message
6. Verify error state does NOT show (no red box)

**Expected:** ✅ Search works, proper empty state shown

---

### Test 2.5: Error Handling
**Steps:**
1. Open DevTools Network tab
2. Click on Marketplace to reload
3. Right-click on `/api/listings` request → "Throttle" to offline
4. Reload marketplace
5. Should show red error box with "Failed to load listings"
6. Click "Retry" button
7. Turn throttling off
8. Should now load successfully

**Expected:** ✅ Error message shown, retry works

---

## Test Suite 3: Seller Dashboard

### Test 3.1: Seller Login & Dashboard
**Steps:**
1. Login as seller account
2. Should route to `/dashboard/seller`
3. Check header says "Welcome Back, Seller"
4. Wait for loading spinner to finish

**Expected:** ✅ Dashboard loads without errors

---

### Test 3.2: Transactions Display
**Steps:**
1. On seller dashboard, check "Transactions" section
2. Should show table with seller's transactions
3. If no transactions exist, might show empty state
4. Check columns: Dispute ID, Amount, Status, Filed, Action

**Expected:** ✅ Transactions visible (even if empty)

---

### Test 3.3: Listings Display
**Steps:**
1. On seller dashboard, check "Listings" tab (if exists)
2. Should show seller's active listings
3. Each listing shows: title, price, status
4. Can click to edit/delete (if implemented)

**Expected:** ✅ Listings visible and editable

---

### Test 3.4: Transaction Filtering
**Steps:**
1. On seller dashboard, find filter buttons
2. Click "all" → shows all transactions
3. Click "escrow" → shows only escrow status
4. Click "released" → shows only released
5. Stats should update based on filter

**Expected:** ✅ Filtering works, counts accurate

---

## Test Suite 4: Buyer Dashboard

### Test 4.1: Buyer Login & Dashboard
**Steps:**
1. Login as buyer account
2. Should route to `/dashboard/buyer`
3. Check header says "My Transactions" or similar
4. Wait for loading spinner to finish

**Expected:** ✅ Dashboard loads without errors

---

### Test 4.2: Transactions & Seller Info
**Steps:**
1. In buyer dashboard, check transactions table
2. For each transaction, verify seller name visible
3. Verify seller email visible (if shown)
4. Click on seller name → should show seller profile

**Expected:** ✅ Seller data correctly joined and displayed

---

### Test 4.3: Dispute Detection
**Steps:**
1. In buyer dashboard, check stats box
2. Verify "disputed" count matches actual disputes
3. In transaction table, check for dispute indicator
4. If transaction has dispute, should show badge

**Expected:** ✅ Disputes counted and displayed correctly

---

### Test 4.4: Stats Calculation
**Steps:**
1. On buyer dashboard, check stats cards
2. "Total" count should = all transactions
3. "Active" count should = initiated + escrow + delivered
4. "Completed" count should = released only
5. "Disputed" count should = transactions with disputes

**Expected:** ✅ All stats match actual data

---

## Test Suite 5: API Verification

### Test 5.1: Listings API Response
**Steps:**
1. Open DevTools → Network tab
2. Go to marketplace
3. Find `/api/listings` request
4. Click it, go to "Response" tab
5. Verify JSON has structure:
```json
{
  "success": true,
  "listings": [
    {
      "id": "...",
      "title": "...",
      "seller": {
        "id": "...",
        "full_name": "...",
        "email": "..."
      },
      "category": {
        "name": "...",
        "slug": "..."
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

**Expected:** ✅ All fields present, no null seller/category

---

### Test 5.2: Transactions API Response
**Steps:**
1. Login as buyer
2. DevTools → Network tab
3. Buyer dashboard should fetch transactions
4. Check request to `/api/transactions` (if called)
5. Verify response includes seller info

**Expected:** ✅ API returns complete transaction data

---

## Common Error Messages & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Lock was released" in console | Auth race condition | ✅ Fixed - using AuthContext |
| Marketplace pagination buttons do nothing | Missing state | ✅ Fixed - page/totalPages state added |
| Seller dashboard says "router not defined" | Missing import | ✅ Fixed - useRouter imported |
| Filter button does nothing in seller dashboard | Missing state | ✅ Fixed - filter state added |
| Seller lists are empty | Listings not fetched | ✅ Fixed - fetch query added |
| Seller info doesn't show in buyer dashboard | Wrong relationship | ✅ Fixed - seller_id relationship |
| Empty state when no listings exist | Error not handled | ✅ Fixed - error UI added |

---

## Final Verification Checklist

After running all tests above, verify:

- [ ] No red error boxes appear unexpectedly
- [ ] No "undefined" or "null" values in UI where data should be
- [ ] All list pages show proper empty states (not crashes)
- [ ] All buttons trigger expected actions
- [ ] All text/numbers calculate correctly
- [ ] Network requests return complete JSON
- [ ] No console warnings about missing keys in lists
- [ ] Responsive design works (check mobile view)
- [ ] Loading spinners appear before data loads
- [ ] Error messages are user-friendly

---

## If Issues Found During Testing

1. **Check console for errors** - DevTools → Console tab
2. **Check network for 500 errors** - DevTools → Network tab, filter by XHR
3. **Check database** - Supabase dashboard, verify data exists
4. **Check environment variables** - Verify .env.local has all keys
5. **Check browser cache** - Clear cache and reload
6. **Check server logs** - Look for errors in next dev output

---

## Reporting Issues

When reporting a bug, include:
- [ ] Steps to reproduce
- [ ] What you expected to see
- [ ] What actually happened
- [ ] Console error message (if any)
- [ ] Network tab error (if API related)
- [ ] Browser and OS used

