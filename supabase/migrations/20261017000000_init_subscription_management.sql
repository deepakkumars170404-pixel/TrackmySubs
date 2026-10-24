-- ==============================================================================
-- Kinfolk Household Subscription Management Database Schema
-- File: 20261017000000_init_subscription_management.sql
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 1. Helper Functions & Triggers
-- ==============================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ==============================================================================
-- 2. Households Table (Core ownership unit for Kinfolk)
-- owner_id is a UUID referencing auth.users(id)
-- ==============================================================================
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz default now() not null
);

-- Ensure columns exist if table was already created
alter table public.households add column if not exists name text not null default 'My Household';
alter table public.households add column if not exists owner_id uuid references auth.users(id);
alter table public.households add column if not exists created_at timestamptz default now();

-- ==============================================================================
-- 3. Family Members Table (Members belonging to a household)
-- user_id is a UUID referencing auth.users(id)
-- ==============================================================================
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  relationship text,
  created_at timestamptz default now() not null
);

-- Ensure columns exist if table was already created
alter table public.family_members add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.family_members add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.family_members add column if not exists full_name text not null default '';
alter table public.family_members add column if not exists email text;
alter table public.family_members add column if not exists relationship text;
alter table public.family_members add column if not exists created_at timestamptz default now();

-- ==============================================================================
-- 4. Household Access Helper Functions (Security Definer for RLS)
-- Type-safe UUID comparisons (h.owner_id = auth.uid(), fm.user_id = auth.uid())
-- ==============================================================================

-- Check if current authenticated user is a member of the given household
create or replace function public.is_household_member(h_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select case
    when (select auth.uid()) is null then false
    else exists (
      select 1 from public.households h
      where h.id = h_id and h.owner_id = (select auth.uid())
      union all
      select 1 from public.family_members fm
      where fm.household_id = h_id and fm.user_id = (select auth.uid())
    )
  end;
$$;

-- Check if current authenticated user is the owner of the given household
create or replace function public.is_household_owner(h_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select case
    when (select auth.uid()) is null then false
    else exists (
      select 1 from public.households h
      where h.id = h_id and h.owner_id = (select auth.uid())
    )
  end;
$$;

grant execute on function public.is_household_member(uuid) to authenticated, anon;
grant execute on function public.is_household_owner(uuid) to authenticated, anon;

-- ==============================================================================
-- 5. Subscriptions Table (Household-based)
-- Matches remote schema: household_id, name, provider, amount, currency,
-- billing_cycle, renewal_date, category, status, created_by (UUID)
-- ==============================================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  name text not null,
  provider text,
  amount numeric(12,2) default 0.00 not null,
  currency text default 'USD' not null,
  billing_cycle text default 'monthly' not null,
  renewal_date date,
  category text,
  status text default 'active' not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Ensure all columns exist if table was already created
alter table public.subscriptions add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.subscriptions add column if not exists name text;
alter table public.subscriptions add column if not exists provider text;
alter table public.subscriptions add column if not exists amount numeric(12,2) default 0.00;
alter table public.subscriptions add column if not exists currency text default 'USD';
alter table public.subscriptions add column if not exists billing_cycle text default 'monthly';
alter table public.subscriptions add column if not exists renewal_date date;
alter table public.subscriptions add column if not exists category text;
alter table public.subscriptions add column if not exists status text default 'active';
alter table public.subscriptions add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.subscriptions add column if not exists created_at timestamptz default now();
alter table public.subscriptions add column if not exists updated_at timestamptz default now();

-- Supporting optional columns for frontend compatibility
alter table public.subscriptions add column if not exists service_url text;
alter table public.subscriptions add column if not exists description text;
alter table public.subscriptions add column if not exists start_date date default current_date;
alter table public.subscriptions add column if not exists auto_renew boolean default true;
alter table public.subscriptions add column if not exists cancellation_date date;
alter table public.subscriptions add column if not exists payment_method text;
alter table public.subscriptions add column if not exists notify_before_days integer default 3;
alter table public.subscriptions add column if not exists tags text[] default array[]::text[];

-- ==============================================================================
-- 6. Profiles Table (Synced with Supabase Auth users)
-- ==============================================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  company_name text,
  currency text default 'USD' not null,
  monthly_budget numeric(12,2) default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists currency text default 'USD';
alter table public.profiles add column if not exists monthly_budget numeric(12,2) default 0;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- ==============================================================================
-- 7. Categories Table (User / Household scoped)
-- ==============================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text default '#6366f1',
  icon text default 'tag',
  created_at timestamptz default now() not null
);

alter table public.categories add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.categories add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.categories add column if not exists name text;
alter table public.categories add column if not exists color text default '#6366f1';
alter table public.categories add column if not exists icon text default 'tag';
alter table public.categories add column if not exists created_at timestamptz default now();

-- ==============================================================================
-- 8. Payment History / Invoices Table
-- ==============================================================================
create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  amount numeric(12,2) not null,
  currency text default 'USD' not null,
  billing_date date default current_date not null,
  status text default 'succeeded' not null,
  invoice_number text,
  receipt_url text,
  notes text,
  created_at timestamptz default now() not null
);

