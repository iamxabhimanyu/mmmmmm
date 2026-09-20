/**
 * Core Types and Interfaces for MAUSAM Indian Weather Intelligence
 */

export type WeatherConditionKey =
  | 'clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'thunderstorm'
  | 'snow'
  | 'dust'
  | 'unknown';

export interface WeatherConditionInfo {
  key: WeatherConditionKey;
  label: string;
  description: string;
  icon: string;
  bgGradient: string;
  cardBg: string;
  accentColor: string;
  badgeBg: string;
  textColor: string;
}

export interface CurrentWeather {
  temperature?: number;
  feelsLike?: number;
  conditionCode?: number;
  conditionKey: WeatherConditionKey;
  conditionText: string;
  high?: number;
  low?: number;
  humidity?: number;
  windSpeed?: number; // km/h
  windDirection?: number; // degrees
  windGust?: number; // km/h
  pressure?: number; // hPa
  visibility?: number; // km
  uvIndex?: number;
  dewPoint?: number;
  precipitation24h?: number; // mm
  cloudCover?: number; // %
  sunrise?: string;
  sunset?: string;
  isDay?: boolean;
  time?: string;
}

export interface HourlyForecastItem {
  time: string; // "7 PM", "8 PM"
  isoTime: string;
  timestamp: number;
  temperature?: number;
  feelsLike?: number;
  conditionCode?: number;
  conditionKey: WeatherConditionKey;
  conditionText: string;
  precipitationProb?: number; // %
  rainMm?: number;
  windSpeed?: number;
  humidity?: number;
  uvIndex?: number;
  dayLabel?: string;
  isDay?: boolean;
}

export interface DailyForecastItem {
  date: string; // "YYYY-MM-DD"
  dayName: string; // "Today", "Sat", "Sun"
  fullDate: string; // "12 Sep 2026"
  conditionCode?: number;
  conditionKey: WeatherConditionKey;
  conditionText: string;
  tempMax?: number;
  tempMin?: number;
  precipitationProb?: number; // %
  rainSumMm?: number;
  windSpeedMax?: number;
  uvIndexMax?: number;
  sunrise?: string;
  sunset?: string;
  humidity?: number;
}

export interface AirQualityData {
  aqi?: number; // Indian CPCB scale (0 - 500)
  category?: 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe' | 'Unavailable' | 'Unknown';
  color: string;
  bgColor: string;
  pm25?: number;
  pm10?: number;
  nitrogenDioxide?: number;
  sulphurDioxide?: number;
  ozone?: number;
  carbonMonoxide?: number;
  dust?: number;
  healthAdvice: string;
  calculationMethod?: string;
  source: string;
  isUnavailable?: boolean;
}

export type AlertSeverity = 'severe' | 'warning' | 'advisory' | 'info';

export interface WeatherAlert {
  id: string;
  severity: AlertSeverity;
  alertType: string;
  title: string;
  issuedBy: 'Mausam Intelligence Engine' | 'Mausam Convective Engine' | 'Mausam Hydrology Engine' | 'IMD' | 'NDMA' | 'State SDMA' | 'CAP India' | string;
  region: string;
  issuedAt: string;
  validUntil: string;
  headline: string;
  description: string;
  actionableAdvice: string[];
  impactZones?: string[];
  colorCode: 'Red' | 'Orange' | 'Yellow' | 'Green';
  isOfficialWarning?: boolean;
}

import { isValidCoordinate, normalizeCoordinates, isWithinIndiaBounds } from './utils/coordinateUtils';

export interface LocationInfo {
  id: string;
  name: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  isCurrent?: boolean;
  displayName?: string;
  district?: string;
  city?: string;
  town?: string;
  village?: string;
  postcode?: string;
  countryCode?: string;
  timezone?: string;
  elevation?: number;
  source?: 'open-meteo' | 'nominatim' | 'gps' | 'catalog' | 'cache' | 'saved' | 'history' | 'manual';
}

export interface NormalizedLocation extends LocationInfo {
  latitude: number;
  longitude: number;
  displayName: string;
  countryCode: string;
  source: 'open-meteo' | 'nominatim' | 'gps' | 'catalog' | 'cache' | 'saved' | 'history' | 'manual';
}

export function normalizeLocation(loc: LocationInfo | NormalizedLocation): NormalizedLocation {
  const rawLat = typeof (loc as any).latitude === 'number' ? (loc as any).latitude : loc.lat;
  const rawLon = typeof (loc as any).longitude === 'number' ? (loc as any).longitude : loc.lon;

  const norm = normalizeCoordinates(rawLat, rawLon);
  const latitude = norm ? norm.lat : rawLat;
  const longitude = norm ? norm.lon : rawLon;

  const isWithinIndia = isWithinIndiaBounds(latitude, longitude);
  const state = loc.state !== undefined && loc.state !== '' ? loc.state : (isWithinIndia ? 'India' : 'Unknown');
  const country = loc.country || (isWithinIndia ? 'India' : 'Unknown');
  const countryCode = loc.countryCode || (isWithinIndia ? 'IN' : 'XX');
  const timezone = loc.timezone || (isWithinIndia ? 'Asia/Kolkata' : 'UTC');
  const name = loc.name || (isWithinIndia ? 'Selected Location' : 'Outside India Location');
  const district = loc.district || undefined;
  const town = loc.town || undefined;
  const village = loc.village || undefined;
  const city = loc.city || undefined;

  // Build high-integrity displayName from available hierarchy without fabricating
  const subAdmin = village || town || (city && city !== name ? city : undefined);
  const contextParts = [
    name,
    subAdmin && subAdmin !== name ? subAdmin : undefined,
    district && district !== name && district !== subAdmin ? district : undefined,
    state && state !== name && state !== district ? state : undefined,
    country,
  ].filter(Boolean);

  const displayName = loc.displayName || contextParts.join(', ');

  const coordSuffix = norm
    ? `${norm.lat.toFixed(5)}_${norm.lon.toFixed(5)}`
    : `${latitude}_${longitude}`;

  return {
    id: loc.id || `loc-${coordSuffix}`,
    name,
    displayName,
    latitude,
    longitude,
    lat: latitude,
    lon: longitude,
    country,
    countryCode,
    state,
    district,
    city: loc.city,
    town: loc.town,
    village: loc.village,
    postcode: loc.postcode,
    timezone,
    elevation: loc.elevation,
    source: loc.source || 'catalog',
    isCurrent: Boolean(loc.isCurrent),
  };
}

