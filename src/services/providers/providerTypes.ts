/**
 * Normalized Weather Intelligence Types and Provider Interfaces
 * MAUSAM Weather Intelligence Architecture
 */

import { LocationInfo, NormalizedLocation, WeatherConditionKey, AgroMetAdvisory } from '../../types';

export type { NormalizedLocation };

// ==========================================
// 1. DATA PROVIDER CLASSIFICATION & HEALTH
// ==========================================
export type ProviderClassification =
  | 'open-source-software'
  | 'open-data'
  | 'free-api-service'
  | 'official-government-agency';

export type ProviderHealthState = 'healthy' | 'degraded' | 'unavailable';

export interface ProviderHealthStatus {
  providerId: string;
  name: string;
  status: ProviderHealthState;
  consecutiveFailures: number;
  lastSuccessTime: number | null;
  lastFailureTime: number | null;
  cooldownUntil: number | null;
  lastError: string | null;
}

export type FreshnessStatus = 'fresh' | 'cached' | 'stale' | 'partial' | 'degraded' | 'unavailable';
export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW' | 'UNAVAILABLE';
export type SubsystemStatus = 'available' | 'unavailable' | 'stale' | 'cached' | 'derived' | 'not-applicable';

export type ProvenanceSourceType =
  | 'live'
  | 'cache'
  | 'alternate-model'
  | 'derived'
  | 'partial'
  | 'unavailable';

export type ProvenanceFreshness =
  | 'fresh'
  | 'recent'
  | 'stale'
  | 'very-stale'
  | 'unknown';

export type ProvenanceConfidence =
  | 'high'
  | 'medium'
  | 'low'
  | 'unknown';

export interface SubsystemProvenance {
  subsystemId: string;
  sourceName: string;
  sourceType: ProvenanceSourceType | 'not-applicable';
  obtainedAt?: string;
  observedAt?: string;
  cachedAt?: number | string;
  freshness: ProvenanceFreshness;
  ageSeconds?: number;
  status: SubsystemStatus;
  sourceStatus?: 'available' | 'unavailable' | 'not-configured';
  isOfficial: boolean;
  isDerived: boolean;
  limitations?: string[];
}

export interface DataProvenance {
  sourceId: string;
  sourceName: string;
  sourceType: ProvenanceSourceType;
  fallbackLevel: 0 | 1 | 2 | 3 | 4 | 5;
  obtainedAt?: string;
  observedAt?: string;
  cachedAt?: number | string;
  freshness: ProvenanceFreshness;
  ageSeconds?: number;
  confidence: ProvenanceConfidence;
  isOfficial: boolean;
  isExactMatch: boolean;
  isApproximate?: boolean;
  requestedCoordinates: {
    latitude: number;
    longitude: number;
  };
  resolvedCoordinates?: {
    latitude: number;
    longitude: number;
  };
  providerCoordinates?: {
    latitude: number;
    longitude: number;
  };
  cachedCoordinates?: {
    latitude: number;
    longitude: number;
  };
  approximateDistanceKm?: number;
  geocoderSource?: 'open-meteo' | 'nominatim' | 'gps' | 'catalog' | 'cache' | 'saved' | 'history' | 'manual';
  coordinateMismatchWarning?: boolean;
  isDerived: boolean;
  limitations?: string[];
  subsystems?: Record<string, SubsystemProvenance>;
  note?: string;
}

export interface SubsystemsAvailability {
  current: SubsystemStatus;
  hourly: SubsystemStatus;
  daily: SubsystemStatus;
  airQuality: SubsystemStatus;
  marine: SubsystemStatus;
  flood: SubsystemStatus;
  radar: SubsystemStatus;
  alerts: SubsystemStatus;
  cyclone: SubsystemStatus;
  historical: SubsystemStatus;
}

export interface FreshnessMetadata {
  source: string;
  providerId: string;
  status: FreshnessStatus;
  requestedAt: string; // ISO string
  retrievedAt: string; // ISO string
  obtainedAt?: string;
  observedAt?: string;
  cachedAt?: number;
  isStale: boolean;
  ageSeconds: number;
  cacheAgeSeconds?: number;
  location: NormalizedLocation;
  confidence: ConfidenceLevel;
  requestedCoordinates: { latitude: number; longitude: number };
  providerCoordinates?: { latitude: number; longitude: number };
  subsystems: SubsystemsAvailability;
  fallbackLevel: 0 | 1 | 2 | 3 | 4 | 5;
  fallbackReason?: string;
  isUnavailable?: boolean;
  isExactMatch?: boolean;
  isApproximate?: boolean;
  approximateDistanceKm?: number;
  limitations?: string[];
  note?: string;
  provenance?: DataProvenance;
}

export interface ProviderMetadata {
  id: string;
  name: string;
  classification: ProviderClassification;
  license: string;
  requiresAuth: boolean;
  isConfigured: boolean;
  rateLimitInfo: string;
  attribution: string;
  website: string;
}

