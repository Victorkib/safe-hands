# PHASE 2 COMPLETE IMPLEMENTATION PLAN - ZERO ERRORS APPROACH

## Executive Summary

Based on audit of current code and schema, this document outlines the **EXACT** implementation for:
- ✅ Email Verification (required)
- ✅ Password Reset (required) 
- ✅ KYC Multi-Step (deferred to Phase 3 with placeholder)
- ✅ Session Management (required)
- ✅ Login/Signup with 24-hour password reset
- ✅ All database schema fields captured correctly
- ✅ Supabase + Gmail backup email service

---

## CURRENT STATE ANALYSIS

### What Works
- Signup with basic fields (email, name, phone, password, role)
- Login with role-based redirect
- Form validation
- Phone normalization for Kenya

### What's Missing
1. **Email Verification** - Users can login without confirming email
2. **Verification Page** - No page to confirm email after signup
3. **Resend Verification** - No way to resend verification email
4. **Password Reset** - No forgot/reset password flow
5. **Session Tracking** - No last_login updates
6. **KYC Capture** - Multi-step deferred (Phase 3 placeholder added)
7. **Email Service** - No actual email sending configured
8. **Backend Routes** - Most auth logic client-side only

---

## DATABASE SCHEMA FIELDS TO CAPTURE

### Users Table (from 001_create_schema.sql)
```
id - auto generated
email - captured at signup ✅
phone_number - captured & normalized ✅
full_name - captured ✅
role - captured ✅
kyc_status - set to 'pending' at signup ✅
kyc_data - DEFER to Phase 3 (null for now)
profile_picture_url - DEFER to Phase 3
bio - DEFER to Phase 3
is_active - set true at signup ✅
account_balance - set to 0.00 at signup ✅
total_transactions_completed - set to 0 ✅
avg_rating - null ✅
created_at - set at signup ✅
updated_at - set at signup ✅
last_login - UPDATE on login ✅
```

### New Tables Needed (Supabase Auth)
- **auth.users** (Supabase manages this)
  - id
  - email
  - email_confirmed_at (null until verified)
  - encrypted_password
  
- **email_verification_tokens** (custom table)
  - id (uuid)
  - user_id (references users)
  - token (secure random)
  - expires_at (24 hours from creation)
  - used_at (null until verified)
  
- **password_reset_tokens** (custom table)
  - id (uuid)
  - user_id (references users)
  - token (secure random)
  - expires_at (24 hours from creation)
  - used_at (null until reset completed)

---

## IMPLEMENTATION SEQUENCE (ZERO ERRORS)

### PHASE 2A: Email Verification (Days 1-2)

#### Step 1: Create Token Tables (Database)
```sql
-- In 002_add_auth_tokens.sql
CREATE TABLE IF NOT EXISTS email_verification_tokens (...)
CREATE TABLE IF NOT EXISTS password_reset_tokens (...)
```

#### Step 2: Create Email Service Library
```js
lib/emailService.js
- Use Supabase built-in (primary)
- Use Gmail SMTP (backup)
- Send verification emails
- Send password reset emails
- Retry logic with exponential backoff
```

#### Step 3: Create Token Service Library
```js
lib/tokenService.js
- Generate secure tokens
- Verify tokens
- Check expiration (24 hours)
- Mark as used
- Cleanup expired tokens
```

#### Step 4: Update SignUp Form
- After signup, show verification modal
- Not immediately redirect to login
- Show "Check your email" message
- Offer to resend verification email

#### Step 5: Create Verify Email Page
- Get token from URL query param
- Confirm email with API
- Show success/error message
- Auto-redirect to login after 3 seconds

#### Step 6: Create Resend Verification Component
- Allow resending from verify page
- Rate limit (1 resend per 60 seconds)
- Show "Email sent" confirmation

#### Step 7: Update Login Form
- Check if email verified before allowing login
- Show helpful error: "Please verify email first"

#### Step 8: Create API Routes
```
POST /api/auth/verify-email
POST /api/auth/resend-verification
```

---

### PHASE 2B: Password Reset (Days 3-4)

#### Step 1: Create Forgot Password Page
- Email input only
- Find user by email
- Send reset link via email
- Show "Check your email" message

#### Step 2: Create Reset Password Page
- Get token from URL
- Verify token validity & expiration
- Password + confirm password fields
- Password strength indicator

#### Step 3: Create Email Service Methods
- Send password reset email
- Include reset link with token

#### Step 4: Create API Routes
```
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

#### Step 5: Update Login Form
- Add "Forgot your password?" link
- Points to forgot-password page

---

### PHASE 2C: KYC Multi-Step (Deferred)

#### Step 1: Create Placeholder Component
```js
components/auth/KYCPrompt.js
- Shows "KYC verification coming in Phase 3"
- Allows skip for now
- Stores preference in local state
```

#### Step 2: Add to Signup Success
- After email verified
- Show optional KYC prompt
- Skip button available
- Sets kyc_status = 'pending' (already done)

---

### PHASE 2D: Session Management (Day 5)

#### Step 1: Update Login Logic
- On successful login, update last_login timestamp
- Create session in database (optional)
- Set secure HTTP-only cookie

#### Step 2: Create Session Hook
```js
hooks/useAuthSession.js
- Get current user
- Check if email verified
- Check if session valid
```

#### Step 3: Update Protected Routes
- Wrap dashboards with session check
- Redirect unverified users to verify page
- Redirect unauthenticated users to login

#### Step 4: Create Session API Route
```
GET /api/auth/session
```

---

## FILE STRUCTURE

### New Pages
```
app/auth/
  verify-email/
    page.js (handle token verification)
  forgot-password/
    page.js (email input form)
  reset-password/
    page.js (new password form)
