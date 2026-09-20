import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Shield,
  User as UserIcon,
  Loader2,
  Info,
  Star,
  MapPin,
  Trash2,
  Clock,
  Globe,
  Edit2,
  Check,
  Bookmark,
} from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { LocationInfo, NormalizedLocation, SupportedLanguage } from '../types';
import { SUPPORTED_LANGUAGES } from '../data/constants';
import { locationResolver } from '../services/LocationResolver';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueAsGuest?: () => void;
  defaultMode?: 'signin' | 'signup';
  onSelectLocation?: (loc: LocationInfo | NormalizedLocation) => void;
  currentLanguage?: SupportedLanguage;
  onSelectLanguage?: (lang: SupportedLanguage) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onContinueAsGuest,
  defaultMode = 'signin',
  onSelectLocation,
  currentLanguage = 'en',
  onSelectLanguage,
}) => {
  const {
    user,
    profile,
    isProfileLoading,
    updateProfile,
    savedLocations,
    isSavedLocationsLoading,
    deleteSavedLocation,
    toggleFavoriteLocation,
    searchHistory,
    isSearchHistoryLoading,
    deleteSearchHistoryItem,
    clearAllSearchHistory,
    signIn,
    signUp,
    signOut,
    isConfigured,
  } = useAuth();

  // Auth Mode: signin vs signup
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Authenticated View Sub-Tab
  const [activeAccountTab, setActiveAccountTab] = useState<'profile' | 'saved' | 'history'>('profile');

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editLanguage, setEditLanguage] = useState<SupportedLanguage>(currentLanguage);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Status & Notifications
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync edit form with profile data when profile loads
  useEffect(() => {
    if (profile) {
      setEditDisplayName(profile.display_name || '');
      if (profile.preferred_language && SUPPORTED_LANGUAGES.some((l) => l.code === profile.preferred_language)) {
        setEditLanguage(profile.preferred_language as SupportedLanguage);
      }
    }
  }, [profile]);

  if (!isOpen) return null;

  const resetFormState = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessNotice(null);
    setIsEditingProfile(false);
  };

  const handleTabSwitch = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please check again.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const result = await signIn(trimmedEmail, password);
        if (!result.success) {
          setErrorMessage(result.error || 'Failed to sign in. Please verify your credentials.');
        } else {
          setSuccessNotice('Signed in successfully.');
          setTimeout(() => {
            setSuccessNotice(null);
            onClose();
            resetFormState();
          }, 800);
        }
      } else {
        const result = await signUp(trimmedEmail, password);
        if (!result.success) {
          setErrorMessage(result.error || 'Unable to create account. Please try again.');
        } else if (result.needsVerification) {
          setSuccessNotice(
            'Account registered! Please check your email inbox to confirm your email before signing in.'
          );
        } else {
          setSuccessNotice('Account created and signed in successfully!');
          setTimeout(() => {
            setSuccessNotice(null);
            onClose();
            resetFormState();
          }, 800);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'A network error occurred. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueAsGuest = () => {
    onContinueAsGuest?.();
    onClose();
    resetFormState();
  };

  const handleSignOut = async () => {
    setIsSubmitting(true);
    try {
      await signOut();
      setSuccessNotice('You have signed out successfully.');
      setTimeout(() => {
        onClose();
        resetFormState();
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign out.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const res = await updateProfile({
        display_name: editDisplayName.trim(),
        preferred_language: editLanguage,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to update profile.');
      } else {
        setSuccessNotice('Profile updated successfully.');
        setIsEditingProfile(false);
        if (onSelectLanguage && editLanguage) {
          onSelectLanguage(editLanguage);
        }
        setTimeout(() => setSuccessNotice(null), 2500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setErrorMessage(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteSaved = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    setErrorMessage(null);
    try {
      const res = await deleteSavedLocation(id);
      if (!res.success) {
        setErrorMessage(res.error || 'Unable to delete saved location.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete saved location.';
      setErrorMessage(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleFavorite = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFavoriteLocation(id, currentStatus);
    } catch (err: unknown) {
      console.warn('Toggle favorite error:', err);
    }
  };

  const handleDeleteSearch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    setErrorMessage(null);
    try {
      const res = await deleteSearchHistoryItem(id);
      if (!res.success) {
        setErrorMessage(res.error || 'Unable to delete search history item.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete search history item.';
      setErrorMessage(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearHistory = async () => {
    setErrorMessage(null);
    try {
      const res = await clearAllSearchHistory();
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to clear search history.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear search history.';
      setErrorMessage(msg);
    }
  };

  const handleSelectLocationItem = (name: string, lat: number, lon: number, region?: string | null, country?: string | null) => {
    if (onSelectLocation) {
      const loc = locationResolver.normalize({
        id: `db-${lat.toFixed(5)}-${lon.toFixed(5)}`,
        name,
        lat,
        lon,
        state: region || 'India',
        country: country || 'India',
      });
      onSelectLocation(loc);
      onClose();
    }
  };

  const formatSearchTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Recently';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">
                {user ? 'Account & Profile' : 'MAUSAM Account'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {user ? 'Supabase Authentication & Cloud Persistence' : 'Sign in or explore in Guest Mode'}
              </p>
            </div>
          </div>
          <button
            id="auth-modal-close-btn"
            onClick={() => {
              onClose();
              resetFormState();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors touch-manipulation active:scale-95"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs overscroll-contain">
          {/* Missing Env Variable Notice if not configured */}
          {!isConfigured && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Supabase Configuration Notice</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Supabase database and authentication can be connected by defining{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">
                  VITE_SUPABASE_PUBLISHABLE_KEY
                </code>
                . Live weather remains fully accessible in Guest Mode.
              </p>
            </div>
          )}

          {/* Status notices */}
          {successNotice && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* If authenticated: Multi-Tab Account Area */}
          {user ? (
            <div className="space-y-4">
              {/* Account Navigation Tabs */}
              <div className="grid grid-cols-3 p-1 rounded-2xl bg-slate-100 border border-slate-200/60 text-xs font-semibold">
                <button
                  type="button"
                  id="auth-tab-profile"
                  onClick={() => {
                    setActiveAccountTab('profile');
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                    activeAccountTab === 'profile'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Profile</span>
                </button>
                <button
                  type="button"
                  id="auth-tab-saved"
                  onClick={() => {
                    setActiveAccountTab('saved');
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                    activeAccountTab === 'saved'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Saved ({savedLocations.length})</span>
                </button>
                <button
                  type="button"
                  id="auth-tab-history"
                  onClick={() => {
                    setActiveAccountTab('history');
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                    activeAccountTab === 'history'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Searches ({searchHistory.length})</span>
                </button>
              </div>

              {/* Tab 1: Profile View / Edit */}
              {activeAccountTab === 'profile' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white font-bold text-lg flex items-center justify-center shadow-xs shrink-0">
                          {((profile?.display_name || user.email || 'U')[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active Session
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {profile?.display_name || user.email}
                          </h4>
                          {profile?.display_name && (
                            <p className="text-[11px] text-slate-600 truncate">{user.email}</p>
                          )}
                        </div>
                      </div>

                      {!isEditingProfile && (
                        <button
                          type="button"
                          id="profile-edit-toggle-btn"
                          onClick={() => {
                            setIsEditingProfile(true);
                            setEditDisplayName(profile?.display_name || '');
                            if (profile?.preferred_language) {
                              setEditLanguage(profile.preferred_language as SupportedLanguage);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors touch-manipulation active:scale-95 shadow-2xs"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-sky-600" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {/* Profile Fields Details */}
                    {!isEditingProfile ? (
                      <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                          <span className="text-slate-400 block text-[10px]">Display Name</span>
                          <span className="font-semibold text-slate-800 truncate block">
                            {profile?.display_name || 'Not configured'}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                          <span className="text-slate-400 block text-[10px]">Preferred Language</span>
                          <span className="font-semibold text-slate-800 truncate block">
                            {SUPPORTED_LANGUAGES.find(
                              (l) => l.code === (profile?.preferred_language || currentLanguage)
                            )?.name || 'English'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Inline Profile Edit Form */
                      <form onSubmit={handleSaveProfile} className="pt-2 border-t border-slate-200/60 space-y-3">
                        <div>
                          <label className="text-slate-600 block text-[11px] font-semibold mb-1">
                            Display Name
                          </label>
                          <input
                            id="edit-profile-display-name"
                            type="text"
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            placeholder="Enter your name"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                            maxLength={50}
                          />
                        </div>

                        <div>
                          <label className="text-slate-600 block text-[11px] font-semibold mb-1">
                            Preferred Language
                          </label>
                          <select
                            id="edit-profile-language"
                            value={editLanguage}
                            onChange={(e) => setEditLanguage(e.target.value as SupportedLanguage)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                          >
                            {SUPPORTED_LANGUAGES.map((lang) => (
                              <option key={lang.code} value={lang.code}>
                                {lang.name} ({lang.nativeName})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="submit"
                            id="save-profile-btn"
                            disabled={isSavingProfile}
                            className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors touch-manipulation disabled:opacity-50"
                          >
                            {isSavingProfile ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Save Profile</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingProfile(false)}
                            disabled={isSavingProfile}
                            className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold text-xs transition-colors touch-manipulation"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Sign Out Action */}
                  <button
                    id="auth-signout-btn"
                    onClick={handleSignOut}
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl border border-rose-200 hover:bg-rose-50 active:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2 touch-manipulation active:scale-98 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                    <span>Sign Out of MAUSAM</span>
                  </button>
                </div>
              )}

              {/* Tab 2: Saved Locations */}
              {activeAccountTab === 'saved' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Saved Locations ({savedLocations.length})
                    </span>
                    {isSavedLocationsLoading && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                    )}
                  </div>

                  {savedLocations.length > 0 ? (
                    <div className="space-y-2">
                      {savedLocations.map((loc) => (
                        <div
                          key={loc.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 transition-colors group cursor-pointer"
                          onClick={() => handleSelectLocationItem(loc.name, loc.latitude, loc.longitude, loc.region, loc.country)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={(e) => handleToggleFavorite(loc.id, loc.is_favorite, e)}
                              className={`p-1.5 rounded-full transition-colors ${
                                loc.is_favorite
                                  ? 'text-amber-500 hover:bg-amber-50'
                                  : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50/50'
                              }`}
                              title={loc.is_favorite ? 'Favorite Location' : 'Mark as Favorite'}
                            >
                              <Star className={`w-4 h-4 ${loc.is_favorite ? 'fill-amber-400' : ''}`} />
                            </button>
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-slate-900 block truncate text-xs">
                                {loc.name}
                              </span>
                              <span className="text-[10px] text-slate-500 block truncate">
                                {loc.region ? `${loc.region}, India` : 'India'} •{' '}
                                <span className="font-mono text-[9px]">
                                  {loc.latitude.toFixed(2)}°N, {loc.longitude.toFixed(2)}°E
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSaved(loc.id, e)}
                              disabled={deletingId === loc.id}
                              className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors touch-manipulation"
                              title="Delete from saved locations"
                            >
                              {deletingId === loc.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-1.5">
                      <Bookmark className="w-6 h-6 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700 text-xs">No saved locations yet</p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Tap the bookmark icon in the header or search modal to save your frequent cities.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Recent Searches */}
              {activeAccountTab === 'history' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Search History ({searchHistory.length})
                    </span>
                    <div className="flex items-center gap-2">
                      {isSearchHistoryLoading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                      )}
                      {searchHistory.length > 0 && (
                        <button
                          type="button"
                          id="clear-all-history-btn"
                          onClick={handleClearHistory}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition-colors"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  </div>

                  {searchHistory.length > 0 ? (
                    <div className="space-y-1.5 divide-y divide-slate-100">
                      {searchHistory.map((item) => (
                        <div
                          key={item.id}
                          className="pt-1.5 first:pt-0 flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                          onClick={() => handleSelectLocationItem(item.location_name, item.latitude, item.longitude)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-slate-800 block truncate text-xs">
                                {item.location_name}
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                                <span>
                                  {item.latitude.toFixed(2)}°N, {item.longitude.toFixed(2)}°E
                                </span>
                                <span>•</span>
                                <span>{formatSearchTime(item.searched_at)}</span>
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteSearch(item.id, e)}
                            disabled={deletingId === item.id}
                            className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-80 group-hover:opacity-100"
                            title="Delete search"
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-1.5">
                      <Clock className="w-6 h-6 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700 text-xs">No search history recorded</p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Successful searches you perform while logged in are securely saved to your Supabase account.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Unauthenticated: Sign In / Sign Up Form */
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 border border-slate-200/60">
                <button
                  type="button"
                  id="auth-mode-signin-btn"
                  onClick={() => handleTabSwitch('signin')}
                  className={`py-2 text-xs font-semibold rounded-xl transition-all touch-manipulation ${
                    mode === 'signin'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  id="auth-mode-signup-btn"
                  onClick={() => handleTabSwitch('signup')}
                  className={`py-2 text-xs font-semibold rounded-xl transition-all touch-manipulation ${
                    mode === 'signup'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Email field */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      id="auth-email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      disabled={isSubmitting}
                      required
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      id="auth-password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                      disabled={isSubmitting}
                      required
                      className="w-full pl-9 pr-10 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password field for Signup */}
                {mode === 'signup' && (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      Confirm Password
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        id="auth-confirm-password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        disabled={isSubmitting}
                        required
                        className="w-full pl-9 pr-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors disabled:opacity-50"
                      />
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  id="auth-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-2 touch-manipulation active:scale-98 disabled:opacity-50 mt-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : mode === 'signin' ? (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In with Email</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Free Account</span>
                    </>
                  )}
                </button>
              </form>

              {/* Divider & Guest Account Option */}
              <div className="relative flex items-center pt-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="shrink mx-3 text-slate-400 text-[10px] font-semibold tracking-wider uppercase">
                  Or
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                id="auth-guest-account-btn"
                type="button"
                onClick={handleContinueAsGuest}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-2 touch-manipulation active:scale-98 shadow-2xs"
              >
                <UserIcon className="w-4 h-4 text-slate-500" />
                <span>Continue with Guest Account</span>
              </button>

              {/* Guest Mode Assurance */}
              <div className="pt-1 text-center">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Guest account gives instant access to live weather, radar maps, and alerts without requiring sign-in.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
