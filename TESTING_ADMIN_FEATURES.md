# Admin Features - Complete Testing Guide

## Pre-Testing Setup

### 1. Prepare Test Data
```sql
-- Create test admin (if not exists)
INSERT INTO users (id, email, full_name, role, is_active)
VALUES ('test-admin-id', 'admin@test.com', 'Test Admin', 'admin', true)
ON CONFLICT DO NOTHING;

-- Create test users for management
INSERT INTO users (email, full_name, role, is_active)
VALUES 
  ('testuser1@test.com', 'Test User 1', 'buyer', true),
  ('testuser2@test.com', 'Test User 2', 'seller', true),
  ('testuser3@test.com', 'Test User 3', 'buyer_seller', false);
```

### 2. Login as Admin
- Use admin account credentials
- Verify you see the admin sidebar menu
- Dashboard should load without errors

---

## Test Suite 1: Admin Dashboard

### Test 1.1: Dashboard Loads
**Steps:**
1. Navigate to `/dashboard/admin`
2. Wait for page to fully load

**Expected Results:**
- ✅ Page loads without errors
- ✅ Sidebar shows admin menu items (Manage Users, Transactions, Disputes, Listings)
- ✅ 6 stat cards display with numbers
- ✅ Each card has a colored icon and "Manage" button
- ✅ Stats show: Total Users, Transactions, Listings, Disputes, Revenue, Pending Disputes

### Test 1.2: Stat Cards Click Navigation
**Steps:**
1. Click "Manage Users" card
2. Browser should navigate to `/dashboard/admin/users`
3. Go back to dashboard
4. Click "Manage Transactions" card
5. Browser should navigate to `/dashboard/admin/transactions`
6. Repeat for Disputes and Listings cards

**Expected Results:**
- ✅ All buttons navigate to correct pages
- ✅ Pages load with appropriate content
- ✅ No console errors

### Test 1.3: Sidebar Links
**Steps:**
1. From admin dashboard, click "Manage Users" in sidebar
2. Verify navigation works
3. Click "Manage Transactions" in sidebar
4. Verify navigation works
5. Click "Manage Disputes" in sidebar
6. Click "Moderate Listings" in sidebar

**Expected Results:**
- ✅ All sidebar links navigate to correct pages
- ✅ Active page is highlighted in sidebar

---

## Test Suite 2: Manage Users Page

### Test 2.1: Page Load & Data Display
**Steps:**
1. Navigate to `/dashboard/admin/users`
2. Wait for data to load

**Expected Results:**
- ✅ Page loads with title "Manage Users"
- ✅ Loading spinner appears then disappears
- ✅ User table displays with columns: Name, Email, Role, Status, Joined, Actions
- ✅ At least 3 users display in table
- ✅ Stats show "Total", "Active", "Inactive" counts

### Test 2.2: Search Functionality
**Steps:**
1. In search box, type "Test User 1"
2. Table should filter to matching users
3. Clear search box
4. Type email "testuser@test.com"
5. Table should show matching results

**Expected Results:**
- ✅ Search is case-insensitive
- ✅ Table updates in real-time as you type
- ✅ Partial matches work (e.g., "Test" finds all test users)
- ✅ Clearing search shows all users again

### Test 2.3: Filter by Role
**Steps:**
1. Click Role dropdown
2. Select "Seller"
3. Table should show only sellers
4. Click Role dropdown again
5. Select "Admin"
6. Table should show only admins

**Expected Results:**
- ✅ Dropdown updates table instantly
- ✅ Stats update to match filtered data
- ✅ "All Roles" option shows all users

### Test 2.4: Filter by Status
**Steps:**
1. Click Status dropdown
2. Select "Active"
3. Table should show only active users
4. Change to "Inactive"
5. Table should show only inactive users

**Expected Results:**
- ✅ Filters work correctly
- ✅ Stats update with each filter change
- ✅ Can combine Role and Status filters

### Test 2.5: Deactivate User
**Steps:**
1. Find an active user in table
2. Click "Deactivate" button
3. Modal appears asking for confirmation
4. Click "Confirm" button

**Expected Results:**
- ✅ Modal appears with user name
- ✅ "Confirm" button is enabled
- ✅ User status changes from "Active" to "Inactive"
- ✅ Success message appears
- ✅ Active count in stats decreases by 1
- ✅ Inactive count increases by 1
- ✅ Modal closes automatically after success

### Test 2.6: Activate User
**Steps:**
1. Filter to show "Inactive" users
2. Find inactive user
3. Click "Activate" button
4. Confirm in modal

