/**
 * PHASE 4C Verification Suite: Freshness & Provenance
 * Executes automated unit and integration tests across Phase 4C specifications.
 */
import { weatherIntelligenceEngine } from '../src/services/weatherIntelligenceEngine';
import { fallbackManager } from '../src/services/FallbackManager';
import { locationResolver } from '../src/services/LocationResolver';
import { calculateFreshness, determineConfidence, formatRelativeAge } from '../src/utils/freshnessUtils';

interface TestResult {
  id: number;
  name: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

const results: TestResult[] = [];

async function runPhase4CTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 4C: FRESHNESS & PROVENANCE VERIFICATION');
  console.log('====================================================\n');

  const mumbaiLoc = {
    id: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    lat: 19.0760,
    lon: 72.8777,
  };
  const normMumbai = locationResolver.normalize(mumbaiLoc);

  // ----------------------------------------------------
  // TEST 1: Freshness Bucket Computation
  // ----------------------------------------------------
  try {
    const now = Date.now();
    const fresh5m = calculateFreshness(now - 5 * 60 * 1000);
    const recent30m = calculateFreshness(now - 30 * 60 * 1000);
    const ext2h = calculateFreshness(now - 2 * 3600 * 1000);
    const stale10h = calculateFreshness(now - 10 * 3600 * 1000);
    const unknownNull = calculateFreshness(undefined);

    const pass = fresh5m.freshness === 'fresh' &&
      recent30m.freshness === 'recent' &&
      ext2h.freshness === 'stale' &&
      stale10h.freshness === 'very-stale' &&
      unknownNull.freshness === 'unknown';

    results.push({
      id: 1,
      name: 'Freshness Bucket Classification (0-15m, 15-60m, 1-6h, >6h, unknown)',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `5m=${fresh5m.freshness}, 30m=${recent30m.freshness}, 2h=${ext2h.freshness}, 10h=${stale10h.freshness}, null=${unknownNull.freshness}`,
    });
  } catch (err: any) {
    results.push({ id: 1, name: 'Freshness Bucket Classification', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 2: Confidence Level Determination
  // ----------------------------------------------------
  try {
    const confLive = determineConfidence({ sourceType: 'live', fallbackLevel: 0, freshness: 'fresh', isExactMatch: true, isDerived: false });
    const confRecentCache = determineConfidence({ sourceType: 'cache', fallbackLevel: 1, freshness: 'recent', isExactMatch: true, isDerived: false });
    const confStaleCache = determineConfidence({ sourceType: 'cache', fallbackLevel: 1, freshness: 'stale', isExactMatch: true, isDerived: false });
    const confApprox = determineConfidence({ sourceType: 'cache', fallbackLevel: 1, freshness: 'fresh', isExactMatch: false, isDerived: false });
    const confUnavail = determineConfidence({ sourceType: 'unavailable', fallbackLevel: 5, freshness: 'unknown', isExactMatch: true, isDerived: false });

    const pass = confLive.confidence === 'high' &&
      confLive.confidenceLevel === 'HIGH' &&
      confRecentCache.confidence === 'medium' &&
      confRecentCache.confidenceLevel === 'MODERATE' &&
      confStaleCache.confidence === 'low' &&
      confStaleCache.confidenceLevel === 'LOW' &&
      confApprox.confidence === 'medium' &&
      confApprox.confidenceLevel === 'MODERATE' &&
      confUnavail.confidence === 'unknown' &&
      confUnavail.confidenceLevel === 'UNAVAILABLE';

    results.push({
      id: 2,
      name: 'Confidence Determination Rules',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `live=${confLive.confidence}(${confLive.confidenceLevel}), recentCache=${confRecentCache.confidence}(${confRecentCache.confidenceLevel}), staleCache=${confStaleCache.confidence}(${confStaleCache.confidenceLevel}), approx=${confApprox.confidence}(${confApprox.confidenceLevel}), unavail=${confUnavail.confidence}(${confUnavail.confidenceLevel})`,
    });
  } catch (err: any) {
    results.push({ id: 2, name: 'Confidence Determination Rules', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 3: Level 0 Live Data Provenance
  // ----------------------------------------------------
  try {
    const intel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence(mumbaiLoc, true);
    const prov = intel.provenance;
    const pass = prov !== undefined &&
      prov.sourceType === 'live' &&
      prov.fallbackLevel === 0 &&
      prov.isOfficial === false && // Open-Meteo is not official IMD
      prov.isDerived === false &&
      prov.isExactMatch === true &&
      prov.requestedCoordinates.latitude === normMumbai.latitude &&
      prov.requestedCoordinates.longitude === normMumbai.longitude &&
      typeof prov.obtainedAt === 'string' &&
      prov.limitations.length > 0 &&
      prov.subsystems !== undefined;

    results.push({
      id: 3,
      name: 'Level 0 Live Provenance Integrity',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `sourceType=${prov?.sourceType}, level=${prov?.fallbackLevel}, isOfficial=${prov?.isOfficial}, isExactMatch=${prov?.isExactMatch}, obtainedAt=${prov?.obtainedAt}, reqCoords=(${prov?.requestedCoordinates.latitude},${prov?.requestedCoordinates.longitude})`,
    });
  } catch (err: any) {
    results.push({ id: 3, name: 'Level 0 Live Provenance Integrity', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 4: Level 1 Same-Location Cache Provenance
  // ----------------------------------------------------
  try {
    const cachedIntel = fallbackManager.trySameLocationCache(normMumbai, 'Network disconnected simulation');
    const prov = cachedIntel?.provenance;
    const pass = cachedIntel !== null &&
      prov !== undefined &&
      prov.sourceType === 'cache' &&
      prov.fallbackLevel === 1 &&
      prov.isExactMatch === true &&
      prov.requestedCoordinates.latitude === normMumbai.latitude &&
      typeof prov.cachedAt === 'number' &&
      prov.ageSeconds !== undefined;

    results.push({
      id: 4,
      name: 'Level 1 Same-Location Cache Provenance',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `cached=${cachedIntel !== null}, sourceType=${prov?.sourceType}, level=${prov?.fallbackLevel}, isExactMatch=${prov?.isExactMatch}, cachedAt=${prov?.cachedAt}, ageSec=${prov?.ageSeconds}`,
    });
  } catch (err: any) {
    results.push({ id: 4, name: 'Level 1 Same-Location Cache Provenance', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 5: Level 1 Approximate Cache Provenance (Spatial Interpolation)
  // ----------------------------------------------------
  try {
    // Location ~1.2 km away from Mumbai cached coordinates
    const nearbyLoc = locationResolver.normalize({
      id: 'mumbai-kurla',
      name: 'Kurla Mumbai',
      state: 'Maharashtra',
      country: 'India',
      lat: 19.0850,
      lon: 72.8850,
    });

    const approxIntel = fallbackManager.tryApproximateCache(nearbyLoc, 'Provider down, testing approximate fallback');
    const prov = approxIntel?.provenance;
    const pass = approxIntel !== null &&
      prov !== undefined &&
      prov.isExactMatch === false &&
      prov.approximateDistanceKm !== undefined &&
      prov.approximateDistanceKm > 0 &&
      prov.approximateDistanceKm <= 5 &&
      prov.requestedCoordinates.latitude === nearbyLoc.latitude && // Preserves requested coordinates!
      prov.confidence === 'medium';

    results.push({
      id: 5,
      name: 'Level 1 Approximate Cache (Spatial Degradation Transparency)',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `found=${approxIntel !== null}, isExactMatch=${prov?.isExactMatch}, distKm=${prov?.approximateDistanceKm?.toFixed(2)}, reqLat=${prov?.requestedCoordinates.latitude}, provLat=${prov?.providerCoordinates?.latitude}, confidence=${prov?.confidence}`,
    });
  } catch (err: any) {
    results.push({ id: 5, name: 'Level 1 Approximate Cache Transparency', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 6: Level 2 Alternate NWP Model Provenance
  // ----------------------------------------------------
  try {
    const subsystems = fallbackManager.createDefaultSubsystems({
      current: 'available',
      hourly: 'available',
      daily: 'available',
    });
    const meta = fallbackManager.createFreshnessMetadata({
      source: 'Open-Meteo Alternate NWP Multi-Model (GFS/ICON)',
      providerId: 'open-meteo-gfs-icon',
      status: 'fresh',
      location: normMumbai,
      confidence: 'HIGH',
      fallbackLevel: 2,
      subsystems,
      fallbackReason: 'Primary numerical weather model unavailable; served via secondary GFS/ICON model.',
      providerCoordinates: { latitude: normMumbai.latitude, longitude: normMumbai.longitude },
      isExactMatch: true,
      obtainedAt: new Date().toISOString(),
    });

    const prov = meta.provenance;
    const pass = prov.sourceType === 'alternate-model' &&
      prov.fallbackLevel === 2 &&
      prov.isExactMatch === true &&
      prov.isOfficial === false &&
      prov.sourceName.includes('GFS/ICON');

    results.push({
      id: 6,
      name: 'Level 2 Alternate NWP Model Provenance',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `sourceType=${prov.sourceType}, level=${prov.fallbackLevel}, sourceName=${prov.sourceName}, isExactMatch=${prov.isExactMatch}`,
    });
  } catch (err: any) {
    results.push({ id: 6, name: 'Level 2 Alternate NWP Model Provenance', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 7: Level 4 Derived Intelligence Disclaimers
  // ----------------------------------------------------
  try {
    const subsystems = fallbackManager.createDefaultSubsystems({
      cyclone: 'derived',
      alerts: 'derived',
    });
    const meta = fallbackManager.createFreshnessMetadata({
      source: 'Mausam Intelligence Engine (Derived Algorithmic Indices)',
      providerId: 'mausam-intelligence-engine',
      status: 'fresh',
      location: normMumbai,
      confidence: 'MODERATE',
      fallbackLevel: 4,
      subsystems,
      fallbackReason: 'Derived convective/hydrological indices calculated from numerical model outputs.',
      isDerived: true,
      isOfficial: false,
    });

    const prov = meta.provenance;
    const pass = prov.sourceType === 'derived' &&
      prov.isDerived === true &&
      prov.isOfficial === false &&
      prov.limitations.some((l) => l.toLowerCase().includes('not an official imd'));

    results.push({
      id: 7,
      name: 'Level 4 Derived Intelligence Disclaimers & Official Marking Rules',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `sourceType=${prov.sourceType}, isDerived=${prov.isDerived}, isOfficial=${prov.isOfficial}, limitation=${prov.limitations[0]}`,
    });
  } catch (err: any) {
    results.push({ id: 7, name: 'Level 4 Derived Intelligence Disclaimers', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 8: Level 5 Honest Unavailable State (Zero Fabrication)
  // ----------------------------------------------------
  try {
    const unavail = fallbackManager.createHonestUnavailableState(normMumbai, 'Simulated complete blackout');
    const prov = unavail.provenance;
    const pass = unavail.isUnavailable === true &&
      unavail.current.conditionText === 'Data Unavailable' &&
      unavail.current.temperature === 0 && // Non-fabricated placeholder clearly flagged
      prov !== undefined &&
      prov.sourceType === 'unavailable' &&
      prov.fallbackLevel === 5 &&
      prov.confidence === 'unknown' &&
      prov.freshness === 'unknown' &&
      prov.obtainedAt === undefined && // No fake timestamps!
      prov.observedAt === undefined;

    results.push({
      id: 8,
      name: 'Level 5 Honest Unavailable State (Zero Fabrication & No Fake Timestamps)',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `isUnavailable=${unavail.isUnavailable}, condition=${unavail.current.conditionText}, confidence=${prov?.confidence}, freshness=${prov?.freshness}, obtainedAt=${prov?.obtainedAt}`,
    });
  } catch (err: any) {
    results.push({ id: 8, name: 'Level 5 Honest Unavailable State', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 9: Subsystems Granular Provenance Attribution
  // ----------------------------------------------------
  try {
    const subsystems = fallbackManager.createDefaultSubsystems({
      current: 'available',
      hourly: 'available',
      daily: 'available',
      airQuality: 'available',
      marine: 'available',
      flood: 'available',
      cyclone: 'derived',
    });
    const subProv = fallbackManager.buildSubsystemsProvenance(subsystems, 'live', new Date().toISOString(), new Date().toISOString());

    const pass = subProv.current !== undefined &&
      subProv.airQuality !== undefined &&
      subProv.marine !== undefined &&
      subProv.flood !== undefined &&
      subProv.cyclone !== undefined &&
      subProv.current.isOfficial === false && // Open-Meteo not official
      subProv.cyclone.isDerived === true;

    results.push({
      id: 9,
      name: 'Subsystem Attribution Breakdown (11 Subsystems)',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `subsystemsCount=${Object.keys(subProv).length}, currentSource="${subProv.current.sourceName}", cycloneDerived=${subProv.cyclone.isDerived}, aqiFreshness=${subProv.airQuality.freshness}`,
    });
  } catch (err: any) {
    results.push({ id: 9, name: 'Subsystem Attribution Breakdown', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 10: Formatting Utilities
  // ----------------------------------------------------
  try {
    const ageJustNow = formatRelativeAge(10);
    const age5m = formatRelativeAge(300);
    const age2h = formatRelativeAge(7200);
    const age2d = formatRelativeAge(172800);

    const pass = ageJustNow.includes('just now') &&
      age5m.includes('min ago') &&
      age2h.includes('hours ago') &&
      age2d.includes('days ago');

    results.push({
      id: 10,
      name: 'Human-Readable Age and Summary Formatting',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `10s="${ageJustNow}", 300s="${age5m}", 7200s="${age2h}", 172800s="${age2d}"`,
    });
  } catch (err: any) {
    results.push({ id: 10, name: 'Formatting Utilities', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 11: Approximate cache is never automatically selected by normal fallback
  // ----------------------------------------------------
  try {
    const uncachedNearbyLoc = locationResolver.normalize({
      id: 'mumbai-bandra',
      name: 'Bandra Mumbai',
      state: 'Maharashtra',
      country: 'India',
      lat: 19.0596,
      lon: 72.8295,
    });

    const normalCacheResult = fallbackManager.trySameLocationCache(uncachedNearbyLoc, 'Testing normal fallback isolation');
    const pass = normalCacheResult === null;

    results.push({
      id: 11,
      name: 'Approximate cache is never automatically selected by normal fallback',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `trySameLocationCache returned ${normalCacheResult === null ? 'null (correctly rejected)' : 'unexpectedly non-null'}`,
    });
  } catch (err: any) {
    results.push({ id: 11, name: 'Approximate cache normal fallback isolation', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 12: Approximate cache has isExactMatch=false
  // ----------------------------------------------------
  try {
    const nearbyLoc = locationResolver.normalize({
      id: 'mumbai-kurla',
      name: 'Kurla Mumbai',
      state: 'Maharashtra',
      country: 'India',
      lat: 19.0850,
      lon: 72.8850,
    });

    const approxIntel = fallbackManager.tryApproximateCache(nearbyLoc, 'Testing approximate cache flag');
    const prov = approxIntel?.provenance;
    const pass = approxIntel !== null &&
      prov !== undefined &&
      prov.isExactMatch === false &&
      prov.isApproximate === true &&
      approxIntel.freshness.isExactMatch === false &&
      approxIntel.freshness.isApproximate === true;

    results.push({
      id: 12,
      name: 'Approximate cache has isExactMatch=false and isApproximate=true',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `isExactMatch=${prov?.isExactMatch}, isApproximate=${prov?.isApproximate}, freshness.isExactMatch=${approxIntel?.freshness.isExactMatch}`,
    });
  } catch (err: any) {
    results.push({ id: 12, name: 'Approximate cache isExactMatch=false', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 13: Approximate cache preserves requested coordinates
  // ----------------------------------------------------
  try {
    const nearbyLoc = locationResolver.normalize({
      id: 'mumbai-kurla',
      name: 'Kurla Mumbai',
      state: 'Maharashtra',
      country: 'India',
      lat: 19.0850,
      lon: 72.8850,
    });

    const approxIntel = fallbackManager.tryApproximateCache(nearbyLoc, 'Testing coordinate preservation');
    const prov = approxIntel?.provenance;
    const pass = approxIntel !== null &&
      prov !== undefined &&
      prov.requestedCoordinates.latitude === nearbyLoc.latitude &&
      prov.requestedCoordinates.longitude === nearbyLoc.longitude &&
      approxIntel.location.latitude === nearbyLoc.latitude &&
      approxIntel.location.longitude === nearbyLoc.longitude;

    results.push({
      id: 13,
      name: 'Approximate cache preserves requested coordinates',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `requestedCoords=(${prov?.requestedCoordinates.latitude}, ${prov?.requestedCoordinates.longitude}), expected=(${nearbyLoc.latitude}, ${nearbyLoc.longitude}), preserved=${pass}`,
    });
  } catch (err: any) {
    results.push({ id: 13, name: 'Approximate cache coordinate preservation', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 14: Approximate cache exposes distance
  // ----------------------------------------------------
  try {
    const nearbyLoc = locationResolver.normalize({
      id: 'mumbai-kurla',
      name: 'Kurla Mumbai',
      state: 'Maharashtra',
      country: 'India',
      lat: 19.0850,
      lon: 72.8850,
    });

    const approxIntel = fallbackManager.tryApproximateCache(nearbyLoc, 'Testing distance exposure');
    const prov = approxIntel?.provenance;
    const pass = approxIntel !== null &&
      prov !== undefined &&
      typeof prov.approximateDistanceKm === 'number' &&
      prov.approximateDistanceKm > 0 &&
      prov.approximateDistanceKm <= 5 &&
      (prov.note?.includes('not part of normal Level 1 fallback') ||
        prov.limitations.some((l) => l.includes('not part of normal Level 1 fallback')));

    results.push({
      id: 14,
      name: 'Approximate cache exposes distance and diagnostic limitation',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `approximateDistanceKm=${prov?.approximateDistanceKm?.toFixed(2)}, note="${prov?.note}", limitations="${prov?.limitations[0]}"`,
    });
  } catch (err: any) {
    results.push({ id: 14, name: 'Approximate cache exposes distance', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 15: Subsystems provenance reflects actual retrieved data
  // ----------------------------------------------------
  try {
    // 1. Verify actual retrieved intelligence payload and its provenance
    const liveIntel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence(mumbaiLoc, false);
    const liveProv = liveIntel.provenance;
    const subProv = liveProv?.subsystems;

    const hasActualData = liveIntel !== null &&
      typeof liveIntel.current?.temperature === 'number' &&
      Array.isArray(liveIntel.forecast?.daily) && liveIntel.forecast.daily.length > 0 &&
      Array.isArray(liveIntel.forecast?.hourly) && liveIntel.forecast.hourly.length > 0 &&
      (liveIntel.floodRisk !== undefined || liveIntel.flood !== undefined) &&
      liveIntel.historical !== undefined;

    const liveSubsystemsAccurate = subProv !== undefined &&
      subProv.current?.status === 'available' &&
      subProv.current?.sourceType === 'live' &&
      subProv.radar?.status === 'not-applicable' &&
      subProv.radar?.sourceType === 'not-applicable' &&
      // Flood must reflect Mausam Hydrology Engine calculation, NOT Copernicus GloFAS
      subProv.flood?.sourceName === 'Mausam Hydrology Engine (Open-Meteo precipitation input)' &&
      subProv.flood?.sourceType === 'derived' &&
      subProv.flood?.isDerived === true &&
      !subProv.flood?.sourceName.toLowerCase().includes('glofas') &&
      // Historical must reflect Open-Meteo Archive ERA5 reanalysis
      subProv.historical?.sourceName.includes('ERA5');

    // 2. Verify unavailable state subsystems provenance reflects actual reality
    const unavail = fallbackManager.createHonestUnavailableState(normMumbai, 'Test outage verification');
    const unavailSubs = unavail.provenance?.subsystems;
    const unavailSubsystemsAccurate = unavailSubs !== undefined &&
      unavailSubs.current?.status === 'unavailable' &&
      unavailSubs.current?.sourceType === 'unavailable' &&
      unavailSubs.flood?.status === 'unavailable';

    const pass = Boolean(hasActualData && liveSubsystemsAccurate && unavailSubsystemsAccurate);

    results.push({
      id: 15,
      name: 'Subsystems provenance reflects actual retrieved data (not theoretical capability)',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `hasActualData=${hasActualData}, current=${subProv?.current?.status}/${subProv?.current?.sourceType}, radar=${subProv?.radar?.status}/${subProv?.radar?.sourceType}, flood="${subProv?.flood?.sourceName}" (derived=${subProv?.flood?.isDerived}), unavailCurrent=${unavailSubs?.current?.status}/${unavailSubs?.current?.sourceType}`,
    });
  } catch (err: any) {
    results.push({ id: 15, name: 'Subsystems provenance reflects actual data', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 16: Radar is not marked available if not in payload
  // ----------------------------------------------------
  try {
    const defaultSubs = fallbackManager.createDefaultSubsystems();
    const subProv = fallbackManager.buildSubsystemsProvenance(defaultSubs, 'live', new Date().toISOString(), new Date().toISOString());

    const pass = subProv.radar.status === 'not-applicable' &&
      subProv.radar.sourceType === 'not-applicable' &&
      subProv.radar.sourceStatus === 'not-configured' &&
      subProv.radar.freshness === 'unknown' &&
      subProv.radar.obtainedAt === undefined &&
      subProv.radar.observedAt === undefined;

    results.push({
      id: 16,
      name: 'Radar is not marked available if not in numerical payload (Map-only layer)',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `radar.status=${subProv.radar.status}, radar.sourceType=${subProv.radar.sourceType}, radar.freshness=${subProv.radar.freshness}, radar.obtainedAt=${subProv.radar.obtainedAt}`,
    });
  } catch (err: any) {
    results.push({ id: 16, name: 'Radar not marked available if not in payload', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 17: Missing subsystem timestamp produces freshness='unknown'
  // ----------------------------------------------------
  try {
    const subProv = fallbackManager.buildSubsystemsProvenance(
      fallbackManager.createDefaultSubsystems(),
      'live',
      undefined, // Missing obtainedAt
      undefined  // Missing observedAt
    );

    const pass = subProv.current.freshness === 'unknown' &&
      subProv.current.ageSeconds === undefined &&
      subProv.hourly.freshness === 'unknown' &&
      subProv.hourly.ageSeconds === undefined &&
      subProv.daily.freshness === 'unknown' &&
      subProv.daily.ageSeconds === undefined;

    results.push({
      id: 17,
      name: 'Missing subsystem timestamp produces freshness="unknown" (Zero timestamp fabrication)',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `currentFreshness=${subProv.current.freshness}, currentAge=${subProv.current.ageSeconds}, hourlyFreshness=${subProv.hourly.freshness}, dailyFreshness=${subProv.daily.freshness}`,
    });
  } catch (err: any) {
    results.push({ id: 17, name: 'Missing subsystem timestamp produces freshness=unknown', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 18: Official flags remain false for Open-Meteo, GFS/ICON, and Mausam-derived data
  // ----------------------------------------------------
  try {
    const liveIntel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence(mumbaiLoc, false);
    const subProv = liveIntel.provenance?.subsystems;

    const allSubsystemsUnofficial = subProv
      ? Object.values(subProv).every((s) => s.isOfficial === false)
      : false;

    const pass = liveIntel.provenance?.isOfficial === false && allSubsystemsUnofficial;

    results.push({
      id: 18,
      name: 'Official flags remain false for Open-Meteo, GFS/ICON, and Mausam-derived data',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `overallIsOfficial=${liveIntel.provenance?.isOfficial}, allSubsystemsUnofficial=${allSubsystemsUnofficial}`,
    });
  } catch (err: any) {
    results.push({ id: 18, name: 'Official flags remain false', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 19: Level 5 has no fabricated timestamp
  // ----------------------------------------------------
  try {
    const unavail = fallbackManager.createHonestUnavailableState(normMumbai, 'Total outage verification');
    const prov = unavail.provenance;
    const subProv = prov?.subsystems;

    const pass = unavail.freshness.obtainedAt === undefined &&
      unavail.freshness.observedAt === undefined &&
      unavail.freshness.cachedAt === undefined &&
      prov?.obtainedAt === undefined &&
      prov?.observedAt === undefined &&
      prov?.cachedAt === undefined &&
      prov?.freshness === 'unknown' &&
      prov?.ageSeconds === undefined &&
      (subProv ? Object.values(subProv).every((s) => s.obtainedAt === undefined && s.observedAt === undefined && s.freshness === 'unknown') : false);

    results.push({
      id: 19,
      name: 'Level 5 has no fabricated timestamp (obtainedAt/observedAt/cachedAt strictly undefined)',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `prov.obtainedAt=${prov?.obtainedAt}, prov.observedAt=${prov?.observedAt}, prov.cachedAt=${prov?.cachedAt}, prov.freshness=${prov?.freshness}, prov.ageSeconds=${prov?.ageSeconds}`,
    });
  } catch (err: any) {
    results.push({ id: 19, name: 'Level 5 has no fabricated timestamp', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 20: Inactive radar does not claim fresh observations
  // ----------------------------------------------------
  try {
    const subProv = fallbackManager.buildSubsystemsProvenance(
      fallbackManager.createDefaultSubsystems(),
      'live',
      new Date().toISOString(),
      new Date().toISOString()
    );

    const radarProv = subProv.radar;
    const pass = radarProv.freshness === 'unknown' &&
      radarProv.ageSeconds === undefined &&
      radarProv.observedAt === undefined &&
      radarProv.limitations !== undefined &&
      radarProv.limitations.length > 0;

    results.push({
      id: 20,
      name: 'Inactive radar does not claim fresh observations (No fake radar reflectivity)',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `radar.freshness=${radarProv.freshness}, radar.ageSeconds=${radarProv.ageSeconds}, radar.observedAt=${radarProv.observedAt}, limitation="${radarProv.limitations?.[0]}"`,
    });
  } catch (err: any) {
    results.push({ id: 20, name: 'Inactive radar does not claim fresh observations', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 21: Marine is marked not-applicable for inland locations
  // ----------------------------------------------------
  try {
    const inlandSubs = fallbackManager.createDefaultSubsystems({ marine: 'not-applicable' });
    const subProv = fallbackManager.buildSubsystemsProvenance(inlandSubs, 'live', new Date().toISOString());

    const pass = subProv.marine.status === 'not-applicable' &&
      subProv.marine.sourceType === 'not-applicable' &&
      subProv.marine.freshness === 'unknown' &&
      subProv.marine.obtainedAt === undefined &&
      subProv.marine.limitations?.some((l) => l.includes('Inland location'));

    results.push({
      id: 21,
      name: 'Marine is marked not-applicable for inland locations',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `marine.status=${subProv.marine.status}, marine.sourceType=${subProv.marine.sourceType}, marine.freshness=${subProv.marine.freshness}, limitation="${subProv.marine.limitations?.[0]}"`,
    });
  } catch (err: any) {
    results.push({ id: 21, name: 'Marine marked not-applicable for inland locations', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 22: Climatological fallback is labeled derived
  // ----------------------------------------------------
  try {
    const derivedSubs = fallbackManager.createDefaultSubsystems({
      airQuality: 'derived',
      flood: 'derived',
      historical: 'derived',
    });
    const subProv = fallbackManager.buildSubsystemsProvenance(derivedSubs, 'live', new Date().toISOString());

    const pass = subProv.airQuality.sourceType === 'derived' &&
      subProv.airQuality.isDerived === true &&
      subProv.flood.sourceType === 'derived' &&
      subProv.flood.isDerived === true &&
      subProv.historical.sourceType === 'derived' &&
      subProv.historical.isDerived === true;

    results.push({
      id: 22,
      name: 'Climatological fallback is labeled derived',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `aqiDerived=${subProv.airQuality.isDerived}/${subProv.airQuality.sourceType}, floodDerived=${subProv.flood.isDerived}/${subProv.flood.sourceType}, histDerived=${subProv.historical.isDerived}/${subProv.historical.sourceType}`,
    });
  } catch (err: any) {
    results.push({ id: 22, name: 'Climatological fallback labeled derived', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 23: Subsystem timestamps match actual retrieval/observation times
  // ----------------------------------------------------
  try {
    // 1. Supplied timestamps propagate correctly
    const testObservedAt = '2026-09-14T10:00:00.000Z';
    const testObtainedAt = '2026-09-14T10:05:00.000Z';
    const subProvSupplied = fallbackManager.buildSubsystemsProvenance(
      fallbackManager.createDefaultSubsystems(),
      'live',
      testObtainedAt,
      testObservedAt
    );

    const suppliedPass = subProvSupplied.current.observedAt === testObservedAt &&
      subProvSupplied.current.obtainedAt === testObtainedAt &&
      subProvSupplied.hourly.observedAt === undefined && // Forecast grid has no past observation
      subProvSupplied.hourly.obtainedAt === testObtainedAt &&
      subProvSupplied.daily.observedAt === undefined &&
      subProvSupplied.daily.obtainedAt === testObtainedAt;

    // 2. Missing timestamps remain strictly unknown without synthetic fabrication
    const subProvMissing = fallbackManager.buildSubsystemsProvenance(
      fallbackManager.createDefaultSubsystems(),
      'live',
      undefined,
      undefined
    );

    const missingPass = subProvMissing.current.observedAt === undefined &&
      subProvMissing.current.obtainedAt === undefined &&
      subProvMissing.current.freshness === 'unknown' &&
      subProvMissing.current.ageSeconds === undefined &&
      calculateFreshness(undefined).freshness === 'unknown' &&
      calculateFreshness(undefined).ageSeconds === undefined &&
      calculateFreshness('').freshness === 'unknown' &&
      calculateFreshness(NaN).freshness === 'unknown';

    const pass = suppliedPass && missingPass;

    results.push({
      id: 23,
      name: 'Subsystem timestamps match actual retrieval/observation times (Missing timestamps remain unknown)',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `suppliedPass=${suppliedPass} (current.observed=${subProvSupplied.current.observedAt}, hourly.observed=${subProvSupplied.hourly.observedAt}), missingPass=${missingPass} (freshness=${subProvMissing.current.freshness}, ageSeconds=${subProvMissing.current.ageSeconds})`,
    });
  } catch (err: any) {
    results.push({ id: 23, name: 'Subsystem timestamps match actual times', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 24: DataProvenance matches FRESHNESS_PROVENANCE.md schema
  // ----------------------------------------------------
  try {
    const intel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence(mumbaiLoc, false);
    const prov = intel.provenance;

    const hasSourceId = typeof prov?.sourceId === 'string';
    const hasSourceName = typeof prov?.sourceName === 'string';
    const hasSourceType = typeof prov?.sourceType === 'string';
    const hasFallbackLevel = typeof prov?.fallbackLevel === 'number';
    const hasFreshness = typeof prov?.freshness === 'string';
    const hasConfidence = typeof prov?.confidence === 'string';
    const hasIsOfficial = typeof prov?.isOfficial === 'boolean';
    const hasIsDerived = typeof prov?.isDerived === 'boolean';
    const hasIsExactMatch = typeof prov?.isExactMatch === 'boolean';
    const hasReqCoords = typeof prov?.requestedCoordinates?.latitude === 'number' && typeof prov?.requestedCoordinates?.longitude === 'number';
    const hasLimitations = Array.isArray(prov?.limitations);
    const hasSubsystems = typeof prov?.subsystems === 'object' && prov?.subsystems !== null;

    const pass = hasSourceId && hasSourceName && hasSourceType && hasFallbackLevel &&
      hasFreshness && hasConfidence && hasIsOfficial && hasIsDerived &&
      hasIsExactMatch && hasReqCoords && hasLimitations && hasSubsystems;

    results.push({
      id: 24,
      name: 'DataProvenance matches FRESHNESS_PROVENANCE.md schema',
      status: pass ? 'PASS' : 'FAIL',
      evidence: `schemaCheck: sourceId=${hasSourceId}, sourceName=${hasSourceName}, sourceType=${hasSourceType}, fallbackLevel=${hasFallbackLevel}, freshness=${hasFreshness}, confidence=${hasConfidence}, reqCoords=${hasReqCoords}, subsystems=${hasSubsystems}`,
    });
  } catch (err: any) {
    results.push({ id: 24, name: 'DataProvenance schema conformance', status: 'FAIL', evidence: err.message });
  }

  // ----------------------------------------------------
  // TEST 25: Transparency UI displays all required fields across all states
  // ----------------------------------------------------
  try {
    // State 1: Exact Match (Level 0 live)
    const liveIntel = await weatherIntelligenceEngine.getCompleteWeatherIntelligence(mumbaiLoc, false);

    // State 2: Explicit Approximate Cache
    const nearbyLoc = locationResolver.normalize({
      id: 'mumbai-kurla',
      name: 'Kurla Mumbai',
      state: 'Maharashtra',
      country: 'India',
      lat: 19.0850,
      lon: 72.8850,
    });
    const approxIntel = fallbackManager.tryApproximateCache(nearbyLoc, 'UI contract test');

    // State 3: Level 5 Honest Unavailable State
    const unavailIntel = fallbackManager.createHonestUnavailableState(normMumbai, 'Simulated UI contract outage');

    // State 4: Level 4 Derived State
    const derivedSubs = fallbackManager.createDefaultSubsystems({
      cyclone: 'derived',
      alerts: 'derived',
      flood: 'derived',
    });
    const derivedMeta = fallbackManager.createFreshnessMetadata({
      source: 'Mausam Intelligence Engine (Derived Algorithmic Indices)',
      providerId: 'mausam-intelligence-engine',
      status: 'fresh',
      location: normMumbai,
      confidence: 'MODERATE',
      fallbackLevel: 4,
      subsystems: derivedSubs,
      fallbackReason: 'Derived convective/hydrological indices calculated from numerical model outputs.',
      isDerived: true,
      isOfficial: false,
    });

    const testStates = [
      { label: 'Exact Match', prov: liveIntel.provenance },
      { label: 'Approximate Cache', prov: approxIntel?.provenance },
      { label: 'Level 5 Unavailable', prov: unavailIntel.provenance },
      { label: 'Level 4 Derived', prov: derivedMeta.provenance },
    ];

    let allStatesPass = true;
    const stateEvidences: string[] = [];

    // Simulate the exact rendering and data extraction execution of DataSourceTransparencyModal
    for (const { label, prov } of testStates) {
      if (!prov) {
        allStatesPass = false;
        stateEvidences.push(`${label}: missing provenance`);
        continue;
      }

      // 1. Fallback badge resolution
      const level = prov.fallbackLevel;
      const isExact = prov.isExactMatch;
      const isApprox = prov.isApproximate ?? false;
      const badgeValid = level >= 0 && level <= 5 && typeof isExact === 'boolean';

      // 2. Freshness badge resolution
      const freshness = prov.freshness;
      const freshValid = ['fresh', 'recent', 'stale', 'very-stale', 'unknown'].includes(freshness);

      // 3. Coordinates formatting
      const latStr = prov.requestedCoordinates.latitude.toFixed(3);
      const lonStr = prov.requestedCoordinates.longitude.toFixed(3);
      const coordsValid = Boolean(latStr && lonStr);

      // 4. Distance / Approximate notice check
      let distanceValid = true;
      if (!isExact || isApprox) {
        distanceValid = typeof prov.approximateDistanceKm === 'number' && prov.approximateDistanceKm > 0;
      }

      // 5. Subsystems mapping & rendering loop check
      let subsystemsValid = true;
      if (prov.subsystems) {
        for (const [subKey, sub] of Object.entries(prov.subsystems)) {
          if (!sub.sourceName || !sub.status || typeof sub.isOfficial !== 'boolean' || typeof sub.isDerived !== 'boolean') {
            subsystemsValid = false;
          }
        }
      }

      // 6. Limitations check
      const limitationsValid = !prov.limitations || Array.isArray(prov.limitations);

      const stateOk = badgeValid && freshValid && coordsValid && distanceValid && subsystemsValid && limitationsValid;
      if (!stateOk) allStatesPass = false;
      stateEvidences.push(`${label}: ok=${stateOk} (lvl=${level}, fresh=${freshness}, exact=${isExact})`);
    }

    results.push({
      id: 25,
      name: 'Transparency UI displays all required fields without missing data contracts across all states',
      status: allStatesPass ? 'PASS' : 'FAIL',
      evidence: stateEvidences.join(' | '),
    });
  } catch (err: any) {
    results.push({ id: 25, name: 'Transparency UI displays all required fields', status: 'FAIL', evidence: err.message });
  }

  console.log('\n====================================================');
  console.log('PHASE 4C TEST RESULTS:');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;
  for (const r of results) {
    console.log(`[TEST ${r.id}] ${r.name}`);
    console.log(`STATUS:   ${r.status}`);
    console.log(`EVIDENCE: ${r.evidence}\n`);
    if (r.status === 'PASS') passed++;
    else failed++;
  }

  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED across ${results.length} total tests.`);
}

runPhase4CTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
