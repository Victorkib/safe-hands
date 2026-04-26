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
- **Authentication:** Supabase Auth, JWT tokens
- **Payments:** M-Pesa Daraja API
- **Deployment:** Vercel
- **Validation:** Zod
- **HTTP Client:** Axios
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

### Next Phase: Authentication & User Management

## 📁 Project Structure

```
safe-hands-escrow/
├── app/
│   ├── layout.js                  # Root layout
│   ├── page.js                    # Homepage
│   ├── globals.css                # Global styles
│   ├── (auth)/                    # Auth pages (group)
│   │   ├── signup/page.js         # Sign up
│   │   ├── login/page.js          # Login
│   │   └── layout.js              # Auth layout
│   ├── (dashboard)/               # Protected routes (group)
│   │   ├── buyer/page.js          # Buyer dashboard
│   │   ├── seller/page.js         # Seller dashboard
│   │   └── layout.js              # Dashboard layout
│   ├── (admin)/                   # Admin routes (group)
│   │   ├── dashboard/page.js      # Admin dashboard
│   │   ├── disputes/page.js       # Manage disputes
│   │   └── layout.js              # Admin layout
│   └── api/                       # API routes
│       ├── health/route.js        # Health check
│       ├── auth/[...auth]/        # Auth endpoints
│       ├── escrow/                # Escrow endpoints
│       ├── dispute/               # Dispute endpoints
│       ├── mpesa/                 # M-Pesa endpoints
│       └── admin/                 # Admin endpoints
├── components/
│   ├── shared/                    # Reusable components
│   ├── auth/                      # Auth components
│   ├── buyer/                     # Buyer components
│   ├── seller/                    # Seller components
│   ├── dispute/                   # Dispute components
│   └── admin/                     # Admin components
├── lib/
│   ├── supabaseClient.js          # Supabase configuration
│   ├── mpesaClient.js             # M-Pesa API client
│   ├── authMiddleware.js          # Auth middleware
│   └── utils.js                   # Utility functions
├── scripts/
│   ├── 001_create_schema.sql      # Database schema
│   └── migrate.js                 # Migration runner
├── public/
│   ├── images/                    # Images
│   └── icons/                     # Icons
├── .env.example                   # Environment template
├── .env.local                     # Local environment (gitignored)
├── package.json
├── next.config.mjs
├── tsconfig.json
├── SETUP_GUIDE.md                # Setup instructions
├── IMPLEMENTATION_CHECKLIST.md   # Development checklist
└── README.md                      # This file
```

## 🔧 Getting Started

### Prerequisites

- Node.js 18+
- pnpm or npm
- Supabase account
- M-Pesa sandbox credentials

### Installation

1. **Clone the repository** (or download)
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
   - Get M-Pesa sandbox credentials from https://sandbox.safaricom.co.ke
   - Edit `.env.local` with your values

5. **Set up database**
   ```bash
   # Option A: Run migration script
   pnpm run migrate

   # Option B: Manual setup via Supabase dashboard
   # Copy content from scripts/001_create_schema.sql
   # Paste into Supabase SQL editor
   # Run the query
   ```

6. **Start development server**
   ```bash
   pnpm dev
   ```

7. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📖 Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete setup instructions
- **[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)** - Feature development roadmap
- **[project_proposal.md](./docs/project_proposal.md)** - Detailed project requirements

## 🔐 Security

The platform implements several security measures:

- **Authentication:** Supabase Auth with JWT tokens
- **Session Management:** HTTP-only cookies for token storage
- **Row Level Security:** Database RLS policies enforce data access
- **Input Validation:** Zod schema validation on all forms
- **API Protection:** Authentication middleware on protected routes
- **Admin Functions:** Role-based access control (RBAC)

## 💳 M-Pesa Integration

The application integrates with Safaricom's M-Pesa Daraja API for payments:

