import {
  FamilyMember,
  SharedPlanSummary,
  ConnectedInbox,
  DetectedReceipt,
  HouseholdPreferences,
} from '@/types/trackmysubs';

export const INITIAL_MEMBERS: FamilyMember[] = [];

export const INITIAL_SHARED_PLANS: SharedPlanSummary[] = [];

export const INITIAL_INBOXES: ConnectedInbox[] = [];

export const INITIAL_DETECTED: DetectedReceipt[] = [];

export const INITIAL_PREFERENCES: HouseholdPreferences = {
  oneDayRenewalReminder: true,
  emailReminders: true,
  browserPush: false,
  autoTrackingActive: true,
  autoAddHighConfidence: true,
  alertAdvanceDays: 1,
  alertTone: "chime",
  alertVolume: 0.9,
  currency: "INR",
  workspaceScope: "home_office",
};

