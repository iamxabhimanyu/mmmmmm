/**
 * Centralized Coordinate Validation & Geographic Integrity Utilities
 * MAUSAM Phase 4E - Location Reliability & Coordinate Integrity
 *
 * Guarantees:
 * - Deterministic coordinate validation
 * - Latitude: [-90, +90], Longitude: [-180, +180]
 * - Strict rejection of NaN, Infinity, -Infinity, null, undefined, and non-numeric types
 * - 5-decimal precision normalization (~1.1m ground accuracy)
 * - Strict signed-zero (-0 vs +0) handling
 * - Haversine distance calculations and material coordinate mismatch detection
 */

export const INDIA_COORDINATE_BOUNDS = {
  minLat: 6.0,
  maxLat: 37.6,
  minLon: 68.0,
  maxLon: 97.5,
};

export const INDIA_BOUNDS = INDIA_COORDINATE_BOUNDS;

/**
 * Validates whether latitude and longitude are finite numbers within valid geographic ranges.
 * Rejects NaN, Infinity, -Infinity, strings, null, undefined, and out-of-range values.
 */
export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return false;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return false;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return false;
  }
  return true;
}

/**
 * Returns a detailed validation result with diagnostic error message if invalid.
 */
export function validateCoordinates(
  lat: unknown,
  lon: unknown
): { valid: boolean; error?: string } {
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return { valid: false, error: 'Coordinates cannot be null or undefined' };
  }
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return { valid: false, error: 'Coordinates must be numeric values' };
  }
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return { valid: false, error: 'Coordinates cannot be NaN' };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { valid: false, error: 'Coordinates must be finite numbers (cannot be Infinity)' };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, error: `Latitude ${lat} is out of bounds (must be between -90 and +90)` };
  }
  if (lon < -180 || lon > 180) {
    return { valid: false, error: `Longitude ${lon} is out of bounds (must be between -180 and +180)` };
  }
  return { valid: true };
}

/**
 * Normalizes latitude and longitude to 5 decimal places (~1.1 meter ground resolution)
 * and normalizes signed-zero (-0) to 0.
 * Returns null if coordinates are invalid.
 */
export function normalizeCoordinates(
  lat: number,
  lon: number
): { lat: number; lon: number } | null {
  if (!isValidCoordinate(lat, lon)) {
    return null;
  }

  // Handle -0 vs +0 consistently
  const normalizedLat = Object.is(lat, -0) || lat === 0 ? 0 : lat;
  const normalizedLon = Object.is(lon, -0) || lon === 0 ? 0 : lon;

  // Round to 5 decimal places (~1.1 meters precision)
  const roundedLat = Number(normalizedLat.toFixed(5));
  const roundedLon = Number(normalizedLon.toFixed(5));

  return {
    lat: Object.is(roundedLat, -0) || roundedLat === 0 ? 0 : roundedLat,
    lon: Object.is(roundedLon, -0) || roundedLon === 0 ? 0 : roundedLon,
  };
}

/**
 * Computes great-circle distance between two geographic coordinates using the Haversine formula.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return Infinity;
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const LOCATION_DEDUPLICATION_THRESHOLD_KM = 0.15; // 150 meters
export const LOCATION_DEDUPLICATION_THRESHOLD_METERS = 150;

/**
 * Checks if two coordinate pairs represent the same geographic point within a given distance threshold (default: 1 meter / 0.001 km).
 */
export function areCoordinatesEqual(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  thresholdKm = 0.001
): boolean {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return false;
  }
  return haversineDistanceKm(lat1, lon1, lat2, lon2) <= thresholdKm;
}

export function areCoordinatesNearby(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  thresholdKm = LOCATION_DEDUPLICATION_THRESHOLD_KM
): boolean {
  return areCoordinatesEqual(lat1, lon1, lat2, lon2, thresholdKm);
}

/**
 * Detects if provider-returned coordinates differ materially from canonical requested coordinates.
 * Weather numerical prediction models (NWP) typically grid at 10km to 28km (0.1° to 0.25°).
 * A shift of >35 km represents a material discrepancy that must be flagged.
 */
export function areMateriallyDifferent(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  thresholdKm = 35
): boolean {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return true;
  }
  return haversineDistanceKm(lat1, lon1, lat2, lon2) > thresholdKm;
}

/**
 * Checks if coordinates fall within Indian subcontinental bounding limits.
 */
export function isWithinIndiaBounds(lat: number, lon: number): boolean {
  if (!isValidCoordinate(lat, lon)) {
    return false;
  }
  return (
    lat >= INDIA_COORDINATE_BOUNDS.minLat &&
    lat <= INDIA_COORDINATE_BOUNDS.maxLat &&
    lon >= INDIA_COORDINATE_BOUNDS.minLon &&
    lon <= INDIA_COORDINATE_BOUNDS.maxLon
  );
}

/**
 * Formats coordinates for diagnostic display: e.g. "28.6139°N, 77.2090°E"
 */
export function formatCoordinates(lat: number, lon: number, decimals = 4): string {
  if (!isValidCoordinate(lat, lon)) {
    return 'Invalid Coordinates';
  }
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(decimals)}°${latDir}, ${Math.abs(lon).toFixed(decimals)}°${lonDir}`;
}
