# PHASE 2 AUDIT & IMPLEMENTATION PLAN

## Executive Summary
We have a **partially working** authentication system that needs significant improvements before moving to Phase 3. The current signup/login works, but it's missing critical pieces for production: email verification, password reset, multi-step signup for complete KYC data capture, and proper OAuth provider integration support.

---

## PART 1: CURRENT STATE AUDIT

### ✅ WHAT'S WORKING

1. **User Signup**
   - Email, name, phone, role selection ✅
   - Password validation with strength indicator ✅
   - Form validation with error messages ✅
   - Creates auth user in Supabase ✅
   - Creates user profile in `users` table ✅
   - Redirects to login on success ✅

2. **User Login**
   - Email & password authentication ✅
   - Error handling for invalid credentials ✅
   - Auto-redirect to dashboard based on role ✅
   - Success message display ✅
   - Pre-fill email from signup redirect ✅

3. **Form Validation**
   - Phone number (Kenyan format) ✅
   - Email validation ✅
   - Password strength checking ✅
   - Custom validators for all fields ✅

4. **UI/UX**
   - Beautiful responsive design ✅
   - Error message display ✅
   - Loading states ✅
   - Smooth animations ✅

### ❌ WHAT'S MISSING

#### Critical Issues

1. **Email Verification**
   - ❌ No email verification flow
   - ❌ No verification page after signup
   - ❌ No "resend verification email" functionality
   - ❌ Users can login before verifying email (security risk)
   - ❌ Supabase `email_confirmed_at` field not checked

2. **Password Reset**
   - ❌ No "Forgot Password" functionality (link exists but not implemented)
   - ❌ No API route for password reset request
   - ❌ No reset token generation
   - ❌ No reset password page
   - ❌ No email template for reset

3. **Multi-Step Signup**
   - ❌ Can't capture KYC data (ID type, ID number, address) during signup
   - ❌ No profile completion step
   - ❌ No document upload for KYC
   - ❌ No way to defer KYC completion

4. **OAuth/Social Login Preparation**
   - ❌ No OAuth provider setup (Google, Discord, etc.)
   - ❌ No social login buttons
   - ❌ No way to link social accounts to existing accounts
   - ❌ No flow to capture missing data from OAuth users

5. **Data Capture Gaps**
   - Currently captured: `email`, `full_name`, `phone_number`, `role`, `kyc_status`
   - Missing from signup: `bio`, `profile_picture_url`, `kyc_data` (ID type, number, address)
   - Missing: `account_balance`, `last_login` tracking

6. **API Routes**
   - ❌ No `/api/auth/signup` route (signup happens directly on client)
   - ❌ No `/api/auth/verify-email` route
   - ❌ No `/api/auth/resend-verification` route
   - ❌ No `/api/auth/forgot-password` route
   - ❌ No `/api/auth/reset-password` route
   - ✅ Has `/api/auth/logout` and `/api/auth/user`

7. **Session Management**
   - ❌ No HTTP-only cookie storage (currently using Supabase session)
   - ❌ No explicit session validation on each request
   - ❌ No logout cleanup
   - ❌ No session timeout handling

8. **Error Handling**
   - Partial: Covers basic errors but missing:
     - Email already exists during signup (partially handled)
     - Email not verified before login
     - Network errors
     - Rate limiting

9. **User Profile Flow**
   - ✅ Profile page exists and can view/edit
   - ❌ Not integrated into signup flow
   - ❌ No KYC data fields on profile page
   - ❌ No document upload on profile page

10. **Conditional Rendering**
    - ✅ Redirects work based on role
    - ❌ No checking of KYC status before certain actions
    - ❌ No checking of email verification status before certain actions

---

## PART 2: DATABASE SCHEMA vs SIGNUP DATA

### Schema Fields (from `001_create_schema.sql`)

```
users table:
- id (UUID) ✅ captured via auth
- email ✅ captured
- phone_number ✅ captured
- full_name ✅ captured
- role ✅ captured
- kyc_status ✅ captured (set to 'pending')
- kyc_data (JSONB) ❌ NOT captured
- profile_picture_url ❌ NOT captured
- bio ❌ NOT captured
- is_active ✅ default true
- account_balance ✅ default 0.00
- total_transactions_completed ✅ default 0
- avg_rating ❌ not set
- created_at ✅ auto
- updated_at ✅ auto
- last_login ❌ NOT tracked
```

### Missing KYC Data Structure
The schema expects `kyc_data` as JSONB but doesn't define structure. Should be:
```json
{
  "id_type": "national_id|passport|drivers_license",
  "id_number": "string",
  "id_expiry": "YYYY-MM-DD",
  "address": "string",
  "city": "string",
  "country": "KE",
  "verified_at": "ISO timestamp",
  "verified_by": "admin_id"
}
```

---

