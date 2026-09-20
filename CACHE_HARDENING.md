# CACHE HARDENING & PERFORMANCE ARCHITECTURE
**MAUSAM — Indian Weather Intelligence Platform**
**Phase 4D Technical Architecture & Verification Specification**

---

## 1. Executive Summary

Phase 4D hardens MAUSAM's caching layer to guarantee **location integrity**, **dataset-level freshness boundaries**, **resilience against cache poisoning**, and **high-concurrency safety**. 

### The Core Operational Axiom
> **REQUESTED LOCATION > CACHE CONVENIENCE**  
> *"Fallback may change the data source, but must NEVER silently change the user's requested location. Never return another location's weather merely because it is cached."*

---

## 2. Deterministic Cache Key Contract

All cache keys adhere to a strict, canonical format:

$$\text{weather}:\langle\text{normalized-lat}\rangle:\langle\text{normalized-lon}\rangle:\langle\text{dataset}\rangle$$

### Key Construction Rules
1. **Authoritative Coordinates**: Cache identity is based solely on numerical WGS84 geographic coordinates. Location names, slugs, or administrative labels are never used as primary cache keys to eliminate semantic ambiguity and collision across homonymous Indian locations.
2. **Normalized Floating Point Precision**:
   - Normalized to **5 decimal places** ($\approx 1.1$ meters precision on ground).
   - This provides finer geographic identity than the previous 4-decimal normalization ($\approx 11$ meters) and eliminates unintended cache/in-flight key collisions between distinct nearby locations, aligning with the platform's exact-match tolerance (~1 meter).
   - Microscopic floating-point noise is eliminated while preserving micro-scale meteorological differentiation.
   - Consistent signed-zero handling: $-0$ and $+0$ map identically to $0.00000$.
3. **Invalid Coordinate Rejection**:
   - `NaN`, `Infinity`, `-Infinity`, non-numerical inputs, out-of-bounds latitudes ($[-90, 90]$), and longitudes ($[-180, 180]$) are rejected at the normalization layer and cannot produce cache keys.
4. **Dataset Isolation**:
   - Cache keys terminate with the specific subsystem dataset identifier (`complete`, `current`, `hourly`, `daily`, `airQuality`, `marine`, `flood`, `historical`, `alerts`, `derived`).
   - Cross-dataset contamination is impossible: a query for air quality cannot return a surface temperature forecast.

---

## 3. Dataset-Specific TTL Policies

Cache TTL dictates cache entry viability for Level 1 Fallback. It is decoupled from Phase 4C meteorological freshness (which measures elapsed real time since observation):

| Dataset Type | Subsystem Scope | Fresh TTL | Stale Fallback TTL | Description |
| :--- | :--- | :--- | :--- | :--- |
| `current` | Surface observations | 15 min | 1 hour | Real-time surface parameters (temperature, humidity, wind) |
| `hourly` | 24–48 hr forecast | 30 min | 6 hours | High-resolution hourly numerical model steps |
| `daily` | 7–16 day synoptic | 2 hours | 24 hours | Multi-day atmospheric synoptic summaries |
| `airQuality` | CPCB NAQI telemetry | 30 min | 6 hours | CPCB monitoring station readings & dispersion forecasts |
| `marine` | Ocean wave/swell | 1 hour | 12 hours | Coastal sea-state wave heights & swells |
| `flood` | River catchment runoff | 3 hours | 24 hours | Catchment hydrology and river basin flood indicators |
| `historical` | ERA5 climate normals | 24 hours | 7 days | Reanalysis baselines and long-term climatology |
| `alerts` | Warnings & notices | 10 min | 1 hour | Severe weather, thunderstorm, and heavy rain alerts |
| `derived` | Agromet/Risk indices | 15 min | 2 hours | Algorithmic convective and agro-meteorological risks |
| `complete` | Weather intelligence bundle | 10 min | 24 hours | Composite multi-dimensional weather intelligence |

