/**
 * FallbackManager
 *
 * Implements the 6-tier resilient fallback hierarchy for MAUSAM:
 *
 * LEVEL 0: Fresh Live Data (Primary Open-Meteo)
 * LEVEL 1: Same-Location Cache (Exact coordinates / < 5km)
 * LEVEL 2: Alternate Provider (Secondary provider for same coordinates)
 * LEVEL 3: Partial Data (Merge available modules, mark failed subsystems offline)
 * LEVEL 4: Derived Intelligence (Convective, agro, air quality indices computed from available variables)
 * LEVEL 5: Honest Unavailable State (Honest disclosure with retry, NEVER substitute another location)
 *
 * CORE INTEGRITY RULE:
 * "FALLBACK MAY CHANGE THE DATA SOURCE, BUT MUST NEVER SILENTLY CHANGE THE USER'S REQUESTED LOCATION."
 */

import {
  CompleteWeatherIntelligence,
  FreshnessMetadata,
  FreshnessStatus,
  ConfidenceLevel,
  NormalizedLocation,
  SubsystemsAvailability,
  NormalizedCurrentWeather,
  NormalizedForecast,
  NormalizedAirQuality,
  NormalizedMarine,
  NormalizedFloodRisk,
  NormalizedThunderstormRisk,
  NormalizedCyclone,
  NormalizedHistorical,
  DataProvenance,
  SubsystemProvenance,
  ProvenanceSourceType,
  ProvenanceFreshness,
} from './providers/providerTypes';
import { weatherCacheManager } from './WeatherCacheManager';
import { providerHealthManager } from './ProviderHealthManager';
import {
  calculateFreshness,
  determineConfidence,
  formatProvenanceSummary,
} from '../utils/freshnessUtils';

export class FallbackManager {
  /**
   * Builds the default subsystems availability map
   */
  createDefaultSubsystems(overrides?: Partial<SubsystemsAvailability>): SubsystemsAvailability {
    return {
      current: 'available',
      hourly: 'available',
      daily: 'available',
      airQuality: 'available',
      marine: 'not-applicable',
      flood: 'available',
      radar: 'not-applicable', // Radar mosaic is interactive map layer only; not in numeric payload
      alerts: 'derived',
      cyclone: 'derived',
      historical: 'available',
      ...overrides,
    };
  }

  createDefaultSubsystemsAvailability(overrides?: Partial<SubsystemsAvailability>): SubsystemsAvailability {
    return this.createDefaultSubsystems(overrides);
  }

