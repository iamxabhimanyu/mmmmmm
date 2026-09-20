/**
 * LocationResolver Architecture
 *
 * Centralized abstraction responsible for converting user input or coordinates
 * into validated Indian location coordinates (lat/lon) + metadata.
 *
 * Supports:
 * 1. Place name search (Open-Meteo Geocoding -> Nominatim -> Predefined Indian cities).
 * 2. Browser GPS reverse geocoding with exact coordinate retention.
 * 3. Predefined Indian location suggestions & emergency local fallback.
 *
 * CORE INTEGRITY RULE:
 * Fallback may change data sources, but must NEVER silently change the user's requested location.
 */

import { LocationInfo, NormalizedLocation, normalizeLocation } from '../types';
import { MAJOR_INDIAN_CITIES } from '../data/constants';
import { providerHealthManager } from './ProviderHealthManager';
import { fetchWithTimeout } from './providers/fetchUtils';
import {
  isValidCoordinate,
  normalizeCoordinates,
  haversineDistanceKm,
  isWithinIndiaBounds,
  INDIA_COORDINATE_BOUNDS,
  formatCoordinates,
  LOCATION_DEDUPLICATION_THRESHOLD_KM,
} from '../utils/coordinateUtils';

// Geographic bounding box for the Indian subcontinent & territorial limits
export const INDIA_BOUNDS = INDIA_COORDINATE_BOUNDS;

interface GeocodeCacheItem {
  timestamp: number;
  results: NormalizedLocation[];
}

class LocationResolver {
  private memoryCache = new Map<string, GeocodeCacheItem>();
  private CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private LOCAL_STORAGE_KEY = 'mausam_geocode_cache_v2';

  constructor() {
    this.hydrateFromStorage();
  }

