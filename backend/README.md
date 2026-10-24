# 🚀 Kinfolk Subscription Management Backend

Production-ready backend built with **Node.js, Express, TypeScript / ES Modules**, and **Supabase (PostgreSQL, Row Level Security, Auth)** to power the Kinfolk Subscription Management system (`SubscriptionsView`, `FamilyView`, `CalendarView`, `AutoDetectView`, `InviteMemberModal`).

---

## 📁 Backend Folder Structure

```
backend/
├── .env                         # Local environment configuration
├── .env.example                 # Environment variables template
├── package.json                 # Node.js dependencies and scripts
├── tsconfig.json                # TypeScript compiler configuration
├── server.js                    # Core API entry (Auth, Settings, Subscriptions & Webhooks)
├── README.md                    # Setup and API documentation
│
├── controllers/                 # Express controllers (authController, householdController)
├── routes/                      # Route modules (authRoutes, householdRoutes)
├── middleware/                  # Auth and validation middleware
│
├── services/                    # Background & communication services
│   ├── emailService.js          # SMTP & Resend email dispatcher
│
├── supabase/                    # Supabase database layer
│   ├── migrations/
│   │   ├── 20261017000000_init_subscription_management.sql # Core subscriptions & profiles
│   │   └── 20261021000000_family_household_management.sql  # Households, members & shared plans
│   └── seed.sql                 # Seed data (Deepak, Priya, Aarav, Sita, shared plans)
│
└── src/                         # Application source code
    ├── server.ts                # Root HTTP entry bridge
    └── family/                  # Self-contained Family module
        ├── server.ts            # Express app setup, CORS, Helmet & HTTP listener
        ├── config.ts            # Environment configuration & Supabase client factory
        ├── types.ts             # TypeScript data contracts & Express request extensions
        ├── middleware.ts        # Supabase JWT Auth, Zod validation & centralized error handler
        ├── family.routes.ts     # /api/family endpoints & Zod input validation schemas
        ├── family.service.ts    # Business logic, share calculations & Supabase DB queries
        └── index.ts             # Module exports
```

---

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in your Supabase project keys:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Database Migrations
In your Supabase Dashboard **SQL Editor**, execute the migration files in order:
1. `supabase/migrations/20261017000000_init_subscription_management.sql`
2. `supabase/migrations/20261021000000_family_household_management.sql`
3. (Optional) Run `supabase/seed.sql` to seed initial demo members and plans.
*(Alternatively, execute `supabase_tables.sql` for an all-in-one schema setup).*

### 4. Start the Development Server
```bash
npm run dev
```

Main API starts at: `http://localhost:5000`

---

## 📡 API Reference

### 1. Authentication & Recovery (Supabase + Custom SMTP)
- `POST /api/auth/login` - Sign in with email and password
- `POST /api/auth/signup` - Register a new account
- `POST /api/auth/forgot-password` - Generate recovery link & deliver OTP via custom SMTP
- `POST /api/auth/verify-otp` - Verify 8-digit OTP code before setting new password
- `POST /api/auth/reset-password` - Set and confirm new password
- `GET /api/auth/login-history` - Authenticated user login audit trail
- `GET /api/health` - Health check endpoint

### 2. Anonymous Sessions & Household Subscription API
- `POST /api/session/anonymous` - Creates an anonymous Supabase session token
- `POST /api/session/refresh` - Refreshes expired session tokens
- `GET /api/households/me` - Read current household and family members
- `POST /api/households` - Create a household
- `POST /api/households/join` - Join a household with invite code
- `GET /api/households/:id/subscriptions` - List household subscriptions
- `POST /api/households/:id/subscriptions` - Add household subscription
- `PATCH /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription

### 3. Family Module Endpoints
- `GET /api/family/members` - Household members, plan count, monthly share, and inbox status
- `GET /api/family/shared-plans` - Shared family subscriptions, tiers, and member allocations
- `POST /api/family/invite` - Invite or add a new family member
- `GET /api/family/overview` - Combined household, member, and shared plan overview

### 5. Settings & Preferences
- `GET /api/settings` - Retrieve user notification and auto-tracking settings
- `POST /api/settings` - Upsert user notification and renewal reminder preferences

---

## 🔒 Security & Row Level Security (RLS)
- **JWT Authentication**: Verifies tokens against `auth.users` via Supabase.
- **Row Level Security**: Policies restrict data access so that users can only view and manage records within their authorized household.
- **Input Validation**: Strictly validated using Zod schemas with descriptive error responses.
