# Safe Hands Escrow - Quick Start Guide

Get up and running in 5 minutes! ⚡

## TL;DR - 4 Steps

### Step 1: Setup Environment (2 min)
```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# Get from: https://supabase.com and https://sandbox.safaricom.co.ke
```

### Step 2: Create Database (1 min)
```bash
# Option A: Run migration script
pnpm run migrate

# Option B: Manual setup
# Go to Supabase dashboard → SQL Editor
# Paste content from: scripts/001_create_schema.sql
# Click Run
```

### Step 3: Start Development (1 min)
```bash
pnpm dev
```

### Step 4: Open in Browser (1 min)
```
http://localhost:3000
```

✅ **Done!** You should see the homepage.

---

## Detailed Setup

### Prerequisites Check
- [x] Node.js 18+ installed? → `node --version`
- [x] pnpm installed? → `pnpm --version`
- [x] Supabase account? → https://supabase.com
- [x] M-Pesa sandbox account? → https://sandbox.safaricom.co.ke

### Get Your Credentials

#### From Supabase:
1. Go to https://supabase.com
2. Create a project
3. Go to **Settings → API**
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`

#### From M-Pesa Sandbox:
1. Go to https://sandbox.safaricom.co.ke
2. Register
3. Get your consumer key and secret
4. Use sandbox short code: `174379`

### Configure .env.local

```bash
# Copy template
cp .env.example .env.local

# Edit with your editor
nano .env.local
# or
code .env.local
```

Fill in these variables:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_CALLBACK_URL=http://localhost:3000/api/mpesa/callback
POSTGRES_URL=your_postgres_url
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DATABASE=postgres
POSTGRES_HOST=your_supabase_host
```

### Setup Database

**Option A: Automatic (Recommended)**
```bash
pnpm run migrate
```

You should see:
```
🚀 Safe Hands Escrow - Database Migration
📝 Running migration: 001_create_schema.sql
✅ Migration completed: 001_create_schema.sql
✅ All migrations completed successfully!
```

**Option B: Manual**
1. Open Supabase dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Open `scripts/001_create_schema.sql`
5. Copy entire content
6. Paste into query editor
7. Click **Run**

### Start Development Server

```bash
pnpm dev
```

You should see:
```
▲ Next.js 16.2.4
- Local:        http://localhost:3000
- Environments: .env.local

✓ Ready in 1.5s
```

### Verify Setup

Open browser to `http://localhost:3000`

You should see:
- ✅ Safe Hands Escrow homepage
- ✅ Hero section with features
- ✅ Navigation buttons
- ✅ Login/Signup links

**All working?** ✅ Setup complete!

---

## Test Your Setup

### Quick Health Check

Visit: `http://localhost:3000/api/health`

You should see JSON:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-..."
}
```

If not working:
1. Check `.env.local` is filled correctly
2. Check database migration ran successfully
3. Verify Supabase connection in settings
4. Check browser console for errors

---

## File Structure Reference

**Key files created:**
```
lib/
├── supabaseClient.js    ← Database & auth
├── mpesaClient.js       ← Payments
├── authMiddleware.js    ← Route protection
└── utils.js             ← Helper functions

app/
├── layout.js            ← Root layout
├── page.js              ← Homepage
├── (auth)/              ← Auth pages (soon)
├── (dashboard)/         ← User pages (soon)
├── (admin)/             ← Admin pages (soon)
└── api/                 ← API endpoints (soon)

scripts/
├── 001_create_schema.sql    ← Database schema
└── migrate.js               ← Migration runner
```

---

## Common Issues

### "Cannot find module '@supabase/supabase-js'"
```bash
# Solution: Install dependencies
pnpm install
```

### "SUPABASE_URL is missing"
```bash
# Solution: Check .env.local exists and has values
# Make sure variables are filled in
nano .env.local
```

### Database connection fails
```bash
# Solution: Verify Supabase credentials
# Check connection in Supabase dashboard
# Verify POSTGRES_URL format
# Try running migration again: pnpm run migrate
```

### Migration script doesn't run
```bash
# Solution: Check Node.js version
node --version  # Should be 18+

# Make sure .env.local has service role key
# Try running migration with verbose output
node scripts/migrate.js
```

### Port 3000 already in use
```bash
# Solution: Use different port
pnpm dev -p 3001