export type PersonaType =
  | 'runner'
  | 'commuter'
  | 'traveller'
  | 'health'
  | 'family'
  | 'farmer'
  | 'marine'
  // Legacy aliases for backward compatibility
  | 'general'
  | 'outdoor'
  | 'student'
  | 'safety';

export interface PersonaProfile {
  id: PersonaType;
  label: string;
  icon: string;
  badge: string;
  description: string;
  tagline?: string;
  primaryQuestion?: string;
}

export interface PersonaMetricItem {
  label: string;
  value: string;
  subValue?: string;
  status?: 'good' | 'moderate' | 'caution' | 'neutral';
  icon?: string;
}

export interface PersonaHourlyScore {
  time: string;
  score: number; // 0-100
  status: 'Ideal' | 'Good' | 'Fair' | 'Avoid';
  temp?: number;
  rainProb?: number;
  conditionText?: string;
  note?: string;
  dayLabel?: string;
  isToday?: boolean;
}

export interface PersonaIntelligence {
  personaId: PersonaType;
  label: string;
  iconName: string;
  score: number; // 0-100
  scoreLabel: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Caution' | 'Not Applicable' | 'Unavailable';
  primaryQuestion: string;
  primaryAnswer: string;
  bestWindow: string;
  bestWindowSub?: string;
  avoidWindow?: string;
  avoidWindowReason?: string;
  keyConditions: {
    label: string;
    value: string;
    status?: 'good' | 'moderate' | 'caution' | 'neutral';
  }[];
  recommendation: string;
  advisoryHeadline: string;
  prioritizedMetrics: PersonaMetricItem[];
  hourlySuitability: PersonaHourlyScore[];
  whatToCarryOrAction: string[];
  actionButton?: {
    label: string;
    actionType: 'agromet' | 'travel' | 'radar' | 'alerts' | 'custom';
  };
  confidenceLevel?: 'High' | 'Moderate' | 'Low' | 'Unavailable';
  missingMetrics?: string[];
  isModelDerived?: boolean;
}

export interface AgroMetAdvisory {
  cropSeason: 'Kharif' | 'Rabi' | 'Zaid';
  primaryCrops: string[];
  spraySafety: {
    status: 'Safe' | 'Caution' | 'Unfavorable';
    reason: string;
    nextFavorableWindow: string;
  };
  irrigationAdvisory: string;
  sowingHarvestingNotice: string;
  soilMoistureEst: string; // e.g., "Adequate (65%)"
  pestDiseaseAlert: string;
  sourceAttribution?: string;
  isModelDerived?: boolean;
}

export interface JourneyStop {
  city: string;
  distanceKm: number;
  eta: string;
  temp: number;
  condition: string;
  conditionKey: WeatherConditionKey;
  rainProb: number;
  roadCondition: 'Clear' | 'Wet' | 'Foggy' | 'Waterlogged';
}

export interface TravelRoute {
  routeName: string;
  origin: string;
  destination: string;
  totalKm: number;
  overallAdvisory: string;
  stops: JourneyStop[];
  isIllustrative?: boolean;
  isUnavailable?: boolean;
  isLive?: boolean;
  disclaimer?: string;
}

export interface CitizenReport {
  id: string;
  location: string;
  state: string;
  condition: string;
  conditionKey: WeatherConditionKey;
  temp: number;
  timeAgo: string;
  reporterName: string;
  verified: boolean;
  upvotes: number;
  userUpvoted?: boolean;
  notes: string;
  tag?: 'Waterlogging' | 'Rainfall' | 'Hail' | 'Clear Sky' | 'Dense Fog' | 'High Wind';
}

export interface DopplerRadarStation {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  type: 'S-Band' | 'C-Band' | 'X-Band';
  status: 'Operational' | 'Maintenance';
  rangeKm: number;
}

export type SatLayer = 'infrared' | 'visible' | 'waterVapour' | 'cloudTopTemp';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: string;
  suggestedActions?: string[];
}

export type SupportedLanguage =
  | 'en'
  | 'hi'
  | 'mr'
  | 'bn'
  | 'ta'
  | 'te'
  | 'gu'
  | 'kn'
  | 'pa';

export type ActiveTabType = 'home' | 'forecast' | 'radar' | 'alerts' | 'more';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}

export type { Profile, SavedLocation, SearchHistoryItem } from './types/database';
