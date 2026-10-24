-- ==============================================================================
-- Subscription Management - Complete Supabase PostgreSQL Schema & Seed Data
-- ==============================================================================
-- Run this script in your Supabase Dashboard:
-- 1. Go to https://supabase.com/dashboard/project/giuftrigtoackyrfbacw/sql/new
-- 2. Paste this entire SQL file into the SQL Editor
-- 3. Click "RUN" (or Ctrl + Enter)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. SUBSCRIPTIONS TABLE (Core Frontend Table)
-- ==============================================================================
DROP TABLE IF EXISTS public.subscriptions CASCADE;

CREATE TABLE public.subscriptions (
  id TEXT PRIMARY KEY DEFAULT ('sub-' || extract(epoch from now())::bigint || '-' || floor(random() * 1000)::int),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  household_id UUID NULL,
  created_by UUID NULL,
  
  -- Core fields expected by Frontend (HouseholdContext.tsx)
  name TEXT NOT NULL,
  cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  amount NUMERIC(10, 2) GENERATED ALWAYS AS (cost) STORED,
  currency TEXT NOT NULL DEFAULT 'INR',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' | 'yearly' | 'quarterly'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused'
  
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_billing_date DATE NULL,
  renewal_date DATE GENERATED ALWAYS AS (next_billing_date) STORED,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- UI & Service Metadata
  service_url TEXT NULL,
  description TEXT NULL,
  plan_tier TEXT NULL,
  category_id TEXT NULL,
  category TEXT NULL,
  who_uses_it TEXT NOT NULL DEFAULT 'Everyone',
  monthly_cost NUMERIC(10, 2) NULL,
  payment_method TEXT NULL,
  autopay_state TEXT NOT NULL DEFAULT 'on', -- 'on' | 'review' | 'off'
  source TEXT NOT NULL DEFAULT 'receipt', -- 'receipt' | 'estimate' | 'manual'
  source_detail TEXT NULL,
  brand_letter TEXT NOT NULL DEFAULT 'S',
  brand_color TEXT NOT NULL DEFAULT '#6366F1',
  icon_image TEXT NULL,
  banner_image TEXT NULL,
  notify_before_days INTEGER NOT NULL DEFAULT 3,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Permissive policies for easy development & testing
DROP POLICY IF EXISTS "Allow select for all" ON public.subscriptions;
CREATE POLICY "Allow select for all" ON public.subscriptions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert for all" ON public.subscriptions;
CREATE POLICY "Allow insert for all" ON public.subscriptions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for all" ON public.subscriptions;
CREATE POLICY "Allow update for all" ON public.subscriptions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete for all" ON public.subscriptions;
CREATE POLICY "Allow delete for all" ON public.subscriptions FOR DELETE USING (true);

-- ==============================================================================
-- 3. LOGIN HISTORY TABLE (Backend Auth Audit)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.login_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select login_history" ON public.login_history;
CREATE POLICY "Allow select login_history" ON public.login_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert login_history" ON public.login_history;
CREATE POLICY "Allow insert login_history" ON public.login_history FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 4. PASSWORD RESET HISTORY TABLE (Backend Recovery Audit)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.password_reset_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('completed'))
);

