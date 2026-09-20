# FRESHNESS & DATA PROVENANCE SPECIFICATION

## Overview & Core Principles

Mausam enforces an uncompromising, multi-tier data provenance and freshness transparency architecture. Every piece of meteorological data returned by the Mausam Intelligence Engine carries unambiguous metadata tracking its origin, spatial accuracy, temporal lifecycle, and algorithmic status.

### The Provenance Invariants
1. **Zero Data Fabrication**: Meteorological observations are never synthesized. If sensor observations or live numerical model feeds are unreachable, the system transparently reports cache or enters an honest unavailable state.
2. **Actual Retrieved Data**: Provenance represents what was *actually retrieved and verified* in the response payload, never theoretical provider capabilities or unretrieved services.
3. **Opt-In Approximate Spatial Recovery**: Approximate caching is strictly opt-in and is **never** selected automatically during standard Level 1 fallback. Level 1 recovery strictly demands exact coordinate matches.
4. **Distinction Between Map Tiles and Numeric Payloads**: Interactive Doppler radar mosaics (e.g., RainViewer) are rendered on-demand in the map interface. The numerical weather API payload marks radar as `not-applicable` with `freshness: 'unknown'` and never claims synthetic or model-derived radar observations.
5. **Clear Separation of Timestamps**: Observations, ingestions, and cache operations have strictly decoupled timestamp fields. When a timestamp is unavailable or untrustworthy, freshness is labeled `'unknown'` and age is `undefined` rather than generating a synthetic timestamp.
6. **Truthful Provider Attribution**: The system never claims direct queries to upstream institutions when intermediate APIs or derived algorithms are used. Specifically, flood risk is attributed to the Mausam Hydrology Engine using Open-Meteo precipitation inputs (not direct Copernicus GloFAS), and historical reanalysis is attributed to Open-Meteo Archive API — ERA5 Reanalysis.

---

## 1. Provenance Data Structures

The system formalizes provenance across two primary TypeScript interfaces: `DataProvenance` (for overall response provenance) and `SubsystemProvenance` (for individual subsystem streams), defined in `/src/services/providers/providerTypes.ts`.

### Core TypeScript Type Unions

```typescript
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

export type ConfidenceLevel =
  | 'HIGH'
  | 'MODERATE'
  | 'LOW'
  | 'UNAVAILABLE';

export type SubsystemStatus =
  | 'available'
  | 'unavailable'
  | 'stale'
  | 'cached'
  | 'derived'
  | 'not-applicable';
```

### `DataProvenance`
Defined in `/src/services/providers/providerTypes.ts`:

```typescript
export interface DataProvenance {
  sourceId: string;                     // e.g. 'open-meteo', 'open-meteo-gfs-icon', 'mausam-cache', 'unavailable'
  sourceName: string;                   // Human-readable source descriptor
  sourceType: ProvenanceSourceType;     // 'live' | 'cache' | 'alternate-model' | 'derived' | 'partial' | 'unavailable'
  fallbackLevel: 0 | 1 | 2 | 3 | 4 | 5; // 6-tier fallback tier
  obtainedAt?: string;                  // ISO 8601 when payload was received by Mausam
  observedAt?: string;                  // ISO 8601 timestamp of sensor observation (if present)
  cachedAt?: number | string;           // Epoch milliseconds or ISO string when stored into local cache
  freshness: ProvenanceFreshness;       // 'fresh' | 'recent' | 'stale' | 'very-stale' | 'unknown'
  ageSeconds?: number;                  // Elapsed seconds since observation/retrieval
  confidence: ProvenanceConfidence;     // 'high' | 'medium' | 'low' | 'unknown'
  isOfficial: boolean;                  // True ONLY for verified sovereign agencies (IMD, CWC, INCOIS)
  isExactMatch: boolean;                // False if approximate spatial matching was used
  isApproximate?: boolean;              // Explicit marker for approximate cache
  requestedCoordinates: {
    latitude: number;
    longitude: number;
  };
  providerCoordinates?: {
    latitude: number;
    longitude: number;
  };
  approximateDistanceKm?: number;       // Distance in km if approximate cache (0 for exact)
  isDerived: boolean;                   // True if algorithmically derived or modeled
  limitations?: string[];               // Actionable disclosures regarding limits
  subsystems?: Record<string, SubsystemProvenance>; // Per-subsystem granular tracking
  note?: string;                        // Diagnostic annotation (e.g. opt-in notice)
}
```

