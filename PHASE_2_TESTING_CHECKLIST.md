# PHASE 2 TESTING CHECKLIST

Complete this checklist to verify all Phase 2 features are working correctly.

## Pre-Testing Setup
- [ ] Run `pnpm dev` and confirm server starts without errors
- [ ] Clear browser cache/cookies
- [ ] Open http://localhost:3000 in a fresh browser window
- [ ] Verify Supabase credentials in `.env.local`

---

## 1. HOMEPAGE TESTING

### Visual Design
- [ ] Homepage loads without errors
- [ ] Logo displays correctly in navbar
- [ ] Hero section is centered and readable
- [ ] Feature cards display in grid (1 col mobile, 3 cols desktop)
- [ ] "How It Works" steps display correctly
- [ ] FAQ section expands/collapses properly
- [ ] Footer displays with all links
- [ ] All colors are correct (blues, whites, grays)

### Navigation Links
- [ ] "Get Started" button → /auth/signup
- [ ] "Learn More" button → scrolls to #features
- [ ] Navbar login link → /auth/login
- [ ] Navbar signup button → /auth/signup
- [ ] Footer links work (even if they go nowhere)

### Responsiveness
- [ ] Page works on mobile (375px width)
- [ ] Page works on tablet (768px width)
- [ ] Page works on desktop (1920px width)
- [ ] No horizontal scrolling
- [ ] Text is readable on all devices
- [ ] Buttons are clickable on mobile

---

## 2. SIGNUP FLOW TESTING

### Page Load
- [ ] Navigate to http://localhost:3000/auth/signup
- [ ] Form loads with all fields visible
- [ ] Form title says "Create Account"
- [ ] Input fields have correct placeholders

### Form Fields
- [ ] Full Name field accepts text
- [ ] Email field accepts email format
- [ ] Phone field accepts various Kenyan formats:
  - [ ] `07 1234 5678`
  - [ ] `07123456789`
  - [ ] `254712345678`
  - [ ] `+254712345678`
- [ ] Role dropdown has 3 options (Buyer, Seller, Both)
- [ ] Password field hides characters with •••
- [ ] Confirm Password field hides characters
- [ ] Password field shows strength indicator:
  - [ ] Red (weak) when < 50 strength
  - [ ] Yellow (fair) when 50-75 strength
  - [ ] Green (strong) when > 75 strength

### Form Validation (Client-Side)
- [ ] Submit empty form → shows "field required" errors
- [ ] Invalid email → shows "valid email required" error
- [ ] Invalid phone → shows "valid Kenyan phone" error
- [ ] Short password (< 8 chars) → shows "at least 8 characters" error
- [ ] Mismatched passwords → shows "passwords do not match" error
- [ ] All validation errors clear on input change

### Successful Signup
- [ ] Fill valid form with:
  - Name: "Test User"
  - Email: "testuser@example.com"
  - Phone: "0712345678"
  - Role: "Buyer"
  - Password: "TestPassword123!"
  - Confirm: "TestPassword123!"
- [ ] Click "Create Account"
- [ ] Loading state shows "Creating Account..."
- [ ] Success message appears: "Account created successfully!"
- [ ] After 2 seconds, redirect to login page
- [ ] Email field is pre-filled with signup email

### Error Handling
- [ ] Try signup with existing email → "already registered" error
- [ ] Try signup with invalid email → validation error
- [ ] Try signup with weak password → validation error
- [ ] Try signup with mismatched passwords → validation error
- [ ] All errors are readable and helpful

### UI/UX
- [ ] Form has nice styling with shadows
- [ ] Inputs focus correctly (blue outline)
- [ ] Button changes color on hover
- [ ] Button is disabled while loading
- [ ] Error messages are red and visible
- [ ] Success message is green and visible
- [ ] Page is centered and responsive

### Database Verification
After successful signup:
- [ ] Check Supabase Auth: User should exist in auth.users
- [ ] Check Database: User profile should exist in `users` table
- [ ] Verify user data:
  - [ ] ID matches auth user ID
  - [ ] Email is correct
  - [ ] Name is correct
  - [ ] Phone is normalized to 254xxxxxxxxx format
  - [ ] Role is correct
  - [ ] kyc_status is "pending"

---

## 3. LOGIN FLOW TESTING

### Page Load
- [ ] Navigate to http://localhost:3000/auth/login
- [ ] Form loads with all fields visible
- [ ] Form title says "Welcome Back"
- [ ] Input fields have correct placeholders

### Form Fields
- [ ] Email field works
- [ ] Password field has show/hide toggle
  - [ ] Click eye icon to show password
  - [ ] Password becomes visible as text
  - [ ] Click again to hide (back to •••)