# Or kill process using port 3000
# macOS/Linux: lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
# Windows: netstat -ano | findstr :3000
```

---

## Useful Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm lint             # Check code quality
pnpm build            # Build for production

# Database
pnpm run migrate      # Run migrations
# Or manual: node scripts/migrate.js

# Production
pnpm start            # Run production build

# Clean
rm -rf .next          # Remove build cache
rm node_modules       # Remove dependencies (then pnpm install)
```

---

## What's Next?

### After Setup, You Have:

✅ **Foundation**
- Project structure
- Dependencies installed
- Database ready
- Environment configured

✅ **Core Libraries**
- Supabase client
- M-Pesa client
- Auth middleware
- Utility functions

✅ **Homepage**
- Beautiful landing page
- Navigation working
- Responsive design

### Next Phase: Authentication

Ready to build more? Start with:

1. **Create signup page** (`app/(auth)/signup/page.js`)
2. **Create login page** (`app/(auth)/login/page.js`)
3. **Build profile** (`app/profile/page.js`)
4. **Add dashboards** (buyer, seller, admin)

Check `IMPLEMENTATION_CHECKLIST.md` for detailed tasks.

---

## Project Structure

```
safe-hands-escrow/          ← Your project root
├── app/                    ← Next.js app
│   ├── page.js            ← Homepage
│   └── api/               ← API routes
├── lib/                   ← Libraries
│   ├── supabaseClient.js
│   ├── mpesaClient.js
│   ├── authMiddleware.js
│   └── utils.js
├── components/            ← React components (soon)
├── scripts/              ← Database scripts
│   └── 001_create_schema.sql
├── .env.local            ← Your secrets (gitignored)
├── .env.example          ← Template
└── package.json
```

---

## Credentials Checklist

Before running migrations, have these ready:

- [ ] Supabase URL
- [ ] Supabase Anon Key
- [ ] Supabase Service Role Key
- [ ] Postgres URL/Password
- [ ] M-Pesa Consumer Key
- [ ] M-Pesa Consumer Secret

**Need help getting credentials?**
- Supabase: https://supabase.com/docs
- M-Pesa: https://sandbox.safaricom.co.ke/documentation

---

## Verification Steps

✅ **Step 1: Server Running**
- Terminal shows "Ready in X.Xs"

✅ **Step 2: Homepage Loads**
- Visit `http://localhost:3000`
- See homepage with features

✅ **Step 3: Database Connected**
- Visit `http://localhost:3000/api/health`
- See JSON response

✅ **Step 4: Navigation Works**
- Click buttons on homepage
- Links navigate correctly

✅ **Done!**
- Setup is complete
- Ready for development

---

## Getting Help

**Check these resources:**

1. **Setup issues** → `SETUP_GUIDE.md`
2. **Development tasks** → `IMPLEMENTATION_CHECKLIST.md`
3. **Project details** → `README.md`
4. **Phase summary** → `PHASE_1_SUMMARY.md`
5. **Supabase docs** → https://supabase.com/docs
6. **Next.js docs** → https://nextjs.org/docs

---

## Performance Tips

- Node modules slow? Try: `pnpm install --force`
- Build slow? Check Node version: `node --version` (use 18+)
- Database slow? Verify indexes in `001_create_schema.sql`

---

## Next Commands to Run

After setup completes:

```bash
# 1. Check if development server is running
# Terminal should show "Ready in X.Xs"

# 2. Open browser
# Visit http://localhost:3000

# 3. Look at the code
# Start in: app/page.js (homepage)

# 4. Ready to code?
# Check: IMPLEMENTATION_CHECKLIST.md
```

---

## Done! 🎉

Your Safe Hands Escrow platform is set up and ready to build!

**Timeline:**
- Setup: 5-10 minutes ✅
- Phase 2 (Auth): 2 weeks (next)
- Phase 3-8: 16 weeks total

**Start building Phase 2:**
- Signup/Login forms
- User profiles
- Dashboards

Check `IMPLEMENTATION_CHECKLIST.md` for detailed tasks.

**Happy coding!** 🚀

---

**Last Updated:** 2024
**Setup Time:** ~5 minutes
**Next Phase:** Authentication
