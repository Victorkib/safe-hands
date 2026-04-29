# Comprehensive System Test Plan
## Safe Hands Escrow - Current System State Analysis

**Analysis Date:** Based on code examination
**Purpose:** Test the system as it currently exists, identify missing integrations, incomplete features, and non-working components

---

## SYSTEM STATE SUMMARY

### ✅ FULLY IMPLEMENTED & WORKING

#### 1. Authentication System
- Sign up (buyer, seller, buyer_seller roles)
- Login
- Logout
- Profile page (edit name, phone, bio, profile picture)
- Role-based redirects from homepage

#### 2. Buyer Dashboard (`/dashboard/buyer`)
- View all transactions (as buyer)
- Filter transactions by status
- Stats: Total, Active, Completed, Disputes
- "Create New Transaction" button → redirects to `/dashboard/transactions/create`

#### 3. Seller Dashboard (`/dashboard/seller`)
- View all transactions (as seller)
- Filter transactions by status
- Stats: Total Sales, Earnings, Pending, Active
- **Action Buttons:**
  - "Create Listing" → redirects to `/dashboard/listings/create`
  - "Manage Listings" → redirects to `/dashboard/listings`
  - "Browse Marketplace" → redirects to `/marketplace`

#### 4. Transaction Detail Page (`/dashboard/transactions/[id]`)
- View transaction details (amount, description, parties)
- View payment information (method, M-Pesa ref, confirmation time)
- View delivery information (when applicable)
- **Actions:**
  - Buyer: "Pay with M-Pesa" (when status = initiated)
  - Seller: "Mark as Shipped" (when status = escrow)
  - Buyer: "Confirm Delivery" (when status = delivered)

#### 5. Transaction Create Page (`/dashboard/transactions/create`)
- Form fields: Seller email, Amount, Description
- Creates transaction and redirects to detail page
- **ISSUE:** Does NOT pre-fill from listings (localStorage not implemented)

#### 6. Listing System (Phase 9 - FULLY IMPLEMENTED)
- Create listing (`/dashboard/listings/create`) - with image upload
- Manage listings (`/dashboard/listings`) - view, filter, mark sold, delete
- Edit listing (`/dashboard/listings/[id]`) - update details, manage images
- Marketplace browse (`/marketplace`) - search, filters, pagination
- Public listing (`/listings/[id]`) - view details, "Buy Now" button

#### 7. Dispute Pages (READ-ONLY)
- Disputes list (`/dashboard/disputes`) - view all disputes
- Dispute detail (`/dashboard/disputes/[id]`) - view details, upload evidence
- **ISSUE:** No way to CREATE disputes from UI (API exists but no UI)

#### 8. Navigation
- Navbar has: Home, Profile, Buyer Dashboard, Seller Dashboard
- Dashboard layout has auth protection

---

### ❌ MISSING / INCOMPLETE / NOT WORKING

#### 1. DISPUTE CREATION - CRITICAL MISSING
- **Problem:** No UI to raise disputes
- **Location:** Transaction detail page (`/dashboard/transactions/[id]`)
- **Current State:** Dispute API exists (`POST /api/disputes`) but no button/form to use it
- **Impact:** Buyers and sellers cannot raise disputes when issues occur
- **Required Fix:** Add "Raise Dispute" button on transaction detail page with form

#### 2. MARKETPLACE NAVIGATION - MISSING
- **Problem:** No link to marketplace in navbar
- **Location:** Navbar (`components/shared/Navbar.js`)
- **Current State:** Marketplace exists at `/marketplace` but no way to access it from main UI
- **Impact:** Buyers cannot browse marketplace unless they know the URL or go through seller dashboard
- **Required Fix:** Add "Marketplace" link to navbar

#### 3. DISPUTES NAVIGATION - MISSING
- **Problem:** No link to disputes in navbar or dashboards
- **Location:** Navbar, Buyer Dashboard, Seller Dashboard
- **Current State:** Disputes page exists at `/dashboard/disputes` but no way to access it
- **Impact:** Users cannot view their disputes unless they know the URL
- **Required Fix:** Add "Disputes" link to navbar and/or dashboards

#### 4. ADMIN DASHBOARD - COMPLETELY MISSING
- **Problem:** No admin-specific UI
- **Location:** `/dashboard/admin` does not exist
- **Current State:** Admin role exists in database but no dashboard
- **Impact:** Admins have no UI to:
  - View all transactions
  - Resolve disputes (API exists but no UI)
  - Manage users
  - View platform stats
- **Required Fix:** Create admin dashboard with dispute resolution UI