- [ ] Remember me checkbox exists and toggles

### Form Validation
- [ ] Submit empty form → shows validation errors
- [ ] Invalid email → shows validation error
- [ ] Empty password → shows validation error

### Successful Login
- [ ] Use credentials from signup:
  - Email: "testuser@example.com"
  - Password: "TestPassword123!"
- [ ] Click Login
- [ ] Loading state shows "Logging in..."
- [ ] Success message appears: "Login successful!"
- [ ] After 1.5 seconds, redirects to dashboard
- [ ] **Buyer role** → redirects to `/dashboard/buyer`
- [ ] **Seller role** → redirects to `/dashboard/seller`

### Error Handling
- [ ] Try login with wrong password → "Invalid email or password" error
- [ ] Try login with non-existent email → "Invalid email or password" error
- [ ] Try login with unconfirmed email → "Please confirm your email" error
- [ ] Errors don't prevent further attempts

### UI/UX
- [ ] Show/hide password works smoothly
- [ ] Remember me checkbox toggles
- [ ] Inputs have good focus states
- [ ] Error messages are clear
- [ ] Success message is encouraging

### Pre-Fill from Signup
- [ ] If coming from signup page with ?email=...
- [ ] Email field should be pre-filled
- [ ] Success message should show "Account created successfully!"

---

## 4. BUYER DASHBOARD TESTING

### Page Load & Auth
- [ ] Navigate directly to `/dashboard/buyer` without login
- [ ] Should redirect to `/auth/login`
- [ ] Login with buyer account
- [ ] Should now see buyer dashboard
- [ ] Navbar shows "Welcome, [username]"

### Statistics Cards
- [ ] Total Transactions card shows correct count
- [ ] Active Transactions shows count (should be 0 initially)
- [ ] Completed Transactions shows count (should be 0 initially)
- [ ] Disputes card shows count (should be 0 initially)
- [ ] All numbers are right-aligned and bold

### Action Button
- [ ] "+ Create New Transaction" button is visible
- [ ] Button has blue background
- [ ] Button is clickable (for Phase 3)

### Filter Buttons
- [ ] 6 filter buttons exist: All, Initiated, Escrow, Delivered, Released, Disputed
- [ ] Clicking a filter changes active state (blue background)
- [ ] Filters don't cause errors (no transactions yet is OK)

### Transaction Table
- [ ] Table headers are visible
- [ ] Column headers: ID, Amount, Status, Date, Action
- [ ] Since no transactions exist, table should show "No transactions found"
- [ ] Message is centered and readable

### UI/UX
- [ ] Page title: "Buyer Dashboard"
- [ ] Subtitle: "Manage your purchases and track transactions"
- [ ] Layout is clean and organized
- [ ] Stats cards have consistent styling
- [ ] Responsive design (single column on mobile, multi-column on desktop)

---

## 5. SELLER DASHBOARD TESTING

### Page Load & Auth
- [ ] Login with seller account
- [ ] Navigate to `/dashboard/seller`
- [ ] Dashboard loads without errors
- [ ] Navbar shows correct username

### Statistics Cards
- [ ] Total Sales card shows correct count
- [ ] Earnings (Released) shows KES amount with comma formatting
- [ ] Pending shows KES amount with comma formatting
- [ ] Active Transactions shows correct count
- [ ] All numbers formatted correctly

### Filter Buttons
- [ ] Same 6 filter buttons as buyer
- [ ] Filters work without errors

### Transaction Table
- [ ] Column headers are visible
- [ ] Table shows "No transactions found" initially
- [ ] Table styling is consistent

### UI/UX
- [ ] Page title: "Seller Dashboard"
- [ ] Subtitle: "Manage your sales and track earnings"
- [ ] Stats card colors are consistent
- [ ] Green accent color used for seller theme
- [ ] Responsive design works

---

## 6. PROFILE PAGE TESTING

### Page Load
- [ ] Navigate to `/dashboard/profile`
- [ ] Profile page loads without errors
- [ ] Page title: "My Profile"
- [ ] Subtitle: "Manage your account information"

### Read-Only Email Section
- [ ] Email address displays
- [ ] Email cannot be edited
- [ ] Message says "Contact support to change it"
- [ ] Email is in monospace font

### Editable Fields (Display Mode)
- [ ] Full Name displays (empty initially for new users)
- [ ] Phone displays (empty initially for new users)
- [ ] Account Type displays (shows role)
- [ ] Member Since shows date of creation
- [ ] KYC Status shows "pending"

### Edit Profile Button
- [ ] "Edit Profile" button is visible and blue
- [ ] Click "Edit Profile" → Form switches to edit mode
- [ ] Button changes to "Save Changes" and "Cancel"
- [ ] Input fields become editable

