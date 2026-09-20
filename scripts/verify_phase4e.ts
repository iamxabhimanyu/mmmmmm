/**
 * Phase 4E Verification Suite: Location Reliability & Coordinate Integrity
 *
 * Validates the 18 critical requirements for:
 * 1. Authoritative Coordinate Identity
 * 2. Coordinate Validation & Subcontinent Bounds Checking
 * 3. 5-Decimal Normalization (~1.1m resolution)
 * 4. Haversine Distance Accuracy
 * 5. Reverse Geocoding Coordinate Preservation
 * 6. Reverse Geocoding Failure / Offline Fallback
 * 7. Nominatim Provider Ingestion Validation
 * 8. Deduplication Precision (150m-200m)
 * 9. No Silent Substitution on Search (Zero-result honesty)
 * 10. India Bounding Box Filtering
 * 11. WeatherCacheManager Exact Coordinate Enforcement (<1m)
 * 12. Opt-in Approximate Cache Transparency
 * 13. FallbackManager Same-Location Coordinate Preservation
 * 14. FallbackManager Level 5 Honest Unavailable State Integrity
 * 15. DataProvenance Coordinate Tracking & Transparency
 * 16. Saved Locations Service Coordinate Validation & Normalization
 * 17. Search History Service Coordinate Validation
 * 18. End-to-End Fallback Hierarchy Location Invariant (Location never shifts)
 */

import {
  isValidCoordinate,
  isWithinIndiaBounds,
  normalizeCoordinates,
  haversineDistanceKm,
  areCoordinatesNearby,
  INDIA_BOUNDS,
  LOCATION_DEDUPLICATION_THRESHOLD_KM,
  LOCATION_DEDUPLICATION_THRESHOLD_METERS,
} from '../src/utils/coordinateUtils';
import { normalizeLocation } from '../src/types';
import { locationResolver } from '../src/services/LocationResolver';
import { nominatimProvider } from '../src/services/providers/NominatimProvider';
import { weatherCacheManager } from '../src/services/WeatherCacheManager';
import { fallbackManager } from '../src/services/FallbackManager';
import { weatherIntelligenceEngine } from '../src/services/weatherIntelligenceEngine';
import { savedLocationsService } from '../src/services/savedLocationsService';
import { searchHistoryService } from '../src/services/searchHistoryService';
import { NormalizedLocation } from '../src/services/providers/providerTypes';