alter table public.payment_history add column if not exists subscription_id uuid references public.subscriptions(id) on delete cascade;
alter table public.payment_history add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.payment_history add column if not exists amount numeric(12,2);
alter table public.payment_history add column if not exists currency text default 'USD';
alter table public.payment_history add column if not exists billing_date date default current_date;
alter table public.payment_history add column if not exists status text default 'succeeded';
alter table public.payment_history add column if not exists invoice_number text;
alter table public.payment_history add column if not exists receipt_url text;
alter table public.payment_history add column if not exists notes text;
alter table public.payment_history add column if not exists created_at timestamptz default now();

-- ==============================================================================
-- 9. Alerts / Notifications Table
-- ==============================================================================
create table if not exists public.subscription_alerts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  alert_date date not null,
  title text not null,
  message text not null,
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

alter table public.subscription_alerts add column if not exists subscription_id uuid references public.subscriptions(id) on delete cascade;
alter table public.subscription_alerts add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.subscription_alerts add column if not exists alert_date date;
alter table public.subscription_alerts add column if not exists title text;
alter table public.subscription_alerts add column if not exists message text;
alter table public.subscription_alerts add column if not exists is_read boolean default false;
alter table public.subscription_alerts add column if not exists created_at timestamptz default now();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.households enable row level security;
alter table public.family_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.payment_history enable row level security;
alter table public.subscription_alerts enable row level security;

-- ------------------------------------------------------------------------------
-- Households RLS (UUID = UUID comparisons)
-- ------------------------------------------------------------------------------
drop policy if exists "Household members can view household" on public.households;
create policy "Household members can view household"
  on public.households for select
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.family_members fm
      where fm.household_id = id and fm.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can create household" on public.households;
create policy "Users can create household"
  on public.households for insert
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can update household" on public.households;
create policy "Owners can update household"
  on public.households for update
  using (owner_id = (select auth.uid()));

drop policy if exists "Owners can delete household" on public.households;
create policy "Owners can delete household"
  on public.households for delete
  using (owner_id = (select auth.uid()));

-- ------------------------------------------------------------------------------
-- Family Members RLS (UUID = UUID comparisons)
-- ------------------------------------------------------------------------------
drop policy if exists "Household members can view family members" on public.family_members;
create policy "Household members can view family members"
  on public.family_members for select
  using (public.is_household_member(household_id));

drop policy if exists "Household members can insert family members" on public.family_members;
create policy "Household members can insert family members"
  on public.family_members for insert
  with check (public.is_household_member(household_id));

drop policy if exists "Household members can update family members" on public.family_members;
create policy "Household members can update family members"
  on public.family_members for update
  using (public.is_household_member(household_id));

drop policy if exists "Household owners or self can delete family members" on public.family_members;
create policy "Household owners or self can delete family members"
  on public.family_members for delete
  using (
    public.is_household_owner(household_id)
    or user_id = (select auth.uid())
  );

