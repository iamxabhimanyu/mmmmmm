import {
  CurrentWeather,
  HourlyForecastItem,
  DailyForecastItem,
  AirQualityData,
  WeatherAlert,
  WeatherConditionKey,
  AgroMetAdvisory,
  PersonaType,
  TravelRoute,
  LocationInfo,
} from '../types';
import { MAJOR_INDIAN_CITIES } from '../data/constants';
import { weatherIntelligenceEngine } from './weatherIntelligenceEngine';
import type { CompleteWeatherIntelligence } from './weatherIntelligenceEngine';

import { fetchWithTimeout } from './providers/fetchUtils';

export type { CompleteWeatherIntelligence };

export async function getWeatherIntelligence(
  location: LocationInfo,
  forceRefresh: boolean = false
): Promise<CompleteWeatherIntelligence> {
  return weatherIntelligenceEngine.getCompleteWeatherIntelligence(location, forceRefresh);
}

export async function searchIndianLocations(query: string): Promise<LocationInfo[]> {
  if (!query.trim()) return [];
  const lowerQ = query.toLowerCase();
  const localMatches = MAJOR_INDIAN_CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(lowerQ) ||
      c.state.toLowerCase().includes(lowerQ)
  );

  try {
    const res = await fetchWithTimeout(`/api/search-location?q=${encodeURIComponent(query)}`, undefined, 8000);
    if (res.ok) {
      const apiResults = await res.json();
      const combined = [...localMatches];
      for (const item of apiResults) {
        const already = combined.some(
          (c) =>
            Math.abs(c.lat - item.lat) < 0.05 &&
            Math.abs(c.lon - item.lon) < 0.05
        );
        if (!already) combined.push(item);
      }
      return combined;
    }
  } catch (e) {
    console.warn('Location search API error:', e);
  }
  return localMatches;
}

export function mapWmoCodeToCondition(code?: number | null, isDay: boolean = true): {
  key: WeatherConditionKey;
  text: string;
  icon: string;
} {
  if (code === undefined || code === null || !Number.isFinite(code)) {
    return { key: 'unknown', text: 'Condition Unavailable', icon: 'Cloud' };
  }
  switch (code) {
    case 0:
      return { key: 'clear', text: isDay ? 'Clear Sky' : 'Clear Night', icon: isDay ? 'Sun' : 'Moon' };
    case 1:
      return { key: 'clear', text: isDay ? 'Mainly Sunny' : 'Mainly Clear', icon: isDay ? 'Sun' : 'Moon' };
    case 2:
      return { key: 'partly-cloudy', text: 'Partly Cloudy', icon: 'CloudSun' };
    case 3:
      return { key: 'overcast', text: 'Overcast', icon: 'Cloud' };
    case 45:
    case 48:
      return { key: 'fog', text: 'Fog / Mist', icon: 'CloudFog' };
    case 51:
    case 53:
    case 55:
      return { key: 'drizzle', text: 'Light Drizzle', icon: 'CloudDrizzle' };
    case 61:
    case 63:
      return { key: 'rain', text: 'Moderate Rain', icon: 'CloudRain' };
    case 65:
      return { key: 'heavy-rain', text: 'Heavy Rainfall', icon: 'CloudRainWind' };
    case 71:
    case 73:
    case 75:
      return { key: 'snow', text: 'Snowfall', icon: 'CloudSnow' };
    case 80:
    case 81:
    case 82:
      return { key: 'rain', text: 'Rain Showers', icon: 'CloudRain' };
    case 95:
      return { key: 'thunderstorm', text: 'Thunderstorm', icon: 'CloudLightning' };
    case 96:
    case 99:
      return { key: 'thunderstorm', text: 'Severe Thunderstorm & Hail', icon: 'CloudLightning' };
    default:
      return { key: 'unknown', text: 'Unknown Condition', icon: 'Cloud' };
  }
}

