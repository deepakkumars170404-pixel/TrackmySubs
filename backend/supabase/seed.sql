-- ==============================================================================
-- Kinfolk Family Household & Subscription Management Seed Data
-- ==============================================================================

-- 1. Create a Default Demo Household if not exists
insert into public.households (id, name, currency, monthly_budget)
values 
  ('11111111-1111-1111-1111-111111111111', 'Deepak & Family', 'INR', 5000)
on conflict (id) do nothing;

-- 2. Insert Household Members (matching Slide 7 & INITIAL_MEMBERS)
insert into public.household_members (
  id,
  household_id,
  full_name,
  email,
  role,
  status,
  avatar_initials,
  avatar_color,
  inbox_status,
  inbox_email,
  last_checked
) values
(
  '22222222-2222-2222-2222-222222222221',
  '11111111-1111-1111-1111-111111111111',
  'Deepak',
  'deepak@example.com',
  'owner',
  'active',
  'DP',
  'bg-[#184A39] text-white',
  'Gmail connected',
  'deepak@example.com',
  'Today · 9:41 AM'
),
(
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Priya',
  'priya@example.com',
  'member',
  'active',
  'PK',
  'bg-[#FEE2E2] text-[#991B1B]',
  'Outlook connected',
  'priya@example.com',
  'Yesterday'
),
(
  '22222222-2222-2222-2222-222222222223',
  '11111111-1111-1111-1111-111111111111',
  'Aarav',
  'aarav@example.com',
  'member',
  'active',
  'AK',
  'bg-[#E0E7FF] text-[#3730A3]',
  'Not connected',
  null,
  null
),
(
  '22222222-2222-2222-2222-222222222224',
  '11111111-1111-1111-1111-111111111111',
  'Sita',
  'sita@example.com',
  'member',
  'active',
  'SK',
  'bg-[#E7F2EA] text-[#184A39]',
  'Not connected',
  null,
  null
)
on conflict (id) do nothing;

-- 3. Insert Shared Plans (matching INITIAL_SHARED_PLANS)
insert into public.shared_plans (
  id,
  household_id,
  name,
  tier,
  monthly_cost,
  assigned_to,
  icon_bg_color,
  icon_initial
) values
(
  '33333333-3333-3333-3333-333333333331',
  '11111111-1111-1111-1111-111111111111',
  'Netflix',
  'Standard · Monthly',
  649,
  'Everyone',
  'bg-red-50 text-red-600 border border-red-100',
  'N'
),
(
  '33333333-3333-3333-3333-333333333332',
  '11111111-1111-1111-1111-111111111111',
  'Spotify',
  'Family · Monthly',
  179,
  'Deepak + family',
  'bg-emerald-50 text-emerald-700 border border-emerald-100',
  'S'
),
(
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Prime Video',
  'Prime · Annual',
  125,
  'Deepak & Priya',
  'bg-blue-50 text-blue-600 border border-blue-100',
  'P'
)
on conflict (id) do nothing;

-- 4. Insert Member Plan Shares
-- Netflix (649): Deepak (200), Priya (200), Aarav (125), Sita (124)
insert into public.plan_member_shares (plan_id, member_id, share_amount) values
('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221', 200),
('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 200),
('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222223', 125),
('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222224', 124),

-- Spotify (179): Deepak (60), Priya (60), Aarav (59)
('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222221', 60),
('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 60),
('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222223', 59),

-- Prime Video (125): Deepak (63), Priya (62)
('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222221', 63),
('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 62)
on conflict (plan_id, member_id) do update set share_amount = excluded.share_amount;
