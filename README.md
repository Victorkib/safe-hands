# Safe Hands Escrow - Secure P2P Transactions Platform

A modern, secure escrow platform for peer-to-peer transactions in Kenya, featuring M-Pesa integration and comprehensive dispute resolution.

## 🎯 Project Overview

Safe Hands Escrow is a full-stack web application built with Next.js and Supabase that enables secure transactions between buyers and sellers. The platform includes:

- **Secure Escrow System** - Funds held securely until both parties complete their obligations
- **M-Pesa Integration** - Seamless payment processing with Safaricom's Daraja API
- **Role-Based Access** - Separate dashboards for buyers, sellers, and administrators
- **Dispute Resolution** - Fair and transparent conflict resolution by trusted admins
- **User Ratings** - Build reputation through verified transaction ratings
- **KYC Verification** - Know Your Customer compliance for platform safety

## 🚀 Tech Stack

- **Frontend:** Next.js 16 (JavaScript), React 19, Tailwind CSS
- **Backend:** Next.js API Routes, Supabase
- **Database:** PostgreSQL (Supabase)
- **Authentication:** Supabase Auth, JWT tokens, Custom email verification
- **Payments:** M-Pesa Daraja API
- **Email:** Gmail SMTP (custom templates)
- **Deployment:** Vercel
- **Validation:** Custom validation utilities
- **HTTP Client:** Fetch API
- **Data Fetching:** SWR

## 📋 Current Status

### Phase 1: Foundation & Setup ✅ COMPLETED

All initial setup is complete:

- ✅ Project structure created
- ✅ Dependencies installed
- ✅ Database schema designed
- ✅ Core libraries configured
- ✅ Environment variables template created
- ✅ Documentation created

### Phase 2: Authentication & User Management ✅ COMPLETED

Full authentication system implemented:

- ✅ User signup with email verification
- ✅ Login with email verification requirement
- ✅ Password reset via email
- ✅ "Remember me" functionality (1 week session)
- ✅ Role-based access (buyer, seller, buyer_seller, admin)
- ✅ Rate limiting (production-only)
- ✅ Custom email templates via Gmail
- ✅ Email verification flow
- ✅ RLS policies with security definer functions

### Phase 3: Escrow Core ✅ COMPLETED

- ✅ Transaction API routes (POST /api/transactions, GET /api/transactions)
- ✅ M-Pesa STK Push payment (POST /api/transactions/[id]/pay)
- ✅ M-Pesa callback handler (POST /api/mpesa/callback)
- ✅ Payment status polling (GET /api/transactions/[id]/payment-status)
- ✅ Seller shipping endpoint (POST /api/transactions/[id]/ship)
- ✅ Buyer delivery confirmation (POST /api/transactions/[id]/confirm-delivery)
- ✅ Transaction detail page (/dashboard/transactions/[id])
- ✅ Transaction creation page (/dashboard/transactions/create)
- ✅ Auto-release function (pg_cron SQL script at scripts/005_auto_release_cron.sql)
- ✅ Notification service (lib/notificationService.js)

### Phase 4: Disputes ✅ COMPLETED

- ✅ Dispute creation API (POST /api/disputes, GET /api/disputes)
- ✅ Evidence upload endpoint (POST /api/disputes/[id]/upload-evidence)
- ✅ Admin dispute resolution API (POST /api/disputes/[id]/resolve)
- ✅ Disputes list page (/dashboard/disputes)
- ✅ Dispute detail page with evidence upload (/dashboard/disputes/[id])
- ❌ Admin dashboard UI (API exists but no dedicated admin interface)

### Phase 5: UI Components ⚠️ CRITICAL GAPS

- ✅ Buyer dashboard (/dashboard/buyer) - Can create transactions by entering seller email
- ❌ Seller dashboard (/dashboard/seller) - **NON-FUNCTIONAL** - No create button, no listing capability, cannot initiate any action
- ✅ Transaction detail page (/dashboard/transactions/[id]) - Buyers can pay, confirm delivery
- ✅ Transaction creation form (/dashboard/transactions/create) - Only for buyers to manually enter seller email
- ✅ Dispute pages (/dashboard/disputes, /dashboard/disputes/[id])
- ❌ Admin dashboard UI (dedicated admin interface)
- ❌ Marketplace/browse page - No way to discover sellers or products
- ❌ Seller listing capability - Sellers cannot list items for buyers to find

### Phase 6: API Routes ✅ COMPLETED

