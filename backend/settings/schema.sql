-- ==============================================================================
-- User Notification & Household Settings Schema for Supabase
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. User Notification Settings Table
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE
        REFERENCES auth.users(id) ON DELETE CASCADE,
    one_day_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    email_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    browser_push BOOLEAN NOT NULL DEFAULT FALSE,
    automatic_detection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_notification_settings
ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policy to prevent duplicate errors on re-run
DROP POLICY IF EXISTS "Users manage own notification settings"
ON public.user_notification_settings;

-- 4. Create RLS Policy (clean auth.uid() check without subquery issues)
CREATE POLICY "Users manage own notification settings"
ON public.user_notification_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Updated_at Trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_notification_settings_updated_at ON public.user_notification_settings;
CREATE TRIGGER set_user_notification_settings_updated_at
  BEFORE UPDATE ON public.user_notification_settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 6. Auto-provision default notification settings when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_notification_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_notification_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_notification_settings();

-- 7. Helper RPC: get or safely initialize notification settings
CREATE OR REPLACE FUNCTION public.get_or_create_notification_settings(p_user_id UUID)
RETURNS SETOF public.user_notification_settings AS $$
BEGIN
  INSERT INTO public.user_notification_settings (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT * FROM public.user_notification_settings WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
