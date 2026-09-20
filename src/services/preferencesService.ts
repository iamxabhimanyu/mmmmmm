import { supabase, isSupabaseConfigured } from './supabaseClient';
import { UserPreferences, UserPreferencesUpdate, UserPreferencesLocation } from '../types/database';

export interface SaveUserPreferencesParams {
  primary_persona: string;
  selected_personas: string[];
  default_location: UserPreferencesLocation | null;
  temperature_unit: 'C' | 'F' | string;
  high_contrast: boolean;
  large_text: boolean;
}

export const preferencesService = {
  /**
   * Retrieves preferences for the currently authenticated Supabase user.
   * Never accepts a user_id from the caller; strictly derives identity from the session.
   * If preferences do not exist or user is unauthenticated, handles gracefully without throwing.
   */
  async getUserPreferences(): Promise<{ preferences: UserPreferences | null; error?: string }> {
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
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[preferencesService] Error fetching preferences:', error.message);
        return { preferences: null, error: error.message };
      }

      return { preferences: data as UserPreferences | null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve preferences';
      console.warn('[preferencesService] Unexpected error in getUserPreferences:', message);
      return { preferences: null, error: message };
    }
  },

  /**
   * Saves initial preferences for the authenticated user.
   * Operates strictly under the authenticated user's session.
   */
  async saveUserPreferences(
    params: SaveUserPreferencesParams
  ): Promise<{ preferences: UserPreferences | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { preferences: null, error: 'Supabase database is not configured.' };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { preferences: null, error: 'You must be signed in to save preferences.' };
      }

      const payload = {
        user_id: user.id,
        primary_persona: params.primary_persona,
        selected_personas: params.selected_personas,
        default_location: params.default_location,
        temperature_unit: params.temperature_unit,
        high_contrast: params.high_contrast,
        large_text: params.large_text,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('user_preferences')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.warn('[preferencesService] Error inserting preferences:', error.message);
        return { preferences: null, error: error.message };
      }

      return { preferences: data as UserPreferences };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save preferences';
      console.warn('[preferencesService] Unexpected error in saveUserPreferences:', message);
      return { preferences: null, error: message };
    }
  },

  /**
   * Updates partial preferences for the authenticated user.
   * Strictly verifies the user session and writes only the authenticated user's row.
   */
  async updateUserPreferences(
    updates: UserPreferencesUpdate
  ): Promise<{ preferences: UserPreferences | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { preferences: null, error: 'Supabase database is not configured.' };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { preferences: null, error: 'You must be signed in to update preferences.' };
      }

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.primary_persona !== undefined) {
        payload.primary_persona = updates.primary_persona;
      }
      if (updates.selected_personas !== undefined) {
        payload.selected_personas = updates.selected_personas;
      }
      if (updates.default_location !== undefined) {
        payload.default_location = updates.default_location;
      }
      if (updates.temperature_unit !== undefined) {
        payload.temperature_unit = updates.temperature_unit;
      }
      if (updates.high_contrast !== undefined) {
        payload.high_contrast = updates.high_contrast;
      }
      if (updates.large_text !== undefined) {
        payload.large_text = updates.large_text;
      }

      const { data, error } = await supabase
        .from('user_preferences')
        .update(payload)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (error) {
        console.warn('[preferencesService] Error updating preferences:', error.message);
        return { preferences: null, error: error.message };
      }

      // If record did not exist yet, fallback to upsert
      if (!data) {
        return this.upsertUserPreferences({
          primary_persona: updates.primary_persona || 'runner',
          selected_personas: updates.selected_personas || ['runner', 'commuter'],
          default_location: updates.default_location || null,
          temperature_unit: updates.temperature_unit || 'C',
          high_contrast: updates.high_contrast ?? false,
          large_text: updates.large_text ?? false,
        });
      }

      return { preferences: data as UserPreferences };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update preferences';
      console.warn('[preferencesService] Unexpected error in updateUserPreferences:', message);
      return { preferences: null, error: message };
    }
  },

  /**
   * Upserts preferences for the authenticated user, resolving conflict on user_id.
   */
  async upsertUserPreferences(
    params: SaveUserPreferencesParams
  ): Promise<{ preferences: UserPreferences | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { preferences: null, error: 'Supabase database is not configured.' };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { preferences: null, error: 'You must be signed in to upsert preferences.' };
      }

      const payload = {
        user_id: user.id,
        primary_persona: params.primary_persona,
        selected_personas: params.selected_personas,
        default_location: params.default_location,
        temperature_unit: params.temperature_unit,
        high_contrast: params.high_contrast,
        large_text: params.large_text,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('user_preferences')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        console.warn('[preferencesService] Error upserting preferences:', error.message);
        return { preferences: null, error: error.message };
      }

      return { preferences: data as UserPreferences };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upsert preferences';
      console.warn('[preferencesService] Unexpected error in upsertUserPreferences:', message);
      return { preferences: null, error: message };
    }
  },
};
