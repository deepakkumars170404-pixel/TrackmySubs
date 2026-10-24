-- ==============================================================================
-- Subscription Management - Email & Receipt Auto-Detection Schema (Supabase)
-- ==============================================================================
-- Run this in your Supabase Dashboard:
-- 1. Go to https://supabase.com/dashboard/project/giuftrigtoackyrfbacw/sql/new
-- 2. Paste this script and click "RUN" (Ctrl + Enter)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Households Table (Required parent for email & family connections)
CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Deepak & family',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select households for all" ON public.households;
CREATE POLICY "Allow select households for all" ON public.households FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert households for all" ON public.households;
CREATE POLICY "Allow insert households for all" ON public.households FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update households for all" ON public.households;
CREATE POLICY "Allow update households for all" ON public.households FOR UPDATE USING (true);

-- Insert primary household for Deepak if none exists
INSERT INTO public.households (id, name, owner_id)
VALUES ('7a39acb9-9f08-42a0-863c-3f974abebd81', 'Deepak & family', '3b647ce4-af4d-46e6-99a8-ff2b05f3ce20')
ON CONFLICT (id) DO NOTHING;

-- 2. Connected Email Accounts Table (Stores Mailbox connections)
CREATE TABLE IF NOT EXISTS public.connected_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_address TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'Gmail',
  connected_by TEXT NOT NULL DEFAULT 'Deepak',
  status TEXT NOT NULL DEFAULT 'Connected',
  history_days_scanned INTEGER NOT NULL DEFAULT 30,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.connected_email_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on connected_email_accounts" ON public.connected_email_accounts;
CREATE POLICY "Allow all on connected_email_accounts" ON public.connected_email_accounts FOR ALL USING (true) WITH CHECK (true);

-- Secure view without tokens for frontend consumption
CREATE OR REPLACE VIEW public.connected_email_accounts_safe AS
  SELECT
    id,
    household_id,
    user_id,
    email_address,
    provider,
    connected_by,
    status,
    history_days_scanned,
    last_synced_at,
    connected_at,
    created_at,
    updated_at
  FROM public.connected_email_accounts;

-- 3. Detected Subscriptions Table (Receipts auto-detected from connected emails)
CREATE TABLE IF NOT EXISTS public.detected_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'Gmail',
  sender_email TEXT NOT NULL DEFAULT 'billing@netflix.com',
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'INR',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  detected_date DATE NOT NULL DEFAULT CURRENT_DATE,
  confidence NUMERIC(3, 2) NOT NULL DEFAULT 0.98,
  review_status TEXT NOT NULL DEFAULT 'Needs review', -- 'Needs review' | 'Added' | 'Dismissed'
  receipt_reference TEXT NULL,
  snippet TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.detected_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on detected_subscriptions" ON public.detected_subscriptions;
CREATE POLICY "Allow all on detected_subscriptions" ON public.detected_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- Seed initial connected email and detected receipts for Deepak
INSERT INTO public.connected_email_accounts (
  household_id, user_id, email_address, provider, connected_by, status
) VALUES (
  '7a39acb9-9f08-42a0-863c-3f974abebd81',
  '3b647ce4-af4d-46e6-99a8-ff2b05f3ce20',
  'deepakkumars170404@gmail.com',
  'Gmail',
  'Deepak',
  'Connected'
) ON CONFLICT DO NOTHING;

INSERT INTO public.detected_subscriptions (
  household_id, service_name, provider, sender_email, amount, currency, billing_cycle,
  detected_date, confidence, review_status, receipt_reference, snippet
) VALUES
(
  '7a39acb9-9f08-42a0-863c-3f974abebd81',
  'Netflix',
  'Gmail',
  'info@mailer.netflix.com',
  649.00,
  'INR',
  'monthly',
  CURRENT_DATE - INTERVAL '1 day',
  0.99,
  'Needs review',
  'NETFLIX-INV-84920',
  'Your monthly membership of ₹649 has been charged to your card ending in 4021.'
),
(
  '7a39acb9-9f08-42a0-863c-3f974abebd81',
  'Spotify',
  'Gmail',
  'no-reply@spotify.com',
  179.00,
  'INR',
  'monthly',
  CURRENT_DATE - INTERVAL '3 days',
  0.96,
  'Needs review',
  'SPOTIFY-REC-11029',
  'Thank you for subscribing to Spotify Premium Family. Next billing date: 09 Nov 2026.'
)
ON CONFLICT DO NOTHING;

SELECT 'Email & Auto-Detection Schema successfully created!' AS status;

