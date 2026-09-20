import React from 'react';
import { ArrowDown, ArrowUp, Droplets, Wind } from 'lucide-react';
import { CurrentWeather, LocationInfo } from '../types';
import { WeatherIcon } from './WeatherIcon';
import { FreshnessMetadata } from '../services/providers/providerTypes';

interface WeatherHeroProps {
  weather: CurrentWeather;
  location: LocationInfo;
  temperatureUnit?: 'C' | 'F';
  onTapInsights?: () => void;
  isDark?: boolean;
  freshness?: FreshnessMetadata;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenTransparency?: () => void;
}

export const WeatherHero: React.FC<WeatherHeroProps> = ({
  weather,
  location,
  temperatureUnit = 'C',
  isDark: propIsDark,
  freshness,
  onRefresh,
  isRefreshing = false,
  onOpenTransparency,
}) => {
  const isDataUnavailable =
    freshness?.isUnavailable ||
    freshness?.status === 'unavailable' ||
    weather.conditionText === 'Data Unavailable' ||
    weather.source?.providerId === 'unavailable';

  const isDark = propIsDark !== undefined ? propIsDark : !weather.isDay;

  const displayTemp = (celsius: number | null | undefined) => {
    if (isDataUnavailable || typeof celsius !== 'number' || !Number.isFinite(celsius)) return '—';
    if (temperatureUnit === 'F') {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
  };

  const todayDateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  // Dynamic high-contrast character colors tuned strictly to the active background
  const textTheme = isDark
    ? {
        primary: 'text-white',
        secondary: 'text-slate-100',
        muted: 'text-slate-300',
        subtle: 'text-slate-400',
        dateBadge: 'bg-white/10 border-white/20 text-slate-200',
        metricPill: 'bg-white/10 border-white/20 text-slate-100',
        iconBg: 'bg-white/10 border-white/20',
        highAccent: 'text-amber-300',
        lowAccent: 'text-sky-300',
        humidityIcon: 'text-sky-300',
        windIcon: 'text-teal-300',
        divider: 'bg-white/25',
      }
    : weather.conditionKey === 'thunderstorm' || weather.conditionKey === 'heavy-rain'
    ? {
        primary: 'text-slate-950',
        secondary: 'text-slate-900',
        muted: 'text-slate-800',
        subtle: 'text-slate-700',
        dateBadge: 'bg-slate-900/10 border-slate-900/15 text-slate-800',
        metricPill: 'bg-white/80 border-slate-300/80 text-slate-900 shadow-xs',
        iconBg: 'bg-white/80 border-slate-200 shadow-xs',
        highAccent: 'text-amber-700',
        lowAccent: 'text-blue-700',
        humidityIcon: 'text-blue-700',
        windIcon: 'text-indigo-700',
        divider: 'bg-slate-400',
      }
    : weather.conditionKey === 'clear'
    ? {
        primary: 'text-slate-900',
        secondary: 'text-slate-800',
        muted: 'text-slate-700',
        subtle: 'text-slate-600',
        dateBadge: 'bg-amber-900/5 border-amber-900/10 text-slate-700',
        metricPill: 'bg-white/80 border-amber-900/10 text-slate-800 shadow-xs',
        iconBg: 'bg-white/80 border-amber-200/60 shadow-xs',
        highAccent: 'text-amber-600',
        lowAccent: 'text-blue-600',
        humidityIcon: 'text-sky-600',
        windIcon: 'text-teal-600',
        divider: 'bg-slate-300',
      }
    : {
        // Standard Light
        primary: 'text-slate-900',
        secondary: 'text-slate-800',
        muted: 'text-slate-600',
        subtle: 'text-slate-500',
        dateBadge: 'bg-slate-900/5 border-slate-900/10 text-slate-700',
        metricPill: 'bg-white/80 border-slate-200/80 text-slate-800 shadow-xs',
        iconBg: 'bg-white/80 border-slate-200 shadow-xs',
        highAccent: 'text-amber-600',
        lowAccent: 'text-blue-600',
        humidityIcon: 'text-sky-600',
        windIcon: 'text-teal-600',
        divider: 'bg-slate-300',
      };

  return (
    <section
      id="weather-hero-section"
      className={`relative px-4 pt-3 pb-2 w-full max-w-2xl mx-auto flex flex-col items-center text-center transition-colors duration-500 ${textTheme.primary}`}
    >
      {/* Date & Time Capsule with contrast borders */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`flex items-center gap-2 text-xs font-semibold tracking-wide uppercase px-3 py-1 rounded-full border backdrop-blur-xs transition-colors duration-300 ${textTheme.dateBadge}`}
        >
          <span>{todayDateStr}</span>
          <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-slate-400' : 'bg-slate-500'}`}></span>
          <span>{weather.time} IST</span>
        </div>

        {/* Live / Cache / Provenance Status Chip */}
      </div>

      {/* Main Temperature & Visual Display */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 my-1">
        {/* Dominant Temperature */}
        <div className="relative flex items-start">
          <span
            className={`text-6xl xs:text-7xl sm:text-8xl md:text-9xl font-light tracking-tighter leading-none transition-colors duration-300 ${textTheme.primary}`}
          >
            {isDataUnavailable ? '—' : displayTemp(weather.temperature)}
          </span>
          {!isDataUnavailable && (
            <span
              className={`text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-light ml-1 mt-0.5 transition-colors duration-300 ${textTheme.muted}`}
            >
              °{temperatureUnit}
            </span>
          )}
        </div>

        {/* Large Condition Icon */}
        <div
          className={`flex flex-col items-center justify-center p-2.5 rounded-3xl border backdrop-blur-xs shrink-0 transition-colors duration-300 ${textTheme.iconBg}`}
        >
          <WeatherIcon
            conditionKey={weather.conditionKey}
            isDay={weather.isDay}
            className="w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20"
          />
        </div>
      </div>

      {/* Weather Condition Text with Enhanced Character Contrast */}
      <h2
        className={`text-lg xs:text-xl sm:text-2xl font-semibold tracking-tight mt-1 capitalize px-2 transition-colors duration-300 ${textTheme.secondary}`}
      >
        {weather.conditionText}
      </h2>

      {/* Feels Like & High / Low Metrics Row */}
      <div
        className={`flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-2.5 text-xs sm:text-sm font-medium transition-colors duration-300 ${textTheme.secondary}`}
      >
        <span
          className={`px-3 py-1 rounded-full border whitespace-nowrap transition-colors duration-300 ${textTheme.metricPill}`}
        >
          Feels like{' '}
          <span className={`font-bold ${textTheme.primary}`}>
            {isDataUnavailable ? '—' : `${displayTemp(weather.feelsLike)}°`}
          </span>
        </span>

        <div
          className={`flex items-center gap-2.5 px-3 py-1 rounded-full border whitespace-nowrap transition-colors duration-300 ${textTheme.metricPill}`}
        >
          <span className="flex items-center gap-1">
            <ArrowUp className={`w-3.5 h-3.5 ${textTheme.highAccent}`} />
            <span className={`font-bold ${textTheme.primary}`}>
              H {isDataUnavailable ? '—' : `${displayTemp(weather.high)}°`}
            </span>
          </span>
          <span className={`w-px h-3 ${textTheme.divider}`}></span>
          <span className="flex items-center gap-1">
            <ArrowDown className={`w-3.5 h-3.5 ${textTheme.lowAccent}`} />
            <span className={`font-bold ${textTheme.primary}`}>
              L {isDataUnavailable ? '—' : `${displayTemp(weather.low)}°`}
            </span>
          </span>
        </div>
      </div>

      {/* Micro-Bar: Humidity & Wind with dynamic icon & text contrast */}
      <div
        className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3 text-xs font-medium transition-colors duration-300 ${textTheme.muted}`}
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Droplets className={`w-3.5 h-3.5 ${textTheme.humidityIcon}`} />
          <span>
            Humidity:{' '}
            <strong className={`font-bold ${textTheme.primary}`}>
              {isDataUnavailable ? '—' : `${weather.humidity}%`}
            </strong>
          </span>
        </span>
        <span className={`hidden xs:inline-block w-1 h-1 rounded-full ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`}></span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Wind className={`w-3.5 h-3.5 ${textTheme.windIcon}`} />
          <span>
            Wind:{' '}
            <strong className={`font-bold ${textTheme.primary}`}>
              {isDataUnavailable ? '—' : `${weather.windSpeed} km/h`}
            </strong>
          </span>
        </span>
      </div>
    </section>
  );
};
