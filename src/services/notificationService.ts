import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  NotificationPreference,
  NotificationPreferenceUpdate,
  Notification,
  CreateNotificationParams,
} from '../types/database';

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreference, 'user_id' | 'created_at' | 'updated_at'> = {
  severe_weather: true,
  rain: true,
  air_quality: true,
  temperature: true,
  daily_forecast: false,
  saved_locations_only: false,
};

export const notificationService = {
  /**
   * Retrieves notification preferences for the currently authenticated Supabase user.
   * Identity is strictly derived from the authenticated session; never accepted from caller.
   */
  async getNotificationPreferences(): Promise<{ preferences: NotificationPreference | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { preferences: null };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { preferences: null };
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[notificationService] Error fetching preferences:', error.message);
        return { preferences: null, error: error.message };
      }

      return { preferences: data as NotificationPreference | null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve notification preferences';
      console.warn('[notificationService] Unexpected error in getNotificationPreferences:', message);
      return { preferences: null, error: message };
    }
  },

  /**
   * Saves initial notification preferences for the authenticated user.
   */
  async saveNotificationPreferences(
    params: Partial<Omit<NotificationPreference, 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<{ preferences: NotificationPreference | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { preferences: null, error: 'Supabase database is not configured.' };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { preferences: null, error: 'You must be signed in to save notification preferences.' };
      }

      const payload = {
        user_id: user.id,
        severe_weather: params.severe_weather !== undefined ? params.severe_weather : DEFAULT_NOTIFICATION_PREFERENCES.severe_weather,
        rain: params.rain !== undefined ? params.rain : DEFAULT_NOTIFICATION_PREFERENCES.rain,
        air_quality: params.air_quality !== undefined ? params.air_quality : DEFAULT_NOTIFICATION_PREFERENCES.air_quality,
        temperature: params.temperature !== undefined ? params.temperature : DEFAULT_NOTIFICATION_PREFERENCES.temperature,
        daily_forecast: params.daily_forecast !== undefined ? params.daily_forecast : DEFAULT_NOTIFICATION_PREFERENCES.daily_forecast,
        saved_locations_only: params.saved_locations_only !== undefined ? params.saved_locations_only : DEFAULT_NOTIFICATION_PREFERENCES.saved_locations_only,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('notification_preferences')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.warn('[notificationService] Error inserting notification preferences:', error.message);
        return { preferences: null, error: error.message };
      }

      return { preferences: data as NotificationPreference };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save notification preferences';
      console.warn('[notificationService] Unexpected error in saveNotificationPreferences:', message);
      return { preferences: null, error: message };
    }
  },

  /**
   * Updates notification preferences for the authenticated user.
   */
  async updateNotificationPreferences(
    updates: NotificationPreferenceUpdate
  ): Promise<{ preferences: NotificationPreference | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { preferences: null, error: 'Supabase database is not configured.' };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { preferences: null, error: 'You must be signed in to update notification preferences.' };
      }

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.severe_weather !== undefined) payload.severe_weather = updates.severe_weather;
      if (updates.rain !== undefined) payload.rain = updates.rain;
      if (updates.air_quality !== undefined) payload.air_quality = updates.air_quality;
      if (updates.temperature !== undefined) payload.temperature = updates.temperature;
      if (updates.daily_forecast !== undefined) payload.daily_forecast = updates.daily_forecast;
      if (updates.saved_locations_only !== undefined) payload.saved_locations_only = updates.saved_locations_only;

      const { data, error } = await supabase
        .from('notification_preferences')
        .update(payload)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.warn('[notificationService] Error updating notification preferences:', error.message);
        return { preferences: null, error: error.message };
      }

      return { preferences: data as NotificationPreference };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update notification preferences';
      console.warn('[notificationService] Unexpected error in updateNotificationPreferences:', message);
      return { preferences: null, error: message };
    }
  },

  /**
   * Upserts notification preferences: creates if absent, updates if existing.
   */
  async upsertNotificationPreferences(
    params: Partial<Omit<NotificationPreference, 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<{ preferences: NotificationPreference | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { preferences: null, error: 'Supabase database is not configured.' };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { preferences: null, error: 'You must be signed in to update notification preferences.' };
      }

      const payload: Record<string, unknown> = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      if (params.severe_weather !== undefined) payload.severe_weather = params.severe_weather;
      if (params.rain !== undefined) payload.rain = params.rain;
      if (params.air_quality !== undefined) payload.air_quality = params.air_quality;
      if (params.temperature !== undefined) payload.temperature = params.temperature;
      if (params.daily_forecast !== undefined) payload.daily_forecast = params.daily_forecast;
      if (params.saved_locations_only !== undefined) payload.saved_locations_only = params.saved_locations_only;

      const { data, error } = await supabase
        .from('notification_preferences')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        console.warn('[notificationService] Error upserting notification preferences:', error.message);
        return { preferences: null, error: error.message };
      }

      return { preferences: data as NotificationPreference };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save notification preferences';
      console.warn('[notificationService] Unexpected error in upsertNotificationPreferences:', message);
      return { preferences: null, error: message };
    }
  },

  /**
   * Retrieves notifications for the currently authenticated user.
   * Sorted descending by created_at.
   */
  async getNotifications(limit: number = 50): Promise<{ notifications: Notification[]; error?: string }> {
    if (!isSupabaseConfigured) {
      return { notifications: [] };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { notifications: [] };
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[notificationService] Error fetching notifications:', error.message);
        return { notifications: [], error: error.message };
      }

      return { notifications: (data as Notification[]) || [] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve notifications';
      console.warn('[notificationService] Unexpected error in getNotifications:', message);
      return { notifications: [], error: message };
    }
  },

  /**
   * Gets unread notification count for the authenticated user.
   */
  async getUnreadNotificationCount(): Promise<{ count: number; error?: string }> {
    if (!isSupabaseConfigured) {
      return { count: 0 };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { count: 0 };
      }

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.warn('[notificationService] Error counting unread notifications:', error.message);
        return { count: 0, error: error.message };
      }

      return { count: count || 0 };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to count unread notifications';
      return { count: 0, error: message };
    }
  },

  /**
   * Marks a specific notification as read.
   */
  async markNotificationRead(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: true };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { success: false, error: 'User is not signed in.' };
      }

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.warn('[notificationService] Error marking notification as read:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark notification read';
      return { success: false, error: message };
    }
  },

  /**
   * Marks all notifications as read for the authenticated user.
   */
  async markAllNotificationsRead(): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: true };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { success: false, error: 'User is not signed in.' };
      }

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.warn('[notificationService] Error marking all notifications read:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark all notifications read';
      return { success: false, error: message };
    }
  },

  /**
   * Creates a notification record for the authenticated user.
   * Identity is strictly derived from the session.
   * Implements authoritative persistent deduplication against Supabase:
   * Checks if an equivalent notification with the deterministic dedup_key already exists
   * for this user. If it exists (whether read or unread), returns the existing record without inserting.
   */
  async createNotification(
    params: CreateNotificationParams
  ): Promise<{ notification: Notification | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { notification: null, error: 'Supabase database is not configured.' };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { notification: null, error: 'User is not signed in.' };
      }

      // Generate or extract deterministic dedup_key
      const todayStr = new Date().toISOString().split('T')[0];
      const hourBucket = Math.floor(new Date().getHours() / 4);
      const locSlug = (params.location_name || '').trim().replace(/\s+/g, '_');
      const hazardSlug = (params.hazard || 'general').trim().replace(/\s+/g, '_');

      const dedupKey: string =
        (params.metadata?.dedup_key as string) ||
        `auto_${hazardSlug}_${locSlug}_${todayStr}_h${hourBucket}`;

      // PERSISTENT CHECK: Verify if an equivalent notification already exists in Supabase
      // Read/unread status MUST NOT affect deduplication!
      try {
        // Query 1: Check by JSONB containment on metadata.dedup_key
        const { data: matched, error: matchError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .contains('metadata', { dedup_key: dedupKey })
          .limit(1);

        if (!matchError && matched && matched.length > 0) {
          // Found existing notification in Supabase — do not insert duplicate
          return { notification: matched[0] as Notification };
        }

        // Query 2: Fallback scan of recent notifications for this user
        const { data: recents, error: recentsError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!recentsError && recents && recents.length > 0) {
          const existing = recents.find((n) => {
            let existingKey: string | null = null;
            if (n.metadata) {
              if (typeof n.metadata === 'object' && n.metadata !== null) {
                existingKey = (n.metadata as any).dedup_key;
              } else if (typeof n.metadata === 'string') {
                try {
                  existingKey = JSON.parse(n.metadata)?.dedup_key;
                } catch {}
              }
            }
            return existingKey === dedupKey;
          });

          if (existing) {
            // Found existing notification in recent history — do not insert duplicate
            return { notification: existing as Notification };
          }
        }
      } catch (checkErr) {
        console.warn('[notificationService] Persistent dedup check non-blocking error:', checkErr);
      }

      const newId = params.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);

      const payload: Record<string, unknown> = {
        user_id: user.id,
        title: params.title,
        message: params.message,
        severity: params.severity,
        hazard: params.hazard,
        location_name: params.location_name,
        latitude: params.latitude,
        longitude: params.longitude,
        source: params.source,
        source_type: params.source_type,
        is_read: params.is_read ?? false,
        created_at: new Date().toISOString(),
        expires_at: params.expires_at ?? null,
        metadata: {
          ...(params.metadata || {}),
          dedup_key: dedupKey,
        },
      };

      if (newId) {
        payload.id = newId;
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.warn('[notificationService] Error inserting notification:', error.message);
        return { notification: null, error: error.message };
      }

      return { notification: data as Notification };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create notification';
      console.warn('[notificationService] Unexpected error in createNotification:', message);
      return { notification: null, error: message };
    }
  },
};
