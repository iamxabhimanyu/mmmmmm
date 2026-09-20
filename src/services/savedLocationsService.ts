import { supabase, isSupabaseConfigured } from './supabaseClient';
import { SavedLocation } from '../types/database';
import { isValidCoordinate, normalizeCoordinates } from '../utils/coordinateUtils';

export interface SaveLocationParams {
  name: string;
  latitude: number;
  longitude: number;
  country?: string | null;
  region?: string | null;
  is_favorite?: boolean;
}

export const savedLocationsService = {
  /**
   * Retrieves all saved locations for the currently authenticated user.
   * Supabase RLS enforces that only rows matching auth.uid() are returned.
   */
  async getSavedLocations(): Promise<{ data: SavedLocation[]; error?: string }> {
    if (!isSupabaseConfigured) {
      return { data: [] };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { data: [] };
      }

      const { data, error } = await supabase
        .from('saved_locations')
        .select('*')
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[savedLocationsService] Error getting locations:', error.message);
        return { data: [], error: error.message };
      }

      return { data: (data as SavedLocation[]) || [] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch saved locations';
      console.warn('[savedLocationsService] Unexpected error in getSavedLocations:', message);
      return { data: [], error: message };
    }
  },

  /**
   * Saves a location preserving exact coordinates, name, country, region, and favorite status.
   * Only authenticated users can perform this.
   */
  async saveLocation(
    params: SaveLocationParams
  ): Promise<{ data: SavedLocation | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { data: null, error: 'You must be signed in to save locations.' };
      }

      const name = params.name?.trim();
      if (!name) {
        return { data: null, error: 'Location name is required.' };
      }

      if (!isValidCoordinate(params.latitude, params.longitude)) {
        return { data: null, error: 'Valid geographic coordinates are required.' };
      }

      const norm = normalizeCoordinates(params.latitude, params.longitude)!;

      // Check if location with identical coordinates is already saved by this user
      const { data: existing } = await supabase
        .from('saved_locations')
        .select('*')
        .eq('user_id', user.id)
        .gte('latitude', norm.lat - 0.0001)
        .lte('latitude', norm.lat + 0.0001)
        .gte('longitude', norm.lon - 0.0001)
        .lte('longitude', norm.lon + 0.0001)
        .maybeSingle();

      if (existing) {
        return { data: existing as SavedLocation };
      }

      const { data, error } = await supabase
        .from('saved_locations')
        .insert({
          user_id: user.id,
          name,
          latitude: norm.lat,
          longitude: norm.lon,
          country: params.country || 'India',
          region: params.region || null,
          is_favorite: Boolean(params.is_favorite),
        })
        .select()
        .single();

      if (error) {
        console.warn('[savedLocationsService] Error inserting location:', error.message);
        return { data: null, error: error.message };
      }

      return { data: data as SavedLocation };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save location';
      console.warn('[savedLocationsService] Unexpected error in saveLocation:', message);
      return { data: null, error: message };
    }
  },

  /**
   * Updates an existing saved location.
   */
  async updateSavedLocation(
    id: string,
    updates: Partial<{ name: string; region: string; country: string; is_favorite: boolean }>
  ): Promise<{ data: SavedLocation | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { data: null, error: 'You must be signed in to update saved locations.' };
      }

      const payload: Record<string, unknown> = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('saved_locations')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.warn('[savedLocationsService] Error updating location:', error.message);
        return { data: null, error: error.message };
      }

      return { data: data as SavedLocation };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update location';
      console.warn('[savedLocationsService] Unexpected error in updateSavedLocation:', message);
      return { data: null, error: message };
    }
  },

  /**
   * Deletes a saved location for the authenticated user.
   */
  async deleteSavedLocation(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Database is not configured.' };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'You must be signed in to delete saved locations.' };
      }

      const { error } = await supabase
        .from('saved_locations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.warn('[savedLocationsService] Error deleting location:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete location';
      console.warn('[savedLocationsService] Unexpected error in deleteSavedLocation:', message);
      return { success: false, error: message };
    }
  },

  /**
   * Toggles favorite status of a saved location.
   */
  async toggleFavoriteLocation(
    id: string,
    currentFavoriteStatus: boolean
  ): Promise<{ data: SavedLocation | null; error?: string }> {
    return this.updateSavedLocation(id, { is_favorite: !currentFavoriteStatus });
  },
};
