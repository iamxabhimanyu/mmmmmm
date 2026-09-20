import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  Profile,
  SavedLocation,
  SearchHistoryItem,
  UserPreferences,
  UserPreferencesUpdate,
  NotificationPreference,
  NotificationPreferenceUpdate,
  Notification,
  CreateNotificationParams,
} from '../types/database';
import { profileService } from './profileService';
import { savedLocationsService, SaveLocationParams } from './savedLocationsService';
import { searchHistoryService, RecordSearchParams } from './searchHistoryService';
import { preferencesService, SaveUserPreferencesParams } from './preferencesService';
import { notificationService, DEFAULT_NOTIFICATION_PREFERENCES } from './notificationService';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsVerification?: boolean }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;

  // Profile
  profile: Profile | null;
  isProfileLoading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: {
    display_name?: string;
    preferred_language?: string;
    avatar_url?: string;
  }) => Promise<{ success: boolean; error?: string; profile?: Profile }>;

  // Preferences (Phase 3A)
  preferences: UserPreferences | null;
  isPreferencesLoading: boolean;
  refreshPreferences: () => Promise<UserPreferences | null>;
  updatePreferences: (updates: UserPreferencesUpdate) => Promise<{ success: boolean; error?: string; data?: UserPreferences }>;
  savePreferences: (params: SaveUserPreferencesParams) => Promise<{ success: boolean; error?: string; data?: UserPreferences }>;

  // Notifications (Phase 3B)
  notificationPreferences: NotificationPreference;
  isNotificationPreferencesLoading: boolean;
  notifications: Notification[];
  unreadNotificationCount: number;
  isNotificationsLoading: boolean;
  refreshNotificationPreferences: () => Promise<NotificationPreference | null>;
  updateNotificationPreferences: (updates: NotificationPreferenceUpdate) => Promise<{ success: boolean; error?: string; data?: NotificationPreference }>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<{ success: boolean; error?: string }>;
  markAllNotificationsRead: () => Promise<{ success: boolean; error?: string }>;
  recordNotification: (params: CreateNotificationParams) => Promise<{ success: boolean; error?: string; notification?: Notification }>;

  // Saved Locations
  savedLocations: SavedLocation[];
  isSavedLocationsLoading: boolean;
  refreshSavedLocations: () => Promise<void>;
  saveLocation: (
    params: SaveLocationParams
  ) => Promise<{ success: boolean; error?: string; data?: SavedLocation }>;
  updateSavedLocation: (
    id: string,
    updates: Partial<{ name: string; region: string; country: string; is_favorite: boolean }>
  ) => Promise<{ success: boolean; error?: string; data?: SavedLocation }>;
  deleteSavedLocation: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleFavoriteLocation: (
    id: string,
    currentFavoriteStatus: boolean
  ) => Promise<{ success: boolean; error?: string; data?: SavedLocation }>;

  // Search History
  searchHistory: SearchHistoryItem[];
  isSearchHistoryLoading: boolean;
  refreshSearchHistory: () => Promise<void>;
  recordSearch: (params: RecordSearchParams) => Promise<void>;
  deleteSearchHistoryItem: (id: string) => Promise<{ success: boolean; error?: string }>;
  clearAllSearchHistory: () => Promise<{ success: boolean; error?: string }>;
}

const GUEST_DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreference = {
  user_id: 'guest',
  severe_weather: true,
  rain: true,
  air_quality: true,
  temperature: true,
  daily_forecast: false,
  saved_locations_only: false,
};

function getLocalGuestNotificationPreferences(): NotificationPreference {
  try {
    const raw = localStorage.getItem('mausam_notification_preferences');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...GUEST_DEFAULT_NOTIFICATION_PREFERENCES, ...parsed };
    }
  } catch (e) {}
  return GUEST_DEFAULT_NOTIFICATION_PREFERENCES;
}

function getLocalGuestNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem('mausam_local_notifications');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Profile State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false);

  // Saved Locations State
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [isSavedLocationsLoading, setIsSavedLocationsLoading] = useState<boolean>(false);

  // Search History State
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [isSearchHistoryLoading, setIsSearchHistoryLoading] = useState<boolean>(false);

  // User Preferences State (Phase 3A)
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isPreferencesLoading, setIsPreferencesLoading] = useState<boolean>(false);

  // Notification Preferences & Notifications State (Phase 3B)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference>(getLocalGuestNotificationPreferences);
  const [isNotificationPreferencesLoading, setIsNotificationPreferencesLoading] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notification[]>(getLocalGuestNotifications);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState<boolean>(false);

  // 1. Data Refresh Functions
  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    setIsProfileLoading(true);
    try {
      const res = await profileService.getCurrentProfile();
      setProfile(res.profile);
    } catch (e) {
      console.warn('[AuthContext] refreshProfile error:', e);
    } finally {
      setIsProfileLoading(false);
    }
  }, [user]);

  const refreshSavedLocations = useCallback(async () => {
    if (!user) {
      setSavedLocations([]);
      return;
    }
    setIsSavedLocationsLoading(true);
    try {
      const res = await savedLocationsService.getSavedLocations();
      setSavedLocations(res.data);
    } catch (e) {
      console.warn('[AuthContext] refreshSavedLocations error:', e);
    } finally {
      setIsSavedLocationsLoading(false);
    }
  }, [user]);

  const refreshSearchHistory = useCallback(async () => {
    if (!user) {
      setSearchHistory([]);
      return;
    }
    setIsSearchHistoryLoading(true);
    try {
      const res = await searchHistoryService.getSearchHistory();
      setSearchHistory(res.data);
    } catch (e) {
      console.warn('[AuthContext] refreshSearchHistory error:', e);
    } finally {
      setIsSearchHistoryLoading(false);
    }
  }, [user]);

  const refreshPreferences = useCallback(async (): Promise<UserPreferences | null> => {
    if (!user) {
      setPreferences(null);
      return null;
    }
    setIsPreferencesLoading(true);
    try {
      const res = await preferencesService.getUserPreferences();
      setPreferences(res.preferences);
      return res.preferences;
    } catch (e) {
      console.warn('[AuthContext] refreshPreferences error:', e);
      return null;
    } finally {
      setIsPreferencesLoading(false);
    }
  }, [user]);

  const refreshNotificationPreferences = useCallback(async (): Promise<NotificationPreference | null> => {
    if (!user) {
      const guestPrefs = getLocalGuestNotificationPreferences();
      setNotificationPreferences(guestPrefs);
      return guestPrefs;
    }
    setIsNotificationPreferencesLoading(true);
    try {
      const res = await notificationService.getNotificationPreferences();
      if (res.preferences) {
        setNotificationPreferences(res.preferences);
        try {
          localStorage.setItem('mausam_notification_preferences', JSON.stringify(res.preferences));
        } catch (e) {}
        return res.preferences;
      } else {
        const candidate = getLocalGuestNotificationPreferences();
        const saveRes = await notificationService.saveNotificationPreferences(candidate);
        if (saveRes.preferences) {
          setNotificationPreferences(saveRes.preferences);
          return saveRes.preferences;
        }
        return null;
      }
    } catch (e) {
      console.warn('[AuthContext] refreshNotificationPreferences error:', e);
      return null;
    } finally {
      setIsNotificationPreferencesLoading(false);
    }
  }, [user]);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications(getLocalGuestNotifications());
      return;
    }
    setIsNotificationsLoading(true);
    try {
      const res = await notificationService.getNotifications();
      setNotifications(res.notifications);
    } catch (e) {
      console.warn('[AuthContext] refreshNotifications error:', e);
    } finally {
      setIsNotificationsLoading(false);
    }
  }, [user]);

  // 2. Fetch User Data whenever auth user state stabilizes
  useEffect(() => {
    if (user) {
      refreshProfile();
      refreshSavedLocations();
      refreshSearchHistory();
      refreshPreferences();
      refreshNotificationPreferences();
      refreshNotifications();
    } else {
      setProfile(null);
      setSavedLocations([]);
      setSearchHistory([]);
      setPreferences(null);
      setNotificationPreferences(getLocalGuestNotificationPreferences());
      setNotifications(getLocalGuestNotifications());
    }
  }, [
    user,
    refreshProfile,
    refreshSavedLocations,
    refreshSearchHistory,
    refreshPreferences,
    refreshNotificationPreferences,
    refreshNotifications,
  ]);

  // 3. Initial Session & Continuous Auth State Listener
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn('[MAUSAM Auth] Error fetching initial session:', error.message);
        }
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[MAUSAM Auth] Session check failed:', err);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 4. Sign In
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error:
          'Supabase credentials are not configured. Please define VITE_SUPABASE_PUBLISHABLE_KEY in your environment settings.',
      };
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      return { success: false, error: 'Please enter your email address.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setSession(data.session);
      setUser(data.user);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during sign in.';
      return { success: false, error: msg };
    }
  };

  // 5. Sign Up
  const signUp = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; needsVerification?: boolean }> => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error:
          'Supabase credentials are not configured. Please define VITE_SUPABASE_PUBLISHABLE_KEY in your environment settings.',
      };
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const needsVerification = !data.session;
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }

      return {
        success: true,
        needsVerification,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during account creation.';
      return { success: false, error: msg };
    }
  };

  // 6. Sign Out
  const signOut = async (): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setPreferences(null);
      setSavedLocations([]);
      setSearchHistory([]);
      setNotificationPreferences(getLocalGuestNotificationPreferences());
      setNotifications(getLocalGuestNotifications());
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setPreferences(null);
      setSavedLocations([]);
      setSearchHistory([]);
      setNotificationPreferences(getLocalGuestNotificationPreferences());
      setNotifications(getLocalGuestNotifications());
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setPreferences(null);
      setSavedLocations([]);
      setSearchHistory([]);
      setNotificationPreferences(getLocalGuestNotificationPreferences());
      setNotifications(getLocalGuestNotifications());
      const msg = err instanceof Error ? err.message : 'Failed to complete sign out.';
      return { success: false, error: msg };
    }
  };

  // 7. Update Profile
  const updateProfile = async (updates: {
    display_name?: string;
    preferred_language?: string;
    avatar_url?: string;
  }): Promise<{ success: boolean; error?: string; profile?: Profile }> => {
    if (!user) {
      return { success: false, error: 'Must be authenticated to update profile.' };
    }
    setIsProfileLoading(true);
    try {
      const res = await profileService.updateProfile(updates);
      if (res.error) {
        return { success: false, error: res.error };
      }
      if (res.profile) {
        setProfile(res.profile);
      }
      return { success: true, profile: res.profile || undefined };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating profile.';
      return { success: false, error: msg };
    } finally {
      setIsProfileLoading(false);
    }
  };

  // 8. Saved Location Operations
  const saveLocation = async (
    params: SaveLocationParams
  ): Promise<{ success: boolean; error?: string; data?: SavedLocation }> => {
    if (!user) {
      return { success: false, error: 'Please sign in to save locations.' };
    }
    try {
      const res = await savedLocationsService.saveLocation(params);
      if (res.error) {
        return { success: false, error: res.error };
      }
      if (res.data) {
        setSavedLocations((prev) => {
          const filtered = prev.filter((item) => item.id !== res.data!.id);
          return [res.data!, ...filtered];
        });
      }
      return { success: true, data: res.data || undefined };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving location.';
      return { success: false, error: msg };
    }
  };

  const updateSavedLocation = async (
    id: string,
    updates: Partial<{ name: string; region: string; country: string; is_favorite: boolean }>
  ): Promise<{ success: boolean; error?: string; data?: SavedLocation }> => {
    if (!user) {
      return { success: false, error: 'Must be signed in to update location.' };
    }
    try {
      const res = await savedLocationsService.updateSavedLocation(id, updates);
      if (res.error) {
        return { success: false, error: res.error };
      }
      if (res.data) {
        setSavedLocations((prev) =>
          prev.map((item) => (item.id === id ? res.data! : item))
        );
      }
      return { success: true, data: res.data || undefined };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating location.';
      return { success: false, error: msg };
    }
  };

  const deleteSavedLocation = async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Must be signed in to delete location.' };
    }
    try {
      const res = await savedLocationsService.deleteSavedLocation(id);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      setSavedLocations((prev) => prev.filter((item) => item.id !== id));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting location.';
      return { success: false, error: msg };
    }
  };

  const toggleFavoriteLocation = async (
    id: string,
    currentFavoriteStatus: boolean
  ): Promise<{ success: boolean; error?: string; data?: SavedLocation }> => {
    return updateSavedLocation(id, { is_favorite: !currentFavoriteStatus });
  };

  // 9. Search History Operations
  const recordSearch = async (params: RecordSearchParams): Promise<void> => {
    if (!user) return; // Guest searches are never sent to Supabase
    try {
      const res = await searchHistoryService.recordSearch(params);
      if (res.data) {
        setSearchHistory((prev) => {
          const filtered = prev.filter((item) => item.id !== res.data!.id);
          return [res.data!, ...filtered].slice(0, 30);
        });
      }
    } catch (e) {
      console.warn('[AuthContext] recordSearch non-blocking error:', e);
    }
  };

  const deleteSearchHistoryItem = async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Must be signed in to manage search history.' };
    }
    try {
      const res = await searchHistoryService.deleteSearchHistoryItem(id);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      setSearchHistory((prev) => prev.filter((item) => item.id !== id));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting search history.';
      return { success: false, error: msg };
    }
  };

  const clearAllSearchHistory = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Must be signed in.' };
    }
    try {
      const res = await searchHistoryService.clearAllSearchHistory();
      if (!res.success) {
        return { success: false, error: res.error };
      }
      setSearchHistory([]);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error clearing search history.';
      return { success: false, error: msg };
    }
  };

  // 10. Preference Operations (Phase 3A)
  const updatePreferences = async (
    updates: UserPreferencesUpdate
  ): Promise<{ success: boolean; error?: string; data?: UserPreferences }> => {
    if (!user) {
      return { success: false, error: 'Must be authenticated to update preferences.' };
    }
    try {
      const res = await preferencesService.updateUserPreferences(updates);
      if (res.error) {
        return { success: false, error: res.error };
      }
      if (res.preferences) {
        setPreferences(res.preferences);
      }
      return { success: true, data: res.preferences || undefined };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating preferences.';
      return { success: false, error: msg };
    }
  };

  const savePreferences = async (
    params: SaveUserPreferencesParams
  ): Promise<{ success: boolean; error?: string; data?: UserPreferences }> => {
    if (!user) {
      return { success: false, error: 'Must be authenticated to save preferences.' };
    }
    try {
      const res = await preferencesService.upsertUserPreferences(params);
      if (res.error) {
        return { success: false, error: res.error };
      }
      if (res.preferences) {
        setPreferences(res.preferences);
      }
      return { success: true, data: res.preferences || undefined };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving preferences.';
      return { success: false, error: msg };
    }
  };

  // 10. Notification Methods (Phase 3B)
  const unreadNotificationCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const updateNotificationPreferences = async (
    updates: NotificationPreferenceUpdate
  ): Promise<{ success: boolean; error?: string; data?: NotificationPreference }> => {
    const updated: NotificationPreference = {
      ...notificationPreferences,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    setNotificationPreferences(updated);
    try {
      localStorage.setItem('mausam_notification_preferences', JSON.stringify(updated));
    } catch (e) {}

    if (!user) {
      return { success: true, data: updated };
    }

    try {
      const res = await notificationService.upsertNotificationPreferences(updates);
      if (res.error) {
        return { success: false, error: res.error };
      }
      if (res.preferences) {
        setNotificationPreferences(res.preferences);
      }
      return { success: true, data: res.preferences || updated };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating notification preferences.';
      return { success: false, error: msg };
    }
  };

  const markNotificationRead = async (id: string): Promise<{ success: boolean; error?: string }> => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
      if (!user) {
        try {
          localStorage.setItem('mausam_local_notifications', JSON.stringify(updated.slice(0, 50)));
        } catch (e) {}
      }
      return updated;
    });

    if (user) {
      try {
        await notificationService.markNotificationRead(id);
      } catch (e) {
        console.warn('[AuthContext] markNotificationRead error:', e);
      }
    }
    return { success: true };
  };

  const markAllNotificationsRead = async (): Promise<{ success: boolean; error?: string }> => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, is_read: true }));
      if (!user) {
        try {
          localStorage.setItem('mausam_local_notifications', JSON.stringify(updated.slice(0, 50)));
        } catch (e) {}
      }
      return updated;
    });

    if (user) {
      try {
        await notificationService.markAllNotificationsRead();
      } catch (e) {
        console.warn('[AuthContext] markAllNotificationsRead error:', e);
      }
    }
    return { success: true };
  };

  const recordNotification = async (
    params: CreateNotificationParams
  ): Promise<{ success: boolean; error?: string; notification?: Notification }> => {
    // 1. Guest Mode: Local-first persistence in localStorage
    if (!user) {
      const todayStr = new Date().toISOString().split('T')[0];
      const hourBucket = Math.floor(new Date().getHours() / 4);
      const locSlug = (params.location_name || '').trim().replace(/\s+/g, '_');
      const hazardSlug = (params.hazard || 'general').trim().replace(/\s+/g, '_');
      const dedupKey: string =
        (params.metadata?.dedup_key as string) ||
        `guest_${hazardSlug}_${locSlug}_${todayStr}_h${hourBucket}`;

      const localList = getLocalGuestNotifications();
      const existing =
        notifications.find((n) => (n.metadata as any)?.dedup_key === dedupKey) ||
        localList.find((n) => (n.metadata as any)?.dedup_key === dedupKey);

      if (existing) {
        // Notification already recorded for this guest event; prevent duplicate
        return { success: true, notification: existing };
      }

      const newNotif: Notification = {
        id: params.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`),
        user_id: 'guest',
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

      setNotifications((prev) => {
        if (
          prev.some(
            (n) =>
              n.id === newNotif.id ||
              ((n.metadata as any)?.dedup_key && (n.metadata as any).dedup_key === dedupKey)
          )
        ) {
          return prev;
        }
        const next = [newNotif, ...prev].slice(0, 50);
        try {
          localStorage.setItem('mausam_local_notifications', JSON.stringify(next));
        } catch (e) {}
        return next;
      });

      return { success: true, notification: newNotif };
    }

    // 2. Authenticated Mode: Authoritative Supabase persistence
    try {
      const res = await notificationService.createNotification(params);
      if (res.error) {
        return { success: false, error: res.error };
      }
      if (res.notification) {
        const returnedNotif = res.notification;
        const targetDedupKey = (returnedNotif.metadata as any)?.dedup_key;

        setNotifications((prev) => {
          const exists = prev.some(
            (n) =>
              n.id === returnedNotif.id ||
              (targetDedupKey && (n.metadata as any)?.dedup_key === targetDedupKey)
          );

          if (exists) {
            // Already present in state (preserves user read status without duplication)
            return prev;
          }
          return [returnedNotif, ...prev].slice(0, 50);
        });
      }
      return { success: true, notification: res.notification || undefined };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record notification';
      return { success: false, error: msg };
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isConfigured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,

      // Profile
      profile,
      isProfileLoading,
      refreshProfile,
      updateProfile,

      // Preferences (Phase 3A)
      preferences,
      isPreferencesLoading,
      refreshPreferences,
      updatePreferences,
      savePreferences,

      // Notifications (Phase 3B)
      notificationPreferences,
      isNotificationPreferencesLoading,
      notifications,
      unreadNotificationCount,
      isNotificationsLoading,
      refreshNotificationPreferences,
      updateNotificationPreferences,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      recordNotification,

      // Saved Locations
      savedLocations,
      isSavedLocationsLoading,
      refreshSavedLocations,
      saveLocation,
      updateSavedLocation,
      deleteSavedLocation,
      toggleFavoriteLocation,

      // Search History
      searchHistory,
      isSearchHistoryLoading,
      refreshSearchHistory,
      recordSearch,
      deleteSearchHistoryItem,
      clearAllSearchHistory,
    }),
    [
      user,
      session,
      isLoading,
      profile,
      isProfileLoading,
      refreshProfile,
      preferences,
      isPreferencesLoading,
      refreshPreferences,
      notificationPreferences,
      isNotificationPreferencesLoading,
      notifications,
      unreadNotificationCount,
      isNotificationsLoading,
      refreshNotificationPreferences,
      refreshNotifications,
      savedLocations,
      isSavedLocationsLoading,
      refreshSavedLocations,
      searchHistory,
      isSearchHistoryLoading,
      refreshSearchHistory,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