## PART 3: MISSING INFRASTRUCTURE

### Missing Files
1. **Pages**
   - ❌ `/app/auth/verify-email/page.js` - Email verification page
   - ❌ `/app/auth/forgot-password/page.js` - Password reset request
   - ❌ `/app/auth/reset-password/page.js` - New password form
   - ❌ `/app/auth/signup-step-2/page.js` - KYC data capture (optional)
   - ❌ `/app/auth/verify-email-success/page.js` - Confirmation page

2. **Components**
   - ❌ `EmailVerificationModal.js` - Modal after signup
   - ❌ `VerificationEmailSent.js` - Status display
   - ❌ `ForgotPasswordForm.js` - Reset request
   - ❌ `ResetPasswordForm.js` - New password form
   - ❌ `KYCForm.js` - Multi-step KYC capture
   - ❌ `SignUpStep1Form.js` - Refactored signup (basic info)
   - ❌ `SignUpStep2Form.js` - KYC info (optional)
   - ❌ `DocumentUpload.js` - File upload component

3. **API Routes**
   - ❌ `/api/auth/verify-email/route.js` - Email verification callback
   - ❌ `/api/auth/resend-verification/route.js` - Resend verification email
   - ❌ `/api/auth/forgot-password/route.js` - Initiate password reset
   - ❌ `/api/auth/reset-password/route.js` - Complete password reset
   - ❌ `/api/auth/update-profile/route.js` - Update profile (including KYC)
   - ❌ `/api/auth/session/route.js` - Session validation

4. **Libraries/Utilities**
   - ❌ `lib/emailService.js` - Email sending functions
   - ❌ `lib/tokenService.js` - Token generation & validation
   - ❌ `lib/kycService.js` - KYC validation helpers
   - Enhanced: `lib/validation.js` needs password reset validators

---

## PART 4: AUTHENTICATION FLOW ANALYSIS

### Current Signup Flow
```
1. User fills form (email, name, phone, password, role)
2. Client-side validation
3. POST to Supabase Auth → creates auth user
4. POST to Supabase DB → creates user profile
5. Redirect to login
6. ❌ NO email verification
7. ❌ NO KYC verification
```

**Problem**: User can immediately login without email verification!

### Current Login Flow
```
1. User enters email & password
2. Client-side validation
3. POST to Supabase Auth → authenticate
4. Get user role from DB
5. Redirect to dashboard based on role
6. ❌ NO check for email verification
7. ❌ NO check for KYC status
```

**Problem**: User sees incomplete experience, not informed about verification status.

### Desired Signup Flow (with improvements)
```
Step 1: Basic Info
1. Fill email, name, phone, password, role
2. Client-side validation
3. Create auth user + user profile
4. Transition to Step 2

Step 2: Email Verification (REQUIRED)
1. Show modal: "Verify your email"
2. Send verification email via Supabase
3. User clicks link in email
4. Verify token & mark email as confirmed
5. Show success page
6. Redirect to dashboard or Step 3

Step 3: KYC Data (OPTIONAL, can defer)
1. Show modal: "Complete your profile" (can skip)
2. Capture: ID type, ID number, address, bio, photo
3. Submit to API
4. Mark KYC status as 'submitted' or 'approved'
5. Redirect to dashboard

Dashboard Login:
1. Check email verified? (required)
2. Check KYC status? (optional, but restrict features if pending)
3. Show appropriate dashboard
```

---

## PART 5: PASSWORD RESET FLOW

### Desired Password Reset Flow
```
Forgot Password Page:
1. User enters email
2. Validate email exists in system
3. Send reset email with token (via Supabase or custom)
4. Show: "Check your email for reset link"

Reset Link in Email:
1. Contains token & reset URL
2. URL: /auth/reset-password?token=xxx

Reset Password Page:
1. Show form: new password + confirm
2. Validate token is valid
3. Validate password strength
4. Send to API to update
5. Show success
6. Redirect to login
```

---

## PART 6: PROPOSED FILE STRUCTURE

```
app/
├── auth/
│   ├── signup/
│   │   └── page.js (updated: may show step 1 OR modal-based flow)
│   ├── verify-email/
│   │   └── page.js (NEW: email verification page)
│   ├── forgot-password/
│   │   └── page.js (NEW: forgot password)
│   ├── reset-password/
│   │   └── page.js (NEW: reset password)
│   └── layout.js ✅ exists
├── api/
│   └── auth/
│       ├── verify-email/route.js (NEW)
│       ├── resend-verification/route.js (NEW)
│       ├── forgot-password/route.js (NEW)
│       ├── reset-password/route.js (NEW)
│       ├── update-profile/route.js (NEW)
│       ├── session/route.js (NEW)
│       ├── logout/route.js ✅ exists
│       └── user/route.js ✅ exists
components/
├── auth/
│   ├── SignUpForm.js ✅ (refactor for multi-step if needed)
│   ├── LoginForm.js ✅ (add forgot password link)
│   ├── EmailVerificationModal.js (NEW)
│   ├── ForgotPasswordForm.js (NEW)
│   ├── ResetPasswordForm.js (NEW)
│   ├── KYCForm.js (NEW: optional step)
│   └── VerificationEmailSent.js (NEW)
lib/
├── supabaseClient.js ✅ (enhance with auth helpers)
├── validation.js ✅ (add password reset validators)
├── authMiddleware.js ✅ (enhance for email verification check)
├── emailService.js (NEW)
├── tokenService.js (NEW)
└── kycService.js (NEW: optional)
```