### Freshness vs. Cache TTL Distinction
- **Temporal Freshness (Phase 4C)**: Derived from the provider observation timestamp (`observedAt` or `obtainedAt`) to categorize current recency (`fresh`, `recent`, `stale`, `very-stale`, `unknown`).
- **Cache TTL (Phase 4D)**: Governs internal cache lifecycle (`isStale: now > freshUntil`, `isExpired: now > staleUntil`). Expired entries (`now > staleUntil`) are strictly barred from satisfying normal cache requests.

---

## 4. Location Integrity & Fallback Compliance

1. **Exact Cache Exclusivity**:
   - Normal automatic fallback (Level 1 Same-Location Cache) strictly executes `getExact(lat, lon)`.
   - Any cached entry whose ground distance to the requested coordinates exceeds $0.001\text{ km}$ ($1\text{ m}$) is rejected.
2. **Approximate Cache Opt-In Rule**:
   - Approximate spatial cache lookup is **NEVER** automatic.
   - It is only triggered if explicitly requested with `{ allowApproximate: true }` (or via `tryApproximateCache`).
   - Returned approximate data explicitly flags `isExactMatch: false`, `isApproximate: true`, attaches `approximateDistanceKm`, preserves `originalCoordinates` and `originalProviderCoordinates`, and visibly degrades confidence to `MODERATE` or `LOW`.
3. **No False Level 0 Conversion**:
   - An expired or stale cache hit never masquerades as Level 0 live data. Its fallback level remains Level 1.

---

## 5. Cache Poisoning & Write Safety

Before any payload is admitted into cache storage, `WeatherCacheManager.validatePayloadForCache()` verifies:
1. **Null/Undefined Payloads**: Instantly rejected.
2. **Error Responses & Status Codes**: HTTP errors, gateway timeouts, 4xx/5xx responses, or objects with `{ error: ... }` are rejected.
3. **Level 5 Honest Unavailable State**: When all providers fail, Level 5 Honest Unavailable State objects (`isUnavailable: true`, `fallbackLevel: 5`) must **NEVER** be cached as valid weather data.
4. **Finite Numerical Meteorology**: For `complete` and `current` datasets, `current.temperature` must be a valid, finite number (not `NaN` or `Infinity`).
5. **Array Integrity**: Forecast daily and hourly datasets must be valid arrays.
6. **Provenance Presence**: Every payload must contain valid `provenance` and `freshness` metadata.
7. **Valid Partial Data Handling**: Level 3 partial data (where core weather is sound but a secondary subsystem such as AQI is unavailable) is permitted to be cached, provided its subsystem status truthfully records `unavailable` and does not fabricate missing parameters.
8. **Failed Refresh Safety**: When live retrieval fails (timeout, 5xx, network error), the existing cache remains untouched and fully accessible.

---

## 6. Concurrency & Race Condition Protection

### In-Flight Request Deduplication
When multiple concurrent requests arrive for the exact same normalized coordinates (e.g. rapid page navigation, multi-component rendering):
- `WeatherCacheManager.deduplicateInFlight(key, fetcher)` registers the active Promise in an in-memory registry.
- Subsequent concurrent callers receive the identical in-flight Promise, preventing thundering herds and redundant upstream API calls.
- Upon Promise settlement (success or failure), a `finally` block guarantees eviction from the in-flight registry.
- Distinct coordinates generate distinct keys and execute concurrently without mutual blocking.

### Race Condition Protection (Stale-Write Rejection)
When slow request $A$ finishes after faster, newer request $B$:
- `WeatherCacheManager.set()` compares `incomingObtainedTime` with `existingObtainedTime`.
- If incoming data is older than the currently cached data, the write is safely rejected, preventing stale overwrites.

---

## 7. Memory Safety & Bounded Eviction

- **Capacity Limit**: Enforces a strict upper bound of `MAX_CACHE_ENTRIES = 200` entries.
- **Eviction Protocol**:
  1. On insertion when size reaches capacity, `cleanupExpired()` runs first to evict stale entries (`now > staleUntil`).
  2. If size remains at capacity, a Least Recently Used (LRU) algorithm evicts the entry with the oldest `lastAccessedAt` timestamp.
