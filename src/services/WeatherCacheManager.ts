/**
 * WeatherCacheManager
 *
 * Implements strict same-location coordinate caching, deterministic cache keys,
 * dataset-specific TTL enforcement, bounded memory management, cache-poisoning
 * prevention, and concurrent request deduplication.
 *
 * CRITICAL LOCATION INTEGRITY RULE:
 * "REQUESTED LOCATION > CACHE CONVENIENCE"
 * "FALLBACK MAY CHANGE THE DATA SOURCE, BUT MUST NEVER SILENTLY CHANGE THE USER'S REQUESTED LOCATION."
 *
 * Never returns cached weather belonging to a different coordinate.
 */

import { CompleteWeatherIntelligence, NormalizedLocation } from './providers/providerTypes';

export type WeatherDatasetType =
  | 'complete'
  | 'current'
  | 'hourly'
  | 'daily'
  | 'forecast'
  | 'airQuality'
  | 'marine'
  | 'flood'
  | 'historical'
  | 'alerts'
  | 'derived';

export interface DatasetTTLConfig {
  readonly freshTtlMs: number;
  readonly staleTtlMs: number;
  readonly description: string;
}

/**
 * Explicit dataset-specific cache TTL policies.
 * Note: Freshness (Phase 4C temporal age) and Cache TTL (Phase 4D validity window)
 * are distinct concepts:
 * - Freshness measures observation-to-now elapsed time.
 * - TTL dictates whether the entry is eligible for normal cache fallback.
 */
export const CACHE_TTL_POLICIES: Record<WeatherDatasetType, DatasetTTLConfig> = {
  current: {
    freshTtlMs: 15 * 60 * 1000, // 15 min fresh
    staleTtlMs: 60 * 60 * 1000, // 1 hr stale fallback
    description: 'Real-time surface meteorology observations (temperature, wind, humidity)',
  },
  hourly: {
    freshTtlMs: 30 * 60 * 1000, // 30 min fresh
    staleTtlMs: 6 * 60 * 60 * 1000, // 6 hr stale fallback
    description: 'High-resolution 24-48 hour numerical model hourly steps',
  },
  daily: {
    freshTtlMs: 2 * 60 * 60 * 1000, // 2 hr fresh
    staleTtlMs: 24 * 60 * 60 * 1000, // 24 hr stale fallback
    description: 'Multi-day synoptic forecast summaries',
  },
  forecast: {
    freshTtlMs: 1 * 60 * 60 * 1000, // 1 hr fresh
    staleTtlMs: 12 * 60 * 60 * 1000, // 12 hr stale fallback
    description: 'Multi-day hourly and daily forecast model suites',
  },
  airQuality: {
    freshTtlMs: 30 * 60 * 1000, // 30 min fresh
    staleTtlMs: 6 * 60 * 60 * 1000, // 6 hr stale fallback
    description: 'CPCB NAQI pollutant telemetry and dispersion forecasts',
  },
  marine: {
    freshTtlMs: 60 * 60 * 1000, // 1 hr fresh
    staleTtlMs: 12 * 60 * 60 * 1000, // 12 hr stale fallback
    description: 'Oceanographic wave height, swell, and coastal marine states',
  },
  flood: {
    freshTtlMs: 3 * 60 * 60 * 1000, // 3 hr fresh
    staleTtlMs: 24 * 60 * 60 * 1000, // 24 hr stale fallback
    description: 'Catchment hydrology, runoff, and river basin flood indicators',
  },
  historical: {
    freshTtlMs: 24 * 60 * 60 * 1000, // 24 hr fresh
    staleTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days stale fallback
    description: 'ERA5 reanalysis climate normals and historical climatology',
  },
  alerts: {
    freshTtlMs: 10 * 60 * 1000, // 10 min fresh
    staleTtlMs: 60 * 60 * 1000, // 1 hr stale fallback
    description: 'Severe weather, thunderstorm, and hydrological warning notices',
  },
  derived: {
    freshTtlMs: 15 * 60 * 1000, // 15 min fresh
    staleTtlMs: 2 * 60 * 60 * 1000, // 2 hr stale fallback
    description: 'Algorithmic convective and agromet risk indices computed by Mausam',
  },
  complete: {
    freshTtlMs: 10 * 60 * 1000, // 10 min fresh
    staleTtlMs: 24 * 60 * 60 * 1000, // 24 hr stale fallback
    description: 'Composite multi-dimensional weather intelligence bundle',
  },
};