**Expected Results:**
- ✅ User status changes to "Active"
- ✅ Stats update accordingly
- ✅ Success message shows

### Test 2.7: Delete User (DESTRUCTIVE)
**Steps:**
1. Click "Delete" on any user
2. Modal shows warning about permanent deletion
3. Click "Delete" button

**Expected Results:**
- ✅ Warning modal appears
- ✅ User is removed from table
- ✅ Success message appears
- ✅ Total user count decreases
- ✅ User cannot be recovered (verify in database)

### Test 2.8: Clear Filters
**Steps:**
1. Apply multiple filters (search, role, status)
2. Click "Clear Filters" button

**Expected Results:**
- ✅ All filters reset
- ✅ Search box becomes empty
- ✅ Dropdowns reset to "All"
- ✅ Full user list displays again

---

## Test Suite 3: Manage Disputes Page

### Test 3.1: Page Load
**Steps:**
1. Navigate to `/dashboard/admin/disputes`
2. Wait for disputes to load

**Expected Results:**
- ✅ Page loads with title "Manage Disputes"
- ✅ Disputes display (or "No disputes found" message)
- ✅ Status filter buttons visible (All, Open, In Review, Awaiting Response, Resolved, Closed)
- ✅ Stats show dispute distribution

### Test 3.2: Filter by Status
**Steps:**
1. Click "Open" status button
2. Disputes should filter to open only
3. Click "Resolved" button
4. Show only resolved disputes
5. Click "All" to reset

**Expected Results:**
- ✅ Button highlights when selected
- ✅ Dispute list updates correctly
- ✅ Stats show correct counts for each status

### Test 3.3: Open Dispute Details (if disputes exist)
**Steps:**
1. Find an "Open" dispute
2. Click "Review" button
3. Modal should appear with dispute details

**Expected Results:**
- ✅ Modal shows dispute ID
- ✅ Shows reason for dispute
- ✅ Shows transaction amount
- ✅ Shows buyer and seller names/emails
- ✅ Shows current status badge

### Test 3.4: Resolve Dispute - Buyer Wins
**Steps:**
1. Open an open dispute
2. Select "Buyer Wins" option
3. Type admin notes explaining decision
4. Click "Resolve Dispute"

**Expected Results:**
- ✅ Modal validates that decision is selected
- ✅ Success message appears
- ✅ Dispute status changes to "resolved"
- ✅ Modal closes
- ✅ Dispute shows "Resolved" badge with decision visible

### Test 3.5: Resolve Dispute - Seller Wins
**Steps:**
1. Open a different open dispute
2. Select "Seller Wins"
3. Add notes
4. Resolve

**Expected Results:**
- ✅ Same process as Buyer Wins
- ✅ Decision is recorded
- ✅ Transaction is marked for seller payment

### Test 3.6: Resolve Dispute - Split 50/50
**Steps:**
1. Open another dispute
2. Select "Split"
3. Confirm resolution

**Expected Results:**
- ✅ Dispute resolved with split decision
- ✅ Both parties get 50% of transaction amount

### Test 3.7: Cancel Modal
**Steps:**
1. Open dispute modal
2. Click "Cancel" button without making changes

**Expected Results:**
- ✅ Modal closes without saving
- ✅ No changes to dispute
- ✅ Page returns to list view

---

## Test Suite 4: Manage Transactions Page

### Test 4.1: Page Load & Display
**Steps:**
1. Navigate to `/dashboard/admin/transactions`
2. Wait for data to load

**Expected Results:**
- ✅ Page shows transaction table
- ✅ Columns: ID, Item, Buyer, Seller, Amount, Status, Action
- ✅ At least 5 sample transactions display
- ✅ Search and filter controls visible
- ✅ Stats show transaction distribution

### Test 4.2: Search Transactions
**Steps:**
1. Search by transaction ID (first 8 chars)
2. Search by buyer name
3. Search by seller name
4. Search by item description

**Expected Results:**
- ✅ Each search filters results correctly
- ✅ All four search types work
- ✅ Case-insensitive matching

### Test 4.3: Filter by Status
**Steps:**
1. Click Status dropdown
2. Select "Escrow"
3. Table shows only escrow transactions
4. Select "Released"
5. Select "Disputed"

**Expected Results:**
- ✅ Each status option filters correctly
- ✅ Stats update with filtered data
- ✅ "All Status" shows everything

### Test 4.4: Override Transaction Status
**Steps:**
1. Find any transaction
2. Click "Override" button
3. Select new status from dropdown
4. Add override notes
5. Click "Update Status"