-- ------------------------------------------------------------------------------
-- Subscriptions RLS (Household-based)
-- ------------------------------------------------------------------------------
drop policy if exists "Users can view own subscriptions" on public.subscriptions;
drop policy if exists "Users can insert own subscriptions" on public.subscriptions;
drop policy if exists "Users can update own subscriptions" on public.subscriptions;
drop policy if exists "Users can delete own subscriptions" on public.subscriptions;

drop policy if exists "Household members can view subscriptions" on public.subscriptions;
create policy "Household members can view subscriptions"
  on public.subscriptions for select
  using (public.is_household_member(household_id));

drop policy if exists "Household members can insert subscriptions" on public.subscriptions;
create policy "Household members can insert subscriptions"
  on public.subscriptions for insert
  with check (public.is_household_member(household_id));

drop policy if exists "Household members can update subscriptions" on public.subscriptions;
create policy "Household members can update subscriptions"
  on public.subscriptions for update
  using (public.is_household_member(household_id));

drop policy if exists "Household members can delete subscriptions" on public.subscriptions;
create policy "Household members can delete subscriptions"
  on public.subscriptions for delete
  using (public.is_household_member(household_id));

-- ------------------------------------------------------------------------------
-- Profiles RLS (UUID = UUID comparisons)
-- ------------------------------------------------------------------------------
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id);

-- ------------------------------------------------------------------------------
-- Categories RLS (UUID = UUID comparisons)
-- ------------------------------------------------------------------------------
drop policy if exists "Users can view own categories" on public.categories;
create policy "Users can view own categories"
  on public.categories for select
  using (
    user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  );

drop policy if exists "Users can insert own categories" on public.categories;
create policy "Users can insert own categories"
  on public.categories for insert
  with check (
    user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  );

drop policy if exists "Users can update own categories" on public.categories;
create policy "Users can update own categories"
  on public.categories for update
  using (
    user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  );

drop policy if exists "Users can delete own categories" on public.categories;
create policy "Users can delete own categories"
  on public.categories for delete
  using (
    user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  );

-- ------------------------------------------------------------------------------
-- Payment History RLS (UUID = UUID comparisons)
-- ------------------------------------------------------------------------------
drop policy if exists "Users can view own payments" on public.payment_history;
create policy "Users can view own payments"
  on public.payment_history for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.subscriptions s
      where s.id = payment_history.subscription_id
        and public.is_household_member(s.household_id)
    )
  );

drop policy if exists "Users can insert own payments" on public.payment_history;
create policy "Users can insert own payments"
  on public.payment_history for insert
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.subscriptions s
      where s.id = payment_history.subscription_id
        and public.is_household_member(s.household_id)
    )
  );

drop policy if exists "Users can update own payments" on public.payment_history;
create policy "Users can update own payments"
  on public.payment_history for update
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.subscriptions s
      where s.id = payment_history.subscription_id
        and public.is_household_member(s.household_id)
    )
  );

drop policy if exists "Users can delete own payments" on public.payment_history;
create policy "Users can delete own payments"
  on public.payment_history for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.subscriptions s
      where s.id = payment_history.subscription_id
        and public.is_household_member(s.household_id)
    )
  );

-- ------------------------------------------------------------------------------
-- Subscription Alerts RLS (UUID = UUID comparisons)
-- ------------------------------------------------------------------------------
drop policy if exists "Users can view own alerts" on public.subscription_alerts;
create policy "Users can view own alerts"
  on public.subscription_alerts for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.subscriptions s
      where s.id = subscription_alerts.subscription_id
        and public.is_household_member(s.household_id)
    )
  );

drop policy if exists "Users can update own alerts" on public.subscription_alerts;
create policy "Users can update own alerts"
  on public.subscription_alerts for update
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.subscriptions s
      where s.id = subscription_alerts.subscription_id
        and public.is_household_member(s.household_id)
    )
  );

drop policy if exists "Users can delete own alerts" on public.subscription_alerts;
create policy "Users can delete own alerts"
  on public.subscription_alerts for delete
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.subscriptions s
      where s.id = subscription_alerts.subscription_id
        and public.is_household_member(s.household_id)
    )
  );

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at triggers
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.handle_updated_at();