  /**
   * Builds independent provenance for all weather intelligence subsystems.
   * Enforces that provenance describes ACTUAL RETRIEVED DATA, not provider capability.
   * Never fabricates timestamps or claims radar observation payloads when only map tiles exist.
   */
  buildSubsystemsProvenance(
    subsystems: SubsystemsAvailability,
    overallSourceType: ProvenanceSourceType,
    obtainedAt?: string,
    observedAt?: string
  ): Record<string, SubsystemProvenance> {
    const isOffline = overallSourceType === 'unavailable';
    const retrievalTime = isOffline ? undefined : obtainedAt;

    const getSubsystemFreshness = (time?: string | number): { freshness: ProvenanceFreshness; ageSeconds?: number } => {
      if (!time || isOffline) {
        return { freshness: 'unknown', ageSeconds: undefined };
      }
      const calc = calculateFreshness(time);
      return { freshness: calc.freshness, ageSeconds: calc.ageSeconds };
    };

    const currentFresh = getSubsystemFreshness(observedAt || retrievalTime);
    const hourlyFresh = getSubsystemFreshness(retrievalTime);
    const dailyFresh = getSubsystemFreshness(retrievalTime);
    const aqiFresh = subsystems.airQuality === 'derived' || subsystems.airQuality === 'unavailable'
      ? { freshness: 'unknown' as const, ageSeconds: undefined }
      : getSubsystemFreshness(retrievalTime);
    const marineFresh = subsystems.marine === 'not-applicable' || subsystems.marine === 'unavailable'
      ? { freshness: 'unknown' as const, ageSeconds: undefined }
      : getSubsystemFreshness(retrievalTime);
    const floodFresh = subsystems.flood === 'derived' || subsystems.flood === 'unavailable'
      ? { freshness: 'unknown' as const, ageSeconds: undefined }
      : getSubsystemFreshness(retrievalTime);
    const histFresh = subsystems.historical === 'derived' || subsystems.historical === 'unavailable'
      ? { freshness: 'unknown' as const, ageSeconds: undefined }
      : getSubsystemFreshness(retrievalTime);
    const thunderstormFresh = isOffline || !retrievalTime
      ? { freshness: 'unknown' as const, ageSeconds: undefined }
      : getSubsystemFreshness(retrievalTime);
    const alertsFresh = isOffline || !retrievalTime
      ? { freshness: 'unknown' as const, ageSeconds: undefined }
      : getSubsystemFreshness(retrievalTime);
    const cycloneFresh = isOffline || !retrievalTime
      ? { freshness: 'unknown' as const, ageSeconds: undefined }
      : getSubsystemFreshness(retrievalTime);

    return {
      current: {
        subsystemId: 'current',
        sourceName: overallSourceType === 'alternate-model'
          ? 'Open-Meteo GFS/ICON Multi-Model'
          : 'Open-Meteo Global Numerical Models',
        sourceType: isOffline || subsystems.current === 'unavailable' ? 'unavailable' : overallSourceType,
        obtainedAt: isOffline || subsystems.current === 'unavailable' ? undefined : retrievalTime,
        observedAt: isOffline || subsystems.current === 'unavailable' ? undefined : observedAt,
        freshness: subsystems.current === 'unavailable' ? 'unknown' : currentFresh.freshness,
        ageSeconds: subsystems.current === 'unavailable' ? undefined : currentFresh.ageSeconds,
        status: subsystems.current,
        sourceStatus: subsystems.current === 'available' ? 'available' : 'unavailable',
        isOfficial: false,
        isDerived: false,
      },
      hourly: {
        subsystemId: 'hourly',
        sourceName: overallSourceType === 'alternate-model'
          ? 'Open-Meteo GFS/ICON Multi-Model'
          : 'Open-Meteo Hourly Numerical Forecast',
        sourceType: isOffline || subsystems.hourly === 'unavailable' ? 'unavailable' : overallSourceType,
        obtainedAt: isOffline || subsystems.hourly === 'unavailable' ? undefined : retrievalTime,
        observedAt: undefined, // Numerical forecast grid; not a sensor observation
        freshness: subsystems.hourly === 'unavailable' ? 'unknown' : hourlyFresh.freshness,
        ageSeconds: subsystems.hourly === 'unavailable' ? undefined : hourlyFresh.ageSeconds,
        status: subsystems.hourly,
        sourceStatus: subsystems.hourly === 'available' ? 'available' : 'unavailable',
        isOfficial: false,
        isDerived: false,
      },
      daily: {
        subsystemId: 'daily',
        sourceName: overallSourceType === 'alternate-model'
          ? 'Open-Meteo GFS/ICON Multi-Model'
          : 'Open-Meteo 10-Day Numerical Forecast',
        sourceType: isOffline || subsystems.daily === 'unavailable' ? 'unavailable' : overallSourceType,
        obtainedAt: isOffline || subsystems.daily === 'unavailable' ? undefined : retrievalTime,
        observedAt: undefined, // Multi-day numerical forecast; not a sensor observation
        freshness: subsystems.daily === 'unavailable' ? 'unknown' : dailyFresh.freshness,
        ageSeconds: subsystems.daily === 'unavailable' ? undefined : dailyFresh.ageSeconds,
        status: subsystems.daily,
        sourceStatus: subsystems.daily === 'available' ? 'available' : 'unavailable',
        isOfficial: false,
        isDerived: false,
      },
      airQuality: {
        subsystemId: 'airQuality',
        sourceName: isOffline || subsystems.airQuality === 'unavailable'
          ? 'Air Quality Monitoring Station (Unavailable)'
          : subsystems.airQuality === 'derived'
          ? 'Atmospheric Chemistry Model (Derived estimate)'
          : 'Open-Meteo Atmospheric Chemistry & CPCB NAQI algorithm',
        sourceType: isOffline || subsystems.airQuality === 'unavailable'
          ? 'unavailable'
          : subsystems.airQuality === 'derived'
          ? 'derived'
          : overallSourceType,
        obtainedAt: isOffline || subsystems.airQuality === 'unavailable' ? undefined : retrievalTime,
        observedAt: undefined,
        freshness: aqiFresh.freshness,
        ageSeconds: aqiFresh.ageSeconds,
        status: subsystems.airQuality,
        sourceStatus: subsystems.airQuality === 'available' || subsystems.airQuality === 'derived' ? 'available' : 'unavailable',
        isOfficial: false,
        isDerived: true, // CPCB NAQI conversion is derived
        limitations: isOffline || subsystems.airQuality === 'unavailable'
          ? ['Air quality observation telemetry is currently unavailable.']
          : subsystems.airQuality === 'derived'
          ? ['Atmospheric chemistry model estimate; live station telemetry was not retrieved.']
          : undefined,
      },
      marine: {
        subsystemId: 'marine',
        sourceName: 'Copernicus Marine Environment Monitoring Service',
        sourceType: subsystems.marine === 'not-applicable' ? 'not-applicable' : isOffline || subsystems.marine === 'unavailable' ? 'unavailable' : overallSourceType,
        obtainedAt: subsystems.marine === 'not-applicable' || subsystems.marine === 'unavailable' || isOffline ? undefined : retrievalTime,
        observedAt: undefined,
        freshness: marineFresh.freshness,
        ageSeconds: marineFresh.ageSeconds,
        status: subsystems.marine,
        sourceStatus: subsystems.marine === 'available' ? 'available' : 'unavailable',
        isOfficial: false,
        isDerived: false,
        limitations: subsystems.marine === 'not-applicable'
          ? ['Inland location; marine oceanographic data is not applicable.']
          : undefined,
      },
      flood: {
        subsystemId: 'flood',
        sourceName: subsystems.flood === 'derived'
          ? 'Mausam Hydrology Engine (Climatological Catchment Runoff)'
          : 'Mausam Hydrology Engine (Open-Meteo precipitation input)',
        sourceType: isOffline || subsystems.flood === 'unavailable'
          ? 'unavailable'
          : 'derived',
        obtainedAt: isOffline || subsystems.flood === 'unavailable' ? undefined : retrievalTime,
        observedAt: undefined,
        freshness: floodFresh.freshness,
        ageSeconds: floodFresh.ageSeconds,
        status: subsystems.flood,
        sourceStatus: subsystems.flood === 'available' || subsystems.flood === 'derived' ? 'available' : 'unavailable',
        isOfficial: false,
        isDerived: true, // Hydrological modeling is model-derived
        limitations: [
          'Model-derived flood-risk estimate calculated by Mausam from precipitation inputs. This is not direct Copernicus GloFAS river-discharge data and is not an official CWC/state flood bulletin.',
        ],
      },
      radar: {
        subsystemId: 'radar',
        sourceName: 'RainViewer Radar Tile Service (Map Layer Only)',
        sourceType: 'not-applicable',
        obtainedAt: undefined,
        observedAt: undefined,
        freshness: 'unknown',
        ageSeconds: undefined,
        status: subsystems.radar === 'available' ? 'not-applicable' : subsystems.radar,
        sourceStatus: 'not-configured',
        isOfficial: false,
        isDerived: false,
        limitations: [
          'Radar reflectivity data is served strictly on-demand as map tiles in the interactive Radar Map view; no Doppler radar observation payloads are included in numeric weather responses.',
        ],
      },
      thunderstorm: {
        subsystemId: 'thunderstorm',
        sourceName: 'Mausam Intelligence Engine (Convective Risk Algorithm)',
        sourceType: isOffline ? 'unavailable' : 'derived',
        obtainedAt: isOffline ? undefined : retrievalTime,
        observedAt: undefined, // Algorithmic convective calculation; not a physical sensor observation
        freshness: thunderstormFresh.freshness,
        ageSeconds: thunderstormFresh.ageSeconds,
        status: isOffline ? 'unavailable' : 'derived',
        sourceStatus: isOffline ? 'unavailable' : 'available',
        isOfficial: false,
        isDerived: true,
        limitations: [
          'Algorithmic convective index calculated from numerical atmospheric parameters; not an official IMD lightning bulletin or Doppler radar observation.',
        ],
      },
      alerts: {
        subsystemId: 'alerts',
        sourceName: 'Mausam Meteorological Hazard Surveillance',
        sourceType: isOffline ? 'unavailable' : 'derived',
        obtainedAt: isOffline ? undefined : retrievalTime,
        observedAt: undefined, // Algorithmic threshold surveillance; not an observation
        freshness: alertsFresh.freshness,
        ageSeconds: alertsFresh.ageSeconds,
        status: isOffline ? 'unavailable' : 'derived',
        sourceStatus: isOffline ? 'unavailable' : 'available',
        isOfficial: false,
        isDerived: true,
        limitations: [
          'Hazard thresholds evaluated against international numerical model forecast grids. Only official bulletins explicitly marked as such originate from state agencies.',
        ],
      },
      cyclone: {
        subsystemId: 'cyclone',
        sourceName: 'Mausam Storm Surveillance (Open Data)',
        sourceType: isOffline ? 'unavailable' : 'derived',
        obtainedAt: isOffline ? undefined : retrievalTime,
        observedAt: undefined, // Algorithmic surveillance; not an official RSMC bulletin
        freshness: cycloneFresh.freshness,
        ageSeconds: cycloneFresh.ageSeconds,
        status: subsystems.cyclone,
        sourceStatus: isOffline ? 'unavailable' : 'available',
        isOfficial: false,
        isDerived: true,
        limitations: [
          'Open-data storm surveillance model. Not an official IMD RSMC tropical cyclone advisory.',
        ],
      },
      historical: {
        subsystemId: 'historical',
        sourceName: isOffline || subsystems.historical === 'unavailable'
          ? 'Open-Meteo Archive API — ERA5 Reanalysis (Unavailable)'
          : 'Open-Meteo Archive API — ERA5 Reanalysis',
        sourceType: isOffline || subsystems.historical === 'unavailable'
          ? 'unavailable'
          : subsystems.historical === 'derived'
          ? 'derived'
          : 'live',
        obtainedAt: isOffline || subsystems.historical === 'unavailable' ? undefined : retrievalTime,
        observedAt: undefined, // Reanalysis is an archived climate model; not a real-time sensor observation
        freshness: histFresh.freshness,
        ageSeconds: histFresh.ageSeconds,
        status: subsystems.historical,
        sourceStatus: subsystems.historical === 'unavailable' ? 'unavailable' : 'available',
        isOfficial: false,
        isDerived: subsystems.historical === 'derived',
        limitations: [
          'Historical climate data retrieved via Open-Meteo Archive API serving ECMWF ERA5 reanalysis data.',
        ],
      },
    };
  }