  private hydrateFromStorage() {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        for (const [key, val] of Object.entries(parsed)) {
          const item = val as GeocodeCacheItem;
          if (now - item.timestamp < this.CACHE_TTL_MS) {
            this.memoryCache.set(key, item);
          }
        }
      }
    } catch (e) {
      // Non-blocking local storage failure
    }
  }

  private persistToStorage() {
    try {
      const obj: Record<string, GeocodeCacheItem> = {};
      const entries = Array.from(this.memoryCache.entries()).slice(-40); // keep last 40 queries
      for (const [k, v] of entries) {
        obj[k] = v;
      }
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      // Storage quota reached or blocked
    }
  }

  /**
   * Validates if given coordinates lie inside the Indian geographic bounding region
   */
  validateIndianBounds(lat: number, lon: number): boolean {
    return isWithinIndiaBounds(lat, lon);
  }

  /**
   * Normalizes any input location into the canonical NormalizedLocation schema
   */
  normalize(loc: LocationInfo | NormalizedLocation): NormalizedLocation {
    return normalizeLocation(loc);
  }

  /**
   * Returns predefined popular Indian locations for suggestions & quick selection
   */
  getPopularLocations(): NormalizedLocation[] {
    return MAJOR_INDIAN_CITIES.map((c) => this.normalize(c));
  }

  /**
   * Primary Location Search with 5-tier resolution hierarchy:
   * 1. Cache
   * 2. Open-Meteo Geocoding API
   * 3. Nominatim secondary geocoding
   * 4. Predefined Indian city catalog (matching query only)
   * 5. Honest empty state (never substitute unrelated city)
   */
  async searchPlaces(query: string): Promise<NormalizedLocation[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return [];
    }

    const cacheKey = trimmed.toLowerCase();

    // 1. Cached geocoding result
    const cached = this.memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.results;
    }

    const results: NormalizedLocation[] = [];

    // Check local catalog for instant matches (fuzzy, query-matching only)
    const localCatalogMatches = MAJOR_INDIAN_CITIES.filter(
      (c) =>
        c.name.toLowerCase().includes(cacheKey) ||
        c.state.toLowerCase().includes(cacheKey)
    ).map((c) => this.normalize(c));

    // 2. Open-Meteo Geocoding API (Primary Indian place search)
    if (providerHealthManager.isAvailable('open-meteo-geocoding')) {
      try {
        const omResults = await this.fetchOpenMeteoGeocoding(trimmed);
        if (omResults.length > 0) {
          providerHealthManager.recordSuccess('open-meteo-geocoding');
          for (const item of omResults) {
            // Deduplicate only if virtually identical point (<= 150m)
            if (!results.some((r) => this.areNearby(r.latitude, r.longitude, item.latitude, item.longitude))) {
              results.push(item);
            }
          }
        }
      } catch (err) {
        console.warn('Open-Meteo geocoding probe failed:', err);
        providerHealthManager.recordFailure('open-meteo-geocoding', err);
      }
    }

    // 3. Nominatim Secondary Geocoder (if Open-Meteo returned few or is unavailable)
    if (results.length < 4 && providerHealthManager.isAvailable('osm-nominatim')) {
      try {
        const nominatimResults = await this.fetchNominatimGeocoding(trimmed);
        if (nominatimResults.length > 0) {
          providerHealthManager.recordSuccess('osm-nominatim');
          for (const item of nominatimResults) {
            if (!results.some((r) => this.areNearby(r.latitude, r.longitude, item.latitude, item.longitude))) {
              results.push(item);
            }
          }
        }
      } catch (err) {
        console.warn('Nominatim geocoding probe failed:', err);
        providerHealthManager.recordFailure('osm-nominatim', err);
      }
    }

    // 4. Predefined known-location catalog integration (only matching entries)
    for (const cat of localCatalogMatches) {
      if (!results.some((r) => this.areNearby(r.latitude, r.longitude, cat.latitude, cat.longitude))) {
        results.push(cat);
      }
    }

    // 5. Honest empty state if nothing found (never fabricate or substitute a default city)
    if (results.length > 0) {
      this.memoryCache.set(cacheKey, { timestamp: Date.now(), results });
      this.persistToStorage();
    }

    return results;
  }

  /**
   * Resolves browser GPS coordinates to a validated Indian NormalizedLocation.
   * If reverse geocoding fails, strictly preserves exact requested coordinates.
   */
  async resolveFromCoordinates(lat: number, lon: number): Promise<NormalizedLocation> {
    if (!isValidCoordinate(lat, lon)) {
      throw new Error(`Invalid coordinates for location resolution: lat=${lat}, lon=${lon}`);
    }

    const norm = normalizeCoordinates(lat, lon)!;
    const isWithinIndia = this.validateIndianBounds(norm.lat, norm.lon);

    const baseLocation: NormalizedLocation = {
      id: `gps-${norm.lat.toFixed(5)}_${norm.lon.toFixed(5)}`,
      name: isWithinIndia ? 'Current Location' : 'Outside India Territory',
      displayName: isWithinIndia ? `Current Location (${formatCoordinates(norm.lat, norm.lon)})` : `Location outside standard Indian bounds (${formatCoordinates(norm.lat, norm.lon)})`,
      latitude: norm.lat,
      longitude: norm.lon,
      lat: norm.lat,
      lon: norm.lon,
      country: isWithinIndia ? 'India' : 'Unknown',
      countryCode: isWithinIndia ? 'IN' : 'XX',
      state: isWithinIndia ? 'India' : 'Unknown',
      source: 'gps',
      isCurrent: true,
      timezone: isWithinIndia ? 'Asia/Kolkata' : 'UTC',
    };

    // Attempt reverse geocode via Nominatim server proxy
    if (providerHealthManager.isAvailable('osm-nominatim')) {
      try {
        const res = await fetchWithTimeout(`/api/search-location?q=${norm.lat.toFixed(5)},${norm.lon.toFixed(5)}`, undefined, 8000);
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const item = data[0];
            const addr = item.address || {};
            const cityName =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.suburb ||
              addr.county ||
              item.display_name?.split(',')[0] ||
              (isWithinIndia ? 'Current Location' : 'Outside India Territory');
            const district = addr.state_district || addr.county;
            const stateName = addr.state || (isWithinIndia ? 'India' : (addr.country || 'Unknown'));
            const town = addr.town;
            const village = addr.village;
            const postcode = addr.postcode;

            const subAdmin = village || town || (addr.city && addr.city !== cityName ? addr.city : undefined);
            const contextParts = [
              cityName,
              subAdmin && subAdmin !== cityName ? subAdmin : undefined,
              district && district !== cityName && district !== subAdmin ? district : undefined,
              stateName && stateName !== cityName && stateName !== district ? stateName : undefined,
              addr.country || (isWithinIndia ? 'India' : 'Unknown'),
            ].filter(Boolean);

            baseLocation.name = cityName;
            baseLocation.state = stateName;
            baseLocation.district = district;
            baseLocation.city = addr.city;
            baseLocation.town = town;
            baseLocation.village = village;
            baseLocation.postcode = postcode;
            baseLocation.displayName = contextParts.join(', ');
            baseLocation.country = addr.country || (isWithinIndia ? 'India' : 'Unknown');
            baseLocation.countryCode = addr.country_code ? addr.country_code.toUpperCase() : (isWithinIndia ? 'IN' : 'XX');
            providerHealthManager.recordSuccess('osm-nominatim');
          }
        }
      } catch (e) {
        console.warn('Reverse geocoding failed, keeping exact coordinates:', e);
        providerHealthManager.recordFailure('osm-nominatim', e);
      }
    }

    return baseLocation;
  }

  /**
   * Internal: Queries Open-Meteo Geocoding API via server proxy or direct
   */
  private async fetchOpenMeteoGeocoding(query: string): Promise<NormalizedLocation[]> {
    let url = `/api/geocode?q=${encodeURIComponent(query)}`;
    let res: Response;

    try {
      res = await fetchWithTimeout(url, undefined, 8000);
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        throw new Error('Proxy returned non-JSON response');
      }
    } catch {
      // Fallback to direct client call if server route unavailable
      url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=12&language=en&format=json`;
      res = await fetchWithTimeout(url, undefined, 8000);
    }

    if (!res.ok) {
      throw new Error(`Open-Meteo geocoding HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawResults = data.results || [];

    const indianResults: NormalizedLocation[] = [];

    for (const r of rawResults) {
      // Filter strictly for India
      const isIndia =
        r.country_code === 'IN' ||
        (r.country && r.country.toLowerCase() === 'india');

      if (!isIndia) continue;

      const rawLat = Number(r.latitude);
      const rawLon = Number(r.longitude);
      if (!isValidCoordinate(rawLat, rawLon)) continue;

      const norm = normalizeCoordinates(rawLat, rawLon);
      if (!norm) continue;

      const name = r.name || 'Unknown';
      const state = r.admin1 || r.admin2 || 'India';
      const district = r.admin2 || undefined;

      const parts: string[] = [name];
      if (district && district !== name) parts.push(district);
      if (state && state !== name && state !== district) parts.push(state);
      parts.push('India');

      indianResults.push({
        id: `om-${r.id || `${norm.lat.toFixed(5)}_${norm.lon.toFixed(5)}`}`,
        name,
        displayName: parts.join(', '),
        latitude: norm.lat,
        longitude: norm.lon,
        lat: norm.lat,
        lon: norm.lon,
        country: 'India',
        countryCode: 'IN',
        state,
        district,
        city: name,
        timezone: r.timezone || 'Asia/Kolkata',
        elevation: r.elevation ? Math.round(r.elevation) : undefined,
        source: 'open-meteo',
      });
    }

    return indianResults;
  }

  /**
   * Internal: Queries Nominatim via server proxy
   */
  private async fetchNominatimGeocoding(query: string): Promise<NormalizedLocation[]> {
    const res = await fetchWithTimeout(`/api/search-location?q=${encodeURIComponent(query)}`, undefined, 8000);
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) {
      throw new Error(`Nominatim geocoding HTTP ${res.status} or non-JSON response`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const results: NormalizedLocation[] = [];

    for (const item of data) {
      const rawLat = parseFloat(item.lat);
      const rawLon = parseFloat(item.lon);
      if (!isValidCoordinate(rawLat, rawLon)) continue;

      const norm = normalizeCoordinates(rawLat, rawLon);
      if (!norm) continue;

      const isWithinIndia = isWithinIndiaBounds(norm.lat, norm.lon);
      const addr = item.address || {};
      const cityName =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.suburb ||
        addr.county ||
        addr.state_district ||
        item.display_name?.split(',')[0] ||
        query;
      const district = addr.state_district || addr.county || undefined;
      const stateName = addr.state || (isWithinIndia ? 'India' : (addr.country || 'Unknown'));
      const town = addr.town || undefined;
      const village = addr.village || undefined;
      const postcode = addr.postcode || undefined;

      const subAdmin = village || town || (addr.city && addr.city !== cityName ? addr.city : undefined);
      const parts: string[] = [
        cityName,
        subAdmin && subAdmin !== cityName ? subAdmin : undefined,
        district && district !== cityName && district !== subAdmin ? district : undefined,
        stateName && stateName !== cityName && stateName !== district ? stateName : undefined,
        addr.country || (isWithinIndia ? 'India' : 'Unknown'),
      ].filter(Boolean);

      results.push({
        id: `osm-${item.place_id || `${norm.lat.toFixed(5)}_${norm.lon.toFixed(5)}`}`,
        name: cityName,
        displayName: parts.join(', '),
        latitude: norm.lat,
        longitude: norm.lon,
        lat: norm.lat,
        lon: norm.lon,
        country: addr.country || (isWithinIndia ? 'India' : 'Unknown'),
        countryCode: addr.country_code ? addr.country_code.toUpperCase() : (isWithinIndia ? 'IN' : 'XX'),
        state: stateName,
        district,
        city: addr.city,
        town,
        village,
        postcode,
        source: 'nominatim',
      });
    }

    return results;
  }

  getDeduplicationThresholdKm(): number {
    return LOCATION_DEDUPLICATION_THRESHOLD_KM;
  }

  areNearby(lat1: number, lon1: number, lat2: number, lon2: number, thresholdKm = LOCATION_DEDUPLICATION_THRESHOLD_KM): boolean {
    return haversineDistanceKm(lat1, lon1, lat2, lon2) <= thresholdKm;
  }
}

export const locationResolver = new LocationResolver();
