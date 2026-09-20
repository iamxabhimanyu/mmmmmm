/**
 * OpenStreetMap & Nominatim Geocoding Provider
 * Classification: Open Data (ODbL) / Free API Service
 * Nominatim provides free geocoding and reverse geocoding governed by OSM Usage Policy:
 * Max 1 req/sec, descriptive User-Agent, client caching.
 */

import { IGeocodingProvider, ProviderMetadata } from './providerTypes';
import { LocationInfo } from '../../types';
import { MAJOR_INDIAN_CITIES } from '../../data/constants';
import { fetchWithTimeout } from './fetchUtils';
import {
  isValidCoordinate,
  normalizeCoordinates,
  haversineDistanceKm,
  formatCoordinates,
  LOCATION_DEDUPLICATION_THRESHOLD_KM,
  isWithinIndiaBounds,
} from '../../utils/coordinateUtils';
import { providerHealthManager } from '../ProviderHealthManager';

export class NominatimProvider implements IGeocodingProvider {
  readonly id = 'osm-nominatim';

  readonly metadata: ProviderMetadata = {
    id: 'osm-nominatim',
    name: 'OpenStreetMap Nominatim',
    classification: 'open-data',
    license: 'Open Database License (ODbL) / © OpenStreetMap contributors',
    requiresAuth: false,
    isConfigured: true,
    rateLimitInfo: 'Max 1 request/sec as per OSM Usage Policy, client-cached',
    attribution: 'Geocoding data © OpenStreetMap contributors under ODbL',
    website: 'https://nominatim.openstreetmap.org',
  };

  private searchCache = new Map<string, { timestamp: number; results: LocationInfo[] }>();
  private reverseCache = new Map<string, { timestamp: number; result: LocationInfo }>();
  private CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours cache for locations

  async searchLocations(query: string): Promise<LocationInfo[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed || trimmed.length < 2) return [];