  /**
   * Creates comprehensive freshness and provenance metadata
   */
  createFreshnessMetadata(params: {
    source: string;
    providerId: string;
    status: FreshnessStatus;
    location: NormalizedLocation;
    confidence: ConfidenceLevel;
    fallbackLevel: 0 | 1 | 2 | 3 | 4 | 5;
    subsystems: SubsystemsAvailability;
    ageSeconds?: number;
    cacheAgeSeconds?: number;
    fallbackReason?: string;
    isStale?: boolean;
    isUnavailable?: boolean;
    providerCoordinates?: { latitude: number; longitude: number };
    obtainedAt?: string;
    observedAt?: string;
    cachedAt?: number;
    isExactMatch?: boolean;
    isApproximate?: boolean;
    approximateDistanceKm?: number;
    note?: string;
    isDerived?: boolean;
    isOfficial?: boolean;
    limitations?: string[];
  }): FreshnessMetadata {
    const nowIso = new Date().toISOString();
    const isOffline = Boolean(params.isUnavailable || params.fallbackLevel === 5);

    // Build unified DataProvenance
    let provenance: DataProvenance;

    if (isOffline) {
      provenance = {
        sourceId: 'unavailable',
        sourceName: 'Unavailable',
        sourceType: 'unavailable',
        fallbackLevel: 5,
        freshness: 'unknown',
        ageSeconds: undefined,
        obtainedAt: undefined,
        observedAt: undefined,
        cachedAt: undefined,
        confidence: 'unknown',
        isOfficial: false,
        isDerived: false,
        isExactMatch: true,
        requestedCoordinates: {
          latitude: params.location.latitude ?? params.location.lat,
          longitude: params.location.longitude ?? params.location.lon,
        },
        providerCoordinates: undefined,
        limitations: [
          params.fallbackReason || 'All live meteorological feeds and same-location caches unreachable.',
        ],
        subsystems: this.buildSubsystemsProvenance(params.subsystems, 'unavailable'),
      };
    } else if (params.fallbackLevel === 1) {
      const isExact = params.isExactMatch !== false && !params.isApproximate;
      const isApprox = !isExact || Boolean(params.isApproximate);
      const distKm = isExact ? 0 : (params.approximateDistanceKm ?? 2.5);
      const freshCalc = calculateFreshness(params.cachedAt || params.obtainedAt || params.observedAt);
      const conf = determineConfidence({
        sourceType: 'cache',
        fallbackLevel: 1,
        freshness: freshCalc.freshness,
        isExactMatch: isExact,
        isDerived: false,
      });

      provenance = {
        sourceId: params.providerId || 'open-meteo',
        sourceName: params.source.replace(' (Cached)', '').replace(/\s*\(Approximate Cache.*?\)/, ''),
        sourceType: 'cache',
        fallbackLevel: 1,
        freshness: freshCalc.freshness,
        ageSeconds: freshCalc.ageSeconds ?? params.ageSeconds,
        obtainedAt: params.obtainedAt,
        observedAt: params.observedAt,
        cachedAt: params.cachedAt,
        confidence: conf.confidence,
        isOfficial: false,
        isDerived: false,
        isExactMatch: isExact,
        isApproximate: isApprox,
        approximateDistanceKm: distKm,
        note: isApprox ? 'Explicit approximate cache — not part of normal Level 1 fallback.' : undefined,
        requestedCoordinates: {
          latitude: params.location.latitude ?? params.location.lat,
          longitude: params.location.longitude ?? params.location.lon,
        },
        providerCoordinates: params.providerCoordinates || {
          latitude: params.location.latitude ?? params.location.lat,
          longitude: params.location.longitude ?? params.location.lon,
        },
        limitations: isExact
          ? ['Cached meteorological observation; live connection pending refresh.']
          : [
              'Explicit approximate cache — not part of normal Level 1 fallback.',
              `Data from nearby cached station ${distKm.toFixed(1)} km away; spatial interpolation active.`,
            ],
        subsystems: this.buildSubsystemsProvenance(
          params.subsystems,
          'cache',
          params.obtainedAt,
          params.observedAt
        ),
      };
    } else if (params.fallbackLevel === 2) {
      const retrievalIso = params.obtainedAt || nowIso;
      const freshCalc = calculateFreshness(params.observedAt || retrievalIso);
      const conf = determineConfidence({
        sourceType: 'alternate-model',
        fallbackLevel: 2,
        freshness: freshCalc.freshness,
        isExactMatch: true,
        isDerived: false,
      });

      provenance = {
        sourceId: 'open-meteo-gfs-icon',
        sourceName: 'Open-Meteo Alternate Multi-Model (GFS/ICON)',
        sourceType: 'alternate-model',
        fallbackLevel: 2,
        freshness: freshCalc.freshness,
        ageSeconds: freshCalc.ageSeconds,
        obtainedAt: retrievalIso,
        observedAt: params.observedAt,
        confidence: conf.confidence,
        isOfficial: false,
        isDerived: false,
        isExactMatch: true,
        approximateDistanceKm: 0,
        requestedCoordinates: {
          latitude: params.location.latitude ?? params.location.lat,
          longitude: params.location.longitude ?? params.location.lon,
        },
        providerCoordinates: params.providerCoordinates || {
          latitude: params.location.latitude ?? params.location.lat,
          longitude: params.location.longitude ?? params.location.lon,
        },
        limitations: [
          'Secondary numerical weather prediction model feed (GFS/ICON) via Open-Meteo API; not an official government weather station.',
        ],
        subsystems: this.buildSubsystemsProvenance(
          params.subsystems,
          'alternate-model',
          retrievalIso,
          params.observedAt
        ),
      };
    } else if (params.fallbackLevel === 3) {
      const retrievalIso = params.obtainedAt || nowIso;
      const freshCalc = calculateFreshness(params.observedAt || retrievalIso);
      const conf = determineConfidence({
        sourceType: 'partial',
        fallbackLevel: 3,
        freshness: freshCalc.freshness,
        isExactMatch: true,
        isDerived: false,
        hasSubsystemDegradation: true,
      });

      provenance = {
        sourceId: params.providerId || 'open-meteo',
        sourceName: params.source,
        sourceType: 'partial',
        fallbackLevel: 3,
        freshness: freshCalc.freshness,
        ageSeconds: freshCalc.ageSeconds,
        obtainedAt: retrievalIso,
        observedAt: params.observedAt,
        confidence: conf.confidence,
        isOfficial: false,
        isDerived: false,
        isExactMatch: true,
        approximateDistanceKm: 0,
        requestedCoordinates: {
          latitude: params.location.latitude ?? params.location.lat,
          longitude: params.location.longitude ?? params.location.lon,
        },
        providerCoordinates: params.providerCoordinates || {
          latitude: params.location.latitude ?? params.location.lat,
          longitude: params.location.longitude ?? params.location.lon,
        },
        limitations: [
          'Core atmospheric weather operational; one or more non-critical subsystems degraded to baseline.',
        ],
        subsystems: this.buildSubsystemsProvenance(
          params.subsystems,
          'partial',
          retrievalIso,
          params.observedAt
        ),
      };
    } else if (params.fallbackLevel === 4) {
      provenance = {
        sourceId: 'mausam-intelligence-engine',
        sourceName: 'Mausam Intelligence Engine',
        sourceType: 'derived',
        fallbackLevel: 4,
        freshness: 'fresh',
        ageSeconds: 0,
        obtainedAt: nowIso,
        confidence: 'medium',
        isOfficial: false,
        isDerived: true,
        isExactMatch: true,
        requestedCoordinates: {
          latitude: params.location.latitude ?? params.location.lat,
          longitude: params.location.longitude ?? params.location.lon,
        },
        limitations: [
          'Algorithmic convective / agro / hydrological index calculated by Mausam Intelligence Engine from numerical atmospheric parameters. Not an official IMD lightning bulletin or Doppler radar observation.',
        ],
        subsystems: this.buildSubsystemsProvenance(params.subsystems, 'derived'),
      };
    } else {
      // Level 0: Fresh Live Data
      const retrievalIso = params.obtainedAt || nowIso;
      const freshCalc = calculateFreshness(params.observedAt || retrievalIso);
      const conf = determineConfidence({
        sourceType: 'live',
        fallbackLevel: 0,
        freshness: freshCalc.freshness,
        isExactMatch: true,
        isDerived: false,
      });

      provenance = {
        sourceId: params.providerId || 'open-meteo',
        sourceName: 'Open-Meteo Global Numerical Models',
        sourceType: 'live',
        fallbackLevel: 0,
        freshness: freshCalc.freshness,
        ageSeconds: freshCalc.ageSeconds,
        obtainedAt: retrievalIso,
        observedAt: params.observedAt,
        confidence: conf.confidence,
        isOfficial: false,
        isDerived: false,
        isExactMatch: true,
        approximateDistanceKm: 0,
        requestedCoordinates: {
          latitude: params.location.latitude ?? params.location.lat,
          longitude: params.location.longitude ?? params.location.lon,
        },
        providerCoordinates: params.providerCoordinates || {
          latitude: params.location.latitude ?? params.location.lat,
          longitude: params.location.longitude ?? params.location.lon,
        },
        limitations: [
          'Open-access global numerical prediction models. Not directly operated by the India Meteorological Department.',
        ],
        subsystems: this.buildSubsystemsProvenance(
          params.subsystems,
          'live',
          retrievalIso,
          params.observedAt
        ),
      };
    }

    return {
      source: params.source,
      providerId: params.providerId,
      status: params.status,
      requestedAt: nowIso,
      retrievedAt: isOffline ? '' : (params.obtainedAt || nowIso),
      obtainedAt: isOffline ? undefined : (params.obtainedAt || nowIso),
      observedAt: isOffline ? undefined : params.observedAt,
      cachedAt: params.cachedAt,
      isStale: Boolean(params.isStale),
      ageSeconds: isOffline ? 0 : (params.ageSeconds ?? provenance.ageSeconds ?? 0),
      cacheAgeSeconds: params.cacheAgeSeconds,
      location: params.location,
      confidence: params.confidence,
      requestedCoordinates: {
        latitude: params.location.latitude ?? params.location.lat,
        longitude: params.location.longitude ?? params.location.lon,
      },
      providerCoordinates: params.providerCoordinates || {
        latitude: params.location.latitude ?? params.location.lat,
        longitude: params.location.longitude ?? params.location.lon,
      },
      subsystems: params.subsystems,
      fallbackLevel: params.fallbackLevel,
      fallbackReason: params.fallbackReason,
      isUnavailable: params.isUnavailable,
      isExactMatch: provenance.isExactMatch,
      isApproximate: provenance.isApproximate,
      approximateDistanceKm: provenance.approximateDistanceKm,
      note: provenance.note,
      limitations: provenance.limitations,
      provenance,
    };
  }

