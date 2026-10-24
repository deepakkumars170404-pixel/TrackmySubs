-- Run this in Supabase Dashboard -> SQL Editor -> New query.
-- These tables store event timestamps only. Never store passwords or OTP codes.
CREATE TABLE IF NOT EXISTS public.login_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own login history" ON public.login_history;
CREATE POLICY "Users can read their own login history"
ON public.login_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.password_reset_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('completed'))
);

ALTER TABLE public.password_reset_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own password reset history" ON public.password_reset_history;
CREATE POLICY "Users can read their own password reset history"
ON public.password_reset_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Backend uses the server-only service role to insert rows. Do not expose that key in frontend.

-- Household subscription data. Apply this file in the Supabase SQL Editor.
CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  invite_code UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 80),
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  plan TEXT NOT NULL DEFAULT '',
  assigned_to TEXT NOT NULL DEFAULT 'Everyone',
  cost NUMERIC(12, 2) NOT NULL CHECK (cost >= 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency ~ '^[A-Z]{3}$'),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_renewal DATE NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'needs_review')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'receipt')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_household_renewal_idx
  ON public.subscriptions (household_id, next_renewal);
CREATE INDEX IF NOT EXISTS household_members_user_idx
  ON public.household_members (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS household_members_one_household_per_user_idx
  ON public.household_members (user_id);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.households TO authenticated;
GRANT SELECT ON public.household_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;

CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.household_id = p_household_id
      AND hm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_owner(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.household_id = p_household_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'owner'
  );
$$;

DROP POLICY IF EXISTS "Household members can read their households" ON public.households;
CREATE POLICY "Household members can read their households"
ON public.households FOR SELECT TO authenticated
USING (public.is_household_member(id));

DROP POLICY IF EXISTS "Household owners can update their households" ON public.households;
CREATE POLICY "Household owners can update their households"
ON public.households FOR UPDATE TO authenticated
USING (public.is_household_owner(id))
WITH CHECK (public.is_household_owner(id));

DROP POLICY IF EXISTS "Household members can read their membership" ON public.household_members;
CREATE POLICY "Household members can read their membership"
ON public.household_members FOR SELECT TO authenticated
USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can read subscriptions" ON public.subscriptions;
CREATE POLICY "Household members can read subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can add subscriptions" ON public.subscriptions;
CREATE POLICY "Household members can add subscriptions"
ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.is_household_member(household_id)
);

DROP POLICY IF EXISTS "Household members can update subscriptions" ON public.subscriptions;
CREATE POLICY "Household members can update subscriptions"
ON public.subscriptions FOR UPDATE TO authenticated
USING (public.is_household_member(household_id))
WITH CHECK (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can delete subscriptions" ON public.subscriptions;
CREATE POLICY "Household members can delete subscriptions"
ON public.subscriptions FOR DELETE TO authenticated
USING (public.is_household_member(household_id));

CREATE OR REPLACE FUNCTION public.create_household(p_name TEXT, p_display_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  new_household_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;
  IF char_length(trim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Household name must be between 1 and 80 characters.';
  END IF;
  IF char_length(trim(coalesce(p_display_name, ''))) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Your name must be between 1 and 80 characters.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.household_members hm WHERE hm.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Your account already belongs to a household.';
  END IF;

  INSERT INTO public.households (name, created_by)
  VALUES (trim(p_name), current_user_id)
  RETURNING id INTO new_household_id;

  INSERT INTO public.household_members (household_id, user_id, display_name, role)
  VALUES (new_household_id, current_user_id, trim(p_display_name), 'owner');

  RETURN new_household_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_household(p_invite_code UUID, p_display_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  target_household_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;
  IF char_length(trim(coalesce(p_display_name, ''))) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Your name must be between 1 and 80 characters.';
  END IF;

  SELECT id INTO target_household_id
  FROM public.households
  WHERE invite_code = p_invite_code;

  IF target_household_id IS NULL THEN
    RAISE EXCEPTION 'That household invite code is invalid.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.user_id = current_user_id
      AND hm.household_id <> target_household_id
  ) THEN
    RAISE EXCEPTION 'Your account already belongs to a household.';
  END IF;

  INSERT INTO public.household_members (household_id, user_id, display_name, role)
  VALUES (target_household_id, current_user_id, trim(p_display_name), 'member')
  ON CONFLICT (household_id, user_id) DO NOTHING;

  RETURN target_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_household(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_household(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_household_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_household_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_household(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_household(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_owner(UUID) TO authenticated;
