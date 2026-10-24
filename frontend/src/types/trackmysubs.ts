export type NavTab = 
  | 'overview'
  | 'subscriptions'
  | 'calendar'
  | 'family' 
  | 'autodetect' 
  | 'settings';

export type TabType = NavTab;

export interface FamilyMember {
  id: string;
  name: string;
  role: 'Owner' | 'Member';
  avatarInitials: string;
  avatarColor: string;
  planCount: number;
  monthlyShare: number; // in ₹
  inboxStatus: 'Gmail connected' | 'Outlook connected' | 'Not connected' | 'Pending Acceptance';
  status?: 'active' | 'invited' | 'pending';
  inviteUrl?: string;
  email?: string;
  lastChecked?: string;
}

export interface SharedPlanSummary {
  id: string;
  name: string;
  tier: string;
  monthlyCost: number;
  assignedTo: string;
  iconBgColor: string;
  iconInitial: string;
}

export interface ConnectedInbox {
  id: string;
  provider: 'Gmail' | 'Outlook' | 'Yahoo';
  email: string;
  connectedBy: string;
  lastChecked: string;
  status: 'Connected' | 'Error' | 'Paused';
  historyDaysScanned: number;
}

export interface DetectedReceipt {
  id: string;
  serviceName: string;
  receiptName: string;
  extractedCost: number;
  receiptDate: string; // YYYY-MM-DD
  chargeDateNote?: string;
  confidence: 'High confidence' | 'Needs review';
  actionTaken?: 'Added' | 'Needs review' | 'Dismissed';
  evidenceSnippet?: string;
  rawSnippet?: string;
}

export interface HouseholdPreferences {
  oneDayRenewalReminder: boolean;
  emailReminders: boolean;
  browserPush: boolean;
  autoTrackingActive: boolean;
  autoAddHighConfidence: boolean;
  alertAdvanceDays?: number;
  alertTone?: "chime" | "bell" | "digital";
  alertVolume?: number;
  currency?: string;
  workspaceScope?: string;
}