  /**
   * LEVEL 1 FALLBACK: Attempts to recover from same-location cache.
   * Enforces that cached data belongs strictly to the requested location.
   */
  trySameLocationCache(
    location: NormalizedLocation,
    reason: string
  ): CompleteWeatherIntelligence | null {
    const lat = location.latitude ?? location.lat;
    const lon = location.longitude ?? location.lon;

    // 1. Exact coordinate cache match
    const exactCached = weatherCacheManager.getExact(lat, lon);
    if (exactCached) {
      const {
        data,
        isStale,
        ageSeconds,
        cachedAt,
        providerId,
        sourceName,
        originalCoordinates,
        originalProviderCoordinates,
        observedAt,
        obtainedAt,
      } = exactCached;

      const subsystems: SubsystemsAvailability = {
        ...data.freshness.subsystems,
        current: isStale ? 'stale' : 'cached',
        hourly: isStale ? 'stale' : 'cached',
        daily: isStale ? 'stale' : 'cached',
      };

      const freshness = this.createFreshnessMetadata({
        source: `${sourceName || data.freshness.source || 'Open-Meteo'} (Cached)`,
        providerId: providerId || 'open-meteo',
        status: isStale ? 'stale' : 'cached',
        location,
        confidence: isStale ? 'MODERATE' : 'HIGH',
        fallbackLevel: 1,
        subsystems,
        ageSeconds,
        cacheAgeSeconds: ageSeconds,
        cachedAt,
        obtainedAt,
        observedAt,
        isExactMatch: true,
        approximateDistanceKm: 0,
        fallbackReason: `Live provider failed (${reason}). Displaying verified same-location cache.`,
        isStale,
        providerCoordinates: originalProviderCoordinates || originalCoordinates,
      });

      return {
        ...data,
        location,
        freshness,
        provenance: freshness.provenance,
      };
    }

    // Level 1 Fallback invariant: MUST ONLY use exact same-location cache.
    return null;
  }

