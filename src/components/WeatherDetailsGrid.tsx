import React, { useState } from 'react';
import {
  Wind,
  Droplets,
  Sun,
  Eye,
  Gauge,
  Sunrise,
  Sunset,
  CloudRain,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Compass,
  Thermometer,
} from 'lucide-react';
import { CurrentWeather, AirQualityData } from '../types';

interface WeatherDetailsGridProps {
  weather: CurrentWeather;
  airQuality: AirQualityData;
  temperatureUnit?: 'C' | 'F';
  isDark?: boolean;
}

export const WeatherDetailsGrid: React.FC<WeatherDetailsGridProps> = ({
  weather,
  airQuality,
  temperatureUnit = 'C',
  isDark = false,
}) => {
  const [showMore, setShowMore] = useState(false);

  const isDataUnavailable =
    weather.conditionText === 'Data Unavailable' ||
    weather.source?.providerId === 'unavailable' ||
    airQuality.calculationMethod === 'Unavailable';

  const getWindDirectionLabel = (deg: number) => {
    if (isDataUnavailable) return '—';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  };

  const getUvLevel = (uv: number) => {
    if (isDataUnavailable) return { text: 'Unavailable', desc: 'UV index observation temporarily offline.' };
    if (uv <= 2) return { text: 'Low', desc: 'No sun protection required.' };
    if (uv <= 5) return { text: 'Moderate', desc: 'Wear sunscreen or a hat during peak midday.' };
    if (uv <= 7) return { text: 'High', desc: 'Seek shade during midday; apply SPF 30+.' };
    if (uv <= 10) return { text: 'Very High', desc: 'Avoid direct midday sun; wear UV sunglasses.' };
    return { text: 'Extreme', desc: 'Take full protection; avoid sun between 11 AM - 3 PM.' };
  };

  const uvInfo = getUvLevel(weather.uvIndex);

  const displayDewPoint = (celsius: number) => {
    if (isDataUnavailable || typeof celsius !== 'number' || !Number.isFinite(celsius)) return '—';
    if (temperatureUnit === 'F') {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
  };

  const dewPointDisplay = displayDewPoint(weather.dewPoint);

  return (
    <section className="w-full max-w-2xl mx-auto px-4 my-2">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <h3
          className={`text-sm font-semibold tracking-tight transition-colors duration-300 ${
            isDark ? 'text-white' : 'text-slate-800'
          }`}
        >
          Weather Details
        </h3>
        <span
          className={`text-xs font-medium transition-colors duration-300 ${
            isDark ? 'text-slate-400' : 'text-slate-400'
          }`}
        >
          {isDataUnavailable ? 'Status: Offline' : 'Live Meteorological Data'}
        </span>
      </div>

      {/* Grid of rounded Google Weather style cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        {/* 1. Air Quality (AQI) Card */}
        <div className="col-span-2 sm:col-span-1 bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Air Quality (AQI)
            </span>
            <span className="text-[10px] text-slate-400">CPCB India</span>
          </div>

          <div className="my-1 flex items-baseline gap-2">
            <span className="text-3xl font-light text-slate-900 tracking-tight">
              {isDataUnavailable ? '—' : airQuality.aqi}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDataUnavailable ? 'bg-slate-100 text-slate-600' : airQuality.bgColor}`}>
              {isDataUnavailable ? 'Unavailable' : airQuality.category}
            </span>
          </div>

          <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
            {airQuality.healthAdvice}
          </p>

          <div className="flex items-center gap-3 pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>PM2.5: <strong className="text-slate-700">{isDataUnavailable ? '—' : `${airQuality.pm25} µg/m³`}</strong></span>
            <span>PM10: <strong className="text-slate-700">{isDataUnavailable ? '—' : `${airQuality.pm10} µg/m³`}</strong></span>
          </div>
        </div>

        {/* 2. UV Index Card */}
        <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              UV Index
            </span>
            <span className="text-xs font-semibold text-slate-700">{uvInfo.text}</span>
          </div>

          <div className="my-1">
            <span className="text-3xl font-light text-slate-900 tracking-tight">
              {isDataUnavailable || typeof weather.uvIndex !== 'number' || !Number.isFinite(weather.uvIndex) ? '—' : weather.uvIndex}
            </span>
            {!isDataUnavailable && typeof weather.uvIndex === 'number' && Number.isFinite(weather.uvIndex) && <span className="text-xs text-slate-400 font-normal ml-1">/ 11</span>}
          </div>

          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {uvInfo.desc}
          </p>
        </div>

        {/* 3. Wind & Gust Card */}
        <div className="bg-white/85 backdrop-blur-md rounded-3xl p-3.5 sm:p-4 border border-black/[0.05] shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-2 gap-1 min-w-0">
            <span className="flex items-center gap-1.5 shrink-0">
              <Wind className="w-3.5 h-3.5 text-teal-500" />
              Wind
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-700 flex items-center gap-1 truncate">
              <Compass className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">
                {isDataUnavailable || typeof weather.windDirection !== 'number' || !Number.isFinite(weather.windDirection) ? '—' : `${getWindDirectionLabel(weather.windDirection)} (${weather.windDirection}°)`}
              </span>
            </span>
          </div>

          <div className="my-1 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-light text-slate-900 tracking-tight">
              {isDataUnavailable || typeof weather.windSpeed !== 'number' || !Number.isFinite(weather.windSpeed) ? '—' : weather.windSpeed}
            </span>
            {!isDataUnavailable && typeof weather.windSpeed === 'number' && Number.isFinite(weather.windSpeed) && <span className="text-xs text-slate-500 font-normal">km/h</span>}
          </div>

          <p className="text-xs text-slate-600 mt-1 truncate">
            {isDataUnavailable || typeof weather.windGust !== 'number' || !Number.isFinite(weather.windGust) ? 'Wind speed unavailable' : <>Gusts up to <strong className="text-slate-800">{weather.windGust} km/h</strong></>}
          </p>
        </div>

        {/* 4. Humidity & Dew Point Card */}
        <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-sky-500" />
              Humidity
            </span>
            <span className="text-xs font-medium text-slate-500">
              {isDataUnavailable || typeof weather.humidity !== 'number' || !Number.isFinite(weather.humidity) ? '—' : weather.humidity > 65 ? 'Humid' : weather.humidity < 35 ? 'Dry' : 'Comfortable'}
            </span>
          </div>

          <div className="my-1">
            <span className="text-3xl font-light text-slate-900 tracking-tight">
              {isDataUnavailable || typeof weather.humidity !== 'number' || !Number.isFinite(weather.humidity) ? '—' : weather.humidity}
            </span>
            {!isDataUnavailable && typeof weather.humidity === 'number' && Number.isFinite(weather.humidity) && <span className="text-xs text-slate-500 font-normal">%</span>}
          </div>

          <p className="text-xs text-slate-600 mt-1">
            {isDataUnavailable || dewPointDisplay === '—' ? (
              'Dew point unavailable'
            ) : (
              <>
                The dew point is <strong className="text-slate-800">{dewPointDisplay}°{temperatureUnit}</strong>
              </>
            )}
          </p>
        </div>

        {/* 5. Sunrise & Sunset Card */}
        <div className="bg-white/85 backdrop-blur-md rounded-3xl p-3.5 sm:p-4 border border-black/[0.05] shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <Sunrise className="w-3.5 h-3.5 text-amber-500" />
              Sunrise & Sunset
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 my-1">
            <div>
              <p className="text-[10px] text-slate-400">Dawn</p>
              <p className="text-sm xs:text-base font-semibold text-slate-800 truncate">{weather.sunrise}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Dusk</p>
              <p className="text-sm xs:text-base font-semibold text-slate-800 truncate">{weather.sunset}</p>
            </div>
          </div>

          <p className="text-[10px] xs:text-[11px] text-slate-500 mt-1 truncate">
            {isDataUnavailable ? 'Solar ephemeris unavailable' : weather.sunset ? `Golden hour window preceding ${weather.sunset}` : 'Solar ephemeris'}
          </p>
        </div>

        {/* 6. Visibility Card */}
        <div className="bg-white/85 backdrop-blur-md rounded-3xl p-3.5 sm:p-4 border border-black/[0.05] shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-500" />
              Visibility
            </span>
            <span className="text-xs font-semibold text-slate-700">
              {isDataUnavailable || typeof weather.visibility !== 'number' || !Number.isFinite(weather.visibility)
                ? 'Unavailable'
                : weather.visibility >= 10
                ? 'Clear'
                : weather.visibility >= 4
                ? 'Moderate'
                : 'Foggy'}
            </span>
          </div>

          <div className="my-1 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-light text-slate-900 tracking-tight">
              {isDataUnavailable || typeof weather.visibility !== 'number' || !Number.isFinite(weather.visibility) ? '—' : weather.visibility}
            </span>
            {!isDataUnavailable && typeof weather.visibility === 'number' && Number.isFinite(weather.visibility) && <span className="text-xs text-slate-500 font-normal">km</span>}
          </div>

          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
            {isDataUnavailable || typeof weather.visibility !== 'number' || !Number.isFinite(weather.visibility)
              ? 'Visibility observations temporarily offline.'
              : weather.visibility >= 10
              ? 'Clear horizon; excellent road and flight visibility.'
              : 'Reduced visibility; exercise caution while driving.'}
          </p>
        </div>
      </div>

      {/* Progressive Disclosure: More Details Toggle */}
      <div className="mt-3 text-center">
        <button
          id="details-toggle-more-btn"
          onClick={() => setShowMore(!showMore)}
          className={`inline-flex items-center gap-1.5 px-5 py-2 min-h-[44px] rounded-full text-xs font-medium transition-all focus:outline-none touch-manipulation active:scale-95 ${
            isDark
              ? 'bg-white/10 hover:bg-white/15 active:bg-white/20 text-slate-200 border border-white/10'
              : 'bg-slate-900/5 hover:bg-slate-900/10 active:bg-slate-900/15 text-slate-700'
          }`}
        >
          <span>{showMore ? 'Fewer details' : 'More meteorological details'}</span>
          {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Secondary Progressive Disclosure Tray */}
      {showMore && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
          <div className="bg-white/80 rounded-2xl p-3 border border-black/[0.04] text-xs">
            <span className="text-slate-400 font-medium block">Sea-level Pressure</span>
            <span className="text-lg font-semibold text-slate-800 mt-0.5 block">
              {isDataUnavailable || typeof weather.pressure !== 'number' || !Number.isFinite(weather.pressure) ? '—' : `${weather.pressure} hPa`}
            </span>
            <span className="text-[10px] text-slate-500">
              {isDataUnavailable ? 'Barometric sensor offline' : 'Normal barometric gradient'}
            </span>
          </div>

          <div className="bg-white/80 rounded-2xl p-3 border border-black/[0.04] text-xs">
            <span className="text-slate-400 font-medium block">Cloud Cover</span>
            <span className="text-lg font-semibold text-slate-800 mt-0.5 block">
              {isDataUnavailable || typeof weather.cloudCover !== 'number' || !Number.isFinite(weather.cloudCover) ? '—' : `${weather.cloudCover}%`}
            </span>
            <span className="text-[10px] text-slate-500">
              {isDataUnavailable ? 'Cloud cover data offline' : 'Atmospheric sky density'}
            </span>
          </div>

          <div className="bg-white/80 rounded-2xl p-3 border border-black/[0.04] text-xs col-span-2 sm:col-span-1">
            <span className="text-slate-400 font-medium block">24h Rain Gauge</span>
            <span className="text-lg font-semibold text-slate-800 mt-0.5 block">
              {isDataUnavailable ? '—' : `${weather.precipitation24h} mm`}
            </span>
            <span className="text-[10px] text-slate-500">
              {isDataUnavailable ? 'Precipitation gauge offline' : 'Cumulative rainfall recorded'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