- ✅ Transaction endpoints (4 routes: create, list, pay, ship, confirm-delivery, payment-status)
- ✅ Dispute endpoints (3 routes: create, list, upload-evidence, resolve)
- ✅ M-Pesa callback endpoint
- ✅ Error handling (all endpoints have try-catch with proper error responses)
- ✅ Rate limiting utility (lib/rateLimiter.js - production-only)
- ❌ CORS configuration (not implemented)
- ❌ Rate limiting applied to all endpoints (utility exists but not used in all routes)

### Phase 7: Security ✅ COMPLETED (Core)

- ✅ Input validation
- ✅ RLS policies (fixed infinite recursion)
- ✅ Rate limiting
- [ ] CORS configuration
- [ ] Monitoring

### Phase 8: Testing & Deployment 📋 PLANNED

- [ ] Comprehensive testing
- [ ] Vercel deployment
- [ ] Production setup

### Phase 9: Marketplace & Listings ✅ COMPLETED

**Implementation Summary:**
- ✅ `listings` table in database (id, seller_id, title, description, price, category, images, status)
- ✅ `categories` table (id, name, slug) with default categories
- ✅ POST /api/listings - Create listing (sellers only)
- ✅ GET /api/listings - Browse listings (public with filters)
- ✅ GET /api/listings/[id] - Get listing details
- ✅ PUT /api/listings/[id] - Update listing (seller only)
- ✅ DELETE /api/listings/[id] - Delete listing (seller only)
- ✅ /marketplace - Browse listings with filters (public page)
- ✅ /dashboard/listings/create - Create listing (seller)
- ✅ /dashboard/listings/[id] - Edit/delete listing (seller)
- ✅ /dashboard/listings - Manage listings (seller)
- ✅ /listings/[id] - Public listing page with "Buy Now" button (creates transaction)
- ✅ Category filtering UI
- ✅ Price filtering UI
- ✅ Search functionality UI
- ✅ Update seller dashboard to include "Create Listing" button
- ✅ Listing validation in lib/validation.js
- ✅ SQL script at scripts/006_create_listings_tables.sql

**Manual Setup Required:**
- ❌ Supabase Storage bucket for listing images (user action needed)

**Platform Status:**
- Sellers can now create listings with images
- Buyers can browse marketplace with search and filters
- Buyers can click "Buy Now" to create transactions
- Platform is now functional for both buyers and sellers

### Phase 10: Ratings & Reviews 📋 FUTURE

**What's Missing:**
- Database has `ratings` table but no implementation
- No API endpoints for ratings
- No UI for users to rate/review transactions
- No rating display on user profiles

**What Needs Implementation:**
- [ ] POST /api/ratings - Create rating
- [ ] GET /api/ratings/[transaction_id] - Get transaction rating
- [ ] GET /api/users/[id]/ratings - Get user ratings
- [ ] Rating form in transaction detail page
- [ ] Rating display on user profiles
- [ ] Average rating calculation
- [ ] Rating aggregation for sellers

### Phase 11: KYC Verification 📋 FUTURE

**What's Missing:**
- Database has `kyc_status` and `kyc_data` fields but no implementation
- No KYC upload endpoints
- No admin KYC review interface
- No ID verification integration

**What Needs Implementation:**
- [ ] POST /api/kyc/submit - Submit KYC documents
- [ ] GET /api/kyc/[user_id] - Get KYC status
- [ ] POST /api/kyc/[user_id]/review - Admin review KYC
- [ ] KYC upload page
- [ ] Admin KYC review dashboard
- [ ] ID document upload to Supabase Storage
- [ ] Integration with ID verification service (optional)

### Phase 12: Admin Dashboard UI 📋 FUTURE

**What's Missing:**
- Admin dispute resolution API exists but no UI
- No admin overview dashboard
- No user management interface
- No transaction monitoring interface

**What Needs Implementation:**
- [ ] /dashboard/admin - Admin overview dashboard
- [ ] /dashboard/admin/disputes - Dispute resolution interface
- [ ] /dashboard/admin/users - User management
- [ ] /dashboard/admin/transactions - Transaction monitoring
- [ ] Admin statistics and metrics
- [ ] Admin notification center

### Phase 13: Notification Center UI 📋 FUTURE

**What's Missing:**
- Notification service exists (lib/notificationService.js) but no UI
- Users cannot view notifications
- No notification bell icon in navbar
- No notification settings

**What Needs Implementation:**
- [ ] /dashboard/notifications - Notification center page
- [ ] Notification bell component in navbar
- [ ] Notification count badge
- [ ] Mark as read functionality
- [ ] Notification settings page
- [ ] Real-time notification updates (optional)

