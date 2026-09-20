/**
 * Database types matching the existing Supabase schema for MAUSAM Phase 2A
 */

export interface Profile {
  id: string; // references auth.users.id
  display_name: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedLocation {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  region: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface SearchHistoryItem {
  id: string;
  user_id: string;
  location_name: string;
  latitude: number;
  longitude: number;
  searched_at: string;
  source: string | null;
}

export interface UserPreferencesLocation {
  id?: string;
  name: string;
  displayName?: string;
  latitude: number;
  longitude: number;
  lat?: number;
  lon?: number;
  country?: string;
  countryCode?: string;
  region?: string;
  state?: string;
  district?: string;
  city?: string;
  village?: string;
  postcode?: string;
  timezone?: string;
  elevation?: number;
  source?: string;
  isCurrent?: boolean;
}

export interface UserPreferences {
  user_id: string;
  primary_persona: string;
  selected_personas: string[];
  default_location: UserPreferencesLocation | null;
  temperature_unit: 'C' | 'F' | string;
  high_contrast: boolean;
  large_text: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserPreferencesUpdate {
  primary_persona?: string;
  selected_personas?: string[];
  default_location?: UserPreferencesLocation | null;
  temperature_unit?: 'C' | 'F' | string;
  high_contrast?: boolean;
  large_text?: boolean;
}

/**
 * Phase 3B - Notification System Types
 */
export type NotificationSeverity = 'info' | 'watch' | 'warning' | 'critical';
export type NotificationSourceType = 'official' | 'provider' | 'derived' | 'demo';

export interface NotificationPreference {
  user_id: string;
  severe_weather: boolean;
  rain: boolean;
  air_quality: boolean;
  temperature: boolean;
  daily_forecast: boolean;
  saved_locations_only: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationPreferenceUpdate {
  severe_weather?: boolean;
  rain?: boolean;
  air_quality?: boolean;
  temperature?: boolean;
  daily_forecast?: boolean;
  saved_locations_only?: boolean;
}

export interface Notification {
  id: string; // uuid
  user_id: string; // uuid
  title: string;
  message: string;
  severity: NotificationSeverity;
  hazard: string;
  location_name: string;
  latitude: number;
  longitude: number;
  source: string;
  source_type: NotificationSourceType;
  is_read: boolean;
  created_at: string;
  expires_at?: string | null;
  metadata?: Record<string, any> | null;
}

export interface CreateNotificationParams {
  id?: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  hazard: string;
  location_name: string;
  latitude: number;
  longitude: number;
  source: string;
  source_type: NotificationSourceType;
  is_read?: boolean;
  expires_at?: string | null;
  metadata?: Record<string, any> | null;
}