- **Operational Diagnostics**:
  - `getDiagnostics()` exposes real-time telemetry: `hits`, `misses`, `expiredHits`, `evictions`, `approximateHits`, `writesAccepted`, `writesRejected`, `deduplicatedRequests`, and `currentSize`.

---

## 8. Provenance & Timestamp Integrity

1. **`cachedAt` Semantics**:
   - `cachedAt` represents the exact timestamp (`Date.now()`) when an entry is committed to cache.
   - Live responses returned directly from network providers leave `cachedAt` strictly `undefined`.
2. **`obtainedAt` Immutability**:
   - Original HTTP retrieval timestamps (`obtainedAt`) are never overwritten or replaced by `cachedAt`.
3. **`observedAt` Zero Fabrication**:
   - If an upstream provider omits observation times, `observedAt` remains strictly `undefined`.
4. **Full Provenance Preservation**:
   - Cache hits preserve all Phase 4C metadata: `sourceId`, `sourceName`, `fallbackLevel`, `isOfficial`, `isExactMatch`, `requestedCoordinates`, `providerCoordinates`, and `subsystems` breakdown.

---

## 9. Verification & Regression Protection

The 37 automated verification tests in `scripts/verify_phase4d.ts` provide continuous end-to-end regression validation:

| Test ID | Requirement | Result |
| :--- | :--- | :--- |
| **TEST 1** | Deterministic cache-key generation | **PASS** |
| **TEST 2** | Invalid coordinate rejection | **PASS** |
| **TEST 3** | Coordinate collision prevention | **PASS** |
| **TEST 4** | Dataset cache isolation | **PASS** |
| **TEST 5** | Exact cache hit | **PASS** |
| **TEST 6** | Exact cache miss | **PASS** |
| **TEST 7** | Approximate cache is NOT automatic | **PASS** |
| **TEST 8** | Explicit approximate cache works | **PASS** |
| **TEST 9** | TTL fresh entry | **PASS** |
| **TEST 10** | TTL expired entry | **PASS** |
| **TEST 11** | Expired entry does not become Level 0 | **PASS** |
| **TEST 12** | Expired entry provenance remains truthful | **PASS** |
| **TEST 13** | Failed provider response does not overwrite good cache | **PASS** |
| **TEST 14** | Timeout does not overwrite good cache | **PASS** |
| **TEST 15** | HTTP 5xx does not overwrite good cache | **PASS** |
| **TEST 16** | Invalid payload does not enter cache | **PASS** |
| **TEST 17** | Empty payload does not enter cache | **PASS** |
| **TEST 18** | Level 5 unavailable state is not cached as normal weather data | **PASS** |
| **TEST 19** | Valid partial data can be cached safely | **PASS** |
| **TEST 20** | Partial data preserves subsystem provenance | **PASS** |
| **TEST 21** | `cachedAt` is generated only on successful cache write | **PASS** |
| **TEST 22** | `obtainedAt` is not replaced by `cachedAt` | **PASS** |
| **TEST 23** | `observedAt` is not fabricated | **PASS** |
| **TEST 24** | Cache hit preserves provenance | **PASS** |
| **TEST 25** | Cache hit preserves requested coordinates | **PASS** |
| **TEST 26** | Cache hit preserves provider coordinates | **PASS** |
| **TEST 27** | Concurrent identical requests are deduplicated | **PASS** |
| **TEST 28** | Failed in-flight request cleans registry | **PASS** |
| **TEST 29** | Different coordinates are NOT deduplicated | **PASS** |
| **TEST 30** | Older response cannot overwrite newer cache entry | **PASS** |
| **TEST 31** | Cache cleanup removes expired entries | **PASS** |
| **TEST 32** | Cache size remains bounded | **PASS** |
| **TEST 33** | Dataset-specific TTLs are respected | **PASS** |
| **TEST 34** | Guest/account cache isolation remains intact where applicable | **PASS** |
| **TEST 35** | Phase 4B fallback regression | **PASS** |
| **TEST 36** | Phase 4C provenance regression | **PASS** |
| **TEST 37** | Nearby-coordinate collision prevention & in-flight isolation | **PASS** |

**Summary: 37 / 37 tests passing (100%).**
