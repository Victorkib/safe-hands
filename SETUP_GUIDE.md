# Safe Hands Escrow - Setup Guide

## Overview
This is a complete setup guide for the Safe Hands Escrow platform. Follow these steps in order to get everything configured.

## Phase 1: Initial Setup ✅ COMPLETED

### What's Been Done
1. ✅ Dependencies installed: `@supabase/supabase-js`, `axios`, `zod`, `swr`, `jose`, `cookie`
2. ✅ Project structure created with all necessary folders
3. ✅ Environment variables template created (`.env.example`)
4. ✅ Database schema migration script created (`scripts/001_create_schema.sql`)
5. ✅ Core library files created:
   - `lib/supabaseClient.js` - Supabase client initialization
   - `lib/mpesaClient.js` - M-Pesa Daraja API client
   - `lib/authMiddleware.js` - Authentication middleware for API routes
   - `lib/utils.js` - Utility functions for formatting, validation, etc.
6. ✅ Homepage created with navigation and features overview
7. ✅ Converted project to JavaScript (removed TypeScript)

---

## Phase 2: Environment Configuration

### Step 1: Get Supabase Credentials

**If you haven't already:**
1. Go to https://supabase.com
2. Create a new project
3. Copy your credentials from **Project Settings → API**

You should have:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key (safe for public use)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep private!)

### Step 2: Get M-Pesa Credentials

**For Testing (Sandbox):**
1. Go to https://sandbox.safaricom.co.ke
2. Register and get credentials:
   - Consumer Key
   - Consumer Secret
   - Short Code (Test: 174379)
   - Passkey (Test: bfb279f9aa9bdbcf158e97dd1a503b91)

**For Production:**
1. Contact Safaricom for approval
2. Get production credentials

### Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in ALL variables:
   ```
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...

   # Database URLs (from Supabase Connection Pooler)
   POSTGRES_URL=postgresql://postgres:password@...
   POSTGRES_PRISMA_URL=postgresql://pgbouncer:password@...
   POSTGRES_URL_NON_POOLING=postgresql://postgres:password@...
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_password
   POSTGRES_DATABASE=postgres
   POSTGRES_HOST=your-project.supabase.co

   # M-Pesa Configuration
   MPESA_CONSUMER_KEY=your_consumer_key
   MPESA_CONSUMER_SECRET=your_consumer_secret
   MPESA_CALLBACK_URL=https://your-domain.com/api/mpesa/callback
   MPESA_SHORT_CODE=174379
   MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd1a503b91
   MPESA_ENVIRONMENT=sandbox  # or 'production'

   # Application
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NODE_ENV=development
   SUPABASE_JWT_SECRET=your_jwt_secret
   ```

---

## Phase 3: Database Setup

### Option A: Using Migration Script (Recommended)

1. Install dotenv globally (if needed):
   ```bash
   npm install -g dotenv
   ```

2. Run the migration script:
   ```bash
   pnpm run migrate
   ```

This will:
- Connect to Supabase using your service role key
- Execute the SQL schema creation
- Set up all tables, indexes, and RLS policies

### Option B: Manual SQL Execution (Alternative)

1. Open Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy the entire contents of `scripts/001_create_schema.sql`
4. Paste into the query editor
5. Click "Run"

---

## Phase 4: Testing the Setup

### Step 1: Start the Development Server
```bash
pnpm dev
```

The app should be running at `http://localhost:3000`

### Step 2: Check Homepage
Visit `http://localhost:3000` and verify:
- ✅ Homepage loads
- ✅ Navigation works
- ✅ Buttons are visible

### Step 3: Test Supabase Connection
We'll create a simple test endpoint.

Create `app/api/health/route.js`:
```javascript
import { supabase } from '@/lib/supabaseClient.js';

export async function GET() {
  try {
    const { data, error } = await supabase.from('users').select('count()');
    
    if (error) throw error;
    
    return Response.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({
      status: 'error',
      message: error.message,
    }, { status: 500 });
  }
}
```