export function getThemeClassesForCondition(conditionKey: WeatherConditionKey, isDay: boolean = true) {
  if (!isDay) {
    return {
      bgGradient: 'from-slate-900 via-indigo-950 to-slate-950',
      heroAccent: 'text-indigo-200',
      cardBg: 'bg-slate-900/80 border-slate-800 text-slate-100',
      softBadge: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40',
      sliderAccent: 'bg-indigo-800/40 text-indigo-200',
      isDark: true,
    };
  }

  switch (conditionKey) {
    case 'clear':
      return {
        bgGradient: 'from-amber-100/60 via-sky-50 to-slate-50',
        heroAccent: 'text-amber-600',
        cardBg: 'bg-white/85 border-slate-200/70 text-slate-900',
        softBadge: 'bg-amber-100/80 text-amber-900 border-amber-200',
        sliderAccent: 'bg-amber-100/70 text-amber-900',
        isDark: false,
      };
    case 'partly-cloudy':
      return {
        bgGradient: 'from-sky-100/70 via-slate-50 to-emerald-50/20',
        heroAccent: 'text-sky-600',
        cardBg: 'bg-white/90 border-slate-200/70 text-slate-900',
        softBadge: 'bg-sky-100 text-sky-900 border-sky-200',
        sliderAccent: 'bg-sky-100 text-sky-900',
        isDark: false,
      };
    case 'overcast':
    case 'fog':
    case 'unknown':
      return {
        bgGradient: 'from-slate-200/70 via-slate-100 to-sky-50',
        heroAccent: 'text-slate-600',
        cardBg: 'bg-white/90 border-slate-200 text-slate-900',
        softBadge: 'bg-slate-200/80 text-slate-800 border-slate-300',
        sliderAccent: 'bg-slate-200/80 text-slate-900',
        isDark: false,
      };
    case 'rain':
    case 'drizzle':
      return {
        bgGradient: 'from-sky-200/60 via-blue-50 to-slate-100',
        heroAccent: 'text-blue-600',
        cardBg: 'bg-white/90 border-blue-100 text-slate-900',
        softBadge: 'bg-blue-100 text-blue-900 border-blue-200',
        sliderAccent: 'bg-blue-100 text-blue-900',
        isDark: false,
      };
    case 'heavy-rain':
    case 'thunderstorm':
      return {
        bgGradient: 'from-slate-300/80 via-indigo-100/60 to-slate-150',
        heroAccent: 'text-indigo-700',
        cardBg: 'bg-white/90 border-indigo-100 text-slate-900',
        softBadge: 'bg-indigo-100 text-indigo-950 border-indigo-200',
        sliderAccent: 'bg-indigo-100 text-indigo-900',
        isDark: false,
      };
    default:
      return {
        bgGradient: 'from-sky-100/60 via-slate-50 to-slate-50',
        heroAccent: 'text-sky-600',
        cardBg: 'bg-white/90 border-slate-200 text-slate-900',
        softBadge: 'bg-sky-100 text-sky-900 border-sky-200',
        sliderAccent: 'bg-sky-100 text-sky-900',
        isDark: false,
      };
  }
}

export async function fetchLiveWeatherData(lat: number, lon: number): Promise<{
  current: CurrentWeather;
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
}> {
  const intel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence({
    id: `loc-${lat.toFixed(5)}-${lon.toFixed(5)}`,
    name: 'Selected Station',
    state: 'India',
    country: 'India',
    lat,
    lon,
  });

  return {
    current: intel.legacyWeather,
    hourly: intel.legacyHourly,
    daily: intel.legacyDaily,
  };
}

export async function fetchAirQualityData(lat: number, lon: number): Promise<AirQualityData> {
  const intel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence({
    id: `loc-${lat.toFixed(5)}-${lon.toFixed(5)}`,
    name: 'Selected Station',
    state: 'India',
    country: 'India',
    lat,
    lon,
  });

  return intel.legacyAirQuality;
}

/**
 * @deprecated Use weatherIntelligenceEngine.generateNormalizedAlerts directly.
 * Forwarded to canonical weatherIntelligenceEngine to eliminate duplicate alert logic,
 * false fog on missing visibility, and fabricated flood metrics.
 */
