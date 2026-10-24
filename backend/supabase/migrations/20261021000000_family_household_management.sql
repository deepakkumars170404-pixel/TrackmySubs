-- ==============================================================================
-- Kinfolk Family & Household Management Schema
-- Migration: 20261021000000_family_household_management.sql
-- Supports: FamilyView & InviteMemberModal
-- ==============================================================================

-- 1. Create Enums if they do not exist
do $$
begin
  if not exists (select 1 from pg_type where typname = 'household_role') then
    create type public.household_role as enum ('owner', 'member');
  end if;

  if not exists (select 1 from pg_type where typname = 'household_member_status') then
    create type public.household_member_status as enum ('active', 'invited', 'inactive');
  end if;
end $$;

-- 2. Households Table
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Household',
  currency text not null default 'INR',
  monthly_budget numeric(12,2) default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Household Members Table
create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  role public.household_role not null default 'member',
  status public.household_member_status not null default 'active',
  avatar_initials text not null,
  avatar_color text not null default 'bg-[#E7F2EA] text-[#184A39]',
  inbox_status text not null default 'Not connected',
  inbox_email text,
  last_checked text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Shared Plans Table
create table if not exists public.shared_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  name text not null,
  tier text not null default 'Standard · Monthly',
  monthly_cost numeric(12,2) not null default 0,
  assigned_to text not null default 'Everyone',
  icon_bg_color text not null default 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  icon_initial text not null default 'S',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Plan Member Shares (Mapping table for individual plan cost distribution)
create table if not exists public.plan_member_shares (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.shared_plans(id) on delete cascade not null,
  member_id uuid references public.household_members(id) on delete cascade not null,
  share_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (plan_id, member_id)
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
create index if not exists idx_household_members_household_id on public.household_members(household_id);
create index if not exists idx_household_members_user_id on public.household_members(user_id);
create index if not exists idx_household_members_email on public.household_members(email);
create index if not exists idx_shared_plans_household_id on public.shared_plans(household_id);
create index if not exists idx_plan_member_shares_plan_id on public.plan_member_shares(plan_id);
create index if not exists idx_plan_member_shares_member_id on public.plan_member_shares(member_id);

-- ==============================================================================
-- TRIGGERS FOR updated_at
-- ==============================================================================
create trigger set_households_updated_at
  before update on public.households
  for each row execute procedure public.handle_updated_at();

create trigger set_household_members_updated_at
  before update on public.household_members
  for each row execute procedure public.handle_updated_at();

create trigger set_shared_plans_updated_at
  before update on public.shared_plans
  for each row execute procedure public.handle_updated_at();

-- ==============================================================================
-- RLS HELPER FUNCTIONS (avoid recursive policy checks)
-- ==============================================================================
create or replace function public.is_household_member(h_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 
    from public.household_members 
    where household_id = h_id 
      and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_household_owner(h_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 
    from public.household_members 
    where household_id = h_id 
      and user_id = auth.uid() 
      and role = 'owner'
  );
end;
$$ language plpgsql security definer;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.shared_plans enable row level security;
alter table public.plan_member_shares enable row level security;

-- Households policies
create policy "Members can view their own household"
  on public.households for select
  using (public.is_household_member(id) or created_by = auth.uid());

create policy "Users can create households"
  on public.households for insert
  with check (auth.uid() = created_by);

create policy "Owners can update their household"
  on public.households for update
  using (public.is_household_owner(id) or created_by = auth.uid());

create policy "Owners can delete their household"
  on public.households for delete
  using (public.is_household_owner(id) or created_by = auth.uid());

-- Household Members policies
create policy "Members can view other members in same household"
  on public.household_members for select
  using (public.is_household_member(household_id));

create policy "Owners can invite or insert members"
  on public.household_members for insert
  with check (public.is_household_owner(household_id) or not exists (
    select 1 from public.household_members where household_id = household_members.household_id
  ));

create policy "Owners or member self can update member info"
  on public.household_members for update
  using (public.is_household_owner(household_id) or user_id = auth.uid());

create policy "Owners can delete members"
  on public.household_members for delete
  using (public.is_household_owner(household_id));

-- Shared Plans policies
create policy "Members can view shared plans"
  on public.shared_plans for select
  using (public.is_household_member(household_id));

create policy "Members can insert shared plans"
  on public.shared_plans for insert
  with check (public.is_household_member(household_id));

create policy "Members can update shared plans"
  on public.shared_plans for update
  using (public.is_household_member(household_id));

create policy "Owners can delete shared plans"
  on public.shared_plans for delete
  using (public.is_household_owner(household_id));

-- Plan Member Shares policies
create policy "Members can view plan shares"
  on public.plan_member_shares for select
  using (
    exists (
      select 1 from public.shared_plans sp
      where sp.id = plan_member_shares.plan_id
        and public.is_household_member(sp.household_id)
    )
  );

create policy "Members can manage plan shares"
  on public.plan_member_shares for all
  using (
    exists (
      select 1 from public.shared_plans sp
      where sp.id = plan_member_shares.plan_id
        and public.is_household_member(sp.household_id)
    )
  );