### `SubsystemProvenance`
```typescript
export interface SubsystemProvenance {
  subsystemId: string;                  // e.g. 'current', 'hourly', 'daily', 'airQuality', 'marine', 'flood', 'radar', 'alerts', 'cyclone', 'historical'
  sourceName: string;                   // Upstream source or algorithm name
  sourceType: ProvenanceSourceType | 'not-applicable'; // Note: supports 'not-applicable' for non-relevant subsystems like radar/inland marine
  obtainedAt?: string;                  // Timestamp of ingestion
  observedAt?: string;                  // Physical sensor observation time (undefined for forecasts/models)
  cachedAt?: number | string;           // Cache timestamp
  freshness: ProvenanceFreshness;       // 'fresh' | 'recent' | 'stale' | 'very-stale' | 'unknown'
  ageSeconds?: number;                  // Age in seconds
  status: SubsystemStatus;              // 'available' | 'unavailable' | 'stale' | 'cached' | 'derived' | 'not-applicable'
  sourceStatus?: 'available' | 'unavailable' | 'not-configured';
  isOfficial: boolean;                  // Official agency flag
  isDerived: boolean;                   // Derived flag
  limitations?: string[];               // Subsystem-specific caveats
}
```

---

## 2. Timestamp Semantics & Invariants

Mausam enforces explicit semantic separation across three distinct timestamp types:

| Timestamp | Type | Meaning | Subsystems Using It | Unavailable Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `observedAt` | ISO 8601 String | Physical timestamp when an atmospheric parameter was recorded by an automatic weather station (AWS) or observation network. | `current` (when reported by station) | Set to `undefined` for numerical predictions (hourly/daily), algorithmic indices, and offline states. |
| `obtainedAt` | ISO 8601 String | Timestamp when the Mausam server or client ingested the payload from the upstream provider. | All operational subsystems | Set to `undefined` when data is unavailable (Level 5) or not retrieved. |
| `cachedAt` | Epoch Milliseconds (`number`) / ISO String | Exact moment when the record was committed to the local `weatherCacheManager`. | Level 1 cache responses | Set to `undefined` for live feeds (Level 0/2/3/4) and Level 5 offline states. |

### Zero Timestamp Fabrication
- If an upstream provider omits an observation timestamp, `observedAt` is set to `undefined`.
- In Level 5 (Honest Unavailable State), **all timestamps (`obtainedAt`, `observedAt`, `cachedAt`) are strictly `undefined`**. No placeholder or current time is used.
- When `obtainedAt` and `observedAt` are missing or invalid, `freshness` is strictly evaluated as `'unknown'` and `ageSeconds` is `undefined`.

---

## 3. Freshness Buckets & Calculation

Freshness is computed via `calculateFreshness(timestamp)` using elapsed seconds:

$$\text{Age (seconds)} = \frac{\text{Date.now}() - \text{timestamp}}{1000}$$

| Freshness Bucket | Elapsed Age Range | Semantic Meaning | Confidence Impact |
| :--- | :--- | :--- | :--- |
| **`fresh`** | $< 900\text{ s}$ ($< 15\text{ min}$) | Real-time observation or current model cycle run. | High confidence (if live). |
| **`recent`** | $900\text{ s} \le \text{age} < 3600\text{ s}$ ($15\text{--}60\text{ min}$) | Active cache or recent observation. | Moderate to High confidence. |
| **`stale`** | $3600\text{ s} \le \text{age} < 21600\text{ s}$ ($1\text{--}6\text{ h}$) | Extended persistence; suitable for multi-day models. | Moderate to Low confidence. |
| **`very-stale`** | $\ge 21600\text{ s}$ ($\ge 6\text{ h}$) | Severely outdated; cache expiry boundary reached. | Low confidence. |
| **`unknown`** | Age is `NaN`, negative, or timestamp is `undefined`. | No reliable timestamp available. | Evaluated as `'unknown'` confidence. |

---

## 4. Confidence Evaluation Rules

Confidence is mathematically evaluated based on the source type, fallback level, freshness bucket, spatial exactness, and derived nature via `determineConfidence`:

```typescript
export function determineConfidence(params: {
  sourceType: ProvenanceSourceType;
  fallbackLevel: 0 | 1 | 2 | 3 | 4 | 5;
  freshness: ProvenanceFreshness;
  isExactMatch: boolean;
  isDerived?: boolean;
  hasSubsystemDegradation?: boolean;
}): { confidence: ProvenanceConfidence; confidenceLevel: ConfidenceLevel }
```

### Truth Table for Confidence:
1. **`HIGH` (`confidence: 'high'`):**
   - Level 0 (Live Primary Feed) with `fresh` status ($< 15\text{ min}$) and exact coordinates.
   - Level 1 (Same-Location Cache) with `fresh` status ($< 15\text{ min}$) and exact coordinates (`isExactMatch: true`).