Visit `http://localhost:3000/api/health` and you should see:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-..."
}
```

---

## Phase 5: File Structure Reference

```
safe-hands-escrow/
├── app/
│   ├── layout.js              # Root layout
│   ├── page.js                # Homepage
│   ├── globals.css            # Global styles
│   ├── (auth)/
│   │   ├── login/page.js      # Login page (to be created)
│   │   ├── signup/page.js     # Signup page (to be created)
│   │   └── layout.js          # Auth layout (to be created)
│   ├── (dashboard)/           # Protected routes
│   │   ├── buyer/page.js      # Buyer dashboard
│   │   ├── seller/page.js     # Seller dashboard
│   │   └── layout.js
│   ├── (admin)/               # Admin only
│   │   ├── dashboard/page.js  # Admin dashboard
│   │   ├── disputes/page.js   # Dispute management
│   │   └── layout.js
│   └── api/
│       ├── health/route.js    # Health check endpoint
│       ├── auth/              # Authentication routes
│       ├── escrow/            # Escrow transaction routes
│       ├── dispute/           # Dispute routes
│       ├── mpesa/             # M-Pesa integration routes
│       └── admin/             # Admin routes
├── components/
│   ├── shared/                # Reusable components
│   ├── auth/                  # Auth components
│   ├── buyer/                 # Buyer components
│   ├── seller/                # Seller components
│   ├── dispute/               # Dispute components
│   └── admin/                 # Admin components
├── lib/
│   ├── supabaseClient.js      # Supabase client
│   ├── mpesaClient.js         # M-Pesa client
│   ├── authMiddleware.js      # Auth middleware
│   └── utils.js               # Utility functions
├── scripts/
│   ├── 001_create_schema.sql  # Database schema
│   └── migrate.js             # Migration runner
├── public/
│   ├── images/                # Images and assets
│   └── icons/                 # Icon assets
├── .env.example               # Env template
├── .env.local                 # Your env vars (NOT in git)
├── package.json
├── next.config.mjs
└── SETUP_GUIDE.md            # This file
```

---

## Common Issues & Solutions

### Issue: "SUPABASE_URL is missing"
**Solution:** Check that you've created `.env.local` and filled in all Supabase variables

### Issue: Database tables don't exist
**Solution:** Run `pnpm run migrate` to execute the SQL schema

### Issue: M-Pesa tests fail
**Solution:** Verify you're using sandbox credentials for development. Production requires Safaricom approval.

### Issue: "Cannot find module '@supabase/supabase-js'"
**Solution:** Run `pnpm install` to ensure all dependencies are installed

---

## Next Steps

After completing this setup:

1. **Phase 2 (Auth)** - Build authentication pages
   - Create signup/login forms
   - Implement JWT session management
   - Build user profile pages

2. **Phase 3 (Escrow Core)** - Implement transaction logic
   - Create transaction routes
   - Integrate M-Pesa STK Push
   - Build transaction status tracking

3. **Phase 4 (Disputes)** - Add dispute resolution
   - Create dispute forms
   - Build admin dashboard
   - Implement dispute resolution logic

4. **Phase 5 (Frontend)** - Build UI components
   - Create buyer/seller dashboards
   - Build transaction cards
   - Design forms and layouts

5. **Phase 6 (Testing & Deploy)** - Deploy to production
   - Test all flows
   - Deploy to Vercel
   - Switch to production M-Pesa credentials

---

## Useful Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run database migrations
pnpm run migrate

# Lint code
pnpm lint
```

---

## Support & Documentation

- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **M-Pesa Daraja API:** https://sandbox.safaricom.co.ke/documentation
- **Project Proposal:** See `project_proposal.md` for full requirements

---

**Last Updated:** 2024
**Status:** Phase 1 Complete - Ready for Phase 2