export const MAX_CACHE_ENTRIES = 200;
export const MAX_COORDINATE_DRIFT_KM = 5.0; // 5 km maximum distance for explicit approximate lookups only

import {
  isValidCoordinate,
  normalizeCoordinates as utilsNormalizeCoordinates,
  haversineDistanceKm,
} from '../utils/coordinateUtils';
import {
  validateTemperature,
  validateHumidity,
  validatePrecipitation,
  validateHourlyForecastSeries,
  validateDailyForecastSeries,
} from '../utils/weatherValidation';

export const normalizeCoordinates = utilsNormalizeCoordinates;

/**
 * Generates a deterministic cache key adhering to:
 * weather:<normalized-lat>:<normalized-lon>:<dataset>
 */
export function generateCacheKey(
  lat: number,
  lon: number,
  dataset: WeatherDatasetType = 'complete'
): string {
  const norm = normalizeCoordinates(lat, lon);
  if (!norm) {
    throw new Error(`Invalid coordinates for cache key: lat=${lat}, lon=${lon}`);
  }
  return `weather:${norm.lat.toFixed(5)}:${norm.lon.toFixed(5)}:${dataset}`;
}

export interface CachedWeatherResult {
  data: CompleteWeatherIntelligence;
  isStale: boolean;
  isExpired: boolean;
  ageSeconds: number;
  cachedAt: number;
  providerId: string;
  sourceName?: string;
  isExactMatch: boolean;
  distanceKm: number;
  originalCoordinates: { latitude: number; longitude: number };
  originalRequestedCoordinates?: { latitude: number; longitude: number };
  originalProviderCoordinates?: { latitude: number; longitude: number };
  originalLocation: NormalizedLocation;
  observedAt?: string;
  obtainedAt?: string;
  dataset: WeatherDatasetType;
  freshUntil: number;
  staleUntil: number;
}

export interface CacheLookupOptions {
  /**
   * If true, allows matching a cached entry within MAX_COORDINATE_DRIFT_KM (5 km)
   * when no exact coordinate match is found. The result will have isExactMatch: false,
   * distanceKm > 0, and originalCoordinates preserved.
   * Defaults to false (strict exact coordinate ownership).
   */
  allowApproximate?: boolean;
  dataset?: WeatherDatasetType;
  allowExpired?: boolean;
}

export interface CacheWriteOptions {
  dataset?: WeatherDatasetType;
  writeVersion?: number;
}

export interface CacheDiagnostics {
  hits: number;
  misses: number;
  expiredHits: number;
  evictions: number;
  approximateHits: number;
  writesAccepted: number;
  writesRejected: number;
  deduplicatedRequests: number;
  currentSize: number;
  maxCapacity: number;
}

interface CacheItem {
  key: string;
  location: NormalizedLocation;
  latitude: number;
  longitude: number;
  dataset: WeatherDatasetType;
  data: CompleteWeatherIntelligence;
  cachedAt: number;
  freshUntil: number;
  staleUntil: number;
  providerId: string;
  sourceName?: string;
  observedAt?: string;
  obtainedAt?: string;
  lastAccessedAt: number;
  accessCount: number;
  writeVersion: number;
  originalRequestedCoordinates?: { latitude: number; longitude: number };
  originalProviderCoordinates?: { latitude: number; longitude: number };
}

export class WeatherCacheManager {
  private memoryCache = new Map<string, CacheItem>();
  private inFlightRequests = new Map<string, Promise<any>>();
  private readonly MAX_CACHE_ENTRIES = MAX_CACHE_ENTRIES;
  private readonly MAX_COORDINATE_DRIFT_KM = MAX_COORDINATE_DRIFT_KM;

