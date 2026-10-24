# 🚀 TrackMySubs (Advanced Subscription Management Platform)

A comprehensive, executive-grade full-stack Subscription Management and Household Shared Plans SaaS platform with separate **Frontend** and **Backend** directories.

Built with **Next.js 16 (App Router + Turbopack)**, **Tailwind CSS**, **Node.js/Express (TypeScript)**, **Supabase (PostgreSQL + RLS Auth)**, **IMAP Email Receipt Scanner**, and **W3C WebPush & FCM Background Scheduler**.

---

## 🛠️ Complete Tech Stack & Tools Used

| Tier | Technology / Tool | Purpose / Capability |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16.4.2** (Turbopack) | Modern React 19 App Router with Partial Prefetching and zero-bundle server components. |
| **Styling & Design System** | **Tailwind CSS v4** + Executive UI | High-end gradient hero styling, `KinCard`, `KinButton`, `KinBadge`, custom theme primitives. |
| **Icons & Brand Graphics** | **Lucide React** + `logoHelper.tsx` | 60+ official vector SVG brand logos (Netflix, Spotify, AWS, GitHub, Disney+, Prime, Claude, ChatGPT, etc.). |
| **Backend API** | **Express.js 5** (TypeScript) | High-performance RESTful microservices for Auth, Subscriptions, Household, and Mailbox sync. |
| **Cloud Database & Auth** | **Supabase PostgreSQL** | 100% unlimited, free cloud data storage with Row-Level Security (RLS) and encrypted session tokens. |
| **Mailbox Receipt Scanner** | **IMAP Simple** + **Mailparser** | Automated background sync checking incoming Gmail / Outlook invoices and extracting billing dates & costs. |
| **Push Notifications** | **W3C WebPush (VAPID)** + **Firebase FCM** | Cross-platform renewal reminders sent directly to mobile and desktop browsers 3 days before renewal. |
| **Transactional Email / OTP**| **Nodemailer SMTP** | High-deliverability 6-digit numeric OTP delivery for instant, live password resets. |

---

## 📁 Project Structure

```text
D:\new subscription\
├── frontend/                     # Next.js 16 App Router (React 19, Tailwind CSS)
│   ├── src/
│   │   ├── app/                 # 13 pre-rendered routes (overview, subscriptions, calendar, family, login, reset-password, settings, autodetect)
│   │   ├── components/          # Executive UI components, modals, and charts
│   │   ├── context/             # HouseholdContext state manager
│   │   ├── lib/                 # Logo helpers, date calculator, WebPush/FCM clients, Supabase driver
│   │   └── types/               # TypeScript data definitions
│   ├── public/                  # Static assets & icons
│   ├── .env.local               # Frontend environment configurations
│   └── package.json
│
├── backend/                      # Production Express & TypeScript Backend
│   ├── controllers/             # Auth, Family, Inbox, and Notification controllers
│   ├── routes/                  # Express API route endpoints (/api/auth, /api/household, /api/inbox, /api/notifications)
│   ├── services/                # IMAP email listener, FCM scheduler, WebPush notifier
│   ├── middleware/              # Auth verification & express-rate-limit protection
│   ├── supabase/                # Complete SQL migrations and table schemas
│   ├── .env                     # Supabase URL, Service Keys, IMAP & SMTP credentials
│   └── server.js                # Primary backend server daemon
│
└── README.md
```

---

## 🌟 Key Advanced Features & Verified Conditions

1. **Family Hub Starts with 0 Dummy Members**:
   - Zero hardcoded mock family members. Only actual members created or invited by the user appear in the household roster and spend calculations.
2. **Strict "Continue with Google" Authentication**:
   - Strictly checks if the email is registered in Supabase.
   - Non-registered or fake emails are securely rejected with:
     `"No account found with <email>. Please enter your correct registered email address or click 'Create an account'."`
   - Real registered Google emails log in seamlessly.
3. **Guaranteed 6-Digit Numeric OTP Password Reset**:
   - Forgot Password sends a guaranteed 6-digit numeric OTP directly to the user's inbox via custom SMTP.
   - Password reset links point to the live domain (`https://trackmy-subs.vercel.app/reset-password`), eliminating mobile `localhost:3000` redirect errors.
4. **Interactive Spend Forecast & Category Breakdown**:
   - Real-time visual spend trend chart with interactive actual vs forecast projections.
   - Category distribution bar illustrating percentage breakdown across Entertainment, Productivity, AI, Utilities, and Cloud.
5. **CSV Ledger Export & Bulk Import**:
   - One-click CSV download of active household subscriptions.
   - Bulk CSV import for migrating 20+ subscriptions simultaneously.
6. **IMAP Receipt Auto-Detection**:
   - Live scanning of connected email inboxes to detect renewal receipts and keep subscription dates synced automatically.

---

## ⚡ Quick Start Guide

### 1. Start the Backend Server (Port 5000)

```powershell
cd "D:\new subscription\backend"
npm run dev
```
> The backend boots on `http://localhost:5000` with the Supabase client, IMAP listener, WebPush VAPID, and FCM renewal schedulers active.

### 2. Start the Frontend Application (Port 3000)

```powershell
cd "D:\new subscription\frontend"
npm run dev
```
> The frontend launches on `http://localhost:3000` with Turbopack fast-refresh enabled.

### 3. Build for Production

```powershell
# Frontend production build:
cd "D:\new subscription\frontend"
npm run build

# Backend TypeScript compilation:
cd "D:\new subscription\backend"
npm run build
```

---

## 🔒 100% Free & Unlimited Usage

All services utilize open-source frameworks and free-tier infrastructure:
- **Supabase**: Free PostgreSQL database with unlimited queries and native Row Level Security.
- **Nodemailer SMTP**: Direct mail delivery with zero per-email pricing paywalls.
- **W3C WebPush**: Standards-compliant web push notifications directly via browser service workers.