2. **`MODERATE` (`confidence: 'medium'`):**
   - Level 0 with `recent` status ($15\text{--}60\text{ min}$).
   - Level 1 (Same-Location Cache) with `recent` status ($15\text{--}60\text{ min}$) and exact coordinates.
   - **Any Approximate Cache** (`isExactMatch: false` / `isApproximate: true`) when fresh or recent.
   - Level 2 (Alternate NWP Model e.g. GFS/ICON multi-model).
   - Level 3 (Partial Data with non-critical subsystem failure).
   - Level 4 (Derived Intelligence).
3. **`LOW` (`confidence: 'low'`):**
   - Level 1 with `stale` or `very-stale` status ($> 1\text{ h}$).
   - Any Approximate Cache with `stale` or `very-stale` status.
   - Level 0 with `stale` or `very-stale` status.
4. **`UNAVAILABLE` (`confidence: 'unknown'`):**
   - Level 5 (Honest Unavailable State) — data is absent, so confidence is unknown.
   - Any state where `sourceType === 'unavailable'` or `freshness === 'unknown'`.

---

## 5. Fallback Hierarchy & Provenance Semantics

Mausam implements a strictly sequential 6-tier fallback hierarchy:

### Level 0: Primary Live Feed (`sourceType: 'live'`)
- Primary Open-Meteo High-Resolution Numerical Weather Prediction API.
- All core subsystems (`current`, `hourly`, `daily`) live and verified.
- `isExactMatch: true`, `approximateDistanceKm: 0`.
- Confidence: `HIGH` (if fresh).

### Level 1: Same-Location Exact Cache (`sourceType: 'cache'`)
- Triggered when live primary API fails (network timeout, rate limit, server error).
- **Invariant**: Strictly matches the exact requested coordinate grid key.
- `isExactMatch: true`, `isApproximate: false`, `approximateDistanceKm: 0`.
- Preserves original observed/obtained timestamps and reports elapsed `cachedAt`.

### Level 2: Alternate NWP Model (`sourceType: 'alternate-model'`)
- Triggered when primary model and exact cache are unavailable.
- Ingests secondary multi-model ensembles (NOAA GFS, DWD ICON).
- `confidence: 'medium'`, `confidenceLevel: 'MODERATE'`.
- `limitations`: Explicit disclosure that alternate global numerical prediction grids are active.

### Level 3: Partial Subsystem Fallback (`sourceType: 'partial'`)
- Core atmospheric forecasts succeed, but secondary auxiliary subsystems (AQI, Mausam flood hydrology, marine) fail.
- Graceful degradation: individual subsystem provenance marked as `'derived'` or `'unavailable'`.
- System confidence evaluated as `MODERATE`.

### Level 4: Derived Meteorological Intelligence (`sourceType: 'derived'`)
- Algorithmic assessments computed by Mausam engine:
  - Mausam Convective Thunderstorm Index (CAPE, Dewpoint depression, Pressure tendency).
  - CPCB National Air Quality Index conversions.
  - Mausam Hydrology Catchment Runoff calculations from 3-day precipitation accumulation.
- `isDerived: true`, `isOfficial: false`.
- Limitations explicitly state algorithmic nature.

### Level 5: Honest Unavailable State (`sourceType: 'unavailable'`)
- All live feeds, secondary models, and exact caches have failed.
- **Zero Hallucination Guarantee**: Returns `isUnavailable: true`, `fallbackLevel: 5`.
- `freshness: 'unknown'`, `confidence: 'unknown'`, `confidenceLevel: 'UNAVAILABLE'`.
- Timestamps: `obtainedAt: undefined`, `observedAt: undefined`, `cachedAt: undefined`.
- Subsystems: All set to `status: 'unavailable'`, `freshness: 'unknown'`.

---

## 6. Exact vs. Approximate Cache Semantics

A critical architectural distinction exists between standard Level 1 fallback and approximate caching:

| Feature | Standard Level 1 Fallback | Explicit Approximate Cache |
| :--- | :--- | :--- |
| **Selection Mode** | Automatic on live provider failure. | **Strictly Opt-In Only** via explicit method invocation (`tryApproximateCache`). |
| **Spatial Proximity** | Exact grid point match ($0.0\text{ km}$). | Nearby station within $5.0\text{ km}$ radius. |
| **`isExactMatch`** | `true` | `false` |
| **`isApproximate`** | `false` | `true` |
| **`approximateDistanceKm`** | `0` | $> 0$ (e.g. $2.4\text{ km}$) |
| **Requested Coordinates** | Preserved exactly. | **Preserved exactly** (never overwritten with provider coords). |
| **Provider Coordinates** | Original grid point. | Cached neighbor's grid point. |
| **Confidence** | `HIGH` (if fresh) / `MODERATE` | Capped at `MODERATE` due to spatial interpolation. |
| **Diagnostic Note** | None | `"Explicit approximate cache — not part of normal Level 1 fallback."` |
| **UI Badge** | `Level 1: Same-Location Cache` | `Explicit Approximate Cache (Not Normal Level 1)` |