### Phase 14: B2C Payment Integration 📋 FUTURE

**What's Missing:**
- M-Pesa B2C API integration for fund releases
- MPESA_SECURITY_CREDENTIAL configuration
- Seller payout system
- Transaction completion with actual fund transfer

**What Needs Implementation:**
- [ ] B2C API integration in lib/mpesaClient.js
- [ ] POST /api/transactions/[id]/release-funds - Trigger B2C payout
- [ ] MPESA_SECURITY_CREDENTIAL configuration
- [ ] Seller wallet balance tracking
- [ ] Payout history
- [ ] Payout scheduling

### Phase 15: Additional Features 📋 FUTURE

- [ ] Search functionality across listings
- [ ] Advanced filtering (location, price range, category)
- [ ] Real-time updates via WebSockets
- [ ] Chat/messaging between buyers and sellers
- [ ] Analytics dashboard for sellers
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Currency conversion (beyond KES)

## 📁 Project Structure

```
safe-hands-escrow/
├── app/
│   ├── layout.js                  # Root layout
│   ├── page.js                    # Homepage
│   ├── globals.css                # Global styles
│   ├── auth/                      # Auth pages
│   │   ├── signup/page.js         # Sign up
│   │   ├── login/page.js          # Login
│   │   ├── forgot-password/page.js # Password reset request
│   │   ├── reset-password/page.js # Password reset form
│   │   └── verify-email/page.js   # Email verification
│   ├── dashboard/                 # Protected routes
│   │   ├── buyer/page.js          # Buyer dashboard
│   │   ├── seller/page.js         # Seller dashboard
│   │   └── admin/page.js          # Admin dashboard
│   └── api/                       # API routes
│       ├── auth/                  # Auth endpoints
│       │   ├── verify-email/      # Email verification
│       │   ├── forgot-password/   # Password reset request
│       │   ├── reset-password/    # Password reset
│       │   ├── resend-verification/ # Resend verification
│       │   ├── logout/            # Logout
│       │   └── user/              # Get current user
│       └── ...
├── components/
│   ├── auth/                      # Auth components
│   │   ├── SignUpForm.js          # Signup form
│   │   └── LoginForm.js           # Login form
│   ├── shared/                    # Reusable components
│   └── ui/                        # Shadcn UI components
├── lib/
│   ├── supabaseClient.js          # Supabase configuration
│   ├── emailService.js            # Email sending (Gmail)
│   ├── tokenService.js            # Token generation/verification
│   ├── rateLimiter.js             # Rate limiting utility
│   ├── validation.js              # Form validation
│   ├── authMiddleware.js          # Auth middleware
│   └── utils.js                   # Utility functions
├── scripts/
│   ├── 001_create_schema.sql      # Database schema
│   ├── 002_add_auth_tokens.sql    # Auth token tables
│   ├── 003_update_users_schema.sql # User schema updates
│   ├── 004_fix_rls_policies.sql   # RLS policy fixes
│   └── migrate.js                 # Migration runner
├── .env.example                   # Environment template
├── .env.local                     # Local environment (gitignored)
├── package.json
├── next.config.mjs
├── tsconfig.json
├── AUTH_IMPLEMENTATION_COMPLETE.md # Auth documentation
├── EMAIL_ARCHITECTURE_ANALYSIS.md  # Email system docs
├── IMPLEMENTATION_SUMMARY.md       # Implementation summary
└── README.md                       # This file
```

## 🔧 Getting Started

### Prerequisites

- Node.js 18+
- pnpm or npm
- Supabase account
- M-Pesa sandbox credentials (for payment features)

### Installation