  /**
   * EXPLICIT APPROXIMATE CACHE (Opt-in only)
   * Recovers weather from a nearby cached station within 5km radius.
   * MUST have isExactMatch: false, approximateDistanceKm > 0, degraded confidence,
   * and preserves user's requested coordinates intact!
   */
  tryApproximateCache(
    location: NormalizedLocation,
    reason: string
  ): CompleteWeatherIntelligence | null {
    const lat = location.latitude ?? location.lat;
    const lon = location.longitude ?? location.lon;

    const approxCached = weatherCacheManager.get(lat, lon, { allowApproximate: true });
    if (approxCached && !approxCached.isExactMatch) {
      const {
        data,
        isStale,
        ageSeconds,
        cachedAt,
        providerId,
        sourceName,
        distanceKm,
        originalCoordinates,
        originalProviderCoordinates,
        observedAt,
        obtainedAt,
      } = approxCached;

      const subsystems: SubsystemsAvailability = {
        ...data.freshness.subsystems,
        current: isStale ? 'stale' : 'cached',
        hourly: isStale ? 'stale' : 'cached',
        daily: isStale ? 'stale' : 'cached',
      };

      const freshness = this.createFreshnessMetadata({
        source: `${sourceName || data.freshness.source || 'Open-Meteo'} (Approximate Cache ${distanceKm.toFixed(1)}km)`,
        providerId: providerId || 'open-meteo',
        status: isStale ? 'stale' : 'cached',
        location,
        confidence: 'MODERATE', // visibly degraded
        fallbackLevel: 1,
        subsystems,
        ageSeconds,
        cacheAgeSeconds: ageSeconds,
        cachedAt,
        obtainedAt,
        observedAt,
        isExactMatch: false,
        isApproximate: true,
        approximateDistanceKm: distanceKm,
        fallbackReason: `Live provider failed (${reason}). Displaying spatially approximate nearby cache (${distanceKm.toFixed(1)}km away). Explicit approximate cache — not part of normal Level 1 fallback.`,
        isStale,
        providerCoordinates: originalProviderCoordinates || originalCoordinates,
        limitations: [
          'Explicit approximate cache — not part of normal Level 1 fallback.',
          `Data from nearby cached station ${distanceKm.toFixed(1)} km away; spatial interpolation active.`,
        ],
      });

      return {
        ...data,
        location,
        freshness,
        provenance: freshness.provenance,
      };
    }
    return null;
  }