// ==========================================
// 2. NORMALIZED DATA SCHEMAS
// ==========================================

export interface SourceMetadata {
  providerId: string;
  providerName: string;
  classification: ProviderClassification;
  isOfficialIMD: boolean;
  isDerived: boolean;
  timestamp: string;
  obtainedAt?: string;
  observedAt?: string;
  confidenceScore: number; // 0 - 100
  attributionText: string;
}

export interface NormalizedCurrentWeather {
  temperature?: number; // °C
  feelsLike?: number; // °C
  humidity?: number; // %
  pressure?: number; // hPa
  windSpeed?: number; // km/h
  windDirection?: number; // degrees
  windGust?: number; // km/h
  precipitation?: number; // mm in last hour
  precipitation24h?: number; // mm
  cloudCover?: number; // %
  visibility?: number; // km
  uvIndex?: number; // 0 - 11+
  dewPoint?: number; // °C
  weatherConditionKey: WeatherConditionKey;
  conditionText: string;
  conditionCode?: number;
  sunrise?: string;
  sunset?: string;
  isDay: boolean;
  timeString: string;
  high?: number;
  low?: number;
  source: SourceMetadata;
}

export interface NormalizedHourlyItem {
  timeLabel: string; // "7 PM", "8 PM"
  isoTime: string;
  timestamp: number;
  temperature?: number;
  feelsLike?: number;
  precipitationProb?: number; // %
  rainMm?: number;
  conditionKey: WeatherConditionKey;
  conditionText: string;
  conditionCode?: number;
  windSpeed?: number;
  humidity?: number;
  uvIndex?: number;
  dayLabel?: string;
  isDay?: boolean;
}

export interface NormalizedDailyItem {
  date: string;
  dayLabel: string;
  fullDate: string;
  tempMax?: number;
  tempMin?: number;
  precipitationProb?: number;
  rainSumMm?: number;
  conditionKey: WeatherConditionKey;
  conditionText: string;
  conditionCode?: number;
  windSpeedMax?: number;
  uvIndexMax?: number;
  sunrise?: string;
  sunset?: string;
  humidity?: number;
}

export interface NormalizedForecast {
  hourly: NormalizedHourlyItem[];
  daily: NormalizedDailyItem[];
  horizonDays: number;
  source: SourceMetadata;
}

export interface NormalizedAirQuality {
  aqi?: number; // CPCB Indian Standard (0-500)
  category?: 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe' | 'Unavailable' | 'Unknown';
  pm25?: number; // µg/m³
  pm10?: number; // µg/m³
  nitrogenDioxide?: number; // µg/m³
  sulphurDioxide?: number; // µg/m³
  ozone?: number; // µg/m³
  carbonMonoxide?: number; // mg/m³
  dust?: number; // µg/m³
  color?: string;
  bgColor?: string;
  healthAdvice?: string;
  calculationMethod: string;
  source: SourceMetadata;
  isUnavailable?: boolean;
}

export interface NormalizedMarine {
  isCoastal: boolean;
  isApplicable?: boolean;
  isUnavailable?: boolean;
  locationName: string;
  waveHeight?: number; // meters
  waveDirection?: number; // degrees
  wavePeriod?: number; // seconds
  swellWaveHeight?: number; // meters
  swellWaveDirection?: number;
  swellPeriod?: number;
  seaSurfaceTemperature?: number; // °C
  oceanCurrentSpeed?: number; // km/h
  seaStateCategory?: 'Calm' | 'Smooth' | 'Slight' | 'Moderate' | 'Rough' | 'Very Rough' | 'Not Applicable' | 'Unavailable';
  swimmingSafety?: 'Safe' | 'Caution' | 'Dangerous' | 'Not Applicable' | 'Unavailable';
  source: SourceMetadata;
  disclaimer: string;
}

export interface SatelliteLayerOption {
  id: string;
  name: string;
  description: string;
  type: 'nasa-gibs' | 'rainviewer';
  tileUrlTemplate: string;
  timeString?: string;
  attribution: string;
  maxZoom: number;
  opacity: number;
}

export interface NormalizedHistorical {
  locationName: string;
  periodLabel: string;
  meanTemperature?: number;
  tempAnomaly?: number; // +/- °C relative to 30-year normal
  precipitationTotal?: number;
  precipAnomalyPercent?: number; // +/- % relative to normal
  climateTrend?: 'Warming' | 'Normal' | 'Cooling' | 'Wet Anomaly' | 'Drier Anomaly' | 'Unavailable' | 'Trend unavailable' | 'Unknown';
  summary: string;
  dataPoints: { date: string; temp?: number; precipitation?: number }[];
  source: SourceMetadata;
  isUnavailable?: boolean;
}

