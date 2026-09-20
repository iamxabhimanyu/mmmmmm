/**
 * Freshness & Provenance Utilities for MAUSAM
 *
 * Centralized, verifiable time and confidence calculation.
 * Prevents hardcoded relative timestamps and enforces mathematical freshness buckets.
 */

import {
  DataProvenance,
  ProvenanceFreshness,
  ProvenanceConfidence,
  ProvenanceSourceType,
  ConfidenceLevel,
} from '../services/providers/providerTypes';

export const FRESHNESS_THRESHOLDS = {
  /** 0 - 15 minutes: Fresh operational data */
  FRESH_MAX_SECONDS: 15 * 60,
  /** 15 - 60 minutes: Recent, valid data */
  RECENT_MAX_SECONDS: 60 * 60,
  /** 1 - 6 hours: Stale data; requires visible warning */
  STALE_MAX_SECONDS: 6 * 60 * 60,
  /** > 6 hours: Very stale data; fallback candidate */
} as const;

export interface FreshnessCalculationResult {
  freshness: ProvenanceFreshness;
  ageSeconds?: number;
  relativeTimeText: string;
}

/**
 * Calculates deterministic freshness bucket and elapsed age from a verified timestamp.
 * Returns 'unknown' and undefined age if the timestamp is missing, invalid, or zero.
 */
export function calculateFreshness(
  timestamp?: string | number | null,
  nowMs: number = Date.now()
): FreshnessCalculationResult {
  if (!timestamp) {
    return {
      freshness: 'unknown',
      ageSeconds: undefined,
      relativeTimeText: 'Time unknown',
    };
  }

  const timeMs =
    typeof timestamp === 'number'
      ? timestamp
      : new Date(timestamp).getTime();

  if (isNaN(timeMs) || timeMs <= 0) {
    return {
      freshness: 'unknown',
      ageSeconds: undefined,
      relativeTimeText: 'Time unknown',
    };
  }

  const ageSeconds = Math.max(0, Math.floor((nowMs - timeMs) / 1000));

  let freshness: ProvenanceFreshness;
  if (ageSeconds <= FRESHNESS_THRESHOLDS.FRESH_MAX_SECONDS) {
    freshness = 'fresh';
  } else if (ageSeconds <= FRESHNESS_THRESHOLDS.RECENT_MAX_SECONDS) {
    freshness = 'recent';
  } else if (ageSeconds <= FRESHNESS_THRESHOLDS.STALE_MAX_SECONDS) {
    freshness = 'stale';
  } else {
    freshness = 'very-stale';
  }

  const relativeTimeText = formatRelativeAge(ageSeconds);

  return {
    freshness,
    ageSeconds,
    relativeTimeText,
  };
}

/**
 * Formats elapsed age in seconds into human-readable relative text.
 * Strictly calculated from the numeric delta, never hardcoded.
 */
export function formatRelativeAge(ageSeconds?: number): string {
  if (ageSeconds === undefined || ageSeconds === null || isNaN(ageSeconds)) {
    return 'Time unknown';
  }

  if (ageSeconds < 60) {
    return 'Updated just now';
  }

  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) {
    return `Updated ${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  const days = Math.floor(hours / 24);
  return `Updated ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/**
 * Determines justified confidence from source reliability, freshness, fallback level,
 * and coordinate match accuracy.
 */
export function determineConfidence(params: {
  sourceType: ProvenanceSourceType;
  fallbackLevel: 0 | 1 | 2 | 3 | 4 | 5;
  freshness: ProvenanceFreshness;
  isExactMatch: boolean;
  isDerived?: boolean;
  hasSubsystemDegradation?: boolean;
}): { confidence: ProvenanceConfidence; confidenceLevel: ConfidenceLevel } {
  // Level 5 or Unavailable
  if (params.fallbackLevel === 5 || params.sourceType === 'unavailable' || params.freshness === 'unknown') {
    return { confidence: 'unknown', confidenceLevel: 'UNAVAILABLE' };
  }

  // Explicit Approximate Cache (must be visibly degraded)
  if (!params.isExactMatch) {
    if (params.freshness === 'stale' || params.freshness === 'very-stale') {
      return { confidence: 'low', confidenceLevel: 'LOW' };
    }
    return { confidence: 'medium', confidenceLevel: 'MODERATE' };
  }

  // Level 1: Same-Location Cache
  if (params.fallbackLevel === 1 || params.sourceType === 'cache') {
    if (params.freshness === 'fresh') {
      return { confidence: 'high', confidenceLevel: 'HIGH' };
    }
    if (params.freshness === 'recent') {
      return { confidence: 'medium', confidenceLevel: 'MODERATE' };
    }
    if (params.freshness === 'stale') {
      return { confidence: 'low', confidenceLevel: 'LOW' };
    }
    return { confidence: 'low', confidenceLevel: 'LOW' };
  }

  // Level 2: Alternate GFS/ICON Numerical Model Feed
  if (params.fallbackLevel === 2 || params.sourceType === 'alternate-model') {
    return { confidence: 'medium', confidenceLevel: 'MODERATE' };
  }

  // Level 3: Partial Subsystem Degradation
  if (params.fallbackLevel === 3 || params.sourceType === 'partial' || params.hasSubsystemDegradation) {
    return { confidence: 'medium', confidenceLevel: 'MODERATE' };
  }

  // Level 4: Pure Derived Intelligence
  if (params.fallbackLevel === 4 || params.sourceType === 'derived') {
    return { confidence: 'medium', confidenceLevel: 'MODERATE' };
  }

  // Level 0: Fresh Live Exact Provider Data
  if (params.freshness === 'fresh') {
    return { confidence: 'high', confidenceLevel: 'HIGH' };
  }
  if (params.freshness === 'recent') {
    return { confidence: 'medium', confidenceLevel: 'MODERATE' };
  }
  return { confidence: 'low', confidenceLevel: 'LOW' };
}

/**
 * Generates concise, truthful UI provenance presentation string.
 */
export function formatProvenanceSummary(provenance: DataProvenance): string {
  if (provenance.sourceType === 'unavailable' || provenance.fallbackLevel === 5) {
    return 'Data Unavailable';
  }

  const ageText = provenance.ageSeconds !== undefined
    ? formatRelativeAge(provenance.ageSeconds)
    : provenance.obtainedAt
    ? calculateFreshness(provenance.obtainedAt).relativeTimeText
    : '';

  if (!provenance.isExactMatch && provenance.approximateDistanceKm !== undefined) {
    return `Approximate cached data · ${provenance.approximateDistanceKm.toFixed(1)} km away${ageText ? ` · ${ageText}` : ''}`;
  }

  switch (provenance.sourceType) {
    case 'live':
      return `Live · ${provenance.sourceName}${ageText ? ` · ${ageText}` : ''}`;
    case 'cache':
      return `Cached · ${provenance.sourceName}${ageText ? ` · ${ageText}` : ''}`;
    case 'alternate-model':
      return `Alternate model · GFS/ICON via Open-Meteo${ageText ? ` · ${ageText}` : ''}`;
    case 'partial':
      return `Partial live data · ${provenance.sourceName}${ageText ? ` · ${ageText}` : ''}`;
    case 'derived':
      return `Derived · Mausam Intelligence Engine${ageText ? ` · ${ageText}` : ''}`;
    default:
      return `${provenance.sourceName}${ageText ? ` · ${ageText}` : ''}`;
  }
}