    // Check memory cache
    const cached = this.searchCache.get(trimmed);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.results;
    }

    const results: LocationInfo[] = [];

    try {
      // Use backend proxy endpoint to enforce rate limits and proper User-Agent
      const res = await fetchWithTimeout(`/api/search-location?q=${encodeURIComponent(query)}`, undefined, 8000);

      if (res.status === 429) {
        providerHealthManager.recordFailure('osm-nominatim', 'Rate limited (HTTP 429)');
      } else if (!res.ok) {
        providerHealthManager.recordFailure('osm-nominatim', `HTTP error ${res.status}`);
      } else {
        providerHealthManager.recordSuccess('osm-nominatim');
        const rawResults = await res.json();

        if (Array.isArray(rawResults)) {
          for (const item of rawResults) {
            const rawLat = parseFloat(item.lat);
            const rawLon = parseFloat(item.lon);

            if (!isValidCoordinate(rawLat, rawLon)) {
              continue; // Reject invalid/missing/out-of-bounds coordinates
            }

            const norm = normalizeCoordinates(rawLat, rawLon);
            if (!norm) continue;

            // Only deduplicate if coordinates are virtually identical (<= 150m) or identical OSM place ID
            const alreadyExists = results.some(
              (c) =>
                c.id === `osm-${item.place_id}` ||
                haversineDistanceKm(c.lat, c.lon, norm.lat, norm.lon) <= LOCATION_DEDUPLICATION_THRESHOLD_KM
            );

            if (!alreadyExists) {
              const addr = item.address || {};
              const cityName =
                addr.city ||
                addr.town ||
                addr.village ||
                addr.suburb ||
                addr.county ||
                addr.state_district ||
                item.display_name?.split(',')[0] ||
                'Location';
              const stateName = addr.state || 'India';
              const district = addr.state_district || addr.county || undefined;
              const postcode = addr.postcode || undefined;

              // Preserve rich geographic hierarchy for disambiguation
              const subAdmin = addr.village || addr.town || (addr.city && addr.city !== cityName ? addr.city : undefined);
              const contextParts = [
                cityName,
                subAdmin && subAdmin !== cityName ? subAdmin : undefined,
                district && district !== cityName && district !== subAdmin ? district : undefined,
                stateName && stateName !== cityName && stateName !== district ? stateName : undefined,
                addr.country || 'India',
              ].filter(Boolean);

              results.push({
                id: `osm-${item.place_id || `${norm.lat.toFixed(5)}_${norm.lon.toFixed(5)}`}`,
                name: cityName,
                state: stateName,
                country: addr.country || 'India',
                district,
                city: addr.city,
                town: addr.town,
                village: addr.village,
                postcode,
                lat: norm.lat,
                lon: norm.lon,
                displayName: contextParts.join(', '),
                source: 'nominatim',
              });
            }
          }
        }
      }
    } catch (err) {
      providerHealthManager.recordFailure('osm-nominatim', err instanceof Error ? err.message : 'Network error');
      console.warn('Nominatim search failed:', err);
    }

    // If Nominatim returned no results or failed, check local catalog matches for the query
    if (results.length === 0) {
      const localMatches = MAJOR_INDIAN_CITIES.filter(
        (c) =>
          c.name.toLowerCase().includes(trimmed) ||
          c.state.toLowerCase().includes(trimmed)
      );
      for (const city of localMatches) {
        const norm = normalizeCoordinates(city.lat, city.lon);
        if (norm) {
          results.push({
            ...city,
            lat: norm.lat,
            lon: norm.lon,
            source: 'catalog',
          });
        }
      }
    }

    const finalResults = results.slice(0, 10);
    if (finalResults.length > 0) {
      this.searchCache.set(trimmed, { timestamp: Date.now(), results: finalResults });
    }
    return finalResults;
  }

  async reverseGeocode(lat: number, lon: number): Promise<LocationInfo> {
    if (!isValidCoordinate(lat, lon)) {
      throw new Error(`Invalid coordinates for reverse geocoding: lat=${lat}, lon=${lon}`);
    }

    const norm = normalizeCoordinates(lat, lon)!;
    const cacheKey = `${norm.lat.toFixed(5)}_${norm.lon.toFixed(5)}`;
    const cached = this.reverseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      // Return a copy ensuring the current request's own normalized coordinates are strictly preserved
      return {
        ...cached.result,
        lat: norm.lat,
        lon: norm.lon,
        id: cached.result.id,
      };
    }

    const isWithinIndia = isWithinIndiaBounds(norm.lat, norm.lon);

    // 1. Fetch via OSM Nominatim Reverse Geocoding (exact coordinates preserved)
    try {
      const url = `/api/search-location?q=${norm.lat.toFixed(5)},${norm.lon.toFixed(5)}`;
      const res = await fetchWithTimeout(url, undefined, 8000);
      const ct = res.headers.get('content-type') || '';

      if (res.status === 429) {
        providerHealthManager.recordFailure('osm-nominatim', 'Rate limited (HTTP 429)');
      } else if (!res.ok || !ct.includes('application/json')) {
        providerHealthManager.recordFailure('osm-nominatim', `HTTP error ${res.status}`);
      } else {
        providerHealthManager.recordSuccess('osm-nominatim');
        const raw = await res.json();
        const data = Array.isArray(raw) ? raw[0] : raw;

        if (data && data.address) {
          const addr = data.address || {};
          const cityName =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.suburb ||
            addr.county ||
            addr.state_district ||
            data.display_name?.split(',')[0] ||
            (isWithinIndia ? 'Selected Location' : 'Outside India Territory');
          const stateName = addr.state || (isWithinIndia ? 'India' : (addr.country || 'Unknown'));
          const district = addr.state_district || addr.county || undefined;
          const postcode = addr.postcode || undefined;

          const subAdmin = addr.village || addr.town || (addr.city && addr.city !== cityName ? addr.city : undefined);
          const contextParts = [
            cityName,
            subAdmin && subAdmin !== cityName ? subAdmin : undefined,
            district && district !== cityName && district !== subAdmin ? district : undefined,
            stateName && stateName !== cityName && stateName !== district ? stateName : undefined,
            addr.country || (isWithinIndia ? 'India' : 'Unknown'),
          ].filter(Boolean);

          const locationResult: LocationInfo = {
            id: `osm-rev-${norm.lat.toFixed(5)}_${norm.lon.toFixed(5)}`,
            name: cityName,
            state: stateName,
            country: addr.country || (isWithinIndia ? 'India' : 'Unknown'),
            district,
            city: addr.city,
            town: addr.town,
            village: addr.village,
            postcode,
            lat: norm.lat,
            lon: norm.lon,
            displayName: contextParts.join(', '),
            source: 'nominatim',
          };

          this.reverseCache.set(cacheKey, { timestamp: Date.now(), result: locationResult });
          return locationResult;
        }
      }
    } catch (e) {
      providerHealthManager.recordFailure('osm-nominatim', e instanceof Error ? e.message : 'Network error');
      console.warn('Nominatim reverse geocoding network error:', e);
    }

    // 2. Fallback: exact coordinates strictly retained with canonical format label, NEVER substituting another city
    const fallbackResult: LocationInfo = {
      id: `coords-${norm.lat.toFixed(5)}_${norm.lon.toFixed(5)}`,
      name: isWithinIndia ? 'Custom Location' : 'Outside India Territory',
      state: isWithinIndia ? 'India' : 'Unknown',
      country: isWithinIndia ? 'India' : 'Unknown',
      lat: norm.lat,
      lon: norm.lon,
      displayName: isWithinIndia
        ? `Location (${formatCoordinates(norm.lat, norm.lon)})`
        : `Location outside standard Indian bounds (${formatCoordinates(norm.lat, norm.lon)})`,
      source: 'nominatim',
    };
    this.reverseCache.set(cacheKey, { timestamp: Date.now(), result: fallbackResult });
    return fallbackResult;
  }

  getHealth() {
    return (
      providerHealthManager.getHealth(this.id) || {
        providerId: this.id,
        name: this.metadata.name,
        status: 'healthy',
        consecutiveFailures: 0,
        lastSuccessTime: Date.now(),
        lastFailureTime: null,
        cooldownUntil: null,
        lastError: null,
      }
    );
  }

  private getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return haversineDistanceKm(lat1, lon1, lat2, lon2);
  }
}

export const nominatimProvider = new NominatimProvider();