ALTER TABLE public.password_reset_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select password_reset_history" ON public.password_reset_history;
CREATE POLICY "Allow select password_reset_history" ON public.password_reset_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert password_reset_history" ON public.password_reset_history;
CREATE POLICY "Allow insert password_reset_history" ON public.password_reset_history FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 5. RECEIVED & SENT EMAILS TABLE (Stores all Supabase Mails)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.received_emails (
  id TEXT PRIMARY KEY DEFAULT ('mail-' || extract(epoch from now())::bigint || '-' || floor(random() * 1000)::int),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  sender TEXT NOT NULL DEFAULT 'Supabase Auth <noreply@supabase.co>',
  subject TEXT NOT NULL,
  mail_type TEXT NOT NULL DEFAULT 'password_reset', -- 'password_reset' | 'subscription_reminder' | 'receipt_sync' | 'auth_notification'
  status TEXT NOT NULL DEFAULT 'delivered',
  provider TEXT NOT NULL DEFAULT 'supabase',
  body_preview TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.received_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select received_emails" ON public.received_emails;
CREATE POLICY "Allow select received_emails" ON public.received_emails FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert received_emails" ON public.received_emails;
CREATE POLICY "Allow insert received_emails" ON public.received_emails FOR INSERT WITH CHECK (true);

-- Initial record for Deepak's Supabase password reset email
INSERT INTO public.received_emails (
  recipient, sender, subject, mail_type, status, provider, body_preview
) VALUES (
  'deepakkumars170404@gmail.com',
  'Supabase Auth <noreply@supabase.co>',
  'Reset Your Password - Subscription Management',
  'password_reset',
  'delivered',
  'supabase',
  'Follow this link to reset your password directly on Subscription Management: http://localhost:3000/reset-password'
);

-- ==============================================================================
-- 6. SEED DATA FOR SUBSCRIPTION MANAGEMENT FRONTEND
-- ==============================================================================
INSERT INTO public.subscriptions (
  id, name, plan_tier, service_url, cost, monthly_cost, currency, billing_cycle,
  status, start_date, next_billing_date, auto_renew, who_uses_it, payment_method,
  autopay_state, source, source_detail, brand_letter, brand_color, icon_image,
  banner_image, notify_before_days, tags
) VALUES
(
  'sub-1', 'Netflix', 'Standard · Monthly', 'https://netflix.com', 649, 649, 'INR', 'monthly',
  'active', '2025-11-03', '2026-11-03', TRUE, 'Everyone', 'HDFC Card (•••• 4021)',
  'on', 'receipt', 'Netflix receipt · ₹649', 'N', '#E50914',
  'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
  'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=400&q=80',
  1, ARRAY['Streaming', 'Family']
),
(
  'sub-2', 'Spotify', 'Family · Monthly', 'https://spotify.com', 179, 179, 'INR', 'monthly',
  'active', '2025-11-09', '2026-11-09', TRUE, 'Deepak + family', 'UPI AutoPay',
  'on', 'receipt', 'Spotify receipt · ₹179', 'S', '#1DB954',
  'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
  1, ARRAY['Music', 'Family']
),
(
  'sub-3', 'Prime Video', 'Prime · Annual', 'https://primevideo.com', 1499, 125, 'INR', 'yearly',
  'active', '2025-08-20', '2026-08-20', TRUE, 'Everyone', 'Amazon Pay ICICI Card',
  'on', 'receipt', 'Amazon Prime · ₹1,499/yr', 'P', '#00A8E1',
  'https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png',
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=400&q=80',
  7, ARRAY['Entertainment', 'Shopping']
),
(
  'sub-4', 'Disney+ Hotstar', 'Super · Annual', 'https://hotstar.com', 899, 75, 'INR', 'yearly',
  'active', '2025-12-14', '2026-12-14', TRUE, 'Everyone', 'Paytm UPI',
  'on', 'receipt', 'Hotstar Annual · ₹899', 'D', '#123962',
  'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80',
  3, ARRAY['Streaming', 'Sports']
),
(
  'sub-5', 'YouTube Premium', 'Family · Monthly', 'https://youtube.com', 189, 189, 'INR', 'monthly',
  'active', '2025-10-18', '2026-10-18', TRUE, 'Deepak + family', 'Google Pay UPI',
  'on', 'receipt', 'YouTube receipt · ₹189', 'Y', '#FF0000',
  'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg',
  'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=400&q=80',
  1, ARRAY['Video', 'Ad-Free']
),
(
  'sub-6', 'Google One (100 GB)', 'Basic · Annual', 'https://one.google.com', 1300, 108, 'INR', 'yearly',
  'active', '2025-06-11', '2026-06-11', TRUE, 'Everyone', 'SBI Card (•••• 8820)',
  'on', 'receipt', 'Google storage · ₹1,300/yr', 'G', '#4285F4',
  'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80',
  7, ARRAY['Cloud Storage', 'Backup']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  cost = EXCLUDED.cost,
  currency = EXCLUDED.currency,
  billing_cycle = EXCLUDED.billing_cycle,
  next_billing_date = EXCLUDED.next_billing_date;

-- Output confirmation
SELECT 'Subscription Management Supabase schema successfully created!' as status, count(*) as seeded_subscriptions FROM public.subscriptions;