#### 5. TRANSACTION CREATION PRE-FILL - INCOMPLETE
- **Problem:** "Buy Now" button on listings doesn't pre-fill transaction form
- **Location:** Public listing page (`/listings/[id]`) and Transaction create page
- **Current State:** Public listing page stores data in localStorage but create page doesn't read it
- **Impact:** Buyers clicking "Buy Now" must manually re-enter seller email, amount, description
- **Required Fix:** Implement localStorage pre-fill in transaction create page

#### 6. DISPUTE RESOLUTION UI - MISSING
- **Problem:** No UI for admins to resolve disputes
- **Location:** Dispute detail page (`/dashboard/disputes/[id]`)
- **Current State:** Dispute resolution API exists (`POST /api/disputes/[id]/resolve`) but no UI
- **Impact:** Admins cannot resolve disputes through the UI
- **Required Fix:** Add resolution form on dispute detail page for admins

---

## TEST PLAN BY ROLE

### ROLE 1: BUYER TEST SCENARIOS

#### Pre-requisites
- Sign up as "buyer" role
- Login with buyer account

#### Test 1: View Buyer Dashboard
1. Navigate to `/dashboard/buyer`
2. **Verify:** Page loads and shows buyer dashboard
3. **Verify:** Stats display correctly (Total, Active, Completed, Disputes)
4. **Verify:** "Create New Transaction" button is visible
5. **Verify:** Transaction list shows (if any exist)

#### Test 2: Create Transaction (Manual)
1. Click "Create New Transaction" from buyer dashboard
2. **Verify:** Redirects to `/dashboard/transactions/create`
3. Enter seller email, amount, description
4. Submit form
5. **Verify:** Redirects to transaction detail page
6. **Verify:** Transaction shows status "initiated"

#### Test 3: Create Transaction from Marketplace
1. Navigate to `/marketplace` (must type URL manually - **ISSUE**)
2. Browse listings
3. Click on a listing
4. Click "Buy Now" button
5. **Verify:** Redirects to `/dashboard/transactions/create`
6. **ISSUE:** Form fields are NOT pre-filled with listing data
7. Manually enter seller email, amount, description
8. Submit form
9. **Verify:** Transaction is created

#### Test 4: Pay for Transaction
1. Go to transaction detail page (status = "initiated")
2. **Verify:** "Pay with M-Pesa" button is visible
3. Click "Pay with M-Pesa"
4. **Verify:** Payment modal appears
5. Click "Confirm"
6. **Verify:** M-Pesa STK Push is initiated
7. **Verify:** Transaction status changes to "escrow" after payment

#### Test 5: Confirm Delivery
1. Go to transaction detail page (status = "delivered")
2. **Verify:** "Confirm Delivery" button is visible
3. Click "Confirm Delivery"
4. **Verify:** Confirmation modal appears
5. Add optional comment
6. Click "Confirm Delivery"
7. **Verify:** Transaction status changes to "released"
8. **Verify:** Success message appears

#### Test 6: View Disputes
1. Navigate to `/dashboard/disputes` (must type URL manually - **ISSUE**)
2. **Verify:** Disputes list loads
3. **ISSUE:** Cannot create disputes from UI

#### Test 7: Navigate to Profile
1. Click on user avatar in navbar
2. **Verify:** Dropdown menu appears
3. Click "Profile"
4. **Verify:** Redirects to `/dashboard/profile`
5. **Verify:** Profile information displays correctly
6. Edit profile and save
7. **Verify:** Changes persist

---

### ROLE 2: SELLER TEST SCENARIOS

#### Pre-requisites
- Sign up as "seller" role
- Login with seller account

#### Test 1: View Seller Dashboard
1. Navigate to `/dashboard/seller`
2. **Verify:** Page loads and shows seller dashboard
3. **Verify:** Stats display correctly (Total Sales, Earnings, Pending, Active)
4. **Verify:** Three action buttons visible:
   - "Create Listing"
   - "Manage Listings"
   - "Browse Marketplace"

#### Test 2: Create Listing
1. Click "Create Listing" from seller dashboard
2. **Verify:** Redirects to `/dashboard/listings/create`
3. Enter title, description, price, category, condition, location
4. Upload up to 5 images
5. Submit form
6. **Verify:** Redirects to `/dashboard/listings`
7. **Verify:** New listing appears in list

#### Test 3: Manage Listings
1. Click "Manage Listings" from seller dashboard
2. **Verify:** Redirects to `/dashboard/listings`
3. **Verify:** Stats display (Total, Active, Sold, Views)
4. **Verify:** Filter buttons work (all, active, sold, inactive)
5. Test actions:
   - Click "View" → opens public listing in new tab
   - Click "Edit" → redirects to edit page
   - Click "Mark Sold" → changes status to sold
   - Click "Delete" → soft deletes listing

