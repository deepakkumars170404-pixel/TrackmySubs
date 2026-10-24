import { SupabaseClient } from '@supabase/supabase-js';

// Enums matching database types
export type DbHouseholdRole = 'owner' | 'member';
export type FrontendHouseholdRole = 'Owner' | 'Member';
export type HouseholdMemberStatus = 'active' | 'invited' | 'inactive' | 'pending';
export type InboxStatus = 'Gmail connected' | 'Outlook connected' | 'Not connected' | 'Pending Acceptance';

// Database Models
export interface HouseholdRecord {
  id: string;
  name: string;
  currency: string;
  monthly_budget: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMemberRecord {
  id: string;
  household_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  role: DbHouseholdRole;
  status: HouseholdMemberStatus;
  avatar_initials: string;
  avatar_color: string;
  inbox_status: string;
  inbox_email: string | null;
  last_checked: string | null;
  created_at: string;
  updated_at: string;
}

export interface SharedPlanRecord {
  id: string;
  household_id: string;
  subscription_id: string | null;
  name: string;
  tier: string;
  monthly_cost: number;
  assigned_to: string;
  icon_bg_color: string;
  icon_initial: string;
  created_at: string;
  updated_at: string;
}

export interface PlanMemberShareRecord {
  id: string;
  plan_id: string;
  member_id: string;
  share_amount: number;
  created_at: string;
}

// Frontend API Contract Responses (matching FamilyView & InviteMemberModal)
export interface FamilyMemberResponse {
  id: string;
  name: string;
  role: FrontendHouseholdRole;
  avatarInitials: string;
  avatarColor: string;
  planCount: number;
  monthlyShare: number;
  inboxStatus: InboxStatus;
  email?: string;
  lastChecked?: string;
  status?: HouseholdMemberStatus;
}

export interface SharedPlanResponse {
  id: string;
  name: string;
  tier: string;
  monthlyCost: number;
  assignedTo: string;
  iconBgColor: string;
  iconInitial: string;
}

export interface HouseholdOverviewResponse {
  household: {
    id: string;
    name: string;
    currency: string;
    monthlyBudget: number;
    totalMonthlySpend: number;
  };
  members: FamilyMemberResponse[];
  sharedPlans: SharedPlanResponse[];
}

// Invite Member Request DTO
export interface InviteMemberDTO {
  fullName: string;
  email?: string | null;
  role: 'member' | 'owner';
  householdId?: string;
}

// Authenticated User Context
export interface AuthUser {
  id: string;
  email: string;
  token: string;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      supabaseClient?: SupabaseClient;
    }
  }
}

