import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LocationInfo,
  NormalizedLocation,
  normalizeLocation,
  CurrentWeather,
  HourlyForecastItem,
  DailyForecastItem,
  AirQualityData,
  WeatherAlert,
  PersonaType,
  SupportedLanguage,
  ActiveTabType,
  AgroMetAdvisory,
  PersonaIntelligence,
} from './types';
import { MAJOR_INDIAN_CITIES, normalizePersona } from './data/constants';
import {
  fetchLiveWeatherData,
  fetchAirQualityData,
  generateAlerts,
  generateAgroMetAdvisory,
  getThemeClassesForCondition,
  getWeatherIntelligence,
} from './services/weatherService';
import { locationResolver } from './services/LocationResolver';
import { UserPreferencesUpdate, UserPreferencesLocation } from './types/database';
import { preferencesService } from './services/preferencesService';
import { CompleteWeatherIntelligence } from './services/providers/providerTypes';
import { generatePersonaIntelligence } from './services/personaIntelligenceService';
import { Header } from './components/Header';
import { WeatherHero } from './components/WeatherHero';
import { HourlyForecast } from './components/HourlyForecast';
import { WeatherChart } from './components/WeatherChart';
import { DailyForecast } from './components/DailyForecast';
import { WeatherDetailsGrid } from './components/WeatherDetailsGrid';
import { AlertsBanner } from './components/AlertsBanner';
import { ForYouPersonalizedSection } from './components/ForYouPersonalizedSection';
import { PersonaDetailsModal } from './components/PersonaDetailsModal';
import { OnboardingFlow } from './components/OnboardingFlow';
import { LocationSearchModal } from './components/LocationSearchModal';
import { PersonaSelectorModal } from './components/PersonaSelectorModal';
import { RadarMapSection } from './components/RadarMapSection';
import { AgroMetSection } from './components/AgroMetSection';
import { TravelModeSection } from './components/TravelModeSection';
import { MausamGramSection } from './components/MausamGramSection';
import { MausamAiChat } from './components/MausamAiChat';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { NotificationCenter } from './components/NotificationCenter';
import { Navigation } from './components/Navigation';
import { MausamMarineCard } from './components/MausamMarineCard';
import { MausamThunderstormCard } from './components/MausamThunderstormCard';
import { MausamFloodRiskCard } from './components/MausamFloodRiskCard';
import { MausamCycloneCard } from './components/MausamCycloneCard';
import { MausamHistoricalClimateCard } from './components/MausamHistoricalClimateCard';
import { DataSourceTransparencyModal } from './components/DataSourceTransparencyModal';
import { AutoLocationModal } from './components/AutoLocationModal';
import { autoLocationManager, AutoLocationState } from './services/autoLocationManager';
import { Loader2, RefreshCw, AlertCircle, ShieldAlert, Sparkles, Sprout, Car, Users, Bot, Database, Navigation2, CheckCircle2 } from 'lucide-react';
import { useAuth } from './services/AuthContext';
import {
  evaluateWeatherAlertsForNotifications,
  filterDuplicateCandidates,
} from './services/notificationBridge';