#### Test 4: Edit Listing
1. From listings page, click "Edit" on a listing
2. **Verify:** Redirects to `/dashboard/listings/[id]`
3. **Verify:** Form is pre-filled with listing data
4. Modify fields
5. Add/remove images
6. Submit form
7. **Verify:** Changes persist
8. **Verify:** Redirects back to listings page

#### Test 5: Browse Marketplace
1. Click "Browse Marketplace" from seller dashboard
2. **Verify:** Redirects to `/marketplace`
3. **Verify:** Listings load
4. Test filters:
   - Category filter
   - Price range filter
   - Search
   - Sort (newest, price low, price high)
5. **Verify:** Pagination works

#### Test 6: Mark Transaction as Shipped
1. Go to transaction detail page (status = "escrow")
2. **Verify:** "Mark as Shipped" button is visible (as seller)
3. Click "Mark as Shipped"
4. **Verify:** Shipping modal appears
5. Enter tracking number (optional)
6. Click "Confirm Shipment"
7. **Verify:** Transaction status changes to "delivered"

#### Test 7: View Seller Transactions
1. From seller dashboard
2. **Verify:** Transaction list shows seller's transactions
3. Test filters (all, initiated, escrow, delivered, released, disputed)
4. Click "View" on a transaction
5. **Verify:** Redirects to transaction detail page

---

### ROLE 3: ADMIN TEST SCENARIOS

#### Pre-requisites
- Sign up as "admin" role (may need manual database update)
- Login with admin account

#### Test 1: Navigate to Admin Dashboard
1. **ISSUE:** No admin dashboard exists
2. Try navigating to `/dashboard/admin`
3. **Expected:** 404 error or redirect

#### Test 2: Resolve Dispute
1. Navigate to `/dashboard/disputes/[id]` (must type URL)
2. **ISSUE:** No resolution UI for admins
3. **Expected:** Cannot resolve disputes through UI
4. **Workaround:** Must use API directly or database

#### Test 3: View All Users
1. **ISSUE:** No user management UI
2. **Expected:** Cannot view or manage users

---

### ROLE 4: BUYER_SELLER TEST SCENARIOS

#### Pre-requisites
- Sign up as "buyer_seller" role
- Login with account

#### Test 1: Dashboard Redirect
1. After login
2. **Verify:** Redirects to `/dashboard/buyer` (based on homepage logic)
3. **Verify:** Can access both buyer and seller dashboards via navbar

#### Test 2: Full Transaction Flow as Seller
1. Create listing
2. Wait for buyer to purchase
3. Mark as shipped
4. Receive funds

#### Test 3: Full Transaction Flow as Buyer
1. Browse marketplace
2. Click "Buy Now"
3. Create transaction
4. Pay via M-Pesa
5. Confirm delivery

---

## CRITICAL ISSUES SUMMARY

### Priority 1 - BLOCKING CORE FUNCTIONALITY
1. **No Dispute Creation UI** - Users cannot raise disputes when issues occur
2. **No Marketplace Link in Navbar** - Buyers cannot browse marketplace easily
3. **No Disputes Link in Navbar** - Users cannot access their disputes

### Priority 2 - USABILITY ISSUES
4. **No Admin Dashboard** - Admins have no UI to manage platform
5. **Transaction Pre-fill Not Working** - "Buy Now" doesn't auto-fill form
6. **No Dispute Resolution UI** - Admins cannot resolve disputes through UI

---

## NAVIGATION MAP (CURRENT STATE)

```
Homepage (/)
├── Redirects to /dashboard/buyer (buyer role)
├── Redirects to /dashboard/seller (seller role)
├── Redirects to /dashboard/buyer (buyer_seller role)
└── Shows landing page (not logged in)

Navbar (Logged In)
├── Home (/)
├── Profile (/dashboard/profile) ✓
├── Buyer Dashboard (/dashboard/buyer) ✓
├── Seller Dashboard (/dashboard/seller) ✓
├── Marketplace (/marketplace) ✗ MISSING
├── Disputes (/dashboard/disputes) ✗ MISSING
└── Logout

Buyer Dashboard (/dashboard/buyer)
├── Create New Transaction → /dashboard/transactions/create ✓
└── View Transaction → /dashboard/transactions/[id] ✓

Seller Dashboard (/dashboard/seller)
├── Create Listing → /dashboard/listings/create ✓
├── Manage Listings → /dashboard/listings ✓
├── Browse Marketplace → /marketplace ✓
└── View Transaction → /dashboard/transactions/[id] ✓

Transaction Detail (/dashboard/transactions/[id])
├── Pay with M-Pesa (buyer) ✓
├── Mark as Shipped (seller) ✓
├── Confirm Delivery (buyer) ✓
└── Raise Dispute ✗ MISSING

Dispute Detail (/dashboard/disputes/[id])
├── Upload Evidence ✓
└── Resolve Dispute (admin) ✗ MISSING
```