export function generateAlerts(
  locationName: string,
  state: string,
  weather: CurrentWeather,
  hourly: HourlyForecastItem[]
): WeatherAlert[] {
  if (
    !weather ||
    (weather as any).isUnavailable === true ||
    typeof weather.temperature !== 'number' ||
    !Number.isFinite(weather.temperature)
  ) {
    return [];
  }

  // Calculate thunderstorm risk using the canonical engine
  const thunderstorm = weatherIntelligenceEngine.computeThunderstormRisk(
    {
      ...weather,
      weatherConditionKey: weather.conditionKey,
    } as any,
    hourly as any
  );

  // Delegate to canonical weatherIntelligenceEngine alert generator
  const alerts = weatherIntelligenceEngine.generateNormalizedAlerts(
    locationName,
    state,
    {
      ...weather,
      weatherConditionKey: weather.conditionKey,
    } as any,
    hourly as any,
    thunderstorm,
    {
      basinName: locationName,
      locationName,
      riskLevel: 'Unavailable',
      trend: 'Unavailable',
      confidence: 'Unavailable',
      isUnavailable: true,
      advisory: 'Flood risk evaluation unavailable in legacy alert caller.',
      forecastPeriod: 'Unavailable',
      source: {
        providerId: 'unavailable',
        providerName: 'Unavailable',
        classification: 'open-source-software',
        isOfficialIMD: false,
        isDerived: true,
        timestamp: new Date().toISOString(),
        confidenceScore: 0,
        attributionText: 'Unavailable',
      },
      disclaimer: '',
    }
  );

  return alerts;
}

/**
 * @deprecated Use weatherIntelligenceEngine.computeAgroMetAdvisory directly.
 * Forwarded to canonical weatherIntelligenceEngine to eliminate duplicate decision logic
 * and maintain a single source of truth for agro-meteorological advisories.
 */
export function generateAgroMetAdvisory(
  location: string,
  weather: CurrentWeather,
  daily: DailyForecastItem[]
): AgroMetAdvisory {
  return weatherIntelligenceEngine.computeAgroMetAdvisory(location, weather, daily);
}

/**
 * Returns travel corridor demonstration data.
 * Clearly marked as illustrative simulation data, never claiming live road telemetry.
 */
export function getTravelRouteData(origin: string, destination: string): TravelRoute {
  return {
    routeName: `${origin} to ${destination} Highway Corridor`,
    origin,
    destination,
    totalKm: 148,
    overallAdvisory: 'Illustrative Highway Corridor: Live road-sensor weather telemetry is not connected for this corridor. Values shown are illustrative simulation data.',
    isIllustrative: true,
    isUnavailable: true,
    isLive: false,
    disclaimer: 'Illustrative Corridor Simulation: Real-time road waypoint meteorological sensors are not active on this highway sector. Displayed temperatures, rain chances, and road states are reference demonstration values, not live observations.',
    stops: [
      {
        city: origin,
        distanceKm: 0,
        eta: 'Depart 08:00 AM',
        temp: 28,
        condition: 'Clear Sky (Sample)',
        conditionKey: 'clear',
        rainProb: 10,
        roadCondition: 'Clear',
      },
      {
        city: 'Ghat / Highway Pass',
        distanceKm: 82,
        eta: '09:45 AM',
        temp: 23,
        condition: 'Passing Fog & Drizzle (Sample)',
        conditionKey: 'fog',
        rainProb: 45,
        roadCondition: 'Wet',
      },
      {
        city: 'Midway Toll Plaza',
        distanceKm: 118,
        eta: '10:30 AM',
        temp: 27,
        condition: 'Partly Cloudy (Sample)',
        conditionKey: 'partly-cloudy',
        rainProb: 15,
        roadCondition: 'Clear',
      },
      {
        city: destination,
        distanceKm: 148,
        eta: 'Arrive 11:15 AM',
        temp: 29,
        condition: 'Sunny (Sample)',
        conditionKey: 'clear',
        rainProb: 10,
        roadCondition: 'Clear',
      },
    ],
  };
}
