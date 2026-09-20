import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Navigation2,
  X,
  Clock,
  Loader2,
  Star,
  Trash2,
  Bookmark,
} from 'lucide-react';
import { LocationInfo, NormalizedLocation } from '../types';
import { locationResolver } from '../services/LocationResolver';
import { useAuth } from '../services/AuthContext';

interface LocationSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (loc: LocationInfo | NormalizedLocation) => void;
  onUseCurrentLocation: () => void;
  isLoadingLocation?: boolean;
  recentLocations: LocationInfo[];
}

export const LocationSearchModal: React.FC<LocationSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
  onUseCurrentLocation,
  isLoadingLocation = false,
  recentLocations,
}) => {
  const {
    user,
    savedLocations,
    toggleFavoriteLocation,
    searchHistory,
    deleteSearchHistoryItem,
    clearAllSearchHistory,
    recordSearch,
  } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NormalizedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let isCurrent = true;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const matches = await locationResolver.searchPlaces(trimmed);
        if (isCurrent) {
          setResults(matches);
        }
      } catch (e) {
        console.warn('Search query error:', e);
        if (isCurrent) {
          setResults([]);
        }
      } finally {
        if (isCurrent) {
          setIsSearching(false);
        }
      }
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (!isOpen) return null;

  const popularLocations = locationResolver.getPopularLocations();

  const handleSelectResult = (loc: NormalizedLocation) => {
    // If authenticated, record successful search in Supabase search_history
    if (user && loc.name && !isNaN(loc.latitude) && !isNaN(loc.longitude)) {
      recordSearch({
        location_name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        source: 'search_modal',
      });
    }
    onSelectLocation(loc);
    onClose();
  };

  const handleSelectSavedLocation = (item: {
    name: string;
    latitude: number;
    longitude: number;
    region?: string | null;
    country?: string | null;
  }) => {
    const loc = locationResolver.normalize({
      id: `saved-${item.latitude.toFixed(5)}-${item.longitude.toFixed(5)}`,
      name: item.name,
      lat: item.latitude,
      lon: item.longitude,
      state: item.region || 'India',
      country: item.country || 'India',
    });
    onSelectLocation(loc);
    onClose();
  };

  const handleSelectHistoryItem = (item: {
    location_name: string;
    latitude: number;
    longitude: number;
  }) => {
    const loc = locationResolver.normalize({
      id: `history-${item.latitude.toFixed(5)}-${item.longitude.toFixed(5)}`,
      name: item.location_name,
      lat: item.latitude,
      lon: item.longitude,
      state: 'India',
      country: 'India',
    });
    onSelectLocation(loc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden mt-2 sm:mt-0">
        {/* Search Header Input */}
        <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center gap-2 sm:gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
          <input
            id="location-search-input"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Indian city, town, village, or district..."
            className="flex-1 text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none min-h-[40px]"
          />
          {query ? (
            <button
              id="location-search-clear-btn"
              onClick={() => setQuery('')}
              className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 active:bg-slate-100 transition-colors touch-manipulation active:scale-95 shrink-0"
              aria-label="Clear query"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <button
            id="location-search-cancel-btn"
            onClick={onClose}
            className="min-h-[40px] px-3 flex items-center justify-center text-xs font-semibold text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-xl transition-colors touch-manipulation active:scale-95 shrink-0"
          >
            Cancel
          </button>
        </div>

        {/* GPS Current Location Quick Button */}
        <div className="px-3 sm:px-4 py-2 bg-sky-50/50 border-b border-slate-100 shrink-0">
          <button
            id="use-current-gps-btn"
            onClick={() => {
              onUseCurrentLocation();
              onClose();
            }}
            disabled={isLoadingLocation}
            className="w-full min-h-[50px] flex items-center gap-3 text-left py-2 px-3 rounded-2xl hover:bg-sky-100/70 active:bg-sky-200/60 transition-colors text-sky-800 font-medium text-sm touch-manipulation active:scale-98"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0">
              <Navigation2 className={`w-4 h-4 ${isLoadingLocation ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0">
              <span className="block font-semibold text-xs sm:text-sm truncate">Use Exact GPS Location</span>
              <span className="text-[11px] sm:text-xs text-sky-600 block truncate">
                Precise coordinates preserved for accurate microclimate weather
              </span>
            </div>
          </button>
        </div>

        {/* Scrollable Results & Recommendations */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 overscroll-contain">
          {/* Active Search Results */}
          {query.trim() ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Locations ({results.length})
                </span>
                {isSearching && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Resolving...
                  </span>
                )}
              </div>

              {results.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {results.map((loc) => (
                    <button
                      key={loc.id}
                      id={`location-result-${loc.id}`}
                      onClick={() => handleSelectResult(loc)}
                      className="w-full min-h-[48px] flex items-center gap-3 py-2.5 px-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 text-left transition-colors touch-manipulation active:scale-98"
                    >
                      <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                      <div className="truncate min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {loc.name}
                          </span>
                          {loc.elevation && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm font-mono">
                              {loc.elevation}m
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 block truncate">
                          {loc.displayName || `${loc.district ? loc.district + ', ' : ''}${loc.state}, India`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : !isSearching ? (
                <div className="text-center py-8 px-4">
                  <p className="text-xs font-medium text-slate-600">
                    No matching location found in India for "{query}".
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Try searching by district name, taluka, town, or state.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {/* Authenticated Saved Locations */}
              {user && savedLocations.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-sky-600" />
                      <span>Saved Locations ({savedLocations.length})</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                    {savedLocations.map((loc) => (
                      <div
                        key={loc.id}
                        onClick={() => handleSelectSavedLocation(loc)}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/60 text-left text-xs transition-all cursor-pointer group touch-manipulation"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteLocation(loc.id, loc.is_favorite);
                            }}
                            className="text-slate-400 hover:text-amber-500 transition-colors p-0.5"
                            title={loc.is_favorite ? 'Favorite' : 'Mark favorite'}
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                loc.is_favorite ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                              }`}
                            />
                          </button>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-slate-800 truncate block">
                              {loc.name}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate block">
                              {loc.region ? `${loc.region}, India` : 'India'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Authenticated Recent Searches OR Guest Recent Locations */}
              {user ? (
                searchHistory.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Recent Searches</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => clearAllSearchHistory()}
                        className="text-[10px] font-semibold text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {searchHistory.slice(0, 6).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectHistoryItem(item)}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/60 text-left text-xs transition-all cursor-pointer group touch-manipulation"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate">
                              {item.location_name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSearchHistoryItem(item.id);
                            }}
                            className="text-slate-300 hover:text-rose-500 p-1 rounded-full transition-colors opacity-70 group-hover:opacity-100"
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                /* Guest mode: Local Recent Locations */
                recentLocations.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Recent Locations
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {recentLocations.slice(0, 4).map((loc) => (
                        <button
                          key={loc.id}
                          id={`location-recent-${loc.id}`}
                          onClick={() => {
                            onSelectLocation(loc);
                            onClose();
                          }}
                          className="flex items-center gap-2 p-2.5 min-h-[44px] rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/60 text-left text-xs transition-all touch-manipulation active:scale-95"
                        >
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">{loc.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* Popular Indian Cities */}
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Popular Indian Cities
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {popularLocations.slice(0, 9).map((loc) => (
                    <button
                      key={loc.id}
                      id={`location-popular-${loc.id}`}
                      onClick={() => {
                        onSelectLocation(loc);
                        onClose();
                      }}
                      className="p-3 min-h-[54px] rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/60 text-left transition-all group touch-manipulation active:scale-95"
                    >
                      <span className="text-xs font-bold text-slate-900 block group-hover:text-sky-700 truncate">
                        {loc.name}
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                        {loc.state}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