  private diagnostics: CacheDiagnostics = {
    hits: 0,
    misses: 0,
    expiredHits: 0,
    evictions: 0,
    approximateHits: 0,
    writesAccepted: 0,
    writesRejected: 0,
    deduplicatedRequests: 0,
    currentSize: 0,
    maxCapacity: MAX_CACHE_ENTRIES,
  };

  /**
   * Deterministic cache key accessor
   */
  getCacheKey(lat: number, lon: number, dataset: WeatherDatasetType = 'complete'): string {
    const norm = normalizeCoordinates(lat, lon);
    if (!norm) return '';
    return `weather:${norm.lat.toFixed(5)}:${norm.lon.toFixed(5)}:${dataset}`;
  }

  /**
   * Validates weather payload before cache admission to prevent cache poisoning.
   */
  validatePayloadForCache(
    location: NormalizedLocation,
    data: CompleteWeatherIntelligence,
    dataset: WeatherDatasetType = 'complete'
  ): { isValid: boolean; reason?: string } {
    if (!data) {
      return { isValid: false, reason: 'Payload is null or undefined' };
    }

    // Reject error responses
    if ((data as any).error || (data as any).status === 'error' || ((data as any).statusCode && (data as any).statusCode >= 400)) {
      return { isValid: false, reason: 'Error status response cannot enter cache' };
    }

    // Level 5 Honest Unavailable State must NEVER be cached as valid weather
    if (data.isUnavailable === true || data.freshness?.isUnavailable === true || data.provenance?.fallbackLevel === 5) {
      return { isValid: false, reason: 'Level 5 Honest Unavailable State must not be cached as normal weather data' };
    }

    // Coordinate validation
    const lat = location?.latitude ?? location?.lat;
    const lon = location?.longitude ?? location?.lon;
    if (!normalizeCoordinates(lat, lon)) {
      return { isValid: false, reason: `Invalid location coordinates (${lat}, ${lon})` };
    }

    // Core meteorology validation for complete or current datasets
    if (dataset === 'complete' || dataset === 'current') {
      if (!data.current) {
        return { isValid: false, reason: 'Missing current weather data' };
      }
      const tempVal = validateTemperature(data.current.temperature);
      if (!tempVal.isValid) {
        return { isValid: false, reason: tempVal.error || 'Invalid current temperature' };
      }
      if (data.current.humidity !== undefined && data.current.humidity !== null) {
        const humVal = validateHumidity(data.current.humidity);
        if (!humVal.isValid) {
          return { isValid: false, reason: humVal.error || 'Invalid current humidity' };
        }
      }
      if (data.current.precipitation !== undefined && data.current.precipitation !== null) {
        const precVal = validatePrecipitation(data.current.precipitation);
        if (!precVal.isValid) {
          return { isValid: false, reason: precVal.error || 'Negative or invalid precipitation' };
        }
      }
    }

    // Forecast array validation for complete or forecast datasets
    if (dataset === 'complete' || dataset === 'forecast') {
      if (!data.forecast || !Array.isArray(data.forecast.daily) || !Array.isArray(data.forecast.hourly)) {
        return { isValid: false, reason: 'Missing or malformed forecast arrays' };
      }
      const hourlyCheck = validateHourlyForecastSeries(data.forecast.hourly);
      if (hourlyCheck.items.length === 0 || hourlyCheck.droppedCount > 0) {
        return {
          isValid: false,
          reason: `Hourly forecast validation failed: ${hourlyCheck.errors[0] || 'Corrupt or scrambled forecast'}`,
        };
      }
      const dailyCheck = validateDailyForecastSeries(data.forecast.daily);
      if (dailyCheck.items.length === 0 || dailyCheck.droppedCount > 0) {
        return {
          isValid: false,
          reason: `Daily forecast validation failed: ${dailyCheck.errors[0] || 'Contradictory min/max temperatures'}`,
        };
      }
    }

    // Provenance validation
    if (!data.provenance || !data.provenance.sourceId || !data.freshness) {
      return { isValid: false, reason: 'Missing required provenance or freshness metadata' };
    }

    // Check timestamps if supplied
    if (data.provenance.obtainedAt && isNaN(Date.parse(data.provenance.obtainedAt))) {
      return { isValid: false, reason: 'Malformed obtainedAt timestamp' };
    }

    return { isValid: true };
  }

