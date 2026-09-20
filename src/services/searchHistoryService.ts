import { supabase, isSupabaseConfigured } from './supabaseClient';
import { SearchHistoryItem } from '../types/database';
import { isValidCoordinate, normalizeCoordinates } from '../utils/coordinateUtils';

export interface RecordSearchParams {
  location_name: string;
  latitude: number;
  longitude: number;
  source?: string;
}

export const searchHistoryService = {
  /**
   * Saves a successful location search to search_history for authenticated users only.
   * Does NOT store search history for:
   * - failed searches
   * - invalid locations
   * - empty searches
   * Guest users must NOT have their searches sent to Supabase.
   */
  async recordSearch(
    params: RecordSearchParams
  ): Promise<{ data: SearchHistoryItem | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { data: null };
    }

    const trimmedName = params.location_name?.trim();
    if (!trimmedName) {
      // Empty search: do not record
      return { data: null };
    }

    if (!isValidCoordinate(params.latitude, params.longitude)) {
      // Invalid location coordinates: do not record
      return { data: null };
    }

    const norm = normalizeCoordinates(params.latitude, params.longitude)!;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Guest users must NOT have their searches sent to Supabase
      if (!user) {
        return { data: null };
      }

      const { data, error } = await supabase
        .from('search_history')
        .insert({
          user_id: user.id,
          location_name: trimmedName,
          latitude: norm.lat,
          longitude: norm.lon,
          source: params.source || 'search_bar',
          searched_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.warn('[searchHistoryService] Error recording search:', error.message);
        return { data: null, error: error.message };
      }

      return { data: data as SearchHistoryItem };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to record search';
      console.warn('[searchHistoryService] Non-blocking search error:', message);
      return { data: null, error: message };
    }
  },

  /**
   * Retrieves recent search history for the authenticated user.
   */
  async getSearchHistory(limit = 20): Promise<{ data: SearchHistoryItem[]; error?: string }> {
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
        .from('search_history')
        .select('*')
        .eq('user_id', user.id)
        .order('searched_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[searchHistoryService] Error retrieving search history:', error.message);
        return { data: [], error: error.message };
      }

      return { data: (data as SearchHistoryItem[]) || [] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve search history';
      console.warn('[searchHistoryService] Unexpected error in getSearchHistory:', message);
      return { data: [], error: message };
    }
  },

  /**
   * Deletes a specific search history entry for the authenticated user.
   */
  async deleteSearchHistoryItem(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Database is not configured.' };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'You must be signed in to manage search history.' };
      }

      const { error } = await supabase
        .from('search_history')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.warn('[searchHistoryService] Error deleting search item:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete search item';
      console.warn('[searchHistoryService] Unexpected error in deleteSearchHistoryItem:', message);
      return { success: false, error: message };
    }
  },

  /**
   * Clears all search history entries for the authenticated user.
   */
  async clearAllSearchHistory(): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Database is not configured.' };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'You must be signed in to clear search history.' };
      }

      const { error } = await supabase
        .from('search_history')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.warn('[searchHistoryService] Error clearing search history:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to clear search history';
      console.warn('[searchHistoryService] Unexpected error in clearAllSearchHistory:', message);
      return { success: false, error: message };
    }
  },
};
