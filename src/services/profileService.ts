import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Profile } from '../types/database';

export const profileService = {
  /**
   * Retrieves the profile for the currently authenticated Supabase user.
   * Does not require a user_id from caller; strictly derives identity from session.
   * If profile does not exist, handles gracefully without throwing.
   */
  async getCurrentProfile(): Promise<{ profile: Profile | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { profile: null };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { profile: null };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[profileService] Error fetching profile:', error.message);
        return { profile: null, error: error.message };
      }

      return { profile: data as Profile | null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve profile';
      console.warn('[profileService] Unexpected error in getCurrentProfile:', message);
      return { profile: null, error: message };
    }
  },

  /**
   * Updates display_name and/or preferred_language for the authenticated user.
   * Strictly uses auth.uid() from the authenticated session.
   * Does not add unnecessary fields.
   */
  async updateProfile(updates: {
    display_name?: string;
    preferred_language?: string;
    avatar_url?: string;
  }): Promise<{ profile: Profile | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { profile: null, error: 'Supabase database is not configured.' };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { profile: null, error: 'You must be signed in to update your profile.' };
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.display_name !== undefined) {
        updatePayload.display_name = updates.display_name.trim();
      }
      if (updates.preferred_language !== undefined) {
        updatePayload.preferred_language = updates.preferred_language.trim();
      }
      if (updates.avatar_url !== undefined) {
        updatePayload.avatar_url = updates.avatar_url;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id)
        .select()
        .maybeSingle();

      if (error) {
        console.warn('[profileService] Error updating profile:', error.message);
        return { profile: null, error: error.message };
      }

      // In case the row didn't exist yet (e.g., trigger didn't fire), gracefully upsert with user.id
      if (!data) {
        const { data: upsertData, error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            ...updatePayload,
          })
          .select()
          .single();

        if (upsertError) {
          console.warn('[profileService] Error upserting profile:', upsertError.message);
          return { profile: null, error: upsertError.message };
        }
        return { profile: upsertData as Profile };
      }

      return { profile: data as Profile };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      console.warn('[profileService] Unexpected error in updateProfile:', message);
      return { profile: null, error: message };
    }
  },
};