  /**
   * Validates weather data integrity directly (convenience wrapper for data validation)
   */
  validateDataIntegrity(
    data: any,
    dataset: WeatherDatasetType = 'complete'
  ): { isValid: boolean; reason?: string } {
    const dummyLoc: NormalizedLocation = {
      id: 'probe-loc',
      name: 'Validation Probe',
      displayName: 'Validation Probe, Delhi, India',
      latitude: 28.6139,
      longitude: 77.209,
      lat: 28.6139,
      lon: 77.209,
      state: 'Delhi',
      country: 'India',
      countryCode: 'IN',
      district: 'New Delhi',
      source: 'manual',
    };
    // Include minimal provenance if not provided for unit testing data payload alone
    const probeData = {
      ...data,
      provenance: data?.provenance || { sourceId: 'test-source', obtainedAt: new Date().toISOString() },
      freshness: data?.freshness || { freshness: 'fresh', ageSeconds: 0, isStale: false, isUnavailable: false },
    };
    return this.validatePayloadForCache(dummyLoc, probeData, dataset);
  }

  /**
   * Retrieves strictly exact same-coordinate cached intelligence.
   * Only returns the cache entry corresponding to the exact cache key generated
   * from the requested coordinates. Does NOT perform any proximity scan.
   * Invariant: distKm > 0.001 -> null.
   */
  getExact(
    lat: number,
    lon: number,
    dataset: WeatherDatasetType = 'complete',
    options?: CacheLookupOptions
  ): CachedWeatherResult | null {
    const norm = normalizeCoordinates(lat, lon);
    if (!norm) {
      this.diagnostics.misses++;
      return null;
    }

    const key = this.getCacheKey(norm.lat, norm.lon, dataset);
    const item = this.memoryCache.get(key);
    if (!item) {
      this.diagnostics.misses++;
      return null;
    }

    // Invariant: requested coordinates != provider/cache coordinates -> never classify as exact
    const distKm = this.getDistanceKm(lat, lon, item.latitude, item.longitude);
    if (distKm > 0.001) {
      this.diagnostics.misses++;
      return null;
    }

    const result = this.evaluateItem(item, 0, true, options);
    if (result) {
      this.diagnostics.hits++;
    }
    return result;
  }

  /**
   * Retrieves cached intelligence.
   * By default, enforces exact coordinate ownership (allowApproximate = false).
   * If allowApproximate is true, allows matching within MAX_COORDINATE_DRIFT_KM (5km),
   * but flags isExactMatch = false, records distanceKm, and preserves originalCoordinates.
   */
  get(
    lat: number,
    lon: number,
    options: CacheLookupOptions = {}
  ): CachedWeatherResult | null {
    const dataset = options.dataset || 'complete';

    // 1. Enforce exact coordinate match first
    const exact = this.getExact(lat, lon, dataset, options);
    if (exact) {
      return exact;
    }

    // 2. If approximate lookup is disallowed, never return mismatched coordinates
    if (!options.allowApproximate) {
      return null;
    }

    // 3. Find closest candidate within MAX_COORDINATE_DRIFT_KM (5 km) matching dataset
    let closestCandidate: CacheItem | null = null;
    let closestDistKm = Infinity;

    for (const candidate of this.memoryCache.values()) {
      if (candidate.dataset !== dataset) continue;

      const distKm = this.getDistanceKm(lat, lon, candidate.latitude, candidate.longitude);
      if (distKm <= this.MAX_COORDINATE_DRIFT_KM && distKm < closestDistKm) {
        closestDistKm = distKm;
        closestCandidate = candidate;
      }
    }

    if (closestCandidate) {
      const approxResult = this.evaluateItem(closestCandidate, closestDistKm, false, options);
      if (approxResult) {
        this.diagnostics.approximateHits++;
      }
      return approxResult;
    }

    this.diagnostics.misses++;
    return null;
  }