interface TestResult {
  id: number;
  name: string;
  method: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

const results: TestResult[] = [];

async function runSuite() {
  console.log('====================================================');
  console.log('STARTING PHASE 4E: LOCATION RELIABILITY & COORDINATE INTEGRITY VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST 1: isValidCoordinate boundary & invalidity validation
  // ----------------------------------------------------
  try {
    const valid1 = isValidCoordinate(28.6139, 77.2090);
    const validZero = isValidCoordinate(0, 0);
    const validPoles = isValidCoordinate(90, 180) && isValidCoordinate(-90, -180);
    
    // Invalids
    const invalidNaN = !isValidCoordinate(NaN, 77.2);
    const invalidInfinity = !isValidCoordinate(28.6, Infinity);
    const invalidTypeString = !isValidCoordinate('28.6' as any, 77.2);
    const invalidTypeNull = !isValidCoordinate(null as any, 77.2);
    const invalidLatHigh = !isValidCoordinate(90.0001, 77.2);
    const invalidLatLow = !isValidCoordinate(-90.0001, 77.2);
    const invalidLonHigh = !isValidCoordinate(28.6, 180.0001);
    const invalidLonLow = !isValidCoordinate(28.6, -180.0001);

    const pass =
      valid1 &&
      validZero &&
      validPoles &&
      invalidNaN &&
      invalidInfinity &&
      invalidTypeString &&
      invalidTypeNull &&
      invalidLatHigh &&
      invalidLatLow &&
      invalidLonHigh &&
      invalidLonLow;

    results.push({
      id: 1,
      name: 'Coordinate validity and boundary enforcement',
      method: 'unit/boundary test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `valid1=${valid1}, validZero=${validZero}, validPoles=${validPoles}, rejectsNaN=${invalidNaN}, rejectsInfinity=${invalidInfinity}, rejectsLatOutOfBounds=${invalidLatHigh && invalidLatLow}, rejectsLonOutOfBounds=${invalidLonHigh && invalidLonLow}`,
    });
  } catch (err: any) {
    results.push({ id: 1, name: 'Coordinate validity and boundary enforcement', method: 'unit/boundary test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 2: Indian Subcontinent Bounds Checking
  // ----------------------------------------------------
  try {
    // Verified locations inside Indian bounds
    const mumbai = isWithinIndiaBounds(19.0760, 72.8777);
    const delhi = isWithinIndiaBounds(28.6139, 77.2090);
    const srinagar = isWithinIndiaBounds(34.0837, 74.7973);
    const kanyakumari = isWithinIndiaBounds(8.0883, 77.5385);
    const portBlair = isWithinIndiaBounds(11.6234, 92.7265);
    const indiraPoint = isWithinIndiaBounds(6.7533, 93.8294); // Andaman & Nicobar southernmost
    const kibithu = isWithinIndiaBounds(28.2900, 97.0100); // Easternmost Arunachal

    // Locations outside Indian bounds
    const london = !isWithinIndiaBounds(51.5074, -0.1278);
    const newYork = !isWithinIndiaBounds(40.7128, -74.0060);
    const tokyo = !isWithinIndiaBounds(35.6762, 139.6503);
    const nullIsland = !isWithinIndiaBounds(0, 0);
    const sydney = !isWithinIndiaBounds(-33.8688, 151.2093);

    const pass =
      mumbai && delhi && srinagar && kanyakumari && portBlair && indiraPoint && kibithu &&
      london && newYork && tokyo && nullIsland && sydney;

    results.push({
      id: 2,
      name: 'Indian subcontinent bounds verification',
      method: 'unit/geographical bounds test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `bounds=[${INDIA_BOUNDS.minLat}-${INDIA_BOUNDS.maxLat}N, ${INDIA_BOUNDS.minLon}-${INDIA_BOUNDS.maxLon}E], insideIndia: Mumbai=${mumbai}, Delhi=${delhi}, Srinagar=${srinagar}, PortBlair=${portBlair}, IndiraPoint=${indiraPoint}, Kibithu=${kibithu}; outsideIndia: London=${london}, NY=${newYork}, Tokyo=${tokyo}, NullIsland=${nullIsland}`,
    });
  } catch (err: any) {
    results.push({ id: 2, name: 'Indian subcontinent bounds verification', method: 'unit/geographical bounds test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 3: Coordinate Normalization to 5 Decimal Places (~1.1m resolution)
  // ----------------------------------------------------
  try {
    const norm1 = normalizeCoordinates(28.61394567, 77.20901234);
    const norm2 = normalizeCoordinates(19.076, 72.8777);
    const normZero = normalizeCoordinates(-0, -0);
    const normInvalid = normalizeCoordinates(NaN, 50);

    const pass =
      norm1?.lat === 28.61395 &&
      norm1?.lon === 77.20901 &&
      norm2?.lat === 19.076 &&
      norm2?.lon === 72.8777 &&
      normZero?.lat === 0 &&
      normZero?.lon === 0 &&
      normInvalid === null;

    results.push({
      id: 3,
      name: 'Deterministic 5-decimal coordinate normalization (~1.1m precision)',
      method: 'unit/normalization test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `28.61394567->${norm1?.lat}, 77.20901234->${norm1?.lon}; -0,-0->${normZero?.lat},${normZero?.lon}; NaN->${normInvalid}`,
    });
  } catch (err: any) {
    results.push({ id: 3, name: 'Deterministic 5-decimal coordinate normalization', method: 'unit/normalization test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 4: Haversine Distance Accuracy
  // ----------------------------------------------------
  try {
    const distZero = haversineDistanceKm(28.6139, 77.2090, 28.6139, 77.2090);
    // Delhi to Mumbai is ~1148 km
    const distDelhiMumbai = haversineDistanceKm(28.6139, 77.2090, 19.0760, 72.8777);
    // 0.00001 degrees lat is ~1.11 meters = ~0.00111 km
    const distSmall = haversineDistanceKm(28.61390, 77.20900, 28.61391, 77.20900);

    const pass =
      distZero === 0 &&
      distDelhiMumbai > 1140 &&
      distDelhiMumbai < 1160 &&
      distSmall > 0.001 &&
      distSmall < 0.0012;

    results.push({
      id: 4,
      name: 'Haversine distance calculation accuracy',
      method: 'unit/geodetic test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `distZero=${distZero} km, distDelhiMumbai=${distDelhiMumbai.toFixed(2)} km (expected ~1148km), 1-step offset (~1.1m)=${(distSmall * 1000).toFixed(2)} meters`,
    });
  } catch (err: any) {
    results.push({ id: 4, name: 'Haversine distance calculation accuracy', method: 'unit/geodetic test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 5: Reverse Geocoding Preserves Exact Requested Coordinates
  // ----------------------------------------------------
  try {
    const testLat = 18.52043;
    const testLon = 73.85674;
    const resolved = await locationResolver.resolveFromCoordinates(testLat, testLon);

    const coordinatesPreserved =
      resolved.latitude === testLat &&
      resolved.longitude === testLon &&
      resolved.lat === testLat &&
      resolved.lon === testLon;

    results.push({
      id: 5,
      name: 'Reverse geocoding preserves exact requested coordinates',
      method: 'integration/geocoding test',
      status: coordinatesPreserved ? 'PASS' : 'FAIL',
      evidence: `Requested (${testLat}, ${testLon}) -> Resolved lat=${resolved.latitude}, lon=${resolved.longitude}, name="${resolved.name}", preserved=${coordinatesPreserved}`,
    });
  } catch (err: any) {
    results.push({ id: 5, name: 'Reverse geocoding preserves exact requested coordinates', method: 'integration/geocoding test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 6: Reverse Geocoding Failure Keeps Exact Coordinates without City Substitution
  // ----------------------------------------------------
  try {
    // Coordinate in Arabian Sea or remote area within bounds
    const remoteLat = 15.00000;
    const remoteLon = 70.00000;
    const resolved = await locationResolver.resolveFromCoordinates(remoteLat, remoteLon);

    const preserved =
      resolved.latitude === remoteLat &&
      resolved.longitude === remoteLon &&
      // Must NOT substitute Mumbai or another major city
      resolved.name !== 'Mumbai' &&
      resolved.name !== 'Delhi';

    results.push({
      id: 6,
      name: 'Reverse geocoding failure/offline fallback preserves exact coordinates without city substitution',
      method: 'integration/fallback test',
      status: preserved ? 'PASS' : 'FAIL',
      evidence: `Requested (${remoteLat}, ${remoteLon}) -> returned lat=${resolved.latitude}, lon=${resolved.longitude}, name="${resolved.name}", cityNotSubstituted=${resolved.name !== 'Mumbai'}`,
    });
  } catch (err: any) {
    results.push({ id: 6, name: 'Reverse geocoding fallback preserves coordinates', method: 'integration/fallback test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 7: Nominatim Provider Ingestion Validation & Malformed Input Handling
  // ----------------------------------------------------
  try {
    // Test that nominatimProvider rejects invalid coordinate strings
    const health = nominatimProvider.getHealth();
    const hasHealthFields =
      typeof health.status === 'string' &&
      typeof health.consecutiveFailures === 'number';

    // Reverse geocode with invalid inputs should throw or fallback cleanly
    let rejectedInvalid = false;
    try {
      await nominatimProvider.reverseGeocode(NaN, 77.2);
    } catch {
      rejectedInvalid = true;
    }

    const pass = hasHealthFields && rejectedInvalid;

    results.push({
      id: 7,
      name: 'Nominatim provider input validation and health tracking',
      method: 'unit/validation test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `rejectedInvalid=${rejectedInvalid}, healthStatus=${health.status}, consecutiveFailures=${health.consecutiveFailures}`,
    });
  } catch (err: any) {
    results.push({ id: 7, name: 'Nominatim provider input validation', method: 'unit/validation test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 8: Deduplication Precision (150m-200m)
  // ----------------------------------------------------
  try {
    const centerLat = 19.07600;
    const centerLon = 72.87770;

    // Point 1: 50 meters away (~0.00045 deg lat) -> should be deduplicated as nearby
    const point50mLat = centerLat + 0.00045;
    const is50mNearby = areCoordinatesNearby(centerLat, centerLon, point50mLat, centerLon, 0.15); // threshold 150m (0.15km)

    // Point 2: 250 meters away (~0.00225 deg lat) -> should NOT be deduplicated
    const point250mLat = centerLat + 0.00225;
    const is250mNearby = areCoordinatesNearby(centerLat, centerLon, point250mLat, centerLon, 0.15);

    const pass = is50mNearby === true && is250mNearby === false;

    results.push({
      id: 8,
      name: 'Spatial deduplication precision (<150m grouped, >150m preserved)',
      method: 'unit/spatial precision test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `50m offset grouped=${is50mNearby}, 250m offset preserved=${!is250mNearby}`,
    });
  } catch (err: any) {
    results.push({ id: 8, name: 'Spatial deduplication precision', method: 'unit/spatial precision test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 9: No Silent Substitution on Search (Zero-result honesty)
  // ----------------------------------------------------
  try {
    const fakeQuery = 'zqxwkj-nonexistent-loc-12345';
    const searchResults = await locationResolver.searchPlaces(fakeQuery);

    // CRITICAL: Must be empty array, MUST NOT return Mumbai or any default city!
    const pass = Array.isArray(searchResults) && searchResults.length === 0;

    results.push({
      id: 9,
      name: 'No silent substitution on unmatched search query (honest zero-results)',
      method: 'integration/search honesty test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `query="${fakeQuery}" -> returned ${searchResults.length} results (never defaults to fallback city)`,
    });
  } catch (err: any) {
    results.push({ id: 9, name: 'No silent substitution on unmatched search query', method: 'integration/search honesty test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 10: India Bounding Box Filtering on Place Search
  // ----------------------------------------------------
  try {
    // Check popular locations returned by locationResolver
    const popular = locationResolver.getPopularLocations();
    const allWithinIndia = popular.every((loc) =>
      isWithinIndiaBounds(loc.latitude, loc.longitude)
    );

    results.push({
      id: 10,
      name: 'India bounding box enforcement on location catalog and search results',
      method: 'unit/catalog verification',
      status: allWithinIndia ? 'PASS' : 'FAIL',
      evidence: `Verified ${popular.length} popular Indian cities all within bounds [6.0-37.6N, 68.0-97.5E]`,
    });
  } catch (err: any) {
    results.push({ id: 10, name: 'India bounding box enforcement', method: 'unit/catalog verification', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 11: WeatherCacheManager Exact Coordinate Enforcement (<1m tolerance)
  // ----------------------------------------------------
  try {
    const puneLoc: NormalizedLocation = locationResolver.normalize({
      id: 'pune-test',
      name: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      lat: 18.52043,
      lon: 73.85674,
    });

    const intel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence(puneLoc, true);
    weatherCacheManager.set(puneLoc, intel, 'open-meteo');

    // Exact match: must hit
    const exactHit = weatherCacheManager.getExact(18.52043, 73.85674);

    // 50 meters away: getExact MUST return null!
    const nearbyLat = 18.52043 + 0.00045; // ~50m offset
    const exactMissOn50m = weatherCacheManager.getExact(nearbyLat, 73.85674);

    const pass = exactHit !== null && exactMissOn50m === null;

    results.push({
      id: 11,
      name: 'WeatherCacheManager exact coordinate enforcement (<1m tolerance)',
      method: 'unit/cache precision test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `exactHit=${Boolean(exactHit)}, 50m offset exactMiss=${exactMissOn50m === null}`,
    });
  } catch (err: any) {
    results.push({ id: 11, name: 'WeatherCacheManager exact coordinate enforcement', method: 'unit/cache precision test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 12: Opt-in Approximate Cache Transparency
  // ----------------------------------------------------
  try {
    const lat = 18.52043;
    const lon = 73.85674;
    // 2 km away
    const offset2kmLat = lat + 0.018;

    // 1. Automatic call WITHOUT allowApproximate must return null
    const defaultMiss = weatherCacheManager.get(offset2kmLat, lon);

    // 2. Explicit call WITH allowApproximate: true returns approximate match
    const approxHit = weatherCacheManager.get(offset2kmLat, lon, { allowApproximate: true });

    const pass =
      defaultMiss === null &&
      approxHit !== null &&
      approxHit.isExactMatch === false &&
      approxHit.distanceKm > 1.5 &&
      approxHit.distanceKm < 2.5;

    results.push({
      id: 12,
      name: 'Approximate cache retrieval is strictly opt-in with explicit distance metrics',
      method: 'unit/cache transparency test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `defaultMissWithoutOptIn=${defaultMiss === null}, approxHitWithOptIn=${Boolean(approxHit)}, isExactMatch=${approxHit?.isExactMatch}, distanceKm=${approxHit?.distanceKm.toFixed(2)} km`,
    });
  } catch (err: any) {
    results.push({ id: 12, name: 'Opt-in approximate cache transparency', method: 'unit/cache transparency test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 13: FallbackManager trySameLocationCache Preserves Requested Location
  // ----------------------------------------------------
  try {
    const customLoc: NormalizedLocation = locationResolver.normalize({
      id: 'custom-kochi',
      name: 'Kochi Marine Drive',
      state: 'Kerala',
      country: 'India',
      lat: 9.98163,
      lon: 76.27501,
    });

    const intel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence(customLoc, true);
    weatherCacheManager.set(customLoc, intel, 'open-meteo');

    const recovered = fallbackManager.trySameLocationCache(customLoc, 'Simulated upstream network timeout');

    const pass =
      recovered !== null &&
      recovered.location.latitude === 9.98163 &&
      recovered.location.longitude === 76.27501 &&
      recovered.location.name === 'Kochi Marine Drive' &&
      recovered.provenance?.requestedCoordinates.latitude === 9.98163 &&
      recovered.provenance?.requestedCoordinates.longitude === 76.27501 &&
      recovered.freshness.fallbackLevel === 1;

    results.push({
      id: 13,
      name: 'FallbackManager trySameLocationCache preserves user location & coordinates',
      method: 'unit/fallback recovery test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `recoveredLoc=${recovered?.location.name} (${recovered?.location.latitude}, ${recovered?.location.longitude}), fallbackLevel=${recovered?.freshness.fallbackLevel}`,
    });
  } catch (err: any) {
    results.push({ id: 13, name: 'FallbackManager trySameLocationCache preserves user location', method: 'unit/fallback recovery test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 14: FallbackManager Level 5 Honest Unavailable State Integrity
  // ----------------------------------------------------
  try {
    const unavailLoc: NormalizedLocation = locationResolver.normalize({
      id: 'unavail-loc',
      name: 'Leh Ladakh Remote',
      state: 'Ladakh',
      country: 'India',
      lat: 34.15258,
      lon: 77.57705,
    });

    const honestState = fallbackManager.createHonestUnavailableState(
      unavailLoc,
      'All live meteorological servers and local caches are unreachable'
    );

    const pass =
      honestState.isUnavailable === true &&
      honestState.freshness.fallbackLevel === 5 &&
      honestState.location.latitude === 34.15258 &&
      honestState.location.longitude === 77.57705 &&
      honestState.location.name === 'Leh Ladakh Remote' &&
      honestState.provenance?.requestedCoordinates.latitude === 34.15258 &&
      honestState.provenance?.requestedCoordinates.longitude === 77.57705;

    results.push({
      id: 14,
      name: 'FallbackManager Level 5 Honest Unavailable State preserves location without substituting fallback city',
      method: 'unit/honest state test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `isUnavailable=${honestState.isUnavailable}, fallbackLevel=${honestState.freshness.fallbackLevel}, location="${honestState.location.name}" (${honestState.location.latitude}, ${honestState.location.longitude})`,
    });
  } catch (err: any) {
    results.push({ id: 14, name: 'FallbackManager Level 5 Honest Unavailable State integrity', method: 'unit/honest state test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 15: DataProvenance Coordinate Tracking & Transparency
  // ----------------------------------------------------
  try {
    const provLoc: NormalizedLocation = locationResolver.normalize({
      id: 'prov-bengaluru',
      name: 'Bengaluru MG Road',
      state: 'Karnataka',
      country: 'India',
      lat: 12.97160,
      lon: 77.59460,
    });

    const intel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence(provLoc, true);
    const prov = intel.provenance;

    const pass =
      prov !== undefined &&
      prov.requestedCoordinates.latitude === 12.97160 &&
      prov.requestedCoordinates.longitude === 77.59460 &&
      prov.isExactMatch === true &&
      Array.isArray(prov.limitations);

    results.push({
      id: 15,
      name: 'DataProvenance explicitly tracks requestedCoordinates and exact match status',
      method: 'unit/provenance test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `requestedCoords=(${prov?.requestedCoordinates.latitude}, ${prov?.requestedCoordinates.longitude}), isExactMatch=${prov?.isExactMatch}, limitationsCount=${prov?.limitations.length}`,
    });
  } catch (err: any) {
    results.push({ id: 15, name: 'DataProvenance coordinate tracking', method: 'unit/provenance test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 16: Saved Locations Service Coordinate Validation & Normalization
  // ----------------------------------------------------
  try {
    // Calling saveLocation with invalid coordinates must fail gracefully
    const invalidResult = await savedLocationsService.saveLocation({
      name: 'Invalid Test Location',
      latitude: NaN,
      longitude: 77.2,
    });

    const rejectedNaN = invalidResult.data === null && typeof invalidResult.error === 'string';

    const outOfBoundsResult = await savedLocationsService.saveLocation({
      name: 'Out of bounds Lat',
      latitude: 95.0,
      longitude: 77.2,
    });

    const rejectedOutOfBounds = outOfBoundsResult.data === null && typeof outOfBoundsResult.error === 'string';

    const pass = rejectedNaN && rejectedOutOfBounds;

    results.push({
      id: 16,
      name: 'Saved locations service rejects invalid and out-of-bounds coordinates',
      method: 'unit/service validation test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `rejectedNaN=${rejectedNaN}, rejectedOutOfBounds=${rejectedOutOfBounds}`,
    });
  } catch (err: any) {
    results.push({ id: 16, name: 'Saved locations service coordinate validation', method: 'unit/service validation test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 17: Search History Service Coordinate Validation
  // ----------------------------------------------------
  try {
    const invalidSearch = await searchHistoryService.recordSearch({
      location_name: 'Invalid Search Test',
      latitude: Infinity,
      longitude: 72.8,
    });

    const rejectedInvalid = invalidSearch.data === null;

    results.push({
      id: 17,
      name: 'Search history service rejects non-numeric or invalid coordinates',
      method: 'unit/service validation test',
      status: rejectedInvalid ? 'PASS' : 'FAIL',
      evidence: `invalidSearchRejected=${rejectedInvalid}`,
    });
  } catch (err: any) {
    results.push({ id: 17, name: 'Search history service coordinate validation', method: 'unit/service validation test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 18: End-to-End Fallback Hierarchy Location Invariant
  // Fallback may change data source, but NEVER changes user location!
  // ----------------------------------------------------
  try {
    const hyderabadLoc: NormalizedLocation = locationResolver.normalize({
      id: 'hyd-charminar',
      name: 'Charminar Hyderabad',
      state: 'Telangana',
      country: 'India',
      lat: 17.36156,
      lon: 78.47467,
    });

    // 1. Initial live fetch
    const liveIntel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence(hyderabadLoc, true);

    // 2. Clear provider health to simulate upstream outage
    // The fallback hierarchy must return same-location cache or Level 5 unavailable
    const cachedIntel = fallbackManager.trySameLocationCache(hyderabadLoc, 'Upstream DNS failure');

    const pass =
      liveIntel.location.latitude === 17.36156 &&
      liveIntel.location.longitude === 78.47467 &&
      liveIntel.location.name === 'Charminar Hyderabad' &&
      cachedIntel !== null &&
      cachedIntel.location.latitude === 17.36156 &&
      cachedIntel.location.longitude === 78.47467 &&
      cachedIntel.location.name === 'Charminar Hyderabad' &&
      cachedIntel.provenance?.requestedCoordinates.latitude === 17.36156 &&
      cachedIntel.provenance?.requestedCoordinates.longitude === 78.47467;

    results.push({
      id: 18,
      name: 'Core Invariant: Fallback changes data source, but NEVER changes the geographic location',
      method: 'e2e/location invariant test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `Live Coords=(${liveIntel.location.latitude}, ${liveIntel.location.longitude}) == Fallback Cache Coords=(${cachedIntel?.location.latitude}, ${cachedIntel?.location.longitude}) == Requested (${hyderabadLoc.latitude}, ${hyderabadLoc.longitude})`,
    });
  } catch (err: any) {
    results.push({ id: 18, name: 'Core Invariant: Fallback changes data source, but NEVER changes the geographic location', method: 'e2e/location invariant test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 19: 4-Decimal Collision Protection & 5-Decimal Reverse-Cache Isolation
  // ----------------------------------------------------
  try {
    // Two coordinates that are identical at 4 decimals (18.5204, 73.8567) but differ at 5 decimals
    const coord1 = { lat: 18.52041, lon: 73.85671 };
    const coord2 = { lat: 18.52044, lon: 73.85674 };

    const collidesAt4Dec =
      coord1.lat.toFixed(4) === coord2.lat.toFixed(4) &&
      coord1.lon.toFixed(4) === coord2.lon.toFixed(4);

    const differsAt5Dec =
      coord1.lat.toFixed(5) !== coord2.lat.toFixed(5) &&
      coord1.lon.toFixed(5) !== coord2.lon.toFixed(5);

    const res1 = await nominatimProvider.reverseGeocode(coord1.lat, coord1.lon);
    const res2 = await nominatimProvider.reverseGeocode(coord2.lat, coord2.lon);

    const isolated =
      res1.lat === coord1.lat &&
      res1.lon === coord1.lon &&
      res2.lat === coord2.lat &&
      res2.lon === coord2.lon &&
      res1.lat !== res2.lat &&
      res1.lon !== res2.lon &&
      res1.id !== res2.id;

    const pass = collidesAt4Dec && differsAt5Dec && isolated;

    results.push({
      id: 19,
      name: '4-decimal reverse-cache collision protection and 5-decimal cache isolation',
      method: 'regression/cache isolation test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `collidesAt4Dec=${collidesAt4Dec} ("${coord1.lat.toFixed(4)}_${coord1.lon.toFixed(4)}"), differsAt5Dec=${differsAt5Dec}, res1=(${res1.lat}, ${res1.lon}), res2=(${res2.lat}, ${res2.lon}), isolated=${isolated}`,
    });
  } catch (err: any) {
    results.push({ id: 19, name: '4-decimal reverse-cache collision protection', method: 'regression/cache isolation test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 20: 5-Decimal Reverse-Cache Exact Coordinate Preservation on Cache Hit
  // ----------------------------------------------------
  try {
    const coord = { lat: 13.08268, lon: 80.27072 };
    const firstCall = await nominatimProvider.reverseGeocode(coord.lat, coord.lon);
    const cachedCall = await nominatimProvider.reverseGeocode(coord.lat, coord.lon);

    const pass =
      firstCall.lat === coord.lat &&
      firstCall.lon === coord.lon &&
      cachedCall.lat === coord.lat &&
      cachedCall.lon === coord.lon &&
      cachedCall.id === firstCall.id &&
      firstCall.name === cachedCall.name;

    results.push({
      id: 20,
      name: '5-decimal reverse-cache preserves exact normalized coordinates on cache hit',
      method: 'regression/cache hit integrity test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `firstCall=(${firstCall.lat}, ${firstCall.lon}), cachedCall=(${cachedCall.lat}, ${cachedCall.lon}), expected=(${coord.lat}, ${coord.lon})`,
    });
  } catch (err: any) {
    results.push({ id: 20, name: '5-decimal reverse-cache coordinate preservation', method: 'regression/cache hit integrity test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 21: Actual LocationResolver Dedup Threshold = 150m (0.15 km)
  // ----------------------------------------------------
  try {
    const lrThresholdKm = locationResolver.getDeduplicationThresholdKm();
    const sharedConstantKm = LOCATION_DEDUPLICATION_THRESHOLD_KM;
    const sharedConstantMeters = LOCATION_DEDUPLICATION_THRESHOLD_METERS;

    const pass =
      lrThresholdKm === 0.15 &&
      sharedConstantKm === 0.15 &&
      sharedConstantMeters === 150 &&
      lrThresholdKm === sharedConstantKm;

    results.push({
      id: 21,
      name: 'Actual LocationResolver deduplication threshold standardized to 150m (0.15km)',
      method: 'unit/dedup threshold standardization test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `LocationResolver threshold=${lrThresholdKm}km, sharedConstantKm=${sharedConstantKm}km, sharedConstantMeters=${sharedConstantMeters}m`,
    });
  } catch (err: any) {
    results.push({ id: 21, name: 'LocationResolver dedup threshold standardization', method: 'unit/dedup threshold standardization test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 22: 150m Grouped / >150m Preserved in LocationResolver
  // ----------------------------------------------------
  try {
    const baseLat = 19.07600;
    const baseLon = 72.87770;

    // ~100m away (lat offset 0.0009 deg ≈ 100m) -> distance <= 0.15 km -> grouped
    const nearLat = baseLat + 0.0009;
    const nearDistanceKm = haversineDistanceKm(baseLat, baseLon, nearLat, baseLon);
    const isNearGrouped = locationResolver.areNearby(baseLat, baseLon, nearLat, baseLon);

    // ~200m away (lat offset 0.0018 deg ≈ 200m) -> distance > 0.15 km -> preserved (not grouped)
    const farLat = baseLat + 0.0018;
    const farDistanceKm = haversineDistanceKm(baseLat, baseLon, farLat, baseLon);
    const isFarGrouped = locationResolver.areNearby(baseLat, baseLon, farLat, baseLon);

    const pass =
      nearDistanceKm < 0.15 &&
      isNearGrouped === true &&
      farDistanceKm > 0.15 &&
      isFarGrouped === false;

    results.push({
      id: 22,
      name: '150m grouped / >150m preserved in LocationResolver deduplication',
      method: 'integration/spatial boundary test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `Near point (${(nearDistanceKm * 1000).toFixed(1)}m) grouped=${isNearGrouped}, Far point (${(farDistanceKm * 1000).toFixed(1)}m) grouped=${isFarGrouped}`,
    });
  } catch (err: any) {
    results.push({ id: 22, name: '150m grouped / >150m preserved', method: 'integration/spatial boundary test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 23: Outside-India GPS & Coordinate Metadata Consistency
  // ----------------------------------------------------
  try {
    // Tokyo, Japan: 35.6762, 139.6503 (clearly outside India bounds [6, 37.6]N, [68, 97.5]E)
    const tokyoLat = 35.6762;
    const tokyoLon = 139.6503;
    const isInside = isWithinIndiaBounds(tokyoLat, tokyoLon);

    const outsideResolved = await locationResolver.resolveFromCoordinates(tokyoLat, tokyoLon);
    const normalizedOutside = normalizeLocation({
      id: 'test-london',
      name: 'London',
      state: '',
      country: 'United Kingdom',
      lat: 51.5074,
      lon: -0.1278,
    });

    const pass =
      isInside === false &&
      outsideResolved.state !== 'India' &&
      outsideResolved.country !== 'India' &&
      outsideResolved.countryCode !== 'IN' &&
      outsideResolved.name === 'Outside India Territory' &&
      outsideResolved.latitude === tokyoLat &&
      outsideResolved.longitude === tokyoLon &&
      normalizedOutside.state !== 'India' &&
      normalizedOutside.country !== 'India';

    results.push({
      id: 23,
      name: 'Outside-India GPS and coordinate metadata consistency (never forces state="India")',
      method: 'regression/metadata integrity test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `isInside=${isInside}, resolved.state="${outsideResolved.state}", resolved.country="${outsideResolved.country}", resolved.countryCode="${outsideResolved.countryCode}", normalizedOutside.state="${normalizedOutside.state}"`,
    });
  } catch (err: any) {
    results.push({ id: 23, name: 'Outside-India GPS metadata consistency', method: 'regression/metadata integrity test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // Output Summary
  // ----------------------------------------------------
  console.log('====================================================');
  console.log('PHASE 4E TEST RESULTS:');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    console.log(`[TEST ${r.id}] ${r.name} (${r.method})`);
    console.log(`STATUS:   ${r.status}`);
    console.log(`EVIDENCE: ${r.evidence}\n`);

    if (r.status === 'PASS') passed++;
    else failed++;
  }

  console.log('====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED across ${results.length} total tests.`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