1. **Clone the repository**

   ```bash
   cd safe-hands-escrow
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Create environment file**

   ```bash
   cp .env.example .env.local
   ```

4. **Fill in environment variables**
   - Get Supabase credentials from https://supabase.com
   - Configure Gmail for email sending
   - Get M-Pesa sandbox credentials from https://sandbox.safaricom.co.ke

5. **Set up database**

   ```bash
   # Run migrations
   node scripts/migrate.js

   # OR manually run SQL scripts in order:
   # 1. scripts/001_create_schema.sql
   # 2. scripts/002_add_auth_tokens.sql
   # 3. scripts/003_update_users_schema.sql
   # 4. scripts/004_fix_rls_policies.sql
   ```

6. **Configure Supabase Dashboard**
   - Go to Authentication → Settings
   - **Disable** "Enable email confirmations" (we use custom verification)
   - Save changes

7. **Start development server**

   ```bash
   pnpm dev
   ```

8. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📖 Documentation

- **[AUTH_IMPLEMENTATION_COMPLETE.md](./AUTH_IMPLEMENTATION_COMPLETE.md)** - Complete authentication guide
- **[EMAIL_ARCHITECTURE_ANALYSIS.md](./EMAIL_ARCHITECTURE_ANALYSIS.md)** - Email system architecture
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Implementation summary

## 🔐 Security Features

The platform implements several security measures:

- **Authentication:** Supabase Auth with JWT tokens
- **Email Verification:** Required before login
- **Session Management:** Configurable session duration (1 week with "remember me")
- **Row Level Security:** Database RLS policies with security definer functions
- **Rate Limiting:** Production-only rate limiting for auth endpoints
- **Input Validation:** Custom validation on all forms
- **Password Requirements:** 8+ chars, uppercase, lowercase, number, special char
- **API Protection:** Authentication middleware on protected routes

## 📧 Email System

The platform uses Gmail for sending transactional emails:

- **Verification Emails:** Custom branded templates
- **Password Reset:** Secure reset links with 24-hour expiration
- **Welcome Emails:** Sent after email verification

### Email Configuration

Required environment variables:

```env
GMAIL_APP_EMAIL=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_app_password
```

## 🗄️ Database Schema

The application uses PostgreSQL with the following main tables:

- **users** - User accounts, roles, KYC status
- **transactions** - Escrow transactions between buyers and sellers
- **disputes** - Conflict resolution records
- **notifications** - User notifications
- **transaction_history** - Audit trail of status changes
- **ratings** - User ratings and reviews
- **email_verification_tokens** - Email verification tokens
- **password_reset_tokens** - Password reset tokens

See `scripts/001_create_schema.sql` for full schema details.

## 🚨 Important Configuration

### Supabase Dashboard Settings

1. **Disable Email Confirmations**
   - Go to Authentication → Settings
   - Toggle OFF "Enable email confirmations"
   - This prevents duplicate verification emails

2. **Email Templates**
   - We use custom Gmail templates, not Supabase templates
   - No need to configure Supabase email templates

### Database Migration Order

Run SQL scripts in this order:

1. `001_create_schema.sql` - Creates all tables
2. `002_add_auth_tokens.sql` - Adds token tables
3. `003_update_users_schema.sql` - Adds buyer_seller role
4. `004_fix_rls_policies.sql` - Fixes RLS recursion issue

## 🧪 Testing

### Manual Testing Checklist

- [ ] Homepage loads correctly
- [ ] Can sign up with new email
- [ ] Receive verification email
- [ ] Can verify email by clicking link
- [ ] Can login after verification
- [ ] "Remember me" extends session
- [ ] Password reset works
- [ ] Rate limiting activates in production

### Testing Commands

```bash
# Lint code
pnpm lint

# Build for production
pnpm build

# Start production server
pnpm start
```

## 🚀 Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GMAIL_APP_EMAIL`
   - `GMAIL_APP_PASSWORD`
   - `NEXT_PUBLIC_APP_URL`

4. Deploy

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] All environment variables configured
- [ ] Database backups enabled
- [ ] Gmail credentials secured
- [ ] Custom domain configured
- [ ] SSL certificates installed
- [ ] Monitoring/logging enabled

## 📞 Support

For issues, questions, or suggestions:

1. Check [AUTH_IMPLEMENTATION_COMPLETE.md](./AUTH_IMPLEMENTATION_COMPLETE.md)
2. Check [EMAIL_ARCHITECTURE_ANALYSIS.md](./EMAIL_ARCHITECTURE_ANALYSIS.md)
3. Review [Supabase documentation](https://supabase.com/docs)
4. Check [Next.js documentation](https://nextjs.org/docs)

## 📄 License

This project is private and proprietary. All rights reserved.

---

## Quick Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm lint             # Lint code

# Database
node scripts/migrate.js  # Run migrations

# Production
pnpm build            # Build for production
pnpm start            # Start production server
```

## 🎯 Next Steps

1. **Complete Phase 3:** Build escrow transaction system
2. **Integrate M-Pesa:** Payment processing
3. **Build Dashboards:** Buyer, seller, admin interfaces
4. **Deploy:** Push to production

## 📊 Project Status

- **Started:** 2024
- **Current Phase:** 2 (Authentication) ✅
- **Next Phase:** 3 (Escrow Core)
- **Team Size:** Solo development

---

**Created with ❤️ for secure, transparent, peer-to-peer transactions in Kenya.**

Last Updated: 2026-04-28
Version: 0.2.0 (Beta)