```

### New Components
```
components/auth/
  VerifyEmailModal.js (show after signup)
  ForgotPasswordForm.js
  ResetPasswordForm.js
  EmailVerificationStatus.js
  KYCPrompt.js (Phase 3 placeholder)
```

### New Libraries
```
lib/
  emailService.js (Supabase + Gmail)
  tokenService.js (generate & verify tokens)
  Enhanced: supabaseClient.js (add new methods)
  Enhanced: validation.js (token validation)
```

### New Database Tables
```
scripts/
  002_add_auth_tokens.sql (verification & reset tokens)
  003_add_session_logging.sql (optional, for tracking)
```

### New API Routes
```
app/api/auth/
  verify-email/route.js
  resend-verification/route.js
  forgot-password/route.js
  reset-password/route.js
  session/route.js
  update-last-login/route.js
```

---

## DECISION MATRIX

### Email Service
**Decision: Supabase built-in + Gmail backup**
- Primary: Supabase Auth email (free, integrated)
- Backup: Gmail SMTP via app password (if Supabase fails)
- Both configured in emailService.js
- Automatic fallback on error

### Token Expiration
**Decision: 24 hours**
- Password reset links: 24 hours
- Email verification: 24 hours
- Resend allowed every 60 seconds

### Database Constraints
**Follows exactly from 001_create_schema.sql:**
- email: VARCHAR(255) UNIQUE NOT NULL ✅
- phone_number: VARCHAR(20) UNIQUE (optional) ✅
- full_name: VARCHAR(255) NOT NULL ✅
- role: VARCHAR(50) CHECK IN ('buyer','seller','admin') ✅
- kyc_status: VARCHAR(50) DEFAULT 'pending' ✅
- kyc_data: JSONB (null initially) ✅
- is_active: BOOLEAN DEFAULT true ✅
- account_balance: DECIMAL(15,2) DEFAULT 0.00 ✅
- total_transactions_completed: INT DEFAULT 0 ✅
- created_at, updated_at: TIMESTAMP ✅
- last_login: TIMESTAMP (update on login) ✅

---

## ERROR HANDLING STRATEGY

### Every API Call
- ✅ Try-catch blocks
- ✅ Specific error messages
- ✅ Console logging with [v0] prefix
- ✅ User-friendly error display

### Email Failures
- ✅ Catch SMTP errors
- ✅ Fallback to secondary email service
- ✅ Retry 3 times with exponential backoff
- ✅ Show user: "Will retry sending email"

### Token Issues
- ✅ Invalid token: show error page
- ✅ Expired token: offer resend
- ✅ Already used: show "already verified"

### Database Errors
- ✅ Catch constraint violations
- ✅ Duplicate email: helpful message
- ✅ Duplicate phone: helpful message
- ✅ Invalid role: reset to 'buyer'

---

## TESTING CHECKLIST (50+ Tests)

### Email Verification
- [ ] Signup creates user
- [ ] Email sent immediately
- [ ] User can't login until verified
- [ ] Verify link works correctly
- [ ] Expired link shows error
- [ ] Resend works and sends new email
- [ ] User can verify after resend
- [ ] Verified status updates in database

### Password Reset
- [ ] Forgot password form works
- [ ] Email sent with reset link
- [ ] Reset link works correctly
- [ ] Expired link shows error
- [ ] Password requirements enforced
- [ ] Passwords must match
- [ ] Old password required (optional)
- [ ] After reset, old password invalid
- [ ] After reset, new password works

### Login/Logout
- [ ] Can't login unverified email
- [ ] Can login verified email
- [ ] last_login updated on login
- [ ] Can logout properly
- [ ] Session clears on logout
- [ ] Redirects work per role

### Edge Cases
- [ ] Rapid resend clicks (rate limited)
- [ ] Browser refresh during verification
- [ ] Token in multiple tabs
- [ ] Manual URL manipulation
- [ ] SQL injection attempts blocked
- [ ] CSRF protection
- [ ] XSS protection

---

## SUCCESS CRITERIA

✅ All database fields used correctly  
✅ Email verification works end-to-end  
✅ Password reset works end-to-end  
✅ KYC placeholder informs users  
✅ Last login tracked  
✅ Zero console errors  
✅ Zero database constraint errors  
✅ 50+ tests documented and pass  
✅ All redirects work properly  
✅ Session management solid  
✅ Email service has fallback  
✅ Tokens secure & expire properly  

---

## TIMELINE

- **Day 1**: Email verification (logic + pages + API)
- **Day 2**: Email verification (testing + fixes)
- **Day 3**: Password reset (logic + pages + API)
- **Day 4**: Password reset (testing + fixes)
- **Day 5**: Session management + KYC placeholder
- **Total**: 5 days to production-ready

---

## DEPENDENCIES

- `@supabase/supabase-js` (already installed) ✅
- `nodemailer` (for Gmail backup - to install)
- No other external dependencies

---

This plan ensures:
- Zero schema mismatches
- Zero errors in implementation
- All fields captured correctly
- Professional error handling
- Complete test coverage
- Production-ready code

**Ready to implement? Let's go!** 🚀