  private evaluateItem(
    item: CacheItem,
    distanceKm: number,
    isExactMatch: boolean,
    options?: CacheLookupOptions
  ): CachedWeatherResult | null {
    const now = Date.now();
    const isExpired = now > item.staleUntil;

    if (isExpired && !options?.allowExpired) {
      // Entry is past stale TTL; cannot be used as valid cache fallback
      this.diagnostics.expiredHits++;
      return null;
    }

    const isStale = now > item.freshUntil || isExpired;
    const ageSeconds = Math.max(0, Math.floor((now - item.cachedAt) / 1000));

    // Update LRU access statistics
    item.lastAccessedAt = now;
    item.accessCount++;

    return {
      data: item.data,
      isStale,
      isExpired,
      ageSeconds,
      cachedAt: item.cachedAt,
      providerId: item.providerId,
      sourceName: item.sourceName,
      isExactMatch,
      distanceKm,
      originalCoordinates: {
        latitude: item.latitude,
        longitude: item.longitude,
      },
      originalRequestedCoordinates: item.originalRequestedCoordinates || {
        latitude: item.latitude,
        longitude: item.longitude,
      },
      originalProviderCoordinates: item.originalProviderCoordinates,
      originalLocation: item.location,
      observedAt: item.observedAt,
      obtainedAt: item.obtainedAt,
      dataset: item.dataset,
      freshUntil: item.freshUntil,
      staleUntil: item.staleUntil,
    };
  }

  /**
   * Stores complete weather intelligence strictly linked to the location's coordinates.
   * Performs validation, race-condition detection, and memory boundary eviction.
   * Returns true if accepted and cached, false if rejected.
   */
  set(
    location: NormalizedLocation,
    data: CompleteWeatherIntelligence,
    providerId: string = 'open-meteo',
    dataset: WeatherDatasetType = 'complete',
    options?: CacheWriteOptions
  ): boolean {
    const validation = this.validatePayloadForCache(location, data, dataset);
    if (!validation.isValid) {
      this.diagnostics.writesRejected++;
      console.warn(`WeatherCacheManager: Cache write rejected (${validation.reason})`);
      return false;
    }

    const lat = location.latitude ?? location.lat;
    const lon = location.longitude ?? location.lon;
    const norm = normalizeCoordinates(lat, lon);
    if (!norm) {
      this.diagnostics.writesRejected++;
      return false;
    }

    const key = this.getCacheKey(norm.lat, norm.lon, dataset);
    const now = Date.now();

    // Race Condition Protection:
    // If an existing entry exists, do not let older responses overwrite newer cached data
    const existing = this.memoryCache.get(key);
    if (existing) {
      const incomingObtainedTime = data.provenance?.obtainedAt
        ? Date.parse(data.provenance.obtainedAt)
        : (data.cachedAt || now);
      const existingObtainedTime = existing.obtainedAt
        ? Date.parse(existing.obtainedAt)
        : existing.cachedAt;

      if (!isNaN(incomingObtainedTime) && !isNaN(existingObtainedTime) && incomingObtainedTime < existingObtainedTime) {
        this.diagnostics.writesRejected++;
        console.warn(`WeatherCacheManager: Write rejected — incoming data is older than current cache (${incomingObtainedTime} < ${existingObtainedTime})`);
        return false;
      }

      if (options?.writeVersion !== undefined && existing.writeVersion > options.writeVersion) {
        this.diagnostics.writesRejected++;
        return false;
      }
    }

    // Memory Safety: Enforce bounded cache size
    if (!existing && this.memoryCache.size >= this.MAX_CACHE_ENTRIES) {
      this.cleanupExpired();

      // If still at capacity, evict least recently used (LRU) entry
      if (this.memoryCache.size >= this.MAX_CACHE_ENTRIES) {
        this.evictLRU();
      }
    }

    const ttlPolicy = CACHE_TTL_POLICIES[dataset] || CACHE_TTL_POLICIES.complete;

    const observedAt =
      data.current?.source?.observedAt ||
      data.freshness?.observedAt ||
      data.provenance?.observedAt;

    const obtainedAt =
      data.current?.source?.obtainedAt ||
      data.freshness?.retrievedAt ||
      data.freshness?.obtainedAt ||
      data.provenance?.obtainedAt;

    const sourceName =
      data.provenance?.sourceName ||
      data.freshness?.source ||
      data.current?.source?.providerName ||
      'Open-Meteo';

    const providerCoords =
      data.freshness?.providerCoordinates ||
      data.provenance?.providerCoordinates;

    this.memoryCache.set(key, {
      key,
      location,
      latitude: norm.lat,
      longitude: norm.lon,
      dataset,
      data,
      cachedAt: now,
      freshUntil: now + ttlPolicy.freshTtlMs,
      staleUntil: now + ttlPolicy.staleTtlMs,
      providerId,
      sourceName,
      observedAt,
      obtainedAt,
      lastAccessedAt: now,
      accessCount: 1,
      writeVersion: options?.writeVersion ?? 1,
      originalRequestedCoordinates: { latitude: lat, longitude: lon },
      originalProviderCoordinates: providerCoords,
    });

    this.diagnostics.writesAccepted++;
    this.diagnostics.currentSize = this.memoryCache.size;
    return true;
  }