---

## 7. Coordinate Provenance & Preservation

To avoid geo-drift bugs, coordinates are tracked via two distinct tuples:
1. `requestedCoordinates`: The exact geographic latitude and longitude requested by the client or resolved from geocoding. This tuple is immutable throughout the fallback lifecycle.
2. `providerCoordinates`: The actual atmospheric model grid cell center or weather station coordinates returned by the upstream service.

In approximate caching, `requestedCoordinates` retains the user's requested location, while `providerCoordinates` reflects the neighbor station, and `approximateDistanceKm` provides the Vincenty/Haversine distance between them.

---

## 8. Official vs. Derived Data Integrity

Mausam enforces sovereign authority transparency:
- `isOfficial: false` across all Open-Meteo, NOAA GFS, DWD ICON, ECMWF open tiers, and Mausam algorithmic outputs.
- Only data originating from verified official government agencies (such as official IMD RSMC cyclone bulletins, CWC river flood warnings, or INCOIS high-wave alerts) may bear `isOfficial: true`.
- Derived models (convective risk, NAQI approximations, climatological normal comparisons, hydrology runoff) are explicitly marked with `isDerived: true` and accompanied by clear disclaimer notices.

---

## 9. Subsystem-by-Subsystem Audit Summary

| Subsystem | Source Name | Source Type | Default Status | Timestamp Behavior | Official? | Derived? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `current` | Open-Meteo Global Numerical Models | `live` / `cache` | `available` | `observedAt` from station (if present) + `obtainedAt` | No | No |
| `hourly` | Open-Meteo Hourly Numerical Forecast | `live` / `cache` | `available` | `obtainedAt` only (`observedAt: undefined`) | No | No |
| `daily` | Open-Meteo 10-Day Numerical Forecast | `live` / `cache` | `available` | `obtainedAt` only (`observedAt: undefined`) | No | No |
| `airQuality` | Atmospheric Chemistry & CPCB NAQI algorithm | `live` / `derived` | `available` | `obtainedAt` only | No | Yes (NAQI formula) |
| `marine` | Copernicus Marine Environment Monitoring Service | `live` / `not-applicable` | `not-applicable` (inland) / `available` (coastal) | `obtainedAt` only | No | No |
| `flood` | Mausam Hydrology Engine (Open-Meteo precipitation input) | `derived` | `derived` / `available` | `obtainedAt` only | No | Yes (hydrological model) |
| `radar` | RainViewer Radar Tile Service (Map Layer Only) | `not-applicable` | `not-applicable` | Timestamps `undefined`, freshness `unknown` | No | No |
| `thunderstorm` | Mausam Intelligence Engine (Convective Risk) | `derived` | `derived` | `obtainedAt` only (`observedAt: undefined`) | No | Yes |
| `alerts` | Mausam Meteorological Hazard Surveillance | `derived` | `derived` | `obtainedAt` only (`observedAt: undefined`) | No | Yes |
| `cyclone` | Mausam Storm Surveillance (Open Data) | `derived` | `derived` | `obtainedAt` only (`observedAt: undefined`) | No | Yes |
| `historical` | Open-Meteo Archive API — ERA5 Reanalysis | `live` / `derived` | `available` | `obtainedAt` only (`observedAt: undefined`) | No | No / Yes |

---

## 10. Summary of Architectural Guarantees

1. **No Fake Radar Observations**: Radar reflectivity data is served strictly on-demand as map image tiles in the interactive Map view; no synthetic Doppler radar reflectivity values are added to numerical payloads.
2. **Deterministic Unavailable State**: If all sources fail, Level 5 provides a zero-hallucination, unpopulated state with transparent reasons.
3. **No Unannounced Spatial Substitution**: Level 1 fallback guarantees same-location cache. Spatially approximate data is quarantined behind explicit opt-in invocations and prominent UI labeling.
4. **Accurate Provider Lineage**: Flood monitoring is explicitly disclosed as Mausam's internal hydrological calculation driven by precipitation data rather than direct GloFAS ingestion; historical reanalysis is credited via Open-Meteo Archive API.