**Expected Results:**
- ✅ Modal shows transaction details
- ✅ Status dropdown is required
- ✅ Notes field allows text input
- ✅ Update button is disabled until status selected
- ✅ Transaction status changes in table
- ✅ Success message appears
- ✅ Stats update with new status count

### Test 4.5: Override to Released
**Steps:**
1. Find escrow transaction
2. Override to "Released" status
3. Add note like "Manual approval - delivered"
4. Confirm

**Expected Results:**
- ✅ Transaction moves from escrow to released
- ✅ Seller should receive funds (verify in payment log)
- ✅ Stats show change in released count

### Test 4.6: Override to Cancelled
**Steps:**
1. Find active transaction
2. Override to "Cancelled"
3. Add note
4. Confirm

**Expected Results:**
- ✅ Transaction marked cancelled
- ✅ Funds frozen or refunded per business logic
- ✅ Modal auto-closes on success

---

## Test Suite 5: Moderate Listings Page

### Test 5.1: Page Load
**Steps:**
1. Navigate to `/dashboard/admin/listings`
2. Wait for listings to load

**Expected Results:**
- ✅ Page shows grid of listing cards
- ✅ Each card shows preview image, title, price, status
- ✅ Search box and filters visible
- ✅ Status filter works (Active, Suspended, Sold)
- ✅ Category filter works

### Test 5.2: Search Listings
**Steps:**
1. Search by listing title
2. Search by seller name

**Expected Results:**
- ✅ Results filter in real-time
- ✅ Case-insensitive matching
- ✅ Both search types work

### Test 5.3: Filter by Status
**Steps:**
1. Click Status dropdown
2. Select "Active"
3. Change to "Suspended"
4. Change to "Sold"

**Expected Results:**
- ✅ Grid updates with matching listings
- ✅ Stats update for each filter
- ✅ "All Status" shows everything

### Test 5.4: Filter by Category
**Steps:**
1. Click Category dropdown
2. Select a category
3. Grid should show only that category

**Expected Results:**
- ✅ Category filter works
- ✅ Can combine with status filter
- ✅ Stats reflect combined filter

### Test 5.5: Suspend Listing
**Steps:**
1. Find an active listing card
2. Click "Suspend" button
3. Modal appears
4. Type suspension reason (e.g., "Prohibited item")
5. Click "Suspend Listing"

**Expected Results:**
- ✅ Modal shows listing details
- ✅ Suspension reason field is required
- ✅ Reason field validates before submit
- ✅ Listing status changes to "Suspended"
- ✅ Card updates in grid
- ✅ Success message shows
- ✅ Modal closes

### Test 5.6: Approve Listing
**Steps:**
1. Filter to "Suspended" listings
2. Find suspended listing
3. Click "Approve" button
4. Confirm

**Expected Results:**
- ✅ Listing status changes to "Active"
- ✅ Card updates immediately
- ✅ Stats update (suspended count -)
- ✅ Success message shows

### Test 5.7: Delete Listing (DESTRUCTIVE)
**Steps:**
1. Click "Delete" on any listing
2. Modal shows warning
3. Click "Delete Listing" to confirm

**Expected Results:**
- ✅ Warning modal clearly shows this is permanent
- ✅ Listing removed from grid immediately
- ✅ Success message appears
- ✅ Listing cannot be recovered

### Test 5.8: Clear Filters
**Steps:**
1. Apply search, status, and category filters
2. Click "Clear Filters"

**Expected Results:**
- ✅ All filters reset
- ✅ Grid shows all listings
- ✅ Stats show full counts

---

## Test Suite 6: Security & Authorization

### Test 6.1: Non-Admin Access
**Steps:**
1. Logout from admin account
2. Login as buyer account
3. Try to navigate to `/dashboard/admin/users`

**Expected Results:**
- ✅ Access denied OR redirected to user dashboard
- ✅ Cannot see admin pages
- ✅ Cannot access admin API endpoints

### Test 6.2: API Endpoint Protection
**Steps:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Call any admin API endpoint manually
4. Use non-admin token

**Expected Results:**
- ✅ API returns 403 Forbidden
- ✅ Endpoint validates admin role
- ✅ No data leakage in error message

### Test 6.3: Session Expiry
**Steps:**
1. Login as admin
2. Go to `/dashboard/admin/users`
3. Wait for session to expire (or manually expire)
4. Try to perform action

**Expected Results:**
- ✅ Action fails with auth error
- ✅ Redirect to login page
- ✅ Session properly terminated

---

## Test Suite 7: Error Handling

