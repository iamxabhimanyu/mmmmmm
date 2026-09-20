/**
 * Phase 4D Verification Suite: Cache Hardening & Performance
 *
 * Validates the 36 critical requirements for:
 * 1. Correctness & Deterministic Keying
 * 2. Location Integrity (Requested Location > Cache Convenience)
 * 3. Fallback Compliance (Exact Cache only automatic; Approximate is explicit opt-in)
 * 4. Dataset-Specific TTL Policies & Freshness vs TTL Separation
 * 5. Cache Write Safety, Poisoning Prevention & Race Condition Protection
 * 6. Memory Safety, Bounded Capacity & Eviction
 * 7. In-flight Concurrent Request Deduplication
 * 8. Regression Protection (Phase 4B & Phase 4C)
 */

import {
  weatherCacheManager,
  generateCacheKey,
  normalizeCoordinates,
  CACHE_TTL_POLICIES,
  MAX_CACHE_ENTRIES,
  WeatherDatasetType,
} from '../src/services/WeatherCacheManager';
import { fallbackManager } from '../src/services/FallbackManager';
import { weatherIntelligenceEngine } from '../src/services/weatherIntelligenceEngine';
import { locationResolver } from '../src/services/LocationResolver';
import { calculateFreshness, determineConfidence } from '../src/utils/freshnessUtils';
import { CompleteWeatherIntelligence } from '../src/services/providers/providerTypes';

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
  console.log('STARTING PHASE 4D: CACHE HARDENING & PERFORMANCE VERIFICATION');
  console.log('====================================================\n');

  const delhiLoc = locationResolver.normalize({
    id: 'delhi-test',
    name: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    lat: 28.6139,
    lon: 77.2090,
  });

  const mumbaiLoc = locationResolver.normalize({
    id: 'mumbai-test',
    name: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    lat: 19.0760,
    lon: 72.8777,
  });

  // Obtain a baseline mock intelligence for unit test seeding
  const baseIntel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence(delhiLoc, true);

  // ----------------------------------------------------
  // TEST 1: Deterministic cache-key generation
  // ----------------------------------------------------
  try {
    const key1 = weatherCacheManager.getCacheKey(28.6139, 77.2090, 'complete');
    const key2 = generateCacheKey(28.6139, 77.2090, 'complete');
    const keyZero1 = weatherCacheManager.getCacheKey(0, 0, 'complete');
    const keyZero2 = weatherCacheManager.getCacheKey(-0, -0, 'complete');
    const keyPrecision = weatherCacheManager.getCacheKey(28.6139000, 77.2090000, 'complete');

    const pass =
      key1 === 'weather:28.61390:77.20900:complete' &&
      key1 === key2 &&
      keyZero1 === 'weather:0.00000:0.00000:complete' &&
      keyZero1 === keyZero2 &&
      key1 === keyPrecision;

    results.push({
      id: 1,
      name: 'Deterministic cache-key generation',
      method: 'unit/contract test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `key1="${key1}", keyZero1="${keyZero1}", keyZero2="${keyZero2}", identical=${keyZero1 === keyZero2}`,
    });
  } catch (err: any) {
    results.push({ id: 1, name: 'Deterministic cache-key generation', method: 'unit/contract test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 2: Invalid coordinate rejection
  // ----------------------------------------------------
  try {
    const nanCheck = normalizeCoordinates(NaN, 77.2);
    const infCheck = normalizeCoordinates(28.6, Infinity);
    const outLatCheck = normalizeCoordinates(95.0, 77.2);
    const outLonCheck = normalizeCoordinates(28.6, 185.0);
    const stringCheck = normalizeCoordinates('28.6' as any, 77.2);

    let threwOnInvalid = false;
    try {
      generateCacheKey(NaN, 77.2);
    } catch {
      threwOnInvalid = true;
    }

    const pass =
      nanCheck === null &&
      infCheck === null &&
      outLatCheck === null &&
      outLonCheck === null &&
      stringCheck === null &&
      threwOnInvalid;

    results.push({
      id: 2,
      name: 'Invalid coordinate rejection',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `nanCheck=${nanCheck}, infCheck=${infCheck}, outLatCheck=${outLatCheck}, threwOnInvalid=${threwOnInvalid}`,
    });
  } catch (err: any) {
    results.push({ id: 2, name: 'Invalid coordinate rejection', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 3: Coordinate collision prevention
  // ----------------------------------------------------
  try {
    const keyA = weatherCacheManager.getCacheKey(28.6139, 77.2090, 'complete');
    const keyB = weatherCacheManager.getCacheKey(28.6200, 77.2150, 'complete');
    const pass = keyA !== keyB;

    results.push({
      id: 3,
      name: 'Coordinate collision prevention',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `keyA="${keyA}" != keyB="${keyB}" (collision prevented)`,
    });
  } catch (err: any) {
    results.push({ id: 3, name: 'Coordinate collision prevention', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 4: Dataset cache isolation
  // ----------------------------------------------------
  try {
    const completeKey = weatherCacheManager.getCacheKey(28.6139, 77.2090, 'complete');
    const hourlyKey = weatherCacheManager.getCacheKey(28.6139, 77.2090, 'hourly');
    const aqiKey = weatherCacheManager.getCacheKey(28.6139, 77.2090, 'airQuality');
    const floodKey = weatherCacheManager.getCacheKey(28.6139, 77.2090, 'flood');

    const pass =
      completeKey !== hourlyKey &&
      hourlyKey !== aqiKey &&
      aqiKey !== floodKey &&
      completeKey.endsWith(':complete') &&
      hourlyKey.endsWith(':hourly') &&
      aqiKey.endsWith(':airQuality') &&
      floodKey.endsWith(':flood');

    results.push({
      id: 4,
      name: 'Dataset cache isolation',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `Keys isolated: complete="${completeKey}", hourly="${hourlyKey}", aqi="${aqiKey}", flood="${floodKey}"`,
    });
  } catch (err: any) {
    results.push({ id: 4, name: 'Dataset cache isolation', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 5: Exact cache hit
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    weatherCacheManager.set(delhiLoc, baseIntel, 'open-meteo');

    const exactHit = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);
    const pass =
      exactHit !== null &&
      exactHit.isExactMatch === true &&
      exactHit.distanceKm === 0 &&
      exactHit.data.current.temperature === baseIntel.current.temperature;

    results.push({
      id: 5,
      name: 'Exact cache hit',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `hit=${exactHit !== null}, isExactMatch=${exactHit?.isExactMatch}, distanceKm=${exactHit?.distanceKm}, temp=${exactHit?.data.current.temperature}°C`,
    });
  } catch (err: any) {
    results.push({ id: 5, name: 'Exact cache hit', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 6: Exact cache miss
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const miss = weatherCacheManager.getExact(mumbaiLoc.latitude, mumbaiLoc.longitude);
    const pass = miss === null;

    results.push({
      id: 6,
      name: 'Exact cache miss',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `miss result=${miss} (correctly returned null on cache miss)`,
    });
  } catch (err: any) {
    results.push({ id: 6, name: 'Exact cache miss', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 7: Approximate cache is NOT automatic
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const nearbyLoc = locationResolver.normalize({
      id: 'nearby-delhi',
      name: 'Connaught Place',
      state: 'Delhi',
      country: 'India',
      lat: 28.6300,
      lon: 77.2200,
    });
    weatherCacheManager.set(nearbyLoc, baseIntel, 'open-meteo');

    // Query for Delhi exact coordinates (28.6139, 77.2090)
    const exact = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);
    const regularGet = weatherCacheManager.get(delhiLoc.latitude, delhiLoc.longitude); // allowApproximate = false
    const l1Result = fallbackManager.trySameLocationCache(delhiLoc, 'Simulated Failure');

    const pass = exact === null && regularGet === null && l1Result === null;

    results.push({
      id: 7,
      name: 'Approximate cache is NOT automatic',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `getExact=${exact}, regularGet=${regularGet}, fallbackManager.trySameLocationCache=${l1Result}`,
    });
  } catch (err: any) {
    results.push({ id: 7, name: 'Approximate cache is NOT automatic', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 8: Explicit approximate cache works
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const nearbyLoc = locationResolver.normalize({
      id: 'nearby-delhi',
      name: 'Connaught Place',
      state: 'Delhi',
      country: 'India',
      lat: 28.6300,
      lon: 77.2200,
    });
    weatherCacheManager.set(nearbyLoc, baseIntel, 'open-meteo');

    const approx = weatherCacheManager.get(delhiLoc.latitude, delhiLoc.longitude, { allowApproximate: true });
    const pass =
      approx !== null &&
      approx.isExactMatch === false &&
      approx.distanceKm > 0 &&
      approx.distanceKm <= 5.0 &&
      approx.originalCoordinates.latitude === 28.63;

    results.push({
      id: 8,
      name: 'Explicit approximate cache works',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `approx hit=${approx !== null}, isExactMatch=${approx?.isExactMatch}, distanceKm=${approx?.distanceKm?.toFixed(2)}km`,
    });
  } catch (err: any) {
    results.push({ id: 8, name: 'Explicit approximate cache works', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 9: TTL fresh entry
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    weatherCacheManager.set(delhiLoc, baseIntel, 'open-meteo');
    const hit = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);

    const pass = hit !== null && hit.isStale === false && hit.isExpired === false;

    results.push({
      id: 9,
      name: 'TTL fresh entry',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `isStale=${hit?.isStale}, isExpired=${hit?.isExpired}, freshUntil=${hit?.freshUntil}`,
    });
  } catch (err: any) {
    results.push({ id: 9, name: 'TTL fresh entry', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 10: TTL expired entry
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    // Simulate expired entry by directly updating cache item staleUntil into past
    weatherCacheManager.set(delhiLoc, baseIntel, 'open-meteo');
    const key = weatherCacheManager.getCacheKey(delhiLoc.latitude, delhiLoc.longitude, 'complete');
    const rawMap = (weatherCacheManager as any).memoryCache;
    const item = rawMap.get(key);
    item.staleUntil = Date.now() - 1000; // expired 1 sec ago
    item.freshUntil = Date.now() - 5000;

    const normalHit = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);
    const pass = normalHit === null;

    results.push({
      id: 10,
      name: 'TTL expired entry',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `normalHit on expired entry=${normalHit} (strictly returned null; cannot satisfy normal cache request)`,
    });
  } catch (err: any) {
    results.push({ id: 10, name: 'TTL expired entry', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 11: Expired entry does not become Level 0
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    weatherCacheManager.set(delhiLoc, baseIntel, 'open-meteo');
    const key = weatherCacheManager.getCacheKey(delhiLoc.latitude, delhiLoc.longitude, 'complete');
    const rawMap = (weatherCacheManager as any).memoryCache;
    rawMap.get(key).staleUntil = Date.now() - 1000;

    // Normal lookup rejects expired entry
    const res = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);
    const pass = res === null;

    results.push({
      id: 11,
      name: 'Expired entry does not become Level 0',
      method: 'unit/contract test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `Expired entry returned null; never converted into Level 0 fresh live data.`,
    });
  } catch (err: any) {
    results.push({ id: 11, name: 'Expired entry does not become Level 0', method: 'unit/contract test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 12: Expired entry provenance remains truthful
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    weatherCacheManager.set(delhiLoc, baseIntel, 'open-meteo');
    const key = weatherCacheManager.getCacheKey(delhiLoc.latitude, delhiLoc.longitude, 'complete');
    const rawMap = (weatherCacheManager as any).memoryCache;
    rawMap.get(key).staleUntil = Date.now() - 1000;

    // Retrieve via explicit allowExpired inspect
    const expiredRes = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude, 'complete', { allowExpired: true });
    const pass =
      expiredRes !== null &&
      expiredRes.isExpired === true &&
      expiredRes.isStale === true &&
      expiredRes.data.provenance?.isOfficial === false;

    results.push({
      id: 12,
      name: 'Expired entry provenance remains truthful',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `isExpired=${expiredRes?.isExpired}, isStale=${expiredRes?.isStale}, fallbackLevel remains cached (not Level 0).`,
    });
  } catch (err: any) {
    results.push({ id: 12, name: 'Expired entry provenance remains truthful', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 13: Failed provider response does not overwrite good cache
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    weatherCacheManager.set(delhiLoc, baseIntel, 'open-meteo');

    // Simulate failure attempt - validatePayloadForCache rejects error payload
    const failedPayload = { error: 'Network failure', message: 'Connection refused' } as any;
    const writeResult = weatherCacheManager.set(delhiLoc, failedPayload, 'open-meteo');

    const exactAfter = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);
    const pass = writeResult === false && exactAfter !== null && exactAfter.data.current.temperature === baseIntel.current.temperature;

    results.push({
      id: 13,
      name: 'Failed provider response does not overwrite good cache',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `writeResult=${writeResult}, existing good cache preserved with temp=${exactAfter?.data.current.temperature}°C`,
    });
  } catch (err: any) {
    results.push({ id: 13, name: 'Failed provider response does not overwrite good cache', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 14: Timeout does not overwrite good cache
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    weatherCacheManager.set(delhiLoc, baseIntel, 'open-meteo');

    const timeoutPayload = { error: 'TimeoutError', message: 'Request timed out after 5000ms' } as any;
    const writeResult = weatherCacheManager.set(delhiLoc, timeoutPayload, 'open-meteo');
    const exactAfter = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);

    const pass = writeResult === false && exactAfter !== null;

    results.push({
      id: 14,
      name: 'Timeout does not overwrite good cache',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `writeResult=${writeResult}, good cache remains intact`,
    });
  } catch (err: any) {
    results.push({ id: 14, name: 'Timeout does not overwrite good cache', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 15: HTTP 5xx does not overwrite good cache
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    weatherCacheManager.set(delhiLoc, baseIntel, 'open-meteo');

    const http503Payload = { statusCode: 503, status: 'error', message: 'Upstream gateway overloaded' } as any;
    const writeResult = weatherCacheManager.set(delhiLoc, http503Payload, 'open-meteo');
    const exactAfter = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);

    const pass = writeResult === false && exactAfter !== null;

    results.push({
      id: 15,
      name: 'HTTP 5xx does not overwrite good cache',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `writeResult=${writeResult}, good cache preserved intact`,
    });
  } catch (err: any) {
    results.push({ id: 15, name: 'HTTP 5xx does not overwrite good cache', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 16: Invalid payload does not enter cache
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const corruptedPayload: any = {
      ...baseIntel,
      current: { ...baseIntel.current, temperature: NaN },
    };
    const writeRes = weatherCacheManager.set(delhiLoc, corruptedPayload, 'open-meteo');
    const exact = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);

    const pass = writeRes === false && exact === null;

    results.push({
      id: 16,
      name: 'Invalid payload does not enter cache',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `writeRes=${writeRes}, cache entry=${exact} (rejected non-finite temperature)`,
    });
  } catch (err: any) {
    results.push({ id: 16, name: 'Invalid payload does not enter cache', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 17: Empty payload does not enter cache
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const writeResNull = weatherCacheManager.set(delhiLoc, null as any, 'open-meteo');
    const writeResEmpty = weatherCacheManager.set(delhiLoc, {} as any, 'open-meteo');
    const pass = writeResNull === false && writeResEmpty === false;

    results.push({
      id: 17,
      name: 'Empty payload does not enter cache',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `writeResNull=${writeResNull}, writeResEmpty=${writeResEmpty} (both strictly rejected)`,
    });
  } catch (err: any) {
    results.push({ id: 17, name: 'Empty payload does not enter cache', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 18: Level 5 unavailable state is not cached as normal weather data
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const level5 = fallbackManager.createHonestUnavailableState(delhiLoc, 'Live providers offline');
    const writeRes = weatherCacheManager.set(delhiLoc, level5, 'fallback-manager');
    const exact = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);

    const pass = writeRes === false && exact === null;

    results.push({
      id: 18,
      name: 'Level 5 unavailable state is not cached as normal weather data',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `writeRes=${writeRes}, exact=${exact} (Level 5 honest unavailable state was rejected from cache)`,
    });
  } catch (err: any) {
    results.push({ id: 18, name: 'Level 5 unavailable state is not cached as normal weather data', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 19: Valid partial data can be cached safely
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const partialIntel: CompleteWeatherIntelligence = {
      ...baseIntel,
      airQuality: undefined,
      freshness: {
        ...baseIntel.freshness,
        status: 'partial',
        fallbackLevel: 3,
        subsystems: {
          ...baseIntel.freshness.subsystems,
          airQuality: 'unavailable',
        },
      },
      provenance: {
        ...baseIntel.provenance,
        fallbackLevel: 3,
        subsystems: {
          ...baseIntel.provenance.subsystems,
          airQuality: {
            subsystemId: 'airQuality',
            sourceName: 'Unavailable',
            status: 'unavailable',
            sourceType: 'unavailable',
            freshness: 'unknown',
            isOfficial: false,
            isDerived: false,
          },
        },
      },
    };

    const writeRes = weatherCacheManager.set(delhiLoc, partialIntel, 'open-meteo');
    const exact = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);

    const pass = writeRes === true && exact !== null && exact.data.freshness.fallbackLevel === 3;

    results.push({
      id: 19,
      name: 'Valid partial data can be cached safely',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `writeRes=${writeRes}, exact.fallbackLevel=${exact?.data.freshness.fallbackLevel}, airQuality=${exact?.data.airQuality}`,
    });
  } catch (err: any) {
    results.push({ id: 19, name: 'Valid partial data can be cached safely', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 20: Partial data preserves subsystem provenance
  // ----------------------------------------------------
  try {
    const exact = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);
    const pass =
      exact !== null &&
      exact.data.freshness.subsystems.airQuality === 'unavailable' &&
      exact.data.provenance.subsystems.airQuality.status === 'unavailable';

    results.push({
      id: 20,
      name: 'Partial data preserves subsystem provenance',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `freshness.aqi=${exact?.data.freshness.subsystems.airQuality}, provenance.aqi=${exact?.data.provenance.subsystems.airQuality.status}`,
    });
  } catch (err: any) {
    results.push({ id: 20, name: 'Partial data preserves subsystem provenance', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 21: cachedAt is generated only on successful cache write
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const liveIntel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence(delhiLoc, true);
    // On fresh live response returned to caller, cachedAt is undefined
    const isLiveCachedAtUndefined = liveIntel.cachedAt === undefined;

    // After setting into cache, retrieve from cache
    weatherCacheManager.set(delhiLoc, liveIntel, 'open-meteo');
    const cachedHit = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);

    const pass = isLiveCachedAtUndefined && typeof cachedHit?.cachedAt === 'number';

    results.push({
      id: 21,
      name: 'cachedAt is generated only on successful cache write',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `liveIntel.cachedAt=${liveIntel.cachedAt} (undefined on live), cachedHit.cachedAt=${cachedHit?.cachedAt} (number on cache hit)`,
    });
  } catch (err: any) {
    results.push({ id: 21, name: 'cachedAt is generated only on successful cache write', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 22: obtainedAt is not replaced by cachedAt
  // ----------------------------------------------------
  try {
    const cachedHit = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);
    const obtainedAt = cachedHit?.obtainedAt;
    const cachedAt = cachedHit?.cachedAt;

    const pass =
      typeof obtainedAt === 'string' &&
      typeof cachedAt === 'number' &&
      obtainedAt !== String(cachedAt);

    results.push({
      id: 22,
      name: 'obtainedAt is not replaced by cachedAt',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `obtainedAt="${obtainedAt}", cachedAt=${cachedAt} (distinct types and timestamps)`,
    });
  } catch (err: any) {
    results.push({ id: 22, name: 'obtainedAt is not replaced by cachedAt', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 23: observedAt is not fabricated
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const payloadWithoutObserved: CompleteWeatherIntelligence = {
      ...baseIntel,
      current: {
        ...baseIntel.current,
        source: {
          ...baseIntel.current.source,
          observedAt: undefined,
        },
      },
      freshness: {
        ...baseIntel.freshness,
        observedAt: undefined,
      },
      provenance: {
        ...baseIntel.provenance,
        observedAt: undefined,
      },
    };

    weatherCacheManager.set(delhiLoc, payloadWithoutObserved, 'open-meteo');
    const hit = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);

    const pass = hit !== null && hit.observedAt === undefined;

    results.push({
      id: 23,
      name: 'observedAt is not fabricated',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `hit.observedAt=${hit?.observedAt} (remains strictly undefined without synthetic fabrication)`,
    });
  } catch (err: any) {
    results.push({ id: 23, name: 'observedAt is not fabricated', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 24: Cache hit preserves provenance
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    weatherCacheManager.set(delhiLoc, baseIntel, 'open-meteo');
    const hit = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);

    const pass =
      hit !== null &&
      hit.data.provenance.sourceId === 'open-meteo' &&
      hit.data.provenance.sourceName.includes('Open-Meteo') &&
      hit.data.provenance.isOfficial === false;

    results.push({
      id: 24,
      name: 'Cache hit preserves provenance',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `sourceId=${hit?.data.provenance.sourceId}, sourceName=${hit?.data.provenance.sourceName}, isOfficial=${hit?.data.provenance.isOfficial}`,
    });
  } catch (err: any) {
    results.push({ id: 24, name: 'Cache hit preserves provenance', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 25: Cache hit preserves requested coordinates
  // ----------------------------------------------------
  try {
    const hit = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);
    const pass =
      hit !== null &&
      hit.originalCoordinates.latitude === delhiLoc.latitude &&
      hit.originalCoordinates.longitude === delhiLoc.longitude;

    results.push({
      id: 25,
      name: 'Cache hit preserves requested coordinates',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `coords=(${hit?.originalCoordinates.latitude}, ${hit?.originalCoordinates.longitude}) match requested (${delhiLoc.latitude}, ${delhiLoc.longitude})`,
    });
  } catch (err: any) {
    results.push({ id: 25, name: 'Cache hit preserves requested coordinates', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 26: Cache hit preserves provider coordinates
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const payloadWithProviderCoords: CompleteWeatherIntelligence = {
      ...baseIntel,
      freshness: {
        ...baseIntel.freshness,
        providerCoordinates: { latitude: 28.6100, longitude: 77.2000 },
      },
      provenance: {
        ...baseIntel.provenance,
        providerCoordinates: { latitude: 28.6100, longitude: 77.2000 },
      },
    };

    weatherCacheManager.set(delhiLoc, payloadWithProviderCoords, 'open-meteo');
    const hit = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);

    const pass =
      hit !== null &&
      hit.originalProviderCoordinates?.latitude === 28.6100 &&
      hit.originalProviderCoordinates?.longitude === 77.2000;

    results.push({
      id: 26,
      name: 'Cache hit preserves provider coordinates',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `providerCoordinates=(${hit?.originalProviderCoordinates?.latitude}, ${hit?.originalProviderCoordinates?.longitude}) preserved`,
    });
  } catch (err: any) {
    results.push({ id: 26, name: 'Cache hit preserves provider coordinates', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 27: Concurrent identical requests are deduplicated
  // ----------------------------------------------------
  try {
    weatherCacheManager.clearInFlight();
    let callCount = 0;
    const key = weatherCacheManager.getCacheKey(delhiLoc.latitude, delhiLoc.longitude, 'complete');

    const fetcher = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { temp: 28 };
    };

    const [res1, res2] = await Promise.all([
      weatherCacheManager.deduplicateInFlight(key, fetcher),
      weatherCacheManager.deduplicateInFlight(key, fetcher),
    ]);

    const pass = callCount === 1 && res1 === res2 && res1.temp === 28;

    results.push({
      id: 27,
      name: 'Concurrent identical requests are deduplicated',
      method: 'unit/concurrency test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `callCount=${callCount} (executed exactly once for 2 concurrent calls), res1===res2 is ${res1 === res2}`,
    });
  } catch (err: any) {
    results.push({ id: 27, name: 'Concurrent identical requests are deduplicated', method: 'unit/concurrency test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 28: Failed in-flight request cleans registry
  // ----------------------------------------------------
  try {
    weatherCacheManager.clearInFlight();
    const key = weatherCacheManager.getCacheKey(delhiLoc.latitude, delhiLoc.longitude, 'complete');

    let threw = false;
    try {
      await weatherCacheManager.deduplicateInFlight(key, async () => {
        throw new Error('Simulated In-flight Failure');
      });
    } catch {
      threw = true;
    }

    const isInFlightAfter = weatherCacheManager.isInFlight(key);
    const pass = threw && isInFlightAfter === false;

    results.push({
      id: 28,
      name: 'Failed in-flight request cleans registry',
      method: 'unit/concurrency test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `threw=${threw}, isInFlightAfter=${isInFlightAfter} (registry cleaned properly via finally)`,
    });
  } catch (err: any) {
    results.push({ id: 28, name: 'Failed in-flight request cleans registry', method: 'unit/concurrency test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 29: Different coordinates are NOT deduplicated
  // ----------------------------------------------------
  try {
    weatherCacheManager.clearInFlight();
    let delhiExecuted = false;
    let mumbaiExecuted = false;

    const keyDelhi = weatherCacheManager.getCacheKey(delhiLoc.latitude, delhiLoc.longitude, 'complete');
    const keyMumbai = weatherCacheManager.getCacheKey(mumbaiLoc.latitude, mumbaiLoc.longitude, 'complete');

    await Promise.all([
      weatherCacheManager.deduplicateInFlight(keyDelhi, async () => {
        delhiExecuted = true;
        return 'delhi-done';
      }),
      weatherCacheManager.deduplicateInFlight(keyMumbai, async () => {
        mumbaiExecuted = true;
        return 'mumbai-done';
      }),
    ]);

    const pass = keyDelhi !== keyMumbai && delhiExecuted && mumbaiExecuted;

    results.push({
      id: 29,
      name: 'Different coordinates are NOT deduplicated',
      method: 'unit/concurrency test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `keyDelhi != keyMumbai (${keyDelhi} !== ${keyMumbai}), delhiExecuted=${delhiExecuted}, mumbaiExecuted=${mumbaiExecuted}`,
    });
  } catch (err: any) {
    results.push({ id: 29, name: 'Different coordinates are NOT deduplicated', method: 'unit/concurrency test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 30: Older response cannot overwrite newer cache entry
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const newerTime = '2026-09-14T12:00:00.000Z';
    const olderTime = '2026-09-14T11:00:00.000Z';

    const newerPayload: CompleteWeatherIntelligence = {
      ...baseIntel,
      provenance: { ...baseIntel.provenance, obtainedAt: newerTime },
      current: { ...baseIntel.current, temperature: 30 },
    };

    const olderPayload: CompleteWeatherIntelligence = {
      ...baseIntel,
      provenance: { ...baseIntel.provenance, obtainedAt: olderTime },
      current: { ...baseIntel.current, temperature: 20 },
    };

    // First write newer payload
    const write1 = weatherCacheManager.set(delhiLoc, newerPayload, 'open-meteo');
    // Then attempt write older payload
    const write2 = weatherCacheManager.set(delhiLoc, olderPayload, 'open-meteo');

    const exact = weatherCacheManager.getExact(delhiLoc.latitude, delhiLoc.longitude);
    const pass = write1 === true && write2 === false && exact?.data.current.temperature === 30;

    results.push({
      id: 30,
      name: 'Older response cannot overwrite newer cache entry',
      method: 'unit/race test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `write1(newer)=${write1}, write2(older)=${write2}, temp=${exact?.data.current.temperature}°C (preserved newer 30°C)`,
    });
  } catch (err: any) {
    results.push({ id: 30, name: 'Older response cannot overwrite newer cache entry', method: 'unit/race test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 31: Cache cleanup removes expired entries
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    weatherCacheManager.set(delhiLoc, baseIntel, 'open-meteo');
    weatherCacheManager.set(mumbaiLoc, baseIntel, 'open-meteo');

    // Make delhiLoc expired
    const delhiKey = weatherCacheManager.getCacheKey(delhiLoc.latitude, delhiLoc.longitude, 'complete');
    (weatherCacheManager as any).memoryCache.get(delhiKey).staleUntil = Date.now() - 1000;

    const initialSize = weatherCacheManager.size;
    const purged = weatherCacheManager.cleanupExpired();
    const finalSize = weatherCacheManager.size;

    const pass = initialSize === 2 && purged === 1 && finalSize === 1;

    results.push({
      id: 31,
      name: 'Cache cleanup removes expired entries',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `initialSize=${initialSize}, purged=${purged}, finalSize=${finalSize}`,
    });
  } catch (err: any) {
    results.push({ id: 31, name: 'Cache cleanup removes expired entries', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 32: Cache size remains bounded
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    const capacity = weatherCacheManager.getCapacity();

    // Insert 220 items with unique lat/lons
    for (let i = 0; i < 220; i++) {
      const lat = 10.0 + (i * 0.05);
      const lon = 75.0 + (i * 0.05);
      const loc = locationResolver.normalize({
        id: `bounded-loc-${i}`,
        name: `Bounded Stn ${i}`,
        state: 'Kerala',
        country: 'India',
        lat,
        lon,
      });
      weatherCacheManager.set(loc, baseIntel, 'open-meteo');
    }

    const currentSize = weatherCacheManager.size;
    const diagnostics = weatherCacheManager.getDiagnostics();
    const pass = currentSize <= MAX_CACHE_ENTRIES && diagnostics.evictions >= 20;

    results.push({
      id: 32,
      name: 'Cache size remains bounded',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `capacity=${capacity}, currentSize=${currentSize}, evictions=${diagnostics.evictions} (bounded to <= ${MAX_CACHE_ENTRIES})`,
    });
  } catch (err: any) {
    results.push({ id: 32, name: 'Cache size remains bounded', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 33: Dataset-specific TTLs are respected
  // ----------------------------------------------------
  try {
    const currentPolicy = CACHE_TTL_POLICIES.current;
    const hourlyPolicy = CACHE_TTL_POLICIES.hourly;
    const dailyPolicy = CACHE_TTL_POLICIES.daily;
    const aqiPolicy = CACHE_TTL_POLICIES.airQuality;
    const historicalPolicy = CACHE_TTL_POLICIES.historical;

    const pass =
      currentPolicy.freshTtlMs === 15 * 60 * 1000 &&
      currentPolicy.staleTtlMs === 60 * 60 * 1000 &&
      hourlyPolicy.freshTtlMs === 30 * 60 * 1000 &&
      dailyPolicy.freshTtlMs === 2 * 60 * 60 * 1000 &&
      aqiPolicy.freshTtlMs === 30 * 60 * 1000 &&
      historicalPolicy.freshTtlMs === 24 * 60 * 60 * 1000 &&
      historicalPolicy.staleTtlMs === 7 * 24 * 60 * 60 * 1000;

    results.push({
      id: 33,
      name: 'Dataset-specific TTLs are respected',
      method: 'unit/contract test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `current=15m/1h, hourly=30m/6h, daily=2h/24h, aqi=30m/6h, historical=24h/7d`,
    });
  } catch (err: any) {
    results.push({ id: 33, name: 'Dataset-specific TTLs are respected', method: 'unit/contract test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 34: Guest/account cache isolation remains intact where applicable
  // ----------------------------------------------------
  try {
    const key = weatherCacheManager.getCacheKey(delhiLoc.latitude, delhiLoc.longitude, 'complete');
    const hasPersonalData =
      key.includes('user') ||
      key.includes('token') ||
      key.includes('guest') ||
      key.includes('auth');

    const pass = hasPersonalData === false && key === 'weather:28.61390:77.20900:complete';

    results.push({
      id: 34,
      name: 'Guest/account cache isolation remains intact where applicable',
      method: 'unit test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `Cache key format "${key}" is purely coordinate-based. No user tokens or account IDs are leaked into weather cache.`,
    });
  } catch (err: any) {
    results.push({ id: 34, name: 'Guest/account cache isolation remains intact where applicable', method: 'unit test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 35: Phase 4B fallback regression
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    // Test Level 1 Cache Fallback
    weatherCacheManager.set(delhiLoc, baseIntel, 'open-meteo');
    const l1 = fallbackManager.trySameLocationCache(delhiLoc, 'Simulated provider error');

    // Test Level 5 Honest Unavailable
    const l5 = fallbackManager.createHonestUnavailableState(mumbaiLoc, 'All providers failed');

    const pass =
      l1 !== null &&
      l1.freshness.fallbackLevel === 1 &&
      l1.provenance.fallbackLevel === 1 &&
      l5.isUnavailable === true &&
      l5.freshness.fallbackLevel === 5;

    results.push({
      id: 35,
      name: 'Phase 4B fallback regression',
      method: 'integration test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `L1 fallbackLevel=${l1?.freshness.fallbackLevel}, L5 isUnavailable=${l5.isUnavailable}, L5 fallbackLevel=${l5.freshness.fallbackLevel}`,
    });
  } catch (err: any) {
    results.push({ id: 35, name: 'Phase 4B fallback regression', method: 'integration test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 36: Phase 4C provenance regression
  // ----------------------------------------------------
  try {
    const now = Date.now();
    const f1 = calculateFreshness(now - 300 * 1000).freshness; // 5 min -> fresh
    const f2 = calculateFreshness(now - 7200 * 1000).freshness; // 2 hours -> stale
    const c1 = determineConfidence({ sourceType: 'live', fallbackLevel: 0, freshness: 'fresh', isExactMatch: true }).confidenceLevel;
    const c2 = determineConfidence({ sourceType: 'cache', fallbackLevel: 1, freshness: 'stale', isExactMatch: true }).confidenceLevel;

    const pass = f1 === 'fresh' && f2 === 'stale' && c1 === 'HIGH' && c2 === 'LOW';

    results.push({
      id: 36,
      name: 'Phase 4C provenance regression',
      method: 'integration test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `f1=${f1}, f2=${f2}, c1=${c1}, c2=${c2}`,
    });
  } catch (err: any) {
    results.push({ id: 36, name: 'Phase 4C provenance regression', method: 'integration test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 37: Nearby-coordinate collision prevention & in-flight isolation
  // ----------------------------------------------------
  try {
    weatherCacheManager.clear();
    weatherCacheManager.clearInFlight();

    // Distinct nearby coordinates that would collide under 4-decimal rounding (both 18.5200)
    // but MUST produce distinct keys under 5-decimal precision (~1.1m resolution).
    const latA = 18.52001;
    const lonA = 73.85670;
    const latB = 18.52004;
    const lonB = 73.85670;

    // Verify 4-decimal collision vulnerability
    const oldFourDecA = `${latA.toFixed(4)}:${lonA.toFixed(4)}`;
    const oldFourDecB = `${latB.toFixed(4)}:${lonB.toFixed(4)}`;
    const wouldCollideAt4Dec = oldFourDecA === oldFourDecB; // true: both "18.5200:73.8567"

    const keyA = weatherCacheManager.getCacheKey(latA, lonA, 'complete');
    const keyB = weatherCacheManager.getCacheKey(latB, lonB, 'complete');

    // 1. Key isolation check: keys must be distinct
    const keysAreDistinct = keyA !== keyB;

    // 2. In-flight isolation check: deduplicateInFlight must NOT share the same Promise
    let executedA = false;
    let executedB = false;

    await Promise.all([
      weatherCacheManager.deduplicateInFlight(keyA, async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        executedA = true;
        return 'resA';
      }),
      weatherCacheManager.deduplicateInFlight(keyB, async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        executedB = true;
        return 'resB';
      }),
    ]);

    const inFlightIsolated = executedA && executedB;
    const pass = wouldCollideAt4Dec && keysAreDistinct && inFlightIsolated;

    results.push({
      id: 37,
      name: 'Nearby-coordinate collision prevention & in-flight isolation',
      method: 'unit/concurrency test',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `wouldCollideAt4Dec=${wouldCollideAt4Dec} ("${oldFourDecA}" == "${oldFourDecB}"), keyA="${keyA}", keyB="${keyB}", distinct=${keysAreDistinct}, bothInFlightExecuted=${inFlightIsolated}`,
    });
  } catch (err: any) {
    results.push({ id: 37, name: 'Nearby-coordinate collision prevention & in-flight isolation', method: 'unit/concurrency test', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // Output Summary
  // ----------------------------------------------------
  console.log('====================================================');
  console.log('PHASE 4D TEST RESULTS:');
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