  /**
   * LEVEL 5 FALLBACK: Honest Unavailable State.
   * Never fabricates weather, never silently substitutes another city.
   */
  createHonestUnavailableState(
    location: NormalizedLocation,
    reason: string
  ): CompleteWeatherIntelligence {
    const subsystems: SubsystemsAvailability = {
      current: 'unavailable',
      hourly: 'unavailable',
      daily: 'unavailable',
      airQuality: 'unavailable',
      marine: 'not-applicable',
      flood: 'unavailable',
      radar: 'unavailable',
      alerts: 'unavailable',
      cyclone: 'unavailable',
      historical: 'unavailable',
    };

    const freshness = this.createFreshnessMetadata({
      source: 'Unavailable (Live feed offline)',
      providerId: 'unavailable',
      status: 'unavailable',
      location,
      confidence: 'UNAVAILABLE',
      fallbackLevel: 5,
      subsystems,
      fallbackReason: reason,
      isUnavailable: true,
    });

    // Provide safe zero-value mock structures to prevent runtime crashes in components,
    // but clearly flagged as isUnavailable = true, with no fake timestamps
    const fallbackCurrent: NormalizedCurrentWeather = {
      temperature: 0,
      feelsLike: 0,
      humidity: 0,
      pressure: 1012,
      windSpeed: 0,
      windDirection: 0,
      windGust: 0,
      precipitation: 0,
      precipitation24h: 0,
      cloudCover: 0,
      visibility: 0,
      uvIndex: 0,
      dewPoint: 0,
      weatherConditionKey: 'partly-cloudy',
      conditionText: 'Data Unavailable',
      conditionCode: 0,
      sunrise: '--:--',
      sunset: '--:--',
      isDay: true,
      timeString: '--:--',
      high: 0,
      low: 0,
      source: {
        providerId: 'unavailable',
        providerName: 'Unavailable',
        classification: 'free-api-service',
        isOfficialIMD: false,
        isDerived: false,
        timestamp: '',
        obtainedAt: undefined,
        observedAt: undefined,
        confidenceScore: 0,
        attributionText: 'No live meteorological feed reachable',
      },
    };

    const fallbackForecast: NormalizedForecast = {
      hourly: [],
      daily: [],
      horizonDays: 0,
      source: fallbackCurrent.source,
    };

    const fallbackAQI: NormalizedAirQuality = {
      aqi: undefined,
      category: 'Unavailable',
      pm25: undefined,
      pm10: undefined,
      nitrogenDioxide: undefined,
      sulphurDioxide: undefined,
      ozone: undefined,
      carbonMonoxide: undefined,
      dust: undefined,
      color: 'text-slate-400',
      bgColor: 'bg-slate-100',
      healthAdvice: 'Air quality data is currently unavailable for this station.',
      calculationMethod: 'Unavailable',
      isUnavailable: true,
      source: fallbackCurrent.source,
    };

    const fallbackMarine: NormalizedMarine = {
      isCoastal: false,
      isApplicable: false,
      isUnavailable: true,
      locationName: location.name,
      waveHeight: undefined,
      waveDirection: undefined,
      wavePeriod: undefined,
      swellWaveHeight: undefined,
      swellWaveDirection: undefined,
      swellPeriod: undefined,
      seaSurfaceTemperature: undefined,
      seaStateCategory: 'Unavailable',
      swimmingSafety: 'Unavailable',
      source: fallbackCurrent.source,
      disclaimer: 'Marine data unavailable',
    };

    const fallbackFlood: NormalizedFloodRisk = {
      basinName: 'Indian Catchment',
      locationName: location.name,
      riskLevel: 'Unavailable',
      trend: 'Unavailable',
      catchmentRainfall3DayMm: undefined,
      riverDischargeM3s: undefined,
      advisory: 'Flood-risk estimation is unavailable because required precipitation inputs could not be retrieved.',
      confidence: 'Low',
      forecastPeriod: 'Unavailable',
      isUnavailable: true,
      source: fallbackCurrent.source,
      disclaimer: 'Mausam Hydrology Engine calculation unavailable',
    };

    const fallbackThunder: NormalizedThunderstormRisk = {
      riskScore: 0,
      riskLevel: 'Unavailable',
      lightningLikelihood: 'Unknown',
      convectiveEnergyEstimate: 'Convective monitoring temporarily offline',
      gustRiskKmph: undefined,
      peakWindow: 'N/A',
      advisory: 'Convective nowcasting and thunderstorm modeling are unavailable.',
      safetyTips: [],
      isOfficialWarning: false,
      source: fallbackCurrent.source,
      observedMetrics: {
        maxRainMm: undefined,
        maxRainProb: undefined,
        maxWindKmph: undefined,
      },
    };

    const fallbackCyclone: NormalizedCyclone = {
      hasActiveStorm: false,
      source: fallbackCurrent.source,
    };

    return {
      location,
      current: fallbackCurrent,
      forecast: fallbackForecast,
      airQuality: fallbackAQI,
      marine: fallbackMarine,
      floodRisk: fallbackFlood,
      flood: fallbackFlood,
      thunderstormRisk: fallbackThunder,
      thunderstorm: fallbackThunder,
      cyclone: fallbackCyclone,
      alerts: [],
      cachedAt: Date.now(),
      freshness,
      provenance: freshness.provenance,
      isUnavailable: true,
      unavailableReason: `Weather data is temporarily unavailable for ${location.name}. Please check your connection or try again.`,
    };
  }
}

export const fallbackManager = new FallbackManager();
