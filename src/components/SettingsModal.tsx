import React from 'react';
import {
  X,
  Globe,
  Eye,
  Type,
  Thermometer,
  Shield,
  Check,
  Phone,
  User as UserIcon,
  LogIn,
  LogOut,
  Bookmark,
  MapPin,
  Star,
  Bell,
  CloudRain,
  Wind,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { SupportedLanguage, LocationInfo, PersonaType } from '../types';
import { SUPPORTED_LANGUAGES, EMERGENCY_HELPLINES } from '../data/constants';
import { useAuth } from '../services/AuthContext';
import { AutoLocationState } from '../services/autoLocationManager';
import { Navigation2, RefreshCw, Radio } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  tempUnit: 'C' | 'F';
  onToggleTempUnit: (unit: 'C' | 'F') => void;
  highContrast: boolean;
  onToggleHighContrast: (val: boolean) => void;
  largeText: boolean;
  onToggleLargeText: (val: boolean) => void;
  selectedPersonas?: string[];
  primaryPersona?: string;
  defaultLocation?: LocationInfo;
  onSetDefaultLocation?: (loc: LocationInfo) => void;
  onOpenSearch?: () => void;
  onOpenPersonaModal?: () => void;
  onResetOnboarding?: () => void;
  onOpenAuth?: () => void;
  autoLocationState?: AutoLocationState;
  onToggleAutoLocation?: (enabled: boolean) => void;
  onSelectAutoLocationInterval?: (minutes: number) => void;
  onReloadLocationNow?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentLanguage,
  onSelectLanguage,
  tempUnit,
  onToggleTempUnit,
  highContrast,
  onToggleHighContrast,
  largeText,
  onToggleLargeText,
  selectedPersonas,
  primaryPersona,
  defaultLocation,
  onSetDefaultLocation,
  onOpenSearch,
  onOpenPersonaModal,
  onResetOnboarding,
  onOpenAuth,
  autoLocationState,
  onToggleAutoLocation,
  onSelectAutoLocationInterval,
  onReloadLocationNow,
}) => {
  const {
    user,
    profile,
    savedLocations,
    updateProfile,
    signOut,
    notificationPreferences,
    updateNotificationPreferences,
  } = useAuth();
  if (!isOpen) return null;

  const handleLanguageSelect = (lang: SupportedLanguage) => {
    onSelectLanguage(lang);
    if (user) {
      updateProfile({ preferred_language: lang }).catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Settings & Options
          </h3>
          <button
            id="settings-modal-close-btn"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors touch-manipulation active:scale-95"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 text-xs overscroll-contain">
          {/* Supabase Account & Profile Section */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <UserIcon className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Account & Session</span>
              </span>
              {user ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Authenticated
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold">
                  Guest Mode
                </span>
              )}
            </div>

            {user ? (
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate text-xs">
                    {profile?.display_name || user.email}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                    <span>{user.email}</span>
                    <span>•</span>
                    <span className="text-sky-700 font-medium">
                      {savedLocations.length} saved {savedLocations.length === 1 ? 'place' : 'places'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onOpenAuth && (
                    <button
                      id="settings-view-profile-btn"
                      onClick={() => {
                        onClose();
                        onOpenAuth();
                      }}
                      className="min-h-[36px] px-3 flex items-center text-xs font-bold text-sky-700 hover:text-sky-900 active:bg-sky-100/70 rounded-full transition-colors touch-manipulation active:scale-95"
                    >
                      Account UI
                    </button>
                  )}
                  <button
                    id="settings-signout-btn"
                    onClick={() => signOut()}
                    className="min-h-[36px] px-2.5 flex items-center text-xs font-bold text-rose-600 hover:text-rose-800 active:bg-rose-50 rounded-full transition-colors touch-manipulation active:scale-95"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1" />
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[11px] text-slate-600 flex-1">
                  You are browsing in guest mode. Sign in to link your MAUSAM account.
                </p>
                {onOpenAuth && (
                  <button
                    id="settings-open-auth-btn"
                    onClick={() => {
                      onClose();
                      onOpenAuth();
                    }}
                    className="min-h-[36px] px-3.5 flex items-center gap-1 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-full transition-colors touch-manipulation active:scale-95 shrink-0 shadow-2xs"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Sign In
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Personalized Modes & Personas */}
          {selectedPersonas && onOpenPersonaModal && (
            <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5 truncate">
                  <Shield className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Personalized Modes ({selectedPersonas.length})</span>
                </span>
                <button
                  id="settings-manage-modes-btn"
                  onClick={() => {
                    onClose();
                    onOpenPersonaModal();
                  }}
                  className="min-h-[36px] px-3 flex items-center text-xs font-bold text-sky-700 hover:text-sky-900 active:bg-sky-100/70 rounded-full transition-colors touch-manipulation active:scale-95 shrink-0"
                >
                  Manage Modes
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {selectedPersonas.map((p, idx) => {
                  const isPrimary = primaryPersona === p;
                  return (
                    <span
                      key={idx}
                      className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold capitalize shadow-2xs flex items-center gap-1 ${
                        isPrimary
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white border-sky-200 text-sky-900'
                      }`}
                    >
                      {isPrimary && <Star className="w-3 h-3 fill-current text-amber-300" />}
                      <span>{p}</span>
                      {isPrimary && <span className="text-[9px] opacity-90">(Primary)</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Default / Preferred Home Location */}
          {defaultLocation && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Default Home Location</span>
                </span>
                {onOpenSearch && (
                  <button
                    id="settings-change-default-location-btn"
                    onClick={() => {
                      onClose();
                      onOpenSearch();
                    }}
                    className="min-h-[36px] px-3 flex items-center text-xs font-bold text-emerald-700 hover:text-emerald-900 active:bg-emerald-100/70 rounded-full transition-colors touch-manipulation active:scale-95 shrink-0"
                  >
                    Change City
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {defaultLocation.name}
                    {defaultLocation.state && defaultLocation.state !== defaultLocation.name
                      ? `, ${defaultLocation.state}`
                      : ''}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">
                    {defaultLocation.lat.toFixed(3)}° N, {defaultLocation.lon.toFixed(3)}° E • {defaultLocation.country || 'India'}
                  </p>
                </div>
                {user ? (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                    Cloud Synced
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                    Local Device
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Auto-Location & Live GPS Section */}
          {autoLocationState && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Navigation2 className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Auto Location & Exact GPS</span>
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    autoLocationState.isEnabled
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-200/70 text-slate-600 border-slate-300'
                  }`}
                >
                  {autoLocationState.isEnabled ? (
                    <>
                      <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-600" />
                      Active
                    </>
                  ) : (
                    'Disabled'
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-slate-800">Auto-Reload Location Time-by-Time</p>
                  <p className="text-[11px] text-slate-500">
                    Periodically reloads GPS position for exact coordinates
                  </p>
                </div>
                {onToggleAutoLocation && (
                  <button
                    id="settings-toggle-auto-location-switch"
                    role="switch"
                    aria-checked={autoLocationState.isEnabled}
                    onClick={() => onToggleAutoLocation(!autoLocationState.isEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      autoLocationState.isEnabled ? 'bg-sky-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        autoLocationState.isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
              </div>

              {autoLocationState.isEnabled && onSelectAutoLocationInterval && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                    <span>Reload Frequency</span>
                    <span className="text-sky-700">Every {autoLocationState.intervalMinutes} min</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 3, 5, 10].map((mins) => (
                      <button
                        key={mins}
                        id={`settings-interval-${mins}m`}
                        onClick={() => onSelectAutoLocationInterval(mins)}
                        className={`py-1 px-2 rounded-xl font-semibold text-xs transition-all text-center ${
                          autoLocationState.intervalMinutes === mins
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {onReloadLocationNow && (
                <button
                  id="settings-reload-gps-now-btn"
                  onClick={onReloadLocationNow}
                  disabled={autoLocationState.isAcquiring}
                  className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-98 disabled:opacity-70"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-sky-600 ${autoLocationState.isAcquiring ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {autoLocationState.isAcquiring ? 'Locating Precise Coordinates...' : 'Reload Exact Location Now'}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Temperature Unit */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-sky-600" />
              Temperature Unit
            </label>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
              <button
                id="unit-celsius-btn"
                onClick={() => onToggleTempUnit('C')}
                className={`min-h-[44px] py-2 px-3 rounded-2xl border font-semibold flex items-center justify-between transition-all touch-manipulation active:scale-98 ${
                  tempUnit === 'C'
                    ? 'bg-sky-50 border-sky-400 text-sky-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                }`}
              >
                <span>Celsius (°C)</span>
                {tempUnit === 'C' && <Check className="w-4 h-4 text-sky-600" />}
              </button>
              <button
                id="unit-fahrenheit-btn"
                onClick={() => onToggleTempUnit('F')}
                className={`min-h-[44px] py-2 px-3 rounded-2xl border font-semibold flex items-center justify-between transition-all touch-manipulation active:scale-98 ${
                  tempUnit === 'F'
                    ? 'bg-sky-50 border-sky-400 text-sky-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                }`}
              >
                <span>Fahrenheit (°F)</span>
                {tempUnit === 'F' && <Check className="w-4 h-4 text-sky-600" />}
              </button>
            </div>
          </div>

          {/* Regional Indian Languages */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-600" />
              Indian Language (भाषा)
            </label>
            <div className="grid grid-cols-2 xs:grid-cols-3 gap-1.5">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSel = currentLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    id={`lang-btn-${lang.code}`}
                    onClick={() => handleLanguageSelect(lang.code)}
                    className={`min-h-[44px] py-2 px-2.5 rounded-xl border text-left transition-all touch-manipulation active:scale-95 ${
                      isSel
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{lang.nativeName}</span>
                    <span className="block text-[10px] text-slate-400 font-normal">{lang.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accessibility Toggles */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-600" />
              Display & Accessibility
            </label>
            <div className="space-y-2">
              <label className="min-h-[50px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer touch-manipulation active:bg-slate-100">
                <div className="pr-2">
                  <span className="font-semibold text-slate-800 block">High Contrast Mode</span>
                  <span className="text-[11px] text-slate-500 block">Enhances border contrast for bright outdoor glare</span>
                </div>
                <input
                  id="high-contrast-toggle"
                  type="checkbox"
                  checked={highContrast}
                  onChange={(e) => onToggleHighContrast(e.target.checked)}
                  className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 touch-manipulation"
                />
              </label>
              <label className="min-h-[50px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer touch-manipulation active:bg-slate-100">
                <div className="pr-2">
                  <span className="font-semibold text-slate-800 block">Large Text</span>
                  <span className="text-[11px] text-slate-500 block">Optimizes metric size for fast glanceability</span>
                </div>
                <input
                  id="large-text-toggle"
                  type="checkbox"
                  checked={largeText}
                  onChange={(e) => onToggleLargeText(e.target.checked)}
                  className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 touch-manipulation"
                />
              </label>
            </div>
          </div>

          {/* Weather Alert & Notification Preferences */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-sky-600" />
                Weather Alerts & Notifications
              </label>
              {user ? (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Cloud Synced
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  Device Stored
                </span>
              )}
            </div>

            <div className="space-y-2">
              {/* Severe Weather */}
              <label className="min-h-[50px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer touch-manipulation active:bg-slate-100">
                <div className="pr-2 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 block">Severe Weather Warnings</span>
                    <span className="text-[11px] text-slate-500 block">
                      IMD Red/Orange alerts, convective thunderstorms, cyclones & flash floods
                    </span>
                  </div>
                </div>
                <input
                  id="notif-pref-severe"
                  type="checkbox"
                  checked={notificationPreferences.severe_weather}
                  onChange={(e) =>
                    updateNotificationPreferences({ severe_weather: e.target.checked })
                  }
                  className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 touch-manipulation shrink-0"
                />
              </label>

              {/* Rain & Precipitation */}
              <label className="min-h-[50px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer touch-manipulation active:bg-slate-100">
                <div className="pr-2 flex items-start gap-2.5">
                  <CloudRain className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 block">Rain & Nowcasting</span>
                    <span className="text-[11px] text-slate-500 block">
                      Heavy rainfall thresholds, precipitation probability & cloudburst alerts
                    </span>
                  </div>
                </div>
                <input
                  id="notif-pref-rain"
                  type="checkbox"
                  checked={notificationPreferences.rain}
                  onChange={(e) => updateNotificationPreferences({ rain: e.target.checked })}
                  className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 touch-manipulation shrink-0"
                />
              </label>

              {/* Air Quality (AQI) */}
              <label className="min-h-[50px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer touch-manipulation active:bg-slate-100">
                <div className="pr-2 flex items-start gap-2.5">
                  <Wind className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 block">Air Quality Warnings</span>
                    <span className="text-[11px] text-slate-500 block">
                      CPCB index Poor, Very Poor (AQI &gt; 300) & Severe health advisories
                    </span>
                  </div>
                </div>
                <input
                  id="notif-pref-aqi"
                  type="checkbox"
                  checked={notificationPreferences.air_quality}
                  onChange={(e) =>
                    updateNotificationPreferences({ air_quality: e.target.checked })
                  }
                  className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 touch-manipulation shrink-0"
                />
              </label>

              {/* Temperature & Heatwave */}
              <label className="min-h-[50px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer touch-manipulation active:bg-slate-100">
                <div className="pr-2 flex items-start gap-2.5">
                  <Thermometer className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 block">Temperature & Heatwaves</span>
                    <span className="text-[11px] text-slate-500 block">
                      Extreme heat advisories (&ge;40°C), thermal comfort alerts & cold waves
                    </span>
                  </div>
                </div>
                <input
                  id="notif-pref-temp"
                  type="checkbox"
                  checked={notificationPreferences.temperature}
                  onChange={(e) =>
                    updateNotificationPreferences({ temperature: e.target.checked })
                  }
                  className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 touch-manipulation shrink-0"
                />
              </label>

              {/* Daily Morning Forecast */}
              <label className="min-h-[50px] flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer touch-manipulation active:bg-slate-100">
                <div className="pr-2 flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 block">Daily Morning Briefing</span>
                    <span className="text-[11px] text-slate-500 block">
                      Daily outlook for high/low temperatures, rain chance & weather conditions
                    </span>
                  </div>
                </div>
                <input
                  id="notif-pref-daily"
                  type="checkbox"
                  checked={notificationPreferences.daily_forecast}
                  onChange={(e) =>
                    updateNotificationPreferences({ daily_forecast: e.target.checked })
                  }
                  className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 touch-manipulation shrink-0"
                />
              </label>

              {/* Saved Locations Only Filter */}
              <label className="min-h-[50px] flex items-center justify-between p-3 rounded-2xl bg-sky-50/60 border border-sky-200/80 cursor-pointer touch-manipulation active:bg-sky-100/80">
                <div className="pr-2 flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-sky-950 block">Only Alert for Saved Places</span>
                    <span className="text-[11px] text-sky-800/80 block">
                      Restrict automatic alerts strictly to your bookmarked/favorite locations
                    </span>
                  </div>
                </div>
                <input
                  id="notif-pref-saved-only"
                  type="checkbox"
                  checked={notificationPreferences.saved_locations_only}
                  onChange={(e) =>
                    updateNotificationPreferences({ saved_locations_only: e.target.checked })
                  }
                  className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 border-sky-300 touch-manipulation shrink-0"
                />
              </label>
            </div>
          </div>

          {/* Emergency Helplines & Disaster Numbers */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-rose-600" />
              Emergency & Disaster Helplines
            </label>
            <div className="space-y-1.5">
              {EMERGENCY_HELPLINES.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60"
                >
                  <div>
                    <span className="font-semibold text-slate-800 block">{item.name}</span>
                    <span className="text-[10px] text-slate-500">{item.desc}</span>
                  </div>
                  <span className="font-mono font-bold text-rose-700 text-xs px-2 py-1 rounded-md bg-rose-50 border border-rose-200">
                    {item.number}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* First Run Onboarding Reset */}
          {onResetOnboarding && (
            <div className="pt-2 border-t border-slate-100">
              <button
                id="reset-onboarding-btn"
                onClick={() => {
                  onClose();
                  onResetOnboarding();
                }}
                className="w-full min-h-[44px] py-2 px-3 rounded-2xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-600 font-semibold text-xs transition-colors touch-manipulation active:scale-98"
              >
                Replay Setup & Onboarding
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