### Sandbox (Development)
- URL: https://sandbox.safaricom.co.ke
- Default Short Code: 174379
- Default Passkey: bfb279f9aa9bdbcf158e97dd1a503b91

### Production (Live)
- Requires approval from Safaricom
- Use production credentials in environment

## 🗄️ Database Schema

The application uses PostgreSQL with the following main tables:

- **users** - User accounts, roles, KYC status
- **transactions** - Escrow transactions between buyers and sellers
- **disputes** - Conflict resolution records
- **notifications** - User notifications
- **transaction_history** - Audit trail of status changes
- **ratings** - User ratings and reviews

See `scripts/001_create_schema.sql` for full schema details.

## 📱 Key Features (In Progress)

### Phase 2: Authentication
- [ ] User signup/login
- [ ] Profile management
- [ ] Role selection (buyer/seller)
- [ ] KYC data management

### Phase 3: Escrow Core
- [ ] Transaction creation
- [ ] M-Pesa payment processing
- [ ] Delivery confirmation
- [ ] Auto-release after 3 days

### Phase 4: Disputes
- [ ] Dispute creation
- [ ] Admin dashboard
- [ ] Evidence upload
- [ ] Fair resolution

### Phase 5: UI Components
- [ ] Buyer dashboard
- [ ] Seller dashboard
- [ ] Admin dashboard
- [ ] Transaction cards
- [ ] Forms and validation

### Phase 6: API Routes
- [ ] All endpoints implemented
- [ ] Error handling
- [ ] Rate limiting

### Phase 7: Security
- [ ] Input validation
- [ ] RLS policies
- [ ] CORS configuration
- [ ] Monitoring

### Phase 8: Testing & Deployment
- [ ] Comprehensive testing
- [ ] Vercel deployment
- [ ] Production setup

## 🧪 Testing

### Manual Testing Checklist

- [ ] Homepage loads correctly
- [ ] Navigation works
- [ ] API health endpoint responds
- [ ] Database connection established
- [ ] Environment variables loaded

### Testing Commands

```bash
# Run type checking
pnpm type-check

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
3. Add environment variables in Vercel project settings:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - MPESA_CONSUMER_KEY
   - MPESA_CONSUMER_SECRET
   - MPESA_CALLBACK_URL

4. Deploy button in Vercel dashboard

### Production Checklist

- [ ] All environment variables configured
- [ ] Database backups enabled
- [ ] M-Pesa production credentials set
- [ ] Custom domain configured
- [ ] SSL certificates installed
- [ ] Monitoring/logging enabled
- [ ] Error tracking configured

## 📞 Support

For issues, questions, or suggestions:

1. Check [SETUP_GUIDE.md](./SETUP_GUIDE.md) for common issues
2. Review [Supabase documentation](https://supabase.com/docs)
3. Check [Next.js documentation](https://nextjs.org/docs)
4. Review [M-Pesa API docs](https://sandbox.safaricom.co.ke/documentation)

## 📄 License

This project is private and proprietary. All rights reserved.

## 🙋 Contributing

This is a private project. To contribute, contact the project owner.

---

## Quick Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm lint             # Lint code
pnpm type-check       # Check types

# Database
pnpm run migrate      # Run migrations

# Production
pnpm build            # Build for production
pnpm start            # Start production server

# Cleanup
pnpm clean            # Remove build files
```

## 🎯 Next Steps

1. **Complete Phase 2:** Build authentication system
2. **Test locally:** Verify all flows work
3. **Deploy:** Push to Vercel
4. **Monitor:** Watch for errors and performance

## 📊 Project Status

- **Started:** 2024
- **Current Phase:** 1 (Foundation) ✅
- **Next Phase:** 2 (Authentication)
- **Timeline:** 18 weeks to completion
- **Team Size:** Solo development

---

**Created with ❤️ for secure, transparent, peer-to-peer transactions in Kenya.**

Last Updated: 2024
Version: 0.1.0 (Alpha)