export interface NormalizedFloodRisk {
  basinName: string;
  locationName: string;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe' | 'Unavailable';
  riverDischargeM3s?: number;
  thresholdLevel?: string;
  returnPeriodEst?: string; // e.g. "2-year return level", "10-year return level"
  trend: 'Rising' | 'Steady' | 'Receding' | 'Unavailable';
  catchmentRainfall3DayMm?: number;
  advisory: string;
  confidence: 'High' | 'Medium' | 'Low' | 'Model-Derived' | 'Unavailable';
  forecastPeriod: string;
  source: SourceMetadata;
  disclaimer: string;
  isUnavailable?: boolean;
}

export interface CycloneTrackPoint {
  time: string;
  lat: number;
  lon: number;
  intensityCategory: string;
  windSpeedKts: number;
  pressureHpa?: number;
  status: 'Past' | 'Current' | 'Forecast';
}

export interface NormalizedCyclone {
  hasActiveStorm: boolean;
  cycloneName?: string;
  basin?: 'Bay of Bengal' | 'Arabian Sea' | 'Indian Ocean';
  currentIntensity?: string;
  maxSustainedWindsKmph?: number;
  estimatedCentralPressureHpa?: number;
  movementDirection?: string;
  movementSpeedKmph?: number;
  coastalThreatLevel?: 'None' | 'Watch' | 'Warning' | 'High Alert';
  coastalDistrictsAffected?: string[];
  trackPoints?: CycloneTrackPoint[];
  bulletinSummary?: string;
  source: SourceMetadata;
  isUnavailable?: boolean;
}

export interface NormalizedThunderstormRisk {
  riskScore: number; // 0 - 100
  riskLevel: 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Severe' | 'Unavailable';
  lightningLikelihood: 'Unlikely' | 'Isolated' | 'Scattered' | 'Widespread' | 'Unknown';
  convectiveEnergyEstimate: string; // CAPE approximation or convective trigger
  gustRiskKmph?: number;
  peakWindow: string;
  advisory: string;
  safetyTips: string[];
  isOfficialWarning: boolean;
  source: SourceMetadata;
  observedMetrics?: {
    maxRainMm?: number;
    maxRainProb?: number;
    maxWindKmph?: number;
  };
}

// ==========================================
// 3. PROVIDER INTERFACES
// ==========================================

export interface IWeatherProvider {
  readonly id: string;
  readonly metadata: ProviderMetadata;
  getWeatherAndForecast(lat: number, lon: number): Promise<{
    current: NormalizedCurrentWeather;
    forecast: NormalizedForecast;
  }>;
}

export interface IGeocodingProvider {
  readonly id: string;
  readonly metadata: ProviderMetadata;
  searchLocations(query: string): Promise<LocationInfo[]>;
  reverseGeocode(lat: number, lon: number): Promise<LocationInfo>;
}

export interface IAirQualityProvider {
  readonly id: string;
  readonly metadata: ProviderMetadata;
  getAirQuality(lat: number, lon: number): Promise<NormalizedAirQuality>;
}

export interface IMarineProvider {
  readonly id: string;
  readonly metadata: ProviderMetadata;
  getMarineConditions(lat: number, lon: number, locationName: string): Promise<NormalizedMarine>;
}

export interface ISatelliteProvider {
  readonly id: string;
  readonly metadata: ProviderMetadata;
  getSatelliteLayers(date?: string): Promise<SatelliteLayerOption[]>;
}

export interface IHistoricalWeatherProvider {
  readonly id: string;
  readonly metadata: ProviderMetadata;
  getHistoricalAnalysis(lat: number, lon: number, locationName: string): Promise<NormalizedHistorical>;
}

export interface IFloodProvider {
  readonly id: string;
  readonly metadata: ProviderMetadata;
  getFloodRisk(lat: number, lon: number, locationName: string): Promise<NormalizedFloodRisk>;
}

export interface ICycloneProvider {
  readonly id: string;
  readonly metadata: ProviderMetadata;
  getActiveCycloneInformation(basin?: string): Promise<NormalizedCyclone>;
}

export interface CompleteWeatherIntelligence {
  location: NormalizedLocation;
  current: NormalizedCurrentWeather;
  forecast: NormalizedForecast;
  airQuality: NormalizedAirQuality;
  marine?: NormalizedMarine;
  floodRisk?: NormalizedFloodRisk;
  flood?: NormalizedFloodRisk;
  thunderstormRisk?: NormalizedThunderstormRisk;
  thunderstorm?: NormalizedThunderstormRisk;
  cyclone?: NormalizedCyclone;
  historical?: NormalizedHistorical;
  agroMet?: AgroMetAdvisory;
  sources?: ProviderMetadata[];
  alerts?: any[];
  legacyWeather?: any;
  legacyHourly?: any[];
  legacyDaily?: any[];
  legacyAirQuality?: any;
  cachedAt?: number;
  freshness: FreshnessMetadata;
  provenance?: DataProvenance;
  isUnavailable?: boolean;
  unavailableReason?: string;
}
