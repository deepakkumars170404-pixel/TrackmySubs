-- ==============================================================================
-- Kinfolk Gmail Integration & Detected Subscriptions Migration
-- File: 20261021000000_add_gmail_and_detected_subscriptions.sql
-- ==============================================================================

-- ==============================================================================
-- 1. Connected Email Accounts Table (Existing remote table)
-- Stores OAuth tokens securely on the server per household / user
-- user_id is a UUID referencing auth.users(id)
-- ==============================================================================
create table if not exists public.connected_email_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email_address text not null,
  provider text default 'Gmail' not null,
  access_token text,
  refresh_token text,
  connected_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Ensure non-destructive auxiliary columns exist for token lifecycle management
alter table public.connected_email_accounts add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.connected_email_accounts add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.connected_email_accounts add column if not exists email_address text;
alter table public.connected_email_accounts add column if not exists provider text default 'Gmail';
alter table public.connected_email_accounts add column if not exists access_token text;
alter table public.connected_email_accounts add column if not exists refresh_token text;
alter table public.connected_email_accounts add column if not exists connected_at timestamptz default now();
alter table public.connected_email_accounts add column if not exists created_at timestamptz default now();
alter table public.connected_email_accounts add column if not exists expires_at timestamptz;
alter table public.connected_email_accounts add column if not exists scope text;
alter table public.connected_email_accounts add column if not exists last_synced_at timestamptz;
alter table public.connected_email_accounts add column if not exists updated_at timestamptz default now();

-- Unique constraint per household and email address (rerun-safe)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'connected_email_accounts_household_email_key'
  ) then
    alter table public.connected_email_accounts
      add constraint connected_email_accounts_household_email_key
      unique (household_id, email_address);
  end if;
end $$;

-- Enable RLS on connected_email_accounts
alter table public.connected_email_accounts enable row level security;

-- ------------------------------------------------------------------------------
-- CRITICAL TOKEN SECURITY (Requirement 4, 10, 11):
-- 1. Revoke table-level access from anon and authenticated roles
-- 2. Grant column-level SELECT ONLY on safe, non-sensitive columns
-- 3. access_token and refresh_token are NEVER granted to frontend roles
-- ------------------------------------------------------------------------------
revoke all on public.connected_email_accounts from anon, authenticated;

grant select (
  id,
  household_id,
  user_id,
  email_address,
  provider,
  connected_at,
  expires_at,
  scope,
  last_synced_at,
  created_at,
  updated_at
) on public.connected_email_accounts to authenticated;

-- Allow authenticated users to disconnect (delete) their connected account
grant delete on public.connected_email_accounts to authenticated;

-- Ensure service_role (Edge Functions) has full access
grant all on public.connected_email_accounts to service_role;

-- Row Level Security policies on connected_email_accounts (UUID = UUID comparisons)
drop policy if exists "Household members can view connected email accounts" on public.connected_email_accounts;
create policy "Household members can view connected email accounts"
  on public.connected_email_accounts for select
  using (
    user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  );

drop policy if exists "Household members can delete connected email accounts" on public.connected_email_accounts;
create policy "Household members can delete connected email accounts"
  on public.connected_email_accounts for delete
  using (
    user_id = (select auth.uid())
    or (household_id is not null and public.is_household_owner(household_id))
  );

-- Secure view exposing only non-sensitive connection details to frontend
create or replace view public.connected_email_accounts_safe
with (security_invoker = on) as
  select
    id,
    household_id,
    user_id,
    email_address,
    provider,
    connected_at,
    expires_at,
    scope,
    last_synced_at,
    created_at,
    updated_at
  from public.connected_email_accounts;

grant select on public.connected_email_accounts_safe to authenticated;

-- ==============================================================================
-- 2. Detected Subscriptions Table (Existing remote table)
-- Stores subscription receipts detected from Gmail per household
-- ==============================================================================
create table if not exists public.detected_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  message_id text not null,
  provider text default 'Gmail' not null,
  service_name text not null,
  amount numeric(12,2) default 0.00,
  currency text default 'USD',
  renewal_date date,
  confidence numeric default 1.0,
  review_status text default 'Needs review' not null,
  receipt_reference text,
  created_at timestamptz default now() not null
);

-- Ensure non-destructive auxiliary columns exist
alter table public.detected_subscriptions add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.detected_subscriptions add column if not exists message_id text;
alter table public.detected_subscriptions add column if not exists provider text default 'Gmail';
alter table public.detected_subscriptions add column if not exists service_name text;
alter table public.detected_subscriptions add column if not exists amount numeric(12,2) default 0.00;
alter table public.detected_subscriptions add column if not exists currency text default 'USD';
alter table public.detected_subscriptions add column if not exists renewal_date date;
alter table public.detected_subscriptions add column if not exists confidence numeric default 1.0;
alter table public.detected_subscriptions add column if not exists review_status text default 'Needs review';
alter table public.detected_subscriptions add column if not exists receipt_reference text;
alter table public.detected_subscriptions add column if not exists created_at timestamptz default now();
alter table public.detected_subscriptions add column if not exists evidence_snippet text;
alter table public.detected_subscriptions add column if not exists raw_payload jsonb default '{}'::jsonb;
alter table public.detected_subscriptions add column if not exists updated_at timestamptz default now();

-- Unique constraint for deduplication (matches remote constraint)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'detected_subscriptions_household_id_provider_message_id_key'
  ) then
    alter table public.detected_subscriptions
      add constraint detected_subscriptions_household_id_provider_message_id_key
      unique (household_id, provider, message_id);
  end if;
end $$;

-- Enable RLS on detected_subscriptions
alter table public.detected_subscriptions enable row level security;

-- Grant permissions on detected_subscriptions
grant select, insert, update, delete on public.detected_subscriptions to authenticated;
grant all on public.detected_subscriptions to service_role;

-- Household-scoped RLS policies on detected_subscriptions
drop policy if exists "Household members can view detected subscriptions" on public.detected_subscriptions;
create policy "Household members can view detected subscriptions"
  on public.detected_subscriptions for select
  using (public.is_household_member(household_id));

drop policy if exists "Household members can insert detected subscriptions" on public.detected_subscriptions;
create policy "Household members can insert detected subscriptions"
  on public.detected_subscriptions for insert
  with check (public.is_household_member(household_id));

drop policy if exists "Household members can update detected subscriptions" on public.detected_subscriptions;
create policy "Household members can update detected subscriptions"
  on public.detected_subscriptions for update
  using (public.is_household_member(household_id));

drop policy if exists "Household members can delete detected subscriptions" on public.detected_subscriptions;
create policy "Household members can delete detected subscriptions"
  on public.detected_subscriptions for delete
  using (public.is_household_member(household_id));

-- Updated_at triggers
drop trigger if exists set_connected_email_accounts_updated_at on public.connected_email_accounts;
create trigger set_connected_email_accounts_updated_at
  before update on public.connected_email_accounts
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_detected_subscriptions_updated_at on public.detected_subscriptions;
create trigger set_detected_subscriptions_updated_at
  before update on public.detected_subscriptions
  for each row execute procedure public.handle_updated_at();
