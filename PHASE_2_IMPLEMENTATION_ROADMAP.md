# PHASE 2 ENHANCED: IMPLEMENTATION ROADMAP

## TL;DR - What We're Building

We're going to **significantly enhance** authentication with:
1. ✅ Email verification (required before login)
2. ✅ Password reset (forgot password flow)
3. ✅ Multi-step signup (optional KYC capture)
4. ✅ Proper session & redirect flows
5. ✅ Better error handling & UX

---

## VISUAL FLOW DIAGRAMS

### Current vs Desired Signup Flow

#### CURRENT (Problematic)
```
┌─────────────┐
│ Signup Form │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Create Auth     │
│ Create Profile  │
└────────┬────────┘
         │
         ▼
    ❌ DONE (No email check!)
         │
         ▼
┌─────────────┐
│ Login Page  │ ◄── User can login WITHOUT email verified!
└─────────────┘
```

#### DESIRED (Secure & Complete)
```
┌──────────────────┐
│ Step 1:          │
│ Signup Form      │
│ (email, phone)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│ Create Auth + DB     │
│ Email Verification   │
└────────┬─────────────┘
         │
         ▼
┌────────────────────────┐
│ Step 2:                │
│ Verify Email Page      │
│ "Check your email"     │
│ (wait for verification)│
└────────┬───────────────┘
         │ (user clicks email link)
         ▼
┌────────────────────────┐
│ Verify Email API       │
│ Mark email confirmed   │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Step 3 (Optional):     │
│ KYC Data Page          │
│ "Complete your profile"│
│ (Can SKIP for now)     │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Success Page           │
│ Redirect to Dashboard  │
└────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Login (Verified) │ ◄── Only verified emails can login
└──────────────────┘
```

---

### Forgot Password Flow

```
┌─────────────────────┐
│ Click "Forgot Pass" │
│ on Login Page       │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────┐
│ Forgot Password Page     │
│ Enter email              │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Find user by email       │
│ Generate reset token     │
│ Send reset email         │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Show: "Check your email" │
│ (with resend button)     │
└──────────┬───────────────┘
           │
   (user clicks email link)
           │
           ▼
┌──────────────────────────────────┐
│ Reset Password Page              │
│ New password + Confirm           │
│ Validate token & password        │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Update password in Supabase      │
│ Invalidate token                 │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Success: "Password reset"        │
│ Redirect to Login                │
└──────────────────────────────────┘
```

---

## DETAILED IMPLEMENTATION PLAN

### PHASE 2A: Email Verification (Days 1-2)

#### Files to Create

**1. Email Verification Page**
```
/app/auth/verify-email/page.js
- Shows: "Verify your email" message
- Auto-check: Has verification link been clicked?
- Show countdown: "Resend email in X seconds"
- Button: "Resend Verification Email"
- Status: Loading, Success, Error
```

**2. Email Verification API**
```
/api/auth/verify-email/route.js
- GET request with token parameter
- Validate token is correct
- Mark email as verified in Supabase auth
- Update user.email_confirmed_at in DB
- Return success/error
```

**3. Resend Verification Email API**
```
/api/auth/resend-verification/route.js
- GET current user from session
- Check if already verified
- Send new verification email
- Return status
```

**4. Email Service Library**
```
/lib/emailService.js
- sendVerificationEmail(email, token)
- sendPasswordResetEmail(email, token)
- sendNotificationEmail(...)
- Built on Supabase auth or SendGrid/Resend
```

**5. Token Service Library**
```
/lib/tokenService.js
- generateToken(data, expiresIn)
- verifyToken(token)
- Tokens stored as: email verification, password reset
- Expiry: 24 hours for email, 1 hour for password reset
```

**6. Enhanced Login Form**
```
components/auth/LoginForm.js (updated)
- Add email verification check after login
- Show modal: "Please verify email first"
- Button: "Resend verification email"
```

**7. Enhanced SignUp Form**
```
components/auth/SignUpForm.js (updated)
- After signup success, show modal instead of redirect
- Modal: "Verify your email"
- Auto-redirect to /auth/verify-email
```

#### Database Changes
- ✅ Supabase handles email_confirmed_at automatically
- Create table: `email_verification_tokens` (optional, if not using Supabase)
  - `id`, `email`, `token`, `created_at`, `expires_at`

#### Key Logic

**After Signup:**
```javascript
// Current: redirect to login
// New: redirect to verify-email page

if (signUp successful) {
  // Send verification email (handled by Supabase auth)
  redirect('/auth/verify-email')
}
```

