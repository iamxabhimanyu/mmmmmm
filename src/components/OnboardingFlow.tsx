import React, { useState } from 'react';
import {
  Activity,
  Car,
  Compass,
  HeartPulse,
  Users,
  Sprout,
  Ship,
  Check,
  MapPin,
  Navigation2,
  Search,
  ArrowRight,
  Sparkles,
  Loader2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { PersonaType, SupportedLanguage, LocationInfo } from '../types';
import { PERSONA_PROFILES, SUPPORTED_LANGUAGES, MAJOR_INDIAN_CITIES } from '../data/constants';
import { getOnboardingText } from '../data/translations';
import { searchIndianLocations } from '../services/weatherService';
import { locationResolver } from '../services/LocationResolver';

interface OnboardingFlowProps {
  onComplete: (data: {
    selectedPersonas: PersonaType[];
    primaryPersona: PersonaType;
    language: SupportedLanguage;
    location: LocationInfo;
  }) => void;
  initialLanguage?: SupportedLanguage;
  initialLocation?: LocationInfo;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  initialLanguage = 'en',
  initialLocation = MAJOR_INDIAN_CITIES[0],
}) => {
  // Steps: 1 = Persona, 2 = Language, 3 = Location, 4 = Ready
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [selectedPersonas, setSelectedPersonas] = useState<PersonaType[]>(['runner', 'commuter']);
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);
  const [location, setLocation] = useState<LocationInfo>(initialLocation);

  // Search in Step 3
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  const texts = getOnboardingText(language);

  // Helper for persona icon
  const getPersonaIcon = (id: PersonaType) => {
    switch (id) {
      case 'runner':
        return Activity;
      case 'commuter':
        return Car;
      case 'traveller':
        return Compass;
      case 'health':
        return HeartPulse;
      case 'family':
        return Users;
      case 'farmer':
        return Sprout;
      case 'marine':
        return Ship;
      default:
        return Activity;
    }
  };

  const togglePersona = (pId: PersonaType) => {
    if (selectedPersonas.includes(pId)) {
      if (selectedPersonas.length === 1) return; // Keep at least one
      setSelectedPersonas((prev) => prev.filter((id) => id !== pId));
    } else {
      setSelectedPersonas((prev) => [...prev, pId]);
    }
  };

  const handleGpsLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const resolved = await locationResolver.resolveFromCoordinates(lat, lon);
          resolved.isCurrent = true;
          setLocation(resolved);
        } catch (err) {
          const newLoc: LocationInfo = {
            id: `gps-${lat.toFixed(5)}_${lon.toFixed(5)}`,
            name: 'Exact GPS Position',
            displayName: `GPS (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`,
            state: 'India',
            country: 'India',
            lat: Number(lat.toFixed(5)),
            lon: Number(lon.toFixed(5)),
            isCurrent: true,
          };
          setLocation(newLoc);
        } finally {
          setIsLocatingGps(false);
          setStep(4);
        }
      },
      () => {
        setIsLocatingGps(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results = await searchIndianLocations(val);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleFinish = () => {
    const primary = selectedPersonas[0] || 'runner';
    onComplete({
      selectedPersonas,
      primaryPersona: primary,
      language,
      location,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200/80 overflow-hidden">
        {/* Top Progress Bar */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-800 tracking-wider uppercase">
              Mausam Setup • Step {step} of 3
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s ? 'w-6 bg-sky-600' : step > s ? 'w-3 bg-sky-300' : 'w-2 bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP 1: PERSONA SELECTION */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{texts.step1Title}</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">{texts.step1Sub}</p>
            </div>

            <div className="space-y-2 pt-1">
              {PERSONA_PROFILES.map((p) => {
                const IconComp = getPersonaIcon(p.id);
                const isSelected = selectedPersonas.includes(p.id);

                return (
                  <button
                    key={p.id}
                    id={`onboarding-persona-${p.id}`}
                    onClick={() => togglePersona(p.id)}
                    className={`w-full min-h-[58px] flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all touch-manipulation active:scale-98 ${
                      isSelected
                        ? 'bg-sky-50/90 border-sky-400/80 shadow-xs ring-1 ring-sky-400/30'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200/80'
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl shrink-0 mt-0.5 transition-colors ${
                        isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <IconComp className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">{p.label}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{p.description}</p>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-colors ${
                        isSelected ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: LANGUAGE SELECTION */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{texts.step2Title}</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">{texts.step2Sub}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = language === lang.code;

                return (
                  <button
                    key={lang.code}
                    id={`onboarding-lang-${lang.code}`}
                    onClick={() => setLanguage(lang.code)}
                    className={`min-h-[52px] flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all touch-manipulation active:scale-98 ${
                      isSelected
                        ? 'bg-sky-50/90 border-sky-400 shadow-xs ring-1 ring-sky-400/30'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{lang.nativeName}</p>
                      <p className="text-xs text-slate-500">{lang.name}</p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: LOCATION SELECTION */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{texts.step3Title}</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">{texts.step3Sub}</p>
            </div>

            {/* GPS Auto-detect Button */}
            <button
              id="onboarding-gps-btn"
              onClick={handleGpsLocation}
              disabled={isLocatingGps}
              className="w-full min-h-[56px] flex items-center justify-between p-3.5 rounded-2xl bg-sky-50/90 border border-sky-200 text-sky-800 hover:bg-sky-100/80 active:bg-sky-200/70 transition-colors group text-left touch-manipulation active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-600 text-white shrink-0">
                  <Navigation2 className={`w-4 h-4 ${isLocatingGps ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{texts.useGps}</h4>
                  <p className="text-xs text-slate-500">Fastest setup using device location</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-sky-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="onboarding-location-search"
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search Indian city, district, town..."
                className="w-full min-h-[46px] pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
              />
              {isSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
              )}
            </div>

            {/* Search Results if any */}
            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto rounded-2xl border border-slate-200 p-1 bg-white shadow-xs overscroll-contain">
                {searchResults.map((res) => (
                  <button
                    key={res.id}
                    id={`onboarding-loc-res-${res.id}`}
                    onClick={() => {
                      setLocation(res);
                      setStep(4);
                    }}
                    className="w-full min-h-[44px] flex items-center justify-between p-2.5 rounded-xl hover:bg-sky-50 active:bg-sky-100 text-left transition-colors touch-manipulation active:scale-98"
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 truncate">{res.name}</span>
                      <span className="text-[11px] text-slate-500 truncate">{res.state}</span>
                    </div>
                    <span className="text-[10px] text-sky-600 font-semibold shrink-0 ml-2">Select</span>
                  </button>
                ))}
              </div>
            )}

            {/* Popular Cities Grid */}
            <div className="pt-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Popular Cities
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MAJOR_INDIAN_CITIES.slice(0, 6).map((city) => {
                  const isSelected = location.name === city.name;
                  return (
                    <button
                      key={city.id}
                      id={`onboarding-popular-city-${city.id}`}
                      onClick={() => {
                        setLocation(city);
                        setStep(4);
                      }}
                      className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-all touch-manipulation active:scale-95 ${
                        isSelected
                          ? 'bg-sky-50 border-sky-400 text-sky-900 font-semibold'
                          : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <p className="text-xs font-semibold truncate">{city.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{city.state}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: PREPARING PERSONALIZED HOME */}
        {step === 4 && (
          <div className="flex-1 p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-4 overflow-y-auto overscroll-contain">
            <div className="w-16 h-16 rounded-3xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shadow-xs animate-bounce shrink-0">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Your Mausam is Ready</h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto">
                Configured with high-resolution weather models, {selectedPersonas.length} personalized modes, and localized for{' '}
                <span className="font-semibold text-slate-800">{location.name}</span>.
              </p>
            </div>

            <div className="w-full max-w-xs p-3 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="font-semibold text-slate-800">{location.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Language:</span>
                <span className="font-semibold text-slate-800 uppercase">{language}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Active Personas:</span>
                <span className="font-semibold text-sky-700 capitalize">
                  {selectedPersonas.slice(0, 2).join(', ')}
                  {selectedPersonas.length > 2 ? ` +${selectedPersonas.length - 2}` : ''}
                </span>
              </div>
            </div>

            <button
              id="onboarding-get-started-btn"
              onClick={handleFinish}
              className="w-full max-w-xs min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2 touch-manipulation active:scale-95"
            >
              <span>{texts.getStarted}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Bottom Actions for Step 1, 2, 3 */}
        {step < 4 && (
          <div className="p-3 sm:p-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between shrink-0">
            {step > 1 ? (
              <button
                id="onboarding-back-btn"
                onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-xl transition-colors touch-manipulation active:scale-95"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            <button
              id="onboarding-continue-btn"
              onClick={() => {
                if (step === 1) setStep(2);
                else if (step === 2) setStep(3);
                else if (step === 3) setStep(4);
              }}
              className="min-h-[44px] px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 shadow-sm touch-manipulation active:scale-95"
            >
              <span>{texts.continueBtn}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
