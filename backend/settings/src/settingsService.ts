import { SupabaseClient } from '@supabase/supabase-js';
import {
  UserNotificationSettings,
  RawUserNotificationSettingsRow,
  UpdateNotificationSettingsInput,
  NotificationSettingKey,
  SettingsResult,
} from './types';

/**
 * Transforms PostgreSQL snake_case row to camelCase object
 */
export function mapRowToSettings(row: RawUserNotificationSettingsRow): UserNotificationSettings {
  return {
    id: row.id,
    userId: row.user_id,
    oneDayReminder: row.one_day_reminder,
    emailReminders: row.email_reminders,
    browserPush: row.browser_push,
    automaticDetectionEnabled: row.automatic_detection_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Default fallback settings
 */
export const DEFAULT_NOTIFICATION_SETTINGS = {
  one_day_reminder: true,
  email_reminders: true,
  browser_push: false,
  automatic_detection_enabled: true,
};

/**
 * Maps input update object to database snake_case columns
 */
export function mapInputToRow(input: UpdateNotificationSettingsInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (input.oneDayReminder !== undefined) row.one_day_reminder = input.oneDayReminder;
  if (input.oneDayRenewalReminder !== undefined) row.one_day_reminder = input.oneDayRenewalReminder;

  if (input.emailReminders !== undefined) row.email_reminders = input.emailReminders;
  if (input.browserPush !== undefined) row.browser_push = input.browserPush;

  if (input.automaticDetectionEnabled !== undefined) row.automatic_detection_enabled = input.automaticDetectionEnabled;
  if (input.autoTrackingActive !== undefined) row.automatic_detection_enabled = input.autoTrackingActive;
  if (input.autoAddHighConfidence !== undefined) row.automatic_detection_enabled = input.autoAddHighConfidence;

  return row;
}

/**
 * Fetch settings for a given user from public.user_notification_settings
 */
export async function getUserNotificationSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<SettingsResult<UserNotificationSettings>> {
  try {
    const { data, error } = await supabase
      .from('user_notification_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return { data: null, error: new Error(error.message) };
    }

    if (!data) {
      // Auto-insert default settings if missing
      const { data: created, error: insertError } = await supabase
        .from('user_notification_settings')
        .insert({ user_id: userId, ...DEFAULT_NOTIFICATION_SETTINGS })
        .select('*')
        .single();

      if (insertError) {
        return { data: null, error: new Error(insertError.message) };
      }

      return { data: mapRowToSettings(created as RawUserNotificationSettingsRow), error: null };
    }

    return { data: mapRowToSettings(data as RawUserNotificationSettingsRow), error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching notification settings';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Update settings for a user
 */
export async function updateUserNotificationSettings(
  supabase: SupabaseClient,
  userId: string,
  updates: UpdateNotificationSettingsInput
): Promise<SettingsResult<UserNotificationSettings>> {
  try {
    const payload = mapInputToRow(updates);
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('user_notification_settings')
      .update(payload)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (!data) {
      // Upsert fallback
      const { data: upserted, error: upsertError } = await supabase
        .from('user_notification_settings')
        .upsert(
          { user_id: userId, ...DEFAULT_NOTIFICATION_SETTINGS, ...payload },
          { onConflict: 'user_id' }
        )
        .select('*')
        .single();

      if (upsertError) {
        return { data: null, error: new Error(upsertError.message) };
      }

      return { data: mapRowToSettings(upserted as RawUserNotificationSettingsRow), error: null };
    }

    return { data: mapRowToSettings(data as RawUserNotificationSettingsRow), error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating notification settings';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Toggle a single boolean preference
 */
export async function toggleNotificationPreference(
  supabase: SupabaseClient,
  userId: string,
  key: NotificationSettingKey,
  explicitValue?: boolean
): Promise<SettingsResult<UserNotificationSettings>> {
  const current = await getUserNotificationSettings(supabase, userId);
  if (current.error || !current.data) {
    return current;
  }

  // Resolve property name
  let targetProp: keyof UserNotificationSettings = 'oneDayReminder';
  if (key === 'oneDayReminder' || key === 'oneDayRenewalReminder') targetProp = 'oneDayReminder';
  else if (key === 'emailReminders') targetProp = 'emailReminders';
  else if (key === 'browserPush') targetProp = 'browserPush';
  else if (key === 'automaticDetectionEnabled' || key === 'autoTrackingActive' || key === 'autoAddHighConfidence') {
    targetProp = 'automaticDetectionEnabled';
  }

  const newValue = explicitValue !== undefined ? explicitValue : !current.data[targetProp];
  return updateUserNotificationSettings(supabase, userId, { [targetProp]: newValue });
}

/**
 * Reset notification settings back to defaults
 */
export async function resetNotificationSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<SettingsResult<UserNotificationSettings>> {
  try {
    const { data, error } = await supabase
      .from('user_notification_settings')
      .update({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapRowToSettings(data as RawUserNotificationSettingsRow), error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error resetting notification settings';
    return { data: null, error: new Error(message) };
  }
}
