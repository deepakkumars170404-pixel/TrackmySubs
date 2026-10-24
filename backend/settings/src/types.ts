/**
 * Settings and Preferences Types
 * Matches public.user_notification_settings table and frontend models
 */

export interface UserNotificationSettings {
  id: string;
  userId: string;
  oneDayReminder: boolean;
  emailReminders: boolean;
  browserPush: boolean;
  automaticDetectionEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RawUserNotificationSettingsRow {
  id: string;
  user_id: string;
  one_day_reminder: boolean;
  email_reminders: boolean;
  browser_push: boolean;
  automatic_detection_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateNotificationSettingsInput {
  oneDayReminder?: boolean;
  emailReminders?: boolean;
  browserPush?: boolean;
  automaticDetectionEnabled?: boolean;

  // Aliases matching frontend naming conventions
  oneDayRenewalReminder?: boolean;
  autoTrackingActive?: boolean;
  autoAddHighConfidence?: boolean;
}

export type NotificationSettingKey =
  | 'oneDayReminder'
  | 'emailReminders'
  | 'browserPush'
  | 'automaticDetectionEnabled'
  | 'oneDayRenewalReminder'
  | 'autoTrackingActive'
  | 'autoAddHighConfidence';

export interface SettingsResult<T> {
  data: T | null;
  error: Error | null;
}