### Test 7.1: Network Error Handling
**Steps:**
1. Go to admin page
2. Disconnect internet
3. Try to perform action (e.g., delete user)

**Expected Results:**
- ✅ Error message appears
- ✅ User told "Failed to delete user" or similar
- ✅ Page doesn't crash
- ✅ User can retry when connection restored

### Test 7.2: Server Error Handling
**Steps:**
1. Admin pages should gracefully handle 500 errors
2. Check console for `[v0]` debug logs

**Expected Results:**
- ✅ User sees friendly error message
- ✅ Console has helpful debugging info with `[v0]` prefix
- ✅ Page remains functional
- ✅ Can retry operation

### Test 7.3: Validation Error Handling
**Steps:**
1. Try to submit suspension without reason
2. Try to resolve dispute without selecting decision

**Expected Results:**
- ✅ Form fields validated
- ✅ Submit button disabled if required fields empty
- ✅ Error message explains what's required
- ✅ Cannot proceed without valid input

---

## Test Suite 8: Performance & UX

### Test 8.1: Loading States
**Steps:**
1. Go to any admin page
2. Observe loading spinner during initial load
3. Click action button (delete, suspend, etc.)
4. Observe button show "Processing..." or similar

**Expected Results:**
- ✅ Loading states clearly visible
- ✅ Users know something is happening
- ✅ Buttons disabled during API calls
- ✅ User can't accidentally double-submit

### Test 8.2: Success/Error Feedback
**Steps:**
1. Perform successful action (approve, resolve, etc.)
2. Check for success message
3. Perform failed action (network off, bad data)
4. Check for error message

**Expected Results:**
- ✅ Success message appears (green background)
- ✅ Error message appears (red background)
- ✅ Messages auto-dismiss after 3 seconds
- ✅ Toast notifications not overlapping content

### Test 8.3: Responsive Design
**Steps:**
1. Open admin page on desktop
2. Resize to tablet width
3. Resize to mobile width

**Expected Results:**
- ✅ Tables convert to card layout on mobile
- ✅ Filters stack vertically on small screens
- ✅ Buttons remain clickable on all sizes
- ✅ Text readable on all sizes

### Test 8.4: Empty States
**Steps:**
1. Filter to status with no results
2. Search for non-existent user
3. Create scenario with no data

**Expected Results:**
- ✅ Empty state message displays
- ✅ Icon and text explaining no results
- ✅ Suggestion to adjust filters
- ✅ Not confusing - users understand why nothing shows

---

## Regression Testing

After changes, run these quick checks:

### Quick Admin Checks (5 min)
- [ ] Dashboard loads
- [ ] Manage Users link works
- [ ] Can search users
- [ ] Can deactivate user
- [ ] Can cancel modal without saving

### Full Admin Suite (30 min)
Run through all 8 test suites at least once before release

### Nightly Admin Tests (Automated)
Should run automated tests for:
- All pages load without errors
- All navigation works
- All filters return valid results
- All CRUD operations complete successfully

---

## Known Limitations & TODOs

### Current Limitations:
- [ ] Bulk actions not yet implemented (delete multiple users)
- [ ] Admin approval workflow for listings not implemented
- [ ] Email notifications to affected users not implemented
- [ ] Audit log page not implemented
- [ ] Advanced search/filtering options limited

### Future Enhancements:
- [ ] Add keyboard shortcuts (? for help)
- [ ] Add export to CSV for admin reports
- [ ] Add real-time notifications for new disputes
- [ ] Add automated rules (e.g., auto-suspend after 3 disputes)
- [ ] Add admin team management and role hierarchy

---

## Bug Report Template

If you find bugs, please report with:

```
**Title:** [Brief description]

**Severity:** [Critical/High/Medium/Low]

**Page:** [e.g., /dashboard/admin/users]

**Steps to Reproduce:**
1. ...
2. ...
3. ...

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots:** [If applicable]

**Console Errors:** [From F12 DevTools]

**Browser:** [Chrome/Firefox/Safari + version]

**OS:** [Windows/Mac/Linux]
```

---

## Sign-Off Checklist

Admin system is PRODUCTION READY when:
- [ ] All 8 test suites pass 100%
- [ ] No console errors
- [ ] All API endpoints secured
- [ ] Performance acceptable (< 2s page loads)
- [ ] Mobile responsive tested
- [ ] Security audit passed
- [ ] Database migrations applied
- [ ] Backup strategy in place
- [ ] Documentation complete
- [ ] Team trained

---

**Last Updated:** 2026-04-29  
**Version:** 1.0  
**Status:** READY FOR TESTING