**Before Login:**
```javascript
// After successful auth, check:
if (!user.email_confirmed_at) {
  // Show modal: "Please verify email first"
  // Offer: "Resend email" button
  // Store: email in session to continue after verification
}
```

**On Email Link Click:**
```javascript
// Token comes in URL: /auth/verify-email?token=xxx
// Fetch /api/auth/verify-email?token=xxx
// If valid: mark as verified, redirect to login or dashboard
// If invalid: show error, offer to resend
```

---

### PHASE 2B: Password Reset (Days 3-4)

#### Files to Create

**1. Forgot Password Page**
```
/app/auth/forgot-password/page.js
- Form: email input only
- Submit: call /api/auth/forgot-password
- Show: "Check your email for reset link"
- Link: "Back to login"
```

**2. Reset Password Page**
```
/app/auth/reset-password/page.js
- Get token from URL query: ?token=xxx
- Form: new password + confirm password
- Validate token first
- Submit: call /api/auth/reset-password
- Show: "Password reset successfully"
- Redirect: to login after 2 seconds
```

**3. Forgot Password Form Component**
```
components/auth/ForgotPasswordForm.js
- Email input with validation
- Loading state
- Success/error messages
- Submit handler
```

**4. Reset Password Form Component**
```
components/auth/ResetPasswordForm.js
- New password + confirm password inputs
- Password strength indicator
- Token validation
- Submit handler
```

**5. Forgot Password API**
```
/api/auth/forgot-password/route.js
- Receive: email
- Find user in DB
- Check if email exists (don't reveal if not)
- Generate token (24-hour expiry)
- Send email: password reset link
- Return: "Check your email"
```

**6. Reset Password API**
```
/api/auth/reset-password/route.js
- Receive: token, newPassword
- Validate token (check expiry)
- Find user by token
- Update password in Supabase auth
- Invalidate all tokens for this user
- Mark: password_reset_at
- Return: success
```

#### Database Changes
Create table: `password_reset_tokens`
- `id`, `user_id`, `token`, `created_at`, `expires_at`, `used_at`

#### Key Logic

**Forgot Password Flow:**
```javascript
// User clicks "Forgot Password"
// Enters email
// System checks if email exists (silently, for security)
// Sends reset email with token
// Shows: "Check your email"
// Token: 24 hour expiry
```

**Reset Password Flow:**
```javascript
// User clicks link in email
// Lands on /auth/reset-password?token=xxx
// Page validates token on load
// User enters new password
// Submit validates token again
// Update password in Supabase
// Show success
// Redirect to login
```

---

### PHASE 2C: Multi-Step Signup with KYC (Days 5-6)

#### Option A: Modal-Based (Recommended)
```
Step 1: Signup form (as is)
↓
Show Modal: "Verify your email"
↓
User verifies
↓
Show Modal: "Complete your profile" (optional, can skip)
  - ID type (national_id, passport, drivers_license)
  - ID number
  - Address
  - City
  - Bio
  - Profile picture (optional)
↓
Submit → stored in users.kyc_data JSONB
↓
Dashboard with notice: "KYC pending review"
```

#### Option B: Pages-Based (Alternative)
```
/app/auth/signup/page.js
↓
/app/auth/verify-email/page.js
↓
/app/auth/signup-step-2/page.js (KYC, optional)
↓
Dashboard
```

**Files to Create (if implementing):**
- `components/auth/KYCForm.js`
- `components/auth/SignUpStep1Form.js` (refactored from current)
- `components/auth/SignUpStep2Form.js`
- `/api/auth/update-kyc/route.js`
- Enhanced `lib/validation.js` with KYC validators

---

### PHASE 2D: Session & Redirect Management (Days 7)

#### Files to Create

**1. Session Validation API**
```
/api/auth/session/route.js
- GET: Check if user is logged in
- Return: user data + verification status + role
- Used by: dashboards to verify auth before rendering
```

**2. Auth Context/Hook (Optional)**
```
/lib/useAuth.js
- Custom hook for auth state
- useAuth() → returns { user, loading, isVerified, role }
- Can replace: repeated Supabase calls
```

**3. Protected Route Wrapper**
```
/components/auth/ProtectedRoute.js
- Wrapper component for protected pages
- Checks: user logged in + email verified + role
- Redirects: to login/verify if not qualified
```

#### Database Updates
- Add column to `users`: `last_login` (TIMESTAMP)
- Trigger: Update on every successful login

