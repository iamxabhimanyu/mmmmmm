import React from 'react';
import {
  MapPin,
  SlidersHorizontal,
  Globe,
  User as UserIcon,
  Bookmark,
  Star,
  Bell,
  Navigation2,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { LocationInfo, PersonaType } from '../types';
import { PERSONA_PROFILES } from '../data/constants';
import { useAuth } from '../services/AuthContext';
import { AutoLocationState } from '../services/autoLocationManager';

interface HeaderProps {
  currentLocation: LocationInfo;
  onOpenSearch: () => void;
  onUseCurrentLocation: () => void;
  isLoadingLocation?: boolean;
  selectedPersona: PersonaType;
  onOpenPersonaModal: () => void;
  onOpenSettings: () => void;
  onOpenNotifications?: () => void;
  onOpenAuth?: () => void;
  currentLanguage: string;
  isDark?: boolean;
  autoLocationState?: AutoLocationState;
  onOpenAutoLocationModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentLocation,
  onOpenSearch,
  onUseCurrentLocation,
  isLoadingLocation = false,
  selectedPersona,
  onOpenPersonaModal,
  onOpenSettings,
  onOpenNotifications,
  onOpenAuth,
  isDark = false,
  autoLocationState,
  onOpenAutoLocationModal,
}) => {
  const currentPersonaObj =
    PERSONA_PROFILES.find((p) => p.id === selectedPersona) || PERSONA_PROFILES[0];
  const { user, profile, savedLocations, saveLocation, toggleFavoriteLocation, unreadNotificationCount } = useAuth();

  const currentLat = (currentLocation as any).latitude ?? currentLocation.lat;
  const currentLon = (currentLocation as any).longitude ?? currentLocation.lon;

  const matchedSaved = user
    ? savedLocations.find(
        (s) =>
          Math.abs(s.latitude - currentLat) < 0.005 &&
          Math.abs(s.longitude - currentLon) < 0.005
      )
    : null;

  const isSaved = Boolean(matchedSaved);
  const isFavorite = Boolean(matchedSaved?.is_favorite);

  const handleToggleSaveLocation = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (matchedSaved) {
      toggleFavoriteLocation(matchedSaved.id, isFavorite);
    } else {
      saveLocation({
        name: currentLocation.name,
        latitude: currentLat,
        longitude: currentLon,
        country: currentLocation.country || 'India',
        region: currentLocation.state || '',
        is_favorite: false,
      });
    }
  };

  const displayNameOrEmail = profile?.display_name || user?.email || 'User';
  const initial = displayNameOrEmail.charAt(0).toUpperCase();

  return (
    <header
      className={`sticky top-0 z-30 w-full px-4 pt-3 pb-2 transition-colors duration-300 backdrop-blur-md ${
        isDark ? 'bg-slate-950/40 border-b border-white/[0.08]' : 'bg-white/40 border-b border-black/[0.04]'
      }`}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
        {/* Location Section - Clickable to open search */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <button
            id="header-location-btn"
            onClick={onOpenSearch}
            className="flex-1 min-w-0 flex flex-col text-left group transition-transform active:scale-98 focus:outline-none py-1 pr-1 min-h-[44px] justify-center"
            aria-label="Change location"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <MapPin
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isDark ? 'text-sky-400 group-hover:text-sky-300' : 'text-sky-600 group-hover:text-sky-700'
                }`}
              />
              <h1
                className={`text-lg sm:text-2xl font-semibold tracking-tight transition-colors truncate ${
                  isDark ? 'text-white group-hover:text-sky-200' : 'text-slate-900 group-hover:text-sky-950'
                }`}
              >
                {currentLocation.name}
              </h1>
            </div>
            <div
              className={`text-[11px] sm:text-xs font-medium pl-5 truncate flex items-center gap-1.5 transition-colors ${
                isDark ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {currentLocation.isCurrent ? (
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`inline-flex items-center gap-1 font-medium shrink-0 ${isDark ? 'text-sky-300' : 'text-sky-600'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    Current Location
                  </span>
                  {autoLocationState?.isEnabled && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Radio className="w-2.5 h-2.5 animate-pulse" />
                      Auto {autoLocationState.intervalMinutes}m
                    </span>
                  )}
                </div>
              ) : (
                <span className="truncate">{currentLocation.state ? `${currentLocation.state}, India` : 'India'}</span>
              )}
            </div>
          </button>

          {/* Quick GPS Auto-Reload / Live GPS Modal Button */}
          {onOpenAutoLocationModal && (
            <button
              id="header-live-gps-control-btn"
              onClick={onOpenAutoLocationModal}
              className={`h-9 px-2 rounded-full transition-all flex items-center gap-1 text-[11px] font-semibold touch-manipulation active:scale-95 shrink-0 ${
                currentLocation.isCurrent && autoLocationState?.isEnabled
                  ? isDark
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  : isDark
                  ? 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.14]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Live GPS & Auto-Reload Settings"
              aria-label="Live GPS and auto reload settings"
            >
              <Navigation2
                className={`w-3.5 h-3.5 ${
                  isLoadingLocation || autoLocationState?.isAcquiring ? 'animate-spin text-sky-500' : ''
                }`}
              />
              <span className="hidden sm:inline">
                {isLoadingLocation || autoLocationState?.isAcquiring ? 'Locating...' : 'Live GPS'}
              </span>
            </button>
          )}
        </div>

        {/* Right Action Affordances - Clean touch targets */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Settings & Options Button */}
          <button
            id="header-settings-btn"
            onClick={onOpenSettings}
            className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-full transition-all flex items-center justify-center touch-manipulation active:scale-95 ${
              isDark
                ? 'bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.18] text-slate-200'
                : 'bg-slate-900/[0.04] hover:bg-slate-900/[0.08] active:bg-slate-900/[0.12] text-slate-700'
            }`}
            title="Settings, Language & Accessibility"
            aria-label="Open settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Supabase Account / Auth Profile Button */}
          {onOpenAuth && (
            <button
              id="header-auth-btn"
              onClick={onOpenAuth}
              className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-full transition-all flex items-center justify-center touch-manipulation active:scale-95 relative ${
                user
                  ? isDark
                    ? 'bg-sky-600 text-white hover:bg-sky-500'
                    : 'bg-sky-600 text-white hover:bg-sky-700 shadow-xs'
                  : isDark
                  ? 'bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.18] text-slate-200'
                  : 'bg-slate-900/[0.04] hover:bg-slate-900/[0.08] active:bg-slate-900/[0.12] text-slate-700'
              }`}
              title={
                user
                  ? `Account: ${displayNameOrEmail} (Supabase)`
                  : 'Sign in / Create Account (Guest Mode active)'
              }
              aria-label={user ? 'Open Account Profile' : 'Sign In or Create Account'}
            >
              {user ? (
                <>
                  <span className="font-bold text-xs">{initial}</span>
                  <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-1.5 ring-white dark:ring-slate-950" />
                </>
              ) : (
                <UserIcon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