### Edit Mode - Full Name
- [ ] Full Name input is visible and editable
- [ ] Can type text
- [ ] Can clear and re-type
- [ ] No validation errors (yet)

### Edit Mode - Phone Number
- [ ] Phone input is visible and editable
- [ ] Can type various phone formats
- [ ] Validation works:
  - [ ] Valid format → no error
  - [ ] Invalid format → shows "valid Kenyan phone" error
  - [ ] Error clears on valid input
- [ ] Empty phone is OK (optional field)

### Save Changes
- [ ] Fill valid name and phone
- [ ] Click "Save Changes"
- [ ] Button shows "Saving..."
- [ ] Success message appears: "Profile updated successfully!"
- [ ] Form switches back to display mode
- [ ] New values are displayed
- [ ] Check Supabase database - values should be updated:
  - [ ] Name is updated
  - [ ] Phone is normalized to 254xxxxxxxxx format

### Cancel Edit
- [ ] In edit mode, click "Cancel"
- [ ] Form switches back to display mode
- [ ] Original values are restored (no changes saved)

### Logout Button
- [ ] In display mode, "Logout" button is visible and red
- [ ] Click "Logout"
- [ ] Page redirects to home (`/`)
- [ ] User is logged out (Navbar shows Login/Signup)

### UI/UX
- [ ] Profile card has nice white background with shadow
- [ ] Form is well-organized with clear sections
- [ ] Buttons are properly colored and sized
- [ ] Error messages are visible and helpful
- [ ] Success messages auto-dismiss after 3 seconds

---

## 7. NAVBAR TESTING

### When Logged Out
- [ ] Logo displays with "S" icon
- [ ] "Home" link works
- [ ] "Login" link goes to /auth/login
- [ ] "Sign Up" button goes to /auth/signup
- [ ] Mobile menu has Login button
- [ ] No user menu visible

### When Logged In
- [ ] Logo displays
- [ ] "Home" link works
- [ ] Welcome message shows: "Welcome, [username]"
- [ ] User initial displays in avatar circle (e.g., "T" for Test User)
- [ ] Desktop: Avatar is clickable, opens dropdown
- [ ] Mobile: Hamburger menu icon appears

### Desktop Dropdown Menu
- [ ] Dropdown appears on avatar click
- [ ] Menu items:
  - [ ] Profile link → /dashboard/profile
  - [ ] Buyer Dashboard link → /dashboard/buyer
  - [ ] Seller Dashboard link → /dashboard/seller
  - [ ] Logout button (red)
- [ ] Clicking outside closes menu
- [ ] Clicking item navigates away