---

## IMPLEMENTATION ORDER

```
Week 1:
- Day 1: Email Verification (page + API + modal)
- Day 2: Email Verification testing
- Day 3: Password Reset (forgot + reset pages)
- Day 4: Password Reset testing
- Day 5: Multi-Step Signup (optional KYC)
- Day 6: Session management & redirects
- Day 7: Full end-to-end testing

Total: 7 days (1 week)
```

---

## NEW COMPONENTS SUMMARY

### Components to Create/Modify

```
MODIFY:
- components/auth/SignUpForm.js (add modal flow)
- components/auth/LoginForm.js (add email check)
- lib/validation.js (add password reset validators)

CREATE:
- components/auth/EmailVerificationModal.js
- components/auth/VerificationEmailSent.js
- components/auth/ForgotPasswordForm.js
- components/auth/ResetPasswordForm.js
- components/auth/KYCForm.js (optional)
- lib/emailService.js
- lib/tokenService.js
- lib/kycService.js (optional)
```

### Pages to Create/Modify

```
MODIFY:
- app/auth/signup/page.js (integrate modal)
- app/auth/login/page.js (link to forgot password)

CREATE:
- app/auth/verify-email/page.js
- app/auth/forgot-password/page.js
- app/auth/reset-password/page.js
- app/auth/signup-step-2/page.js (optional KYC)
```

### API Routes to Create

```
CREATE:
- app/api/auth/verify-email/route.js
- app/api/auth/resend-verification/route.js
- app/api/auth/forgot-password/route.js
- app/api/auth/reset-password/route.js
- app/api/auth/update-profile/route.js
- app/api/auth/session/route.js
```

---

## TESTING CRITERIA

### Email Verification Tests
- [ ] Signup triggers verification email
- [ ] Verification link is valid
- [ ] Clicking link marks email as verified
- [ ] Cannot login without verification
- [ ] "Resend" button works
- [ ] Verification link expires after 24h
- [ ] Token is single-use

### Password Reset Tests
- [ ] "Forgot password" page loads
- [ ] Entering email sends reset email
- [ ] Reset link contains valid token
- [ ] Cannot use reset link twice
- [ ] Reset link expires after 1h
- [ ] New password works on login
- [ ] Old password doesn't work

### Multi-Step Signup Tests (if implemented)
- [ ] Modal shows after email verification
- [ ] Can skip KYC completion
- [ ] KYC data saved to database
- [ ] Redirects work correctly

### Redirect Tests
- [ ] Unverified user redirected to verify-email
- [ ] Verified user redirected to dashboard
- [ ] Dashboard shows role-specific content
- [ ] Logout clears session

---

## DEPLOYMENT CHECKLIST

- [ ] Supabase email confirmations enabled
- [ ] Email templates customized
- [ ] Reset password redirect URL configured
- [ ] Password reset tokens table created
- [ ] Environment variables set (.env.local)
- [ ] Rate limiting on email endpoints
- [ ] Error messages don't leak user info
- [ ] HTTPS enforced
- [ ] All tests passing
- [ ] Documentation updated

---

## QUESTIONS FOR YOU (BEFORE WE START)

1. **KYC Data Capture**: 
   - Implement multi-step signup? (Yes/No/Defer)
   - Include document upload? (Yes/No/Defer to Phase 3)

2. **Email Service**:
   - Use Supabase built-in email? (free, 1/week limit)
   - Use SendGrid/Resend? (pay-as-you-go, no limits)

3. **Password Reset**:
   - 24-hour token expiry acceptable?
   - Send reset links to unverified emails? (security question)

4. **Session Management**:
   - Store last_login timestamp?
   - Implement logout cleanup?

5. **Error Messages**:
   - Show if email exists? (security vs UX tradeoff)
   - Show password requirements? (helpful but verbose)

---

## APPROVAL NEEDED

Before I start implementing, please confirm:

✅ **You want this audit?** (Just read it)
✅ **You want this implementation order?** (Or different priority?)
✅ **You want KYC in Phase 2?** (Multi-step signup?)
✅ **You want all password reset features?** (Forgot + Reset?)
✅ **Ready to implement?** (Let's build it!)

Once approved, I'll:
1. Build all files in order
2. Create comprehensive tests
3. Document everything
4. Verify with dev server

**THIS WILL BE PRODUCTION-READY AUTH. NO SHORTCUTS.** 🚀

Are you ready? Let's do this! 💪