---

## RECOMMENDED FIXES (IN ORDER)

1. **Add "Raise Dispute" button to Transaction Detail page**
   - Location: `/app/dashboard/transactions/[id]/page.js`
   - Add button when status allows dispute
   - Create dispute creation modal/form
   - Link to `/api/disputes` API

2. **Add "Marketplace" link to Navbar**
   - Location: `/components/shared/Navbar.js`
   - Add link in both desktop and mobile menus

3. **Add "Disputes" link to Navbar**
   - Location: `/components/shared/Navbar.js`
   - Add link in both desktop and mobile menus

4. **Implement localStorage pre-fill in Transaction Create page**
   - Location: `/app/dashboard/transactions/create/page.js`
   - Read from localStorage on page load
   - Pre-fill form fields
   - Clear localStorage after use

5. **Create Admin Dashboard**
   - Location: `/app/dashboard/admin/page.js`
   - Show platform stats
   - List all transactions
   - List all disputes with resolution UI

6. **Add Dispute Resolution UI to Dispute Detail page**
   - Location: `/app/dashboard/disputes/[id]/page.js`
   - Add resolution form for admins
   - Link to `/api/disputes/[id]/resolve` API

---

## DATABASE SETUP VERIFICATION

Before testing, ensure:
- [x] Users table exists (with role field)
- [x] Transactions table exists
- [x] Listings table exists
- [x] Categories table exists (with default categories)
- [x] Disputes table exists
- [x] Storage bucket `listing-images` exists and is public
- [x] Storage bucket `dispute-evidence` exists and is public
- [x] RLS policies are in place
- [x] Auto-release function is scheduled (pg_cron)

---

## API ENDPOINTS VERIFICATION

### Working APIs
- [x] POST /api/transactions (create transaction)
- [x] POST /api/transactions/[id]/pay (initiate M-Pesa payment)
- [x] POST /api/mpesa/callback (M-Pesa callback)
- [x] GET /api/transactions/[id]/payment-status (check payment status)
- [x] POST /api/transactions/[id]/ship (mark as shipped)
- [x] POST /api/transactions/[id]/confirm-delivery (confirm delivery)
- [x] POST /api/disputes (create dispute) - **NO UI**
- [x] POST /api/disputes/[id]/upload-evidence (upload evidence)
- [x] POST /api/disputes/[id]/resolve (resolve dispute) - **NO UI**
- [x] GET /api/listings (browse listings)
- [x] POST /api/listings (create listing)
- [x] GET /api/listings/[id] (get listing details)
- [x] PUT /api/listings/[id] (update listing)
- [x] DELETE /api/listings/[id] (delete listing)
- [x] GET /api/user/profile (get profile)
- [x] PUT /api/user/profile (update profile)

---

## TEST EXECUTION CHECKLIST

### Pre-Test Setup
- [ ] Database tables created (run scripts 001, 006)
- [ ] Storage buckets created (listing-images, dispute-evidence)
- [ ] RLS policies applied
- [ ] M-Pesa environment variables configured
- [ ] Auto-release function scheduled (script 005)
- [ ] Test accounts created (buyer, seller, admin)

### Buyer Tests
- [ ] Can login as buyer
- [ ] Can view buyer dashboard
- [ ] Can create transaction manually
- [ ] Can browse marketplace (by typing URL)
- [ ] Can view public listing
- [ ] Can click "Buy Now" (but form not pre-filled)
- [ ] Can pay for transaction
- [ ] Can confirm delivery
- [ ] Can view disputes (by typing URL)
- [ ] Can upload dispute evidence

### Seller Tests
- [ ] Can login as seller
- [ ] Can view seller dashboard
- [ ] Can create listing
- [ ] Can manage listings
- [ ] Can edit listing
- [ ] Can mark listing as sold
- [ ] Can delete listing
- [ ] Can browse marketplace from dashboard
- [ ] Can mark transaction as shipped
- [ ] Can view seller transactions

### Admin Tests
- [ ] Can login as admin
- [ ] **ISSUE:** Cannot access admin dashboard
- [ ] Can view disputes (by typing URL)
- [ ] **ISSUE:** Cannot resolve disputes through UI

---

## CONCLUSION

The system has a solid foundation with most core functionality implemented. However, critical navigation issues (missing navbar links) and missing dispute creation UI significantly impact user experience. The marketplace and listing systems are fully functional, but users cannot easily access them. Admin functionality is completely missing from the UI.

**Immediate Actions Required:**
1. Add dispute creation button to transaction detail
2. Add Marketplace link to navbar
3. Add Disputes link to navbar
4. Implement localStorage pre-fill for "Buy Now"
5. Create admin dashboard with dispute resolution UI