### Mobile Menu
- [ ] Hamburger menu appears on login
- [ ] Menu shows Profile and Logout options
- [ ] Clicking option navigates/logs out
- [ ] Menu is responsive (doesn't push content)

### Responsiveness
- [ ] Desktop (>768px): Full navbar with dropdown
- [ ] Mobile (<768px): Hamburger menu
- [ ] Tablet (768-1024px): Properly sized buttons
- [ ] Logo text hides on mobile (shows "Safe Hands" only)

---

## 8. FOOTER TESTING

### Content
- [ ] "Safe Hands" logo and tagline visible
- [ ] Quick Links section with Home, Login, Sign Up
- [ ] Support section with FAQ, Help, Contact
- [ ] Legal section with Privacy, Terms, Security
- [ ] Social media links placeholder
- [ ] Copyright year shows 2025 (or current year)

### Links
- [ ] All footer links are clickable
- [ ] Links don't cause errors (even if destinations not ready)

### Responsiveness
- [ ] Desktop: 4-column grid layout
- [ ] Mobile: Single column layout
- [ ] Text is readable on all sizes
- [ ] No overflow or weird spacing

---

## 9. FORM VALIDATION TESTING

### Email Validation
- [ ] Valid: user@example.com ✓
- [ ] Valid: test.user+tag@example.co.uk ✓
- [ ] Invalid: notanemail ✗
- [ ] Invalid: user@nodomain ✗
- [ ] Invalid: @example.com ✗

### Phone Validation (Kenyan)
- [ ] Valid: 0712345678 ✓
- [ ] Valid: 07 1234 5678 (spaces) ✓
- [ ] Valid: 254712345678 ✓
- [ ] Valid: +254712345678 ✓
- [ ] Invalid: 123456 (too short) ✗
- [ ] Invalid: +1234567890 (not Kenya) ✗
- [ ] Invalid: abc123def456 ✗

### Phone Normalization
After signup/update, verify database:
- [ ] Input: 07123456789 → Saved: 254123456789
- [ ] Input: 254123456789 → Saved: 254123456789
- [ ] Input: +254123456789 → Saved: 254123456789
- [ ] Spaces/formatting stripped

### Password Strength
- [ ] Short password (< 8 chars) → Red (weak)
- [ ] 8 chars no special → Yellow (fair)
- [ ] 8+ with uppercase, lowercase, number, special → Green (strong)
- [ ] Shows strength text: Weak/Fair/Strong

### Password Confirmation
- [ ] Matching passwords → No error
- [ ] Mismatched passwords → "Passwords do not match" error
- [ ] Clearing confirm password → Error disappears on refocus

---

## 10. PROTECTED ROUTES TESTING

### Dashboard Route Protection
- [ ] Visit `/dashboard/buyer` without login
- [ ] Loading spinner appears
- [ ] Auto-redirects to `/auth/login` after 1-2 seconds
- [ ] Can't access dashboard directly without auth

### Profile Route Protection
- [ ] Visit `/dashboard/profile` without login
- [ ] Auto-redirects to `/auth/login`

### Logout Effect
- [ ] After logout, visit `/dashboard/buyer`
- [ ] Auto-redirects to `/auth/login`

---

## 11. SUPABASE DATABASE VERIFICATION

### After Signup
Navigate to Supabase dashboard and verify:

**auth.users table:**
- [ ] New user exists
- [ ] Email matches signup email
- [ ] User ID is UUID format

**public.users table:**
- [ ] New row exists
- [ ] id matches auth user id
- [ ] email is correct
- [ ] name is correct
- [ ] phone is normalized (254xxxxxxxxx)
- [ ] role is correct (buyer/seller/both)
- [ ] kyc_status is "pending"
- [ ] created_at is recent timestamp
- [ ] updated_at is recent timestamp

### After Profile Update
- [ ] name updates in database
- [ ] phone updates and normalizes in database
- [ ] updated_at timestamp changes

---

## 12. BROWSER CONSOLE TESTING

### Check for Errors
- [ ] Open browser DevTools (F12)
- [ ] Go to Console tab
- [ ] Perform all testing above
- [ ] **Should see 0 errors** (warnings are OK)
- [ ] Check for Supabase connection messages

### Network Requests
- [ ] Open Network tab
- [ ] Go to login page
- [ ] All requests should be 200/304 (success)
- [ ] No failed requests (red)
- [ ] Supabase requests should complete

---

## 13. CROSS-BROWSER TESTING

### Chrome/Edge
- [ ] Test all flows above
- [ ] Styling looks correct
- [ ] No console errors

### Firefox
- [ ] Test signup/login
- [ ] Styling looks correct
- [ ] Form validation works

### Safari (if available)
- [ ] Test basic flows
- [ ] Ensure compatibility

### Mobile Browser
- [ ] Test on mobile (or mobile emulation)
- [ ] Responsive design works
- [ ] Touch interactions work

---

## 14. PERFORMANCE TESTING

### Page Load Times
- [ ] Homepage loads in < 2 seconds
- [ ] Login page loads in < 1 second
- [ ] Dashboard loads in < 2 seconds
- [ ] Profile loads in < 2 seconds

### Responsiveness
- [ ] Form inputs respond instantly to typing
- [ ] Buttons respond instantly to clicks
- [ ] No lag or janky animations
- [ ] Dropdown menus open instantly

---

## 15. FINAL SMOKE TEST

Complete a full user flow:
1. [ ] Clear cache
2. [ ] Visit home page
3. [ ] Click "Get Started"
4. [ ] Fill signup form with real data
5. [ ] Verify success message
6. [ ] Verify redirect to login
7. [ ] Login with new credentials
8. [ ] Verify redirect to dashboard
9. [ ] View profile
10. [ ] Edit profile with new name/phone
11. [ ] Verify changes saved
12. [ ] Logout
13. [ ] Verify redirect to home
14. [ ] Try accessing dashboard → redirects to login
15. [ ] ✅ All working!

---

## Issues Found & Fixes Applied

**Issue Log:**
- Issue: __________________ | Status: Fixed / Pending / Not an Issue
- Issue: __________________ | Status: Fixed / Pending / Not an Issue
- Issue: __________________ | Status: Fixed / Pending / Not an Issue

---

## Sign-Off

- **Tester Name:** _______________
- **Test Date:** _______________
- **Test Status:** ☐ All Pass ☐ Some Issues ☐ Major Issues
- **Ready for Phase 3:** ☐ Yes ☐ No

---

**Congratulations!** You now have a fully functional authentication system with complete user management! 🎉

Next phase: **Core Escrow Functionality** with transactions, M-Pesa integration, and dispute resolution.