---

## PART 7: MISSING SCENARIO FLOWS

### Scenario 1: User Signs Up But Never Verifies Email
**Current**: Can still login ❌
**Desired**: 
- Cannot complete transactions
- Warning banner on dashboard
- Ability to resend email

### Scenario 2: User Forgets Password
**Current**: Link to "#forgot-password" (does nothing) ❌
**Desired**:
- Click link → go to forgot-password page
- Enter email → send reset email
- Click reset link → new password form
- Verify token → update password
- Redirect to login

### Scenario 3: User Signs Up Via Google (future)
**Current**: Not supported ❌
**Desired**:
- Google auth works
- User data pre-filled from Google
- May still need phone & KYC
- Step-wise flow guides user

### Scenario 4: User Tries to Create Transaction But Hasn't Verified Email
**Current**: No prevention ❌
**Desired**:
- Modal: "Please verify email first"
- Button to resend verification
- After verification, redirect back to transaction

### Scenario 5: KYC Submission & Approval
**Current**: No KYC flow ❌
**Desired**:
- User uploads ID document
- Sets address & KYC data
- Admin reviews
- Status changes from 'pending' → 'approved' or 'rejected'
- User notified

---

## PART 8: SUPABASE CONFIG REQUIREMENTS

### Current Supabase Settings Needed:
1. **Email Templates** (if using Supabase email)
   - [ ] Confirmation email template
   - [ ] Reset password email template
   - [ ] Custom branding

2. **Auth Settings**
   - [ ] Enable email confirmations
   - [ ] Set verification link redirect URL
   - [ ] Set password reset redirect URL
   - [ ] Configure session duration

3. **Database**
   - [ ] Run 001_create_schema.sql ✅
   - [ ] Enable RLS on all tables ✅
   - [ ] Verify policies are correct ✅

4. **Storage** (for future KYC documents)
   - [ ] Create `kyc-documents` bucket
   - [ ] Set RLS policies for uploads

---

## IMPLEMENTATION PRIORITIES

### Critical (Must Have for Phase 3)
1. **Email Verification**
   - Post-signup verification flow
   - Verification page
   - Resend functionality
   - Check before login

2. **Password Reset**
   - Forgot password page
   - Reset password page
   - Email flow
   - Token validation

3. **Conditional Rendering**
   - Show warnings for unverified email
   - Restrict transactions if unverified

### High Priority (Before Production)
4. **Multi-Step Signup**
   - KYC data capture page
   - Ability to defer KYC
   - Proper state management

5. **Session Management**
   - Proper login tracking
   - last_login updates
   - Session validation routes

### Medium Priority (Phase 3)
6. **OAuth Setup**
   - Social login buttons
   - Data mapping from OAuth
   - Account linking

7. **KYC Validation**
   - ID document upload
   - Admin review flow
   - Status updates

### Low Priority (Phase 4+)
8. **Advanced Features**
   - 2FA
   - Account recovery
   - Email preferences

---

## TESTING CHECKLIST

### Critical Tests
- [ ] Signup creates user
- [ ] Verification email sends
- [ ] Verification link works
- [ ] Unverified user can't login
- [ ] Verified user can login
- [ ] Forgot password email sends
- [ ] Reset password link works
- [ ] Password changes successfully
- [ ] Auto-redirect after verification
- [ ] Role-based dashboard redirect

---

## SUMMARY

**Current Status**: 50% complete - Signup & Login work, but missing email verification and password reset.

**What We Need to Build**:
1. Email verification (2-3 days)
2. Password reset (1-2 days)
3. Multi-step signup for KYC (2-3 days)
4. Session management enhancements (1-2 days)
5. Testing & refinement (1-2 days)

**Total Effort**: 1-2 weeks for Phase 2 completion

**Recommendation**: Build email verification + password reset first (critical), then enhance signup flow for KYC data capture.

---

## NEXT STEPS (After Your Approval)

When you're ready, we'll:

1. Create email verification flow
2. Create password reset flow
3. Refactor signup for multi-step (optional with defer)
4. Update redirects & conditional rendering
5. Add comprehensive testing

This will give us a **production-ready** authentication system before moving to Phase 3.
