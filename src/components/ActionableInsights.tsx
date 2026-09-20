import React from 'react';
import {
  Sparkles,
  Umbrella,
  Sun,
  Shield,
  Car,
  Sprout,
  Activity,
  Compass,
  HeartPulse,
  Users,
  Ship,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { CurrentWeather, HourlyForecastItem, PersonaType, AirQualityData } from '../types';
import { NormalizedMarine } from '../services/providers/providerTypes';
import { generatePersonaIntelligence } from '../services/personaIntelligenceService';

interface ActionableInsightsProps {
  weather: CurrentWeather;
  hourly: HourlyForecastItem[];
  airQuality: AirQualityData;
  persona: PersonaType;
  marine?: NormalizedMarine;
  onSelectPersona?: () => void;
  onOpenAgroMet?: () => void;
  onOpenTravel?: () => void;
}

export const ActionableInsights: React.FC<ActionableInsightsProps> = ({
  weather,
  hourly,
  airQuality,
  persona,
  marine,
  onSelectPersona,
  onOpenAgroMet,
  onOpenTravel,
}) => {
  const intel = generatePersonaIntelligence(persona, weather, hourly, [], airQuality, 'Current Location', marine);

  const getPersonaIcon = (name: string) => {
    switch (name) {
      case 'Activity':
        return Activity;
      case 'Car':
        return Car;
      case 'Compass':
        return Compass;
      case 'HeartPulse':
        return HeartPulse;
      case 'Users':
        return Users;
      case 'Sprout':
        return Sprout;
      case 'Ship':
        return Ship;
      default:
        return Activity;
    }
  };

  const IconComp = getPersonaIcon(intel.iconName);

  // Weather safety tips
  const upcomingRainHour = hourly.slice(0, 12).find((h) => h.precipitationProb >= 35);
  const highUvHour = hourly.slice(0, 12).find((h) => h.uvIndex >= 6);

  return (
    <section className="w-full max-w-2xl mx-auto px-4 my-2">
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Actionable Insights</h3>
          </div>
          {onSelectPersona && (
            <button
              id="insights-switch-mode-btn"
              onClick={onSelectPersona}
              className="min-h-[36px] px-2.5 py-1 rounded-full text-xs font-semibold text-sky-600 hover:text-sky-800 hover:bg-sky-50 active:bg-sky-100 transition-colors touch-manipulation active:scale-95 flex items-center"
            >
              Switch Mode
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {/* Main Persona Intelligence Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/80 to-slate-50/80 border border-sky-100 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-sky-600 text-white shrink-0 mt-0.5">
              <IconComp className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-100/60 px-2 py-0.5 rounded-full">
                  {intel.label} • Score: {intel.score}
                </span>
                <span className="text-xs font-semibold text-emerald-700 truncate">
                  {intel.bestWindow}
                </span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-1">
                {intel.advisoryHeadline}
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {intel.recommendation}
              </p>

              {intel.actionButton && (
                <button
                  id="insights-action-btn"
                  onClick={() => {
                    if (intel.actionButton?.actionType === 'agromet' && onOpenAgroMet) onOpenAgroMet();
                    else if (intel.actionButton?.actionType === 'travel' && onOpenTravel) onOpenTravel();
                  }}
                  className="mt-2.5 min-h-[36px] px-3 py-1.5 rounded-full bg-sky-100/80 hover:bg-sky-200/70 active:bg-sky-300/70 inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 hover:text-sky-950 transition-colors touch-manipulation active:scale-95"
                >
                  <span>{intel.actionButton.label}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Micro Advice Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {upcomingRainHour ? (
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                <Umbrella className="w-4 h-4 text-sky-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-slate-800 block">Rain Alert</span>
                  <span className="text-slate-500">
                    {upcomingRainHour.precipitationProb}% chance around {upcomingRainHour.time}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-slate-800 block">Precipitation Clear</span>
                  <span className="text-slate-500">No rain expected in next 12 hours</span>
                </div>
              </div>
            )}

            {highUvHour ? (
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                <Sun className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-slate-800 block">High UV Alert</span>
                  <span className="text-slate-500">
                    Peak UV {highUvHour.uvIndex} around {highUvHour.time}. Use SPF 30+.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-sky-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-slate-800 block">AQI & UV Safe</span>
                  <span className="text-slate-500">Conditions within moderate thresholds</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