  /**
   * Purges all expired entries whose current age exceeds staleUntil.
   * Returns count of purged items.
   */
  cleanupExpired(): number {
    const now = Date.now();
    let purged = 0;

    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.staleUntil) {
        this.memoryCache.delete(key);
        purged++;
      }
    }

    if (purged > 0) {
      this.diagnostics.evictions += purged;
      this.diagnostics.currentSize = this.memoryCache.size;
    }
    return purged;
  }

  /**
   * Evicts the single least recently used item (LRU) from memory cache.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, item] of this.memoryCache.entries()) {
      if (item.lastAccessedAt < oldestAccess) {
        oldestAccess = item.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.diagnostics.evictions++;
      this.diagnostics.currentSize = this.memoryCache.size;
    }
  }

  /**
   * Deduplicates concurrent in-flight requests for the same cache key.
   * If a request is already pending for this key, subsequent callers receive
   * the same Promise. When settled (fulfilled or rejected), the entry is removed.
   */
  async deduplicateInFlight<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inFlightRequests.get(key);
    if (existing) {
      this.diagnostics.deduplicatedRequests++;
      return existing as Promise<T>;
    }

    const promise = (async () => {
      try {
        return await fetcher();
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  isInFlight(key: string): boolean {
    return this.inFlightRequests.has(key);
  }

  clearInFlight(): void {
    this.inFlightRequests.clear();
  }

  private getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return haversineDistanceKm(lat1, lon1, lat2, lon2);
  }

  getDiagnostics(): CacheDiagnostics {
    return {
      ...this.diagnostics,
      currentSize: this.memoryCache.size,
    };
  }

  resetDiagnostics(): void {
    this.diagnostics = {
      hits: 0,
      misses: 0,
      expiredHits: 0,
      evictions: 0,
      approximateHits: 0,
      writesAccepted: 0,
      writesRejected: 0,
      deduplicatedRequests: 0,
      currentSize: this.memoryCache.size,
      maxCapacity: this.MAX_CACHE_ENTRIES,
    };
  }

  get size(): number {
    return this.memoryCache.size;
  }

  getCapacity(): number {
    return this.MAX_CACHE_ENTRIES;
  }

  clear(): void {
    this.memoryCache.clear();
    this.inFlightRequests.clear();
    this.diagnostics.currentSize = 0;
  }
}

export const weatherCacheManager = new WeatherCacheManager();