export function App() {
  const {
    user,
    profile,
    isLoading: isAuthLoading,
    notificationPreferences,
    notifications,
    isNotificationsLoading,
    recordNotification,
    savedLocations,
  } = useAuth();

  // Auto-Location state and modal visibility
  const [autoLocationState, setAutoLocationState] = useState<AutoLocationState>(() =>
    autoLocationManager.getState()
  );
  const [isAutoLocationOpen, setIsAutoLocationOpen] = useState(false);
  const [locationToast, setLocationToast] = useState<{ message: string; type: 'info' | 'success' } | null>(null);

  // App State - First Launch Onboarding & State Persistence
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mausam_onboarding_completed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [currentLocation, setCurrentLocation] = useState<LocationInfo>(() => {
    try {
      const saved = localStorage.getItem('mausam_selected_location');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return MAJOR_INDIAN_CITIES[0]; // Mumbai default
  });

  const [recentLocations, setRecentLocations] = useState<LocationInfo[]>(() => {
    try {
      const saved = localStorage.getItem('mausam_recents');
      return saved ? JSON.parse(saved) : MAJOR_INDIAN_CITIES.slice(0, 3);
    } catch (e) {
      return MAJOR_INDIAN_CITIES.slice(0, 3);
    }
  });

  const [activeTab, setActiveTab] = useState<ActiveTabType>('home');

  // Personas - Primary + Multi-selection
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaType[]>(() => {
    try {
      const saved = localStorage.getItem('mausam_selected_personas');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p) => normalizePersona(p));
        }
      }
    } catch (e) {}
    return ['runner', 'commuter'];
  });

  const [primaryPersona, setPrimaryPersona] = useState<PersonaType>(() => {
    try {
      const saved = localStorage.getItem('mausam_primary_persona');
      if (saved) return normalizePersona(saved);
    } catch (e) {}
    return 'runner';
  });

  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem('mausam_selected_language');
      if (saved) return saved as SupportedLanguage;
    } catch (e) {}
    return 'en';
  });

  // Sync preferred language from Supabase profile when authenticated
  useEffect(() => {
    if (profile?.preferred_language && profile.preferred_language !== currentLanguage) {
      setCurrentLanguage(profile.preferred_language as SupportedLanguage);
    }
  }, [profile?.preferred_language]);

  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>(() => {
    try {
      const saved = localStorage.getItem('mausam_temperature_unit');
      if (saved === 'C' || saved === 'F') return saved;
    } catch (e) {}
    return 'C';
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mausam_high_contrast') === 'true';
    } catch (e) {}
    return false;
  });

  const [largeText, setLargeText] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mausam_large_text') === 'true';
    } catch (e) {}
    return false;
  });

  // Persistence Refs & Debouncing (Phase 3A)
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<UserPreferencesUpdate>({});
  const isHydratingFromCloudRef = useRef<boolean>(false);
  const lastAuthUserIdRef = useRef<string | null>(null);

  const queuePersistPreferences = useCallback(
    (updates: UserPreferencesUpdate) => {
      if (!user || isHydratingFromCloudRef.current) return;

      pendingUpdatesRef.current = {
        ...pendingUpdatesRef.current,
        ...updates,
      };

      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }

      persistTimeoutRef.current = setTimeout(() => {
        const toSave = { ...pendingUpdatesRef.current };
        pendingUpdatesRef.current = {};
        preferencesService.updateUserPreferences(toSave).catch((err) => {
          console.warn('[App] Non-blocking preferences cloud sync failed:', err);
        });
      }, 600);
    },
    [user]
  );

  // Preference Handlers
  const handleToggleTempUnit = (unit: 'C' | 'F') => {
    setTemperatureUnit(unit);
    try {
      localStorage.setItem('mausam_temperature_unit', unit);
    } catch (e) {}
    queuePersistPreferences({ temperature_unit: unit });
  };

  const handleToggleHighContrast = (val: boolean) => {
    setHighContrast(val);
    try {
      localStorage.setItem('mausam_high_contrast', String(val));
    } catch (e) {}
    queuePersistPreferences({ high_contrast: val });
  };

  const handleToggleLargeText = (val: boolean) => {
    setLargeText(val);
    try {
      localStorage.setItem('mausam_large_text', String(val));
    } catch (e) {}
    queuePersistPreferences({ large_text: val });
  };

  const handleSelectPrimaryPersona = (p: PersonaType) => {
    setPrimaryPersona(p);
    try {
      localStorage.setItem('mausam_primary_persona', p);
    } catch (e) {}
    queuePersistPreferences({ primary_persona: p });
  };

  const handleUpdatePersonas = (personas: PersonaType[], primary: PersonaType) => {
    setSelectedPersonas(personas);
    setPrimaryPersona(primary);
    try {
      localStorage.setItem('mausam_selected_personas', JSON.stringify(personas));
      localStorage.setItem('mausam_primary_persona', primary);
    } catch (e) {}
    queuePersistPreferences({
      selected_personas: personas,
      primary_persona: primary,
    });
  };

  // Cloud Preferences Synchronization (Phase 3A)
  useEffect(() => {
    const syncUserPreferences = async () => {
      // 1. Authenticated user signed in or switched account
      if (user) {
        if (lastAuthUserIdRef.current === user.id) return;
        lastAuthUserIdRef.current = user.id;

        try {
          const res = await preferencesService.getUserPreferences();
          if (res.preferences) {
            // Restore from cloud and update local storage fallback
            isHydratingFromCloudRef.current = true;
            const cloud = res.preferences;

            if (cloud.primary_persona) {
              const normPrimary = normalizePersona(cloud.primary_persona);
              setPrimaryPersona(normPrimary);
              try {
                localStorage.setItem('mausam_primary_persona', normPrimary);
              } catch (e) {}
            }

            if (Array.isArray(cloud.selected_personas) && cloud.selected_personas.length > 0) {
              const normSelected = cloud.selected_personas.map((p) => normalizePersona(p));
              setSelectedPersonas(normSelected);
              try {
                localStorage.setItem('mausam_selected_personas', JSON.stringify(normSelected));
              } catch (e) {}
            }

            if (cloud.temperature_unit === 'C' || cloud.temperature_unit === 'F') {
              setTemperatureUnit(cloud.temperature_unit);
              try {
                localStorage.setItem('mausam_temperature_unit', cloud.temperature_unit);
              } catch (e) {}
            }

            if (typeof cloud.high_contrast === 'boolean') {
              setHighContrast(cloud.high_contrast);
              try {
                localStorage.setItem('mausam_high_contrast', String(cloud.high_contrast));
              } catch (e) {}
            }

            if (typeof cloud.large_text === 'boolean') {
              setLargeText(cloud.large_text);
              try {
                localStorage.setItem('mausam_large_text', String(cloud.large_text));
              } catch (e) {}
            }

            if (cloud.default_location && typeof cloud.default_location === 'object' && cloud.default_location.name) {
              const dl = cloud.default_location;
              const latVal = typeof dl.latitude === 'number' ? dl.latitude : (dl.lat ?? 19.076);
              const lonVal = typeof dl.longitude === 'number' ? dl.longitude : (dl.lon ?? 72.877);
              const locToNormalize: LocationInfo = {
                id: dl.id || `loc-${latVal.toFixed(5)}-${lonVal.toFixed(5)}`,
                name: dl.name,
                displayName: dl.displayName,
                lat: latVal,
                lon: lonVal,
                country: dl.country || 'India',
                state: dl.state || dl.region || 'India',
                district: dl.district,
                city: dl.city,
                village: dl.village,
                postcode: dl.postcode,
                countryCode: dl.countryCode || 'IN',
                timezone: dl.timezone || 'Asia/Kolkata',
                elevation: dl.elevation,
                source: (dl.source as LocationInfo['source']) || 'catalog',
                isCurrent: Boolean(dl.isCurrent),
              };
              const normLoc = normalizeLocation(locToNormalize);
              setCurrentLocation(normLoc);
              try {
                localStorage.setItem('mausam_selected_location', JSON.stringify(normLoc));
              } catch (e) {}
            }

            setTimeout(() => {
              isHydratingFromCloudRef.current = false;
            }, 50);
          } else {
            // Cloud preferences do not exist: save current local preferences as initial cloud record
            const locPayload: UserPreferencesLocation = {
              id: currentLocation.id,
              name: currentLocation.name,
              displayName: currentLocation.displayName || currentLocation.name,
              latitude: currentLocation.lat,
              longitude: currentLocation.lon,
              lat: currentLocation.lat,
              lon: currentLocation.lon,
              country: currentLocation.country || 'India',
              region: currentLocation.state || 'India',
              state: currentLocation.state || 'India',
              district: currentLocation.district,
              city: currentLocation.city,
            };

            await preferencesService.upsertUserPreferences({
              primary_persona: primaryPersona,
              selected_personas: selectedPersonas,
              default_location: locPayload,
              temperature_unit: temperatureUnit,
              high_contrast: highContrast,
              large_text: largeText,
            });
          }
        } catch (err) {
          console.warn('[App] Failed to synchronize preferences with cloud:', err);
          isHydratingFromCloudRef.current = false;
        }
      } else {
        // User signed out: restore clean local guest preferences to prevent leakage between users
        if (lastAuthUserIdRef.current !== null) {
          lastAuthUserIdRef.current = null;
          isHydratingFromCloudRef.current = true;

          const defaultGuestPersonas: PersonaType[] = ['runner', 'commuter'];
          const defaultGuestPrimary: PersonaType = 'runner';
          const defaultGuestLocation = MAJOR_INDIAN_CITIES[0];

          setPrimaryPersona(defaultGuestPrimary);
          setSelectedPersonas(defaultGuestPersonas);
          setTemperatureUnit('C');
          setHighContrast(false);
          setLargeText(false);
          setCurrentLocation(defaultGuestLocation);

          try {
            localStorage.setItem('mausam_primary_persona', defaultGuestPrimary);
            localStorage.setItem('mausam_selected_personas', JSON.stringify(defaultGuestPersonas));
            localStorage.setItem('mausam_temperature_unit', 'C');
            localStorage.setItem('mausam_high_contrast', 'false');
            localStorage.setItem('mausam_large_text', 'false');
            localStorage.setItem('mausam_selected_location', JSON.stringify(defaultGuestLocation));
          } catch (e) {}

          setTimeout(() => {
            isHydratingFromCloudRef.current = false;
          }, 50);
        }
      }
    };

    syncUserPreferences();
  }, [user]);

  // Weather Data State
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [hourly, setHourly] = useState<HourlyForecastItem[]>([]);
  const [daily, setDaily] = useState<DailyForecastItem[]>([]);
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [agroMet, setAgroMet] = useState<AgroMetAdvisory | null>(null);
  const [intelligence, setIntelligence] = useState<CompleteWeatherIntelligence | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHourIndex, setSelectedHourIndex] = useState(0);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPersonaOpen, setIsPersonaOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initial Entrance Authentication Gate: popup login on entry if not logged in and not in guest session
  const [hasChosenAuth, setHasChosenAuth] = useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem('mausam_guest_session') === 'true' ||
        localStorage.getItem('mausam_guest_mode') === 'true'
      );
    } catch (e) {
      return false;
    }
  });

  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(() => {
    try {
      const guestSession =
        sessionStorage.getItem('mausam_guest_session') === 'true' ||
        localStorage.getItem('mausam_guest_mode') === 'true';
      return !guestSession;
    } catch (e) {
      return true;
    }
  });

  // Automatically adjust auth modal once initial auth resolution completes
  useEffect(() => {
    if (!isAuthLoading) {
      if (user) {
        setIsAuthOpen(false);
      } else if (!hasChosenAuth) {
        setIsAuthOpen(true);
      }
    }
  }, [isAuthLoading, user, hasChosenAuth]);

  const handleContinueAsGuest = () => {
    try {
      sessionStorage.setItem('mausam_guest_session', 'true');
      localStorage.setItem('mausam_guest_mode', 'true');
    } catch (e) {}
    setHasChosenAuth(true);
    setIsAuthOpen(false);
  };

  const handleCloseAuth = () => {
    try {
      sessionStorage.setItem('mausam_guest_session', 'true');
    } catch (e) {}
    setHasChosenAuth(true);
    setIsAuthOpen(false);
  };

  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [isTransparencyOpen, setIsTransparencyOpen] = useState(false);
  const [detailsModalIntel, setDetailsModalIntel] = useState<PersonaIntelligence | null>(null);
  const recordedNotificationKeysRef = useRef<Set<string>>(new Set());
  const activeWeatherRequestSeqRef = useRef<number>(0);

  // Load weather when location changes with stale request protection
  const loadWeatherData = async (loc: LocationInfo | NormalizedLocation, refresh = false) => {
    const requestSeq = ++activeWeatherRequestSeqRef.current;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const intelData = await getWeatherIntelligence(loc, refresh);
      if (requestSeq !== activeWeatherRequestSeqRef.current) {
        // Newer location request in flight; discard stale response
        return;
      }
      setIntelligence(intelData);

      if (intelData.isUnavailable || intelData.freshness?.isUnavailable) {
        setError(
          intelData.unavailableReason ||
            `Weather data is temporarily unavailable for ${loc.name}. Please check your connection and tap Try Again.`
        );
        return;
      }

      setWeather(intelData.legacyWeather);
      setHourly(intelData.legacyHourly);
      setDaily(intelData.legacyDaily);
      setAirQuality(intelData.legacyAirQuality);
      setAlerts(intelData.alerts);

      const generatedAgro = generateAgroMetAdvisory(
        loc.name,
        intelData.legacyWeather,
        intelData.legacyDaily
      );
      setAgroMet(generatedAgro);

      setSelectedHourIndex(0);
    } catch (err: any) {
      if (requestSeq !== activeWeatherRequestSeqRef.current) return;
      console.error('Error fetching weather intelligence:', err);
      setError('Unable to load live meteorological data. Please check your internet connection.');
    } finally {
      if (requestSeq === activeWeatherRequestSeqRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    loadWeatherData(currentLocation);
  }, [currentLocation]);

  // Phase 3B: Automatically evaluate weather events into persistent notifications
  useEffect(() => {
    recordedNotificationKeysRef.current.clear();
  }, [user?.id]);

  // Seed recorded keys from persisted notifications (both read and unread) to prevent duplicate generation
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      for (const notif of notifications) {
        let key: string | null = null;
        if (notif.metadata) {
          if (typeof notif.metadata === 'object' && notif.metadata !== null) {
            key = (notif.metadata as any).dedup_key || null;
          } else if (typeof notif.metadata === 'string') {
            try {
              key = JSON.parse(notif.metadata)?.dedup_key || null;
            } catch {}
          }
        }
        if (key) {
          recordedNotificationKeysRef.current.add(String(key));
        }
      }
    }
  }, [notifications]);

  useEffect(() => {
    // Wait until auth initialization and notification loading have completed
    if (isAuthLoading || (user && isNotificationsLoading)) return;
    if (!intelligence || !currentLocation) return;

    try {
      const candidates = evaluateWeatherAlertsForNotifications(
        intelligence,
        currentLocation,
        notificationPreferences,
        savedLocations
      );

      const freshCandidates = filterDuplicateCandidates(candidates, notifications);

      for (const cand of freshCandidates) {
        const dedupKey = (cand.metadata as any)?.dedup_key || cand.dedupKey || cand.title;
        if (recordedNotificationKeysRef.current.has(dedupKey)) {
          continue;
        }
        recordedNotificationKeysRef.current.add(dedupKey);

        recordNotification(cand).catch((err) => {
          console.warn('[App] Non-blocking notification recording:', err);
        });
      }
    } catch (err) {
      console.warn('[App] Notification evaluation error:', err);
    }
  }, [
    intelligence,
    currentLocation,
    notificationPreferences,
    savedLocations,
    notifications,
    isAuthLoading,
    user,
    isNotificationsLoading,
    recordNotification,
  ]);

  // Select Location handler
  const handleSelectLocation = (loc: LocationInfo | NormalizedLocation) => {
    const normalized = locationResolver.normalize(loc);
    setCurrentLocation(normalized);
    try {
      localStorage.setItem('mausam_selected_location', JSON.stringify(normalized));
    } catch (e) {}
    // Add to recents
    setRecentLocations((prev) => {
      const filtered = prev.filter((item) => item.id !== normalized.id);
      const updated = [normalized, ...filtered].slice(0, 6);
      try {
        localStorage.setItem('mausam_recents', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (user) {
      const locPayload: UserPreferencesLocation = {
        id: normalized.id,
        name: normalized.name,
        displayName: normalized.displayName || normalized.name,
        latitude: normalized.lat,
        longitude: normalized.lon,
        lat: normalized.lat,
        lon: normalized.lon,
        country: normalized.country || 'India',
        region: normalized.state || 'India',
        state: normalized.state || 'India',
        district: normalized.district,
        city: normalized.city,
        source: normalized.source,
        isCurrent: normalized.isCurrent,
      };
      queuePersistPreferences({ default_location: locPayload });
    }
  };

  const handleCompleteOnboarding = (data: {
    selectedPersonas: PersonaType[];
    primaryPersona: PersonaType;
    language: SupportedLanguage;
    location: LocationInfo;
  }) => {
    setSelectedPersonas(data.selectedPersonas);
    setPrimaryPersona(data.primaryPersona);
    setCurrentLanguage(data.language);
    setCurrentLocation(data.location);
    setHasCompletedOnboarding(true);
    try {
      localStorage.setItem('mausam_onboarding_completed', 'true');
      localStorage.setItem('mausam_selected_personas', JSON.stringify(data.selectedPersonas));
      localStorage.setItem('mausam_primary_persona', data.primaryPersona);
      localStorage.setItem('mausam_selected_language', data.language);
      localStorage.setItem('mausam_selected_location', JSON.stringify(data.location));
    } catch (e) {}

    if (user) {
      const locPayload: UserPreferencesLocation = {
        id: data.location.id,
        name: data.location.name,
        displayName: data.location.displayName || data.location.name,
        latitude: data.location.lat,
        longitude: data.location.lon,
        lat: data.location.lat,
        lon: data.location.lon,
        country: data.location.country || 'India',
        region: data.location.state || 'India',
        state: data.location.state || 'India',
      };
      queuePersistPreferences({
        primary_persona: data.primaryPersona,
        selected_personas: data.selectedPersonas,
        default_location: locPayload,
      });
    }
  };

  const handleResetOnboarding = () => {
    try {
      localStorage.removeItem('mausam_onboarding_completed');
    } catch (e) {}
    setHasCompletedOnboarding(false);
  };

  const handlePersonaActionClick = (actionType: string) => {
    if (actionType === 'agromet') setActiveTab('more');
    else if (actionType === 'travel') setActiveTab('more');
    else if (actionType === 'radar') setActiveTab('radar');
    else if (actionType === 'alerts') setActiveTab('alerts');
  };

  // Auto-Location state listener
  useEffect(() => {
    const unsubscribe = autoLocationManager.subscribe((state) => {
      setAutoLocationState(state);
    });
    return unsubscribe;
  }, []);

  // Continuous Auto-Location Tracking & App Entry GPS Acquisition
  useEffect(() => {
    // 1. Setup auto-tracking callback: triggers on periodic interval and on movement > 300m
    autoLocationManager.startAutoTracking((resolvedLoc, reason) => {
      handleSelectLocation(resolvedLoc);
      if (reason === 'movement') {
        setLocationToast({
          message: `Location updated: ${resolvedLoc.name} (${resolvedLoc.lat.toFixed(3)}°, ${resolvedLoc.lon.toFixed(3)}°)`,
          type: 'info',
        });
        setTimeout(() => setLocationToast(null), 4000);
      } else if (reason === 'timer') {
        setLocationToast({
          message: `Live GPS reloaded: ${resolvedLoc.name}`,
          type: 'success',
        });
        setTimeout(() => setLocationToast(null), 3000);
      }
    });

    // 2. When entering the app: acquire proper current location of user
    const acquireOnEntry = async () => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        // Show brief entry indicator
        setLocationToast({
          message: 'Acquiring your exact current location...',
          type: 'info',
        });

        const entryLoc = await autoLocationManager.acquireExactLocation('initial', true);
        if (entryLoc) {
          handleSelectLocation(entryLoc);
          setLocationToast({
            message: `Exact location: ${entryLoc.name}`,
            type: 'success',
          });
          setTimeout(() => setLocationToast(null), 3500);
        } else {
          setTimeout(() => setLocationToast(null), 2500);
        }
      }
    };

    acquireOnEntry();

    return () => {
      autoLocationManager.stopAutoTracking();
    };
  }, []);

  // GPS Current Location handler - delegates to autoLocationManager
  const handleUseCurrentLocation = async () => {
    setIsLoadingLocation(true);
    setLocationToast({
      message: 'Locating exact coordinates via GPS...',
      type: 'info',
    });

    try {
      const resolvedLoc = await autoLocationManager.acquireExactLocation('manual', true);
      if (resolvedLoc) {
        handleSelectLocation(resolvedLoc);
        setLocationToast({
          message: `Location set to ${resolvedLoc.name}`,
          type: 'success',
        });
        setTimeout(() => setLocationToast(null), 3500);
      } else {
        setLocationToast({
          message: 'Could not acquire GPS position. Please check permissions.',
          type: 'info',
        });
        setTimeout(() => setLocationToast(null), 3500);
      }
    } catch (e) {
      console.warn('GPS location resolution error:', e);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Dynamic Atmospheric Theme Background
  const theme = weather
    ? getThemeClassesForCondition(weather.conditionKey, weather.isDay)
    : {
        bgGradient: 'from-sky-100/60 via-slate-50 to-slate-50',
        heroAccent: 'text-sky-600',
        cardBg: 'bg-white/90 border-slate-200 text-slate-900',
        isDark: false,
      };

  // Persona Intelligence Generation
  const primaryIntelligence =
    weather && airQuality
      ? generatePersonaIntelligence(
          primaryPersona,
          weather,
          hourly,
          daily,
          airQuality,
          currentLocation.name,
          intelligence?.marine
        )
      : null;

  const allSelectedIntelligences =
    weather && airQuality
      ? selectedPersonas.map((p) =>
          generatePersonaIntelligence(p, weather, hourly, daily, airQuality, currentLocation.name, intelligence?.marine)
        )
      : [];

  return (
    <div
      className={`w-full max-w-full overflow-x-hidden min-h-screen flex flex-col bg-gradient-to-b ${theme.bgGradient} ${
        theme.isDark ? 'text-white' : 'text-slate-900'
      } transition-colors duration-500 pb-nav-safe sm:pb-8 selection:bg-sky-200 ${
        highContrast ? 'contrast-125' : ''
      } ${largeText ? 'text-base' : 'text-sm'}`}
    >
      {/* Top Header */}
      <Header
        currentLocation={currentLocation}
        onOpenSearch={() => setIsSearchOpen(true)}
        onUseCurrentLocation={handleUseCurrentLocation}
        isLoadingLocation={isLoadingLocation}
        selectedPersona={primaryPersona}
        onOpenPersonaModal={() => setIsPersonaOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNotifications={() => setIsNotificationCenterOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        currentLanguage={currentLanguage}
        isDark={theme.isDark}
        autoLocationState={autoLocationState}
        onOpenAutoLocationModal={() => setIsAutoLocationOpen(true)}
      />

      {/* Floating GPS & Location Reload Notification Toast */}
      {locationToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-top-2 fade-in duration-200 pointer-events-none px-4 max-w-md w-full">
          <div
            className={`mx-auto flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md border ${
              locationToast.type === 'success'
                ? 'bg-slate-900/90 border-emerald-500/30 text-emerald-100'
                : 'bg-slate-900/90 border-sky-500/30 text-sky-100'
            }`}
          >
            {locationToast.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Navigation2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
            )}
            <span className="truncate">{locationToast.message}</span>
          </div>
        </div>
      )}

      {/* Desktop / Tablet Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        hasActiveAlerts={alerts.some((a) => a.severity === 'severe' || a.severity === 'warning')}
        isDark={theme.isDark}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 w-full max-w-2xl mx-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
            <span
              className={`text-xs font-semibold tracking-wide transition-colors ${
                theme.isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              Connecting to Indian Meteorological Network...
            </span>
          </div>
        ) : error ? (
          <div className="p-6 text-center max-w-md mx-auto my-12 bg-white/80 backdrop-blur-md rounded-3xl border border-rose-200 shadow-sm mx-4">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-900">Weather Unavailable</h3>
            <p className="text-xs text-slate-600 mt-1 mb-4">{error}</p>
            <button
              id="app-error-retry-btn"
              onClick={() => loadWeatherData(currentLocation)}
              className="min-h-[44px] px-6 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:bg-slate-950 transition-all touch-manipulation active:scale-95"
            >
              Try Again
            </button>
          </div>
        ) : weather && airQuality ? (
          <>
            {/* VIEW 1: HOME (Google Weather Minimal Clean + MAUSAM Persona Intelligence) */}
            {activeTab === 'home' && (
              <div className="animate-in fade-in duration-200">
                {/* 1. Hero */}
                <WeatherHero
                  weather={weather}
                  location={currentLocation}
                  temperatureUnit={temperatureUnit}
                  isDark={theme.isDark}
                  freshness={intelligence?.freshness}
                  onRefresh={() => loadWeatherData(currentLocation, true)}
                  isRefreshing={isRefreshing}
                  onOpenTransparency={() => setIsTransparencyOpen(true)}
                />

                {/* Resilient Fallback Notice (if Level > 0) */}
                {intelligence?.freshness && intelligence.freshness.fallbackLevel > 0 && (
                  <div className="max-w-2xl mx-auto px-4 mb-3">
                    <div className="flex items-center gap-2 text-xs py-2 px-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate flex-1">
                        {intelligence.freshness.fallbackReason ||
                          'Displaying verified same-location cached intelligence.'}
                      </span>
                      <button
                        onClick={() => setIsTransparencyOpen(true)}
                        className="text-[11px] font-semibold underline hover:no-underline shrink-0"
                      >
                        Status
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Active Severe Alerts Banner (If warning active) */}
                <AlertsBanner
                  alerts={alerts}
                  onViewAllAlerts={() => setActiveTab('alerts')}
                />

                {/* 3. Hourly Forecast Horizontal Capsules */}
                <HourlyForecast
                  hourly={hourly}
                  selectedHourIndex={selectedHourIndex}
                  onSelectHour={setSelectedHourIndex}
                  temperatureUnit={temperatureUnit}
                />

                {/* 4. Minimal Weather Trend Chart */}
                <WeatherChart
                  hourly={hourly}
                  temperatureUnit={temperatureUnit}
                />

                {/* 5. Daily 10-Day Forecast Teaser */}
                <DailyForecast
                  daily={daily}
                  temperatureUnit={temperatureUnit}
                />

                {/* 6. "FOR YOU" - The most important personalized section on Home */}
                {primaryIntelligence && (
                  <ForYouPersonalizedSection
                    primaryIntelligence={primaryIntelligence}
                    allSelectedIntelligences={allSelectedIntelligences}
                    selectedPersonas={selectedPersonas}
                    onSelectPrimaryPersona={handleSelectPrimaryPersona}
                    onOpenManagePersonas={() => setIsPersonaOpen(true)}
                    onOpenDetails={(intel) => setDetailsModalIntel(intel)}
                    language={currentLanguage}
                  />
                )}

                {/* 7. Comprehensive Weather Details Bento Grid (AQI, Wind, UV, Humidity, etc.) */}
                <WeatherDetailsGrid
                  weather={weather}
                  airQuality={airQuality}
                  temperatureUnit={temperatureUnit}
                  isDark={theme.isDark}
                />

                {/* 8. Coastal Marine Conditions (if coastal station) */}
                {intelligence?.marine && intelligence.marine.isCoastal && (
                  <div className="px-4 mt-3">
                    <MausamMarineCard marine={intelligence.marine} />
                  </div>
                )}

                {/* 9. Copernicus ERA5 Historical Climate Trends */}
                {intelligence?.historical && (
                  <div className="px-4 mt-3 mb-2">
                    <MausamHistoricalClimateCard historical={intelligence.historical} />
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: FORECAST (Deep Hourly & 10-Day Breakdown) */}
            {activeTab === 'forecast' && (
              <div className="animate-in fade-in duration-200 pt-2">
                <div className="px-4 mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2
                        className={`text-lg font-bold transition-colors ${
                          theme.isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {currentLocation.name} Forecast
                      </h2>
                      <p
                        className={`text-xs transition-colors ${
                          theme.isDark ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Hourly trends, rain likelihood, and 10-day outlook
                      </p>
                    </div>
                    <button
                      id="forecast-refresh-btn"
                      onClick={() => loadWeatherData(currentLocation, true)}
                      disabled={isRefreshing}
                      className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors touch-manipulation active:scale-95 shrink-0 ${
                        theme.isDark
                          ? 'hover:bg-white/10 active:bg-white/20 text-slate-200'
                          : 'hover:bg-slate-100 active:bg-slate-200 text-slate-600'
                      }`}
                      title="Refresh forecast"
                      aria-label="Refresh forecast"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
                    </button>
                  </div>
                </div>

                <HourlyForecast
                  hourly={hourly}
                  selectedHourIndex={selectedHourIndex}
                  onSelectHour={setSelectedHourIndex}
                  temperatureUnit={temperatureUnit}
                />

                <WeatherChart
                  hourly={hourly}
                  temperatureUnit={temperatureUnit}
                />

                <DailyForecast
                  daily={daily}
                  temperatureUnit={temperatureUnit}
                />
              </div>
            )}

            {/* VIEW 3: RADAR & MAPS */}
            {activeTab === 'radar' && (
              <div className="animate-in fade-in duration-200 pt-2">
                <RadarMapSection
                  location={currentLocation}
                  onSelectLocation={handleSelectLocation}
                  onNavigateToForecast={() => setActiveTab('forecast')}
                  temperatureUnit={temperatureUnit}
                  marine={intelligence?.marine}
                  flood={intelligence?.flood}
                  alerts={alerts}
                  currentWeather={weather || undefined}
                />
              </div>
            )}

            {/* VIEW 4: ALERTS & BULLETINS */}
            {activeTab === 'alerts' && (
              <div className="animate-in fade-in duration-200 pt-2">
                <div className="px-4 mb-3">
                  <h2
                    className={`text-lg font-bold transition-colors ${
                      theme.isDark ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    Weather Alerts & Bulletins
                  </h2>
                  <p
                    className={`text-xs transition-colors ${
                      theme.isDark ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Severe weather alerts, nowcasts & safety advisories
                  </p>
                </div>

                <AlertsBanner alerts={alerts} />

                {/* Real Open-Data Surveillance & Risk Models */}
                {intelligence?.thunderstorm && (
                  <div className="px-4 my-2">
                    <MausamThunderstormCard thunderstorm={intelligence.thunderstorm} />
                  </div>
                )}

                {intelligence?.flood && (
                  <div className="px-4 my-2">
                    <MausamFloodRiskCard flood={intelligence.flood} />
                  </div>
                )}

                {intelligence?.cyclone && (
                  <div className="px-4 my-2">
                    <MausamCycloneCard cyclone={intelligence.cyclone} />
                  </div>
                )}

                {/* Additional Public Safety Guidelines */}
                <div className="px-4 my-3">
                  <div
                    className={`backdrop-blur-md rounded-3xl p-4 border shadow-xs transition-colors ${
                      theme.isDark
                        ? 'bg-slate-900/80 border-white/10 text-slate-200'
                        : 'bg-white/85 border-black/[0.05] text-slate-600'
                    }`}
                  >
                    <h3
                      className={`text-sm font-semibold mb-2 flex items-center gap-1.5 ${
                        theme.isDark ? 'text-white' : 'text-slate-800'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4 text-sky-400" />
                      <span>Monsoon & Thunderstorm Safety Guidelines</span>
                    </h3>
                    <div
                      className={`space-y-2 text-xs leading-relaxed ${
                        theme.isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      <p>
                        • <strong>During Lightning:</strong> Move indoors immediately. Stay away from open windows, electrical appliances, and wire fences.
                      </p>
                      <p>
                        • <strong>Waterlogged Roads:</strong> Avoid driving through standing water of unknown depth. Submerged manholes pose severe hazards.
                      </p>
                      <p>
                        • <strong>Coastal Waves:</strong> Obey red flag warnings along beaches and promenades during high tide periods.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 5: MORE / EXPLORE (Krishi Agro-Met, Travel, MausamGram, AI Chat) */}
            {activeTab === 'more' && (
              <div className="animate-in fade-in duration-200 pt-2 space-y-3">
                <div className="px-4 mb-2">
                  <h2
                    className={`text-lg font-bold transition-colors ${
                      theme.isDark ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    Specialized Weather Features
                  </h2>
                  <p
                    className={`text-xs transition-colors ${
                      theme.isDark ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Agricultural advisories, highway journeys, citizen reports, and AI assistant
                  </p>
                </div>

                {/* 1. Agro-Met Section */}
                {agroMet && (
                  <AgroMetSection
                    advisory={agroMet}
                    weather={weather}
                    locationName={currentLocation.name}
                  />
                )}

                {/* 2. Travel Route Section */}
                <TravelModeSection currentCity={currentLocation.name} />

                {/* 3. Mausam AI Assistant Chat */}
                <MausamAiChat
                  location={currentLocation}
                  weather={weather}
                  persona={primaryPersona}
                />

                {/* 4. MausamGram Citizen Observations */}
                <MausamGramSection
                  currentCity={currentLocation.name}
                  currentTemp={weather?.temperature}
                />

                {/* 5. Open Data Transparency & Attribution */}
                <div className="px-4 pb-2">
                  <div
                    className={`backdrop-blur-md rounded-3xl p-4 border shadow-xs flex items-center justify-between gap-3 transition-colors ${
                      theme.isDark
                        ? 'bg-slate-900/80 border-white/10 text-slate-200'
                        : 'bg-white/85 border-black/[0.05] text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-2 rounded-2xl shrink-0 ${
                          theme.isDark
                            ? 'bg-sky-950/80 text-sky-300 border border-sky-800/40'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3
                          className={`text-sm font-semibold ${
                            theme.isDark ? 'text-white' : 'text-slate-800'
                          }`}
                        >
                          Open Data Architecture & Sources
                        </h3>
                        <p
                          className={`text-[11px] ${
                            theme.isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          Open-Meteo, NASA GIBS, Copernicus ERA5 & Mausam Intelligence Engine
                        </p>
                      </div>
                    </div>
                    <button
                      id="open-data-transparency-btn"
                      onClick={() => setIsTransparencyOpen(true)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-all shrink-0 touch-manipulation ${
                        theme.isDark
                          ? 'bg-sky-500 hover:bg-sky-400 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      View Sources
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>

      {/* Modals & Overlays */}
      <LocationSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectLocation={handleSelectLocation}
        onUseCurrentLocation={handleUseCurrentLocation}
        isLoadingLocation={isLoadingLocation}
        recentLocations={recentLocations}
      />

      <PersonaSelectorModal
        isOpen={isPersonaOpen}
        onClose={() => setIsPersonaOpen(false)}
        selectedPersona={primaryPersona}
        selectedPersonas={selectedPersonas}
        onSelectPersona={handleSelectPrimaryPersona}
        onUpdatePersonas={handleUpdatePersonas}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentLanguage={currentLanguage}
        onSelectLanguage={(lang) => {
          setCurrentLanguage(lang);
          try {
            localStorage.setItem('mausam_selected_language', lang);
          } catch (e) {}
        }}
        tempUnit={temperatureUnit}
        onToggleTempUnit={handleToggleTempUnit}
        highContrast={highContrast}
        onToggleHighContrast={handleToggleHighContrast}
        largeText={largeText}
        onToggleLargeText={handleToggleLargeText}
        selectedPersonas={selectedPersonas}
        primaryPersona={primaryPersona}
        defaultLocation={currentLocation}
        onSetDefaultLocation={handleSelectLocation}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenPersonaModal={() => setIsPersonaOpen(true)}
        onResetOnboarding={handleResetOnboarding}
        onOpenAuth={() => setIsAuthOpen(true)}
        autoLocationState={autoLocationState}
        onToggleAutoLocation={(enabled) => autoLocationManager.setAutoEnabled(enabled)}
        onSelectAutoLocationInterval={(mins) => autoLocationManager.setIntervalMinutes(mins)}
        onReloadLocationNow={handleUseCurrentLocation}
      />

      {/* Live GPS & Auto-Reload Configuration Modal */}
      <AutoLocationModal
        isOpen={isAutoLocationOpen}
        onClose={() => setIsAutoLocationOpen(false)}
        state={autoLocationState}
        currentLocation={currentLocation}
        onManualReload={handleUseCurrentLocation}
        onToggleAuto={(enabled) => autoLocationManager.setAutoEnabled(enabled)}
        onSelectInterval={(mins) => autoLocationManager.setIntervalMinutes(mins)}
      />

      {/* Supabase Authentication & Profile Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={handleCloseAuth}
        onContinueAsGuest={handleContinueAsGuest}
        onSelectLocation={handleSelectLocation}
        currentLanguage={currentLanguage}
        onSelectLanguage={(lang) => {
          setCurrentLanguage(lang);
          try {
            localStorage.setItem('mausam_selected_language', lang);
          } catch (e) {}
        }}
      />

      {/* Phase 3B: Weather Alert & Notification Center */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        isDark={theme.isDark}
      />

      {/* Persona Deep-Dive Details Modal */}
      {detailsModalIntel && (
        <PersonaDetailsModal
          isOpen={!!detailsModalIntel}
          onClose={() => setDetailsModalIntel(null)}
          intelligence={detailsModalIntel}
          language={currentLanguage}
          onActionClick={handlePersonaActionClick}
        />
      )}

      {/* First-Launch Onboarding Overlay - Shown after entrance login choice */}
      {!hasCompletedOnboarding && !isAuthOpen && (
        <OnboardingFlow
          onComplete={handleCompleteOnboarding}
          initialLanguage={currentLanguage}
          initialLocation={currentLocation}
        />
      )}

      {/* Open Data Sources & Architecture Transparency Modal */}
      <DataSourceTransparencyModal
        isOpen={isTransparencyOpen}
        onClose={() => setIsTransparencyOpen(false)}
        intelligence={intelligence}
      />
    </div>
  );
}

export default App;
