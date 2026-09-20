# LOCATION RELIABILITY & COORDINATE INTEGRITY ARCHITECTURE
**MAUSAM — Indian Weather Intelligence Platform**
**Phase 4E Technical Architecture & Verification Specification**

---

## 1. Executive Summary

Phase 4E enforces strict **geographic fidelity and coordinate integrity** across all ingestion, resolution, caching, fallback, and UI presentation pipelines in MAUSAM.

### The Core Operational Axiom
> **"MAUSAM MUST NEVER SILENTLY SUBSTITUTE A DIFFERENT GEOGRAPHIC LOCATION FOR THE LOCATION SELECTED BY THE USER."**
>
> *"Fallback may change the DATA SOURCE, but it must NEVER change the LOCATION. Coordinates are the authoritative identity of a location."*

---

## 2. Authoritative Coordinate Identity

1. **Coordinates Over Administrative Names**:
   - In India, many villages, towns, and districts share identical or phonetically similar names (e.g., Rampur, Bilaspur, Aurangabad). Administrative names are merely descriptive metadata; **numerical WGS84 coordinates are the sole authoritative identity**.
2. **Deterministic 5-Decimal Normalization**:
   - Coordinates are normalized to **5 decimal places** ($\approx 1.1\text{ m}$ ground resolution).
   - This provides sufficient resolution to distinguish nearby observation points, hyper-local micro-climates, and agricultural fields while preventing floating-point noise and key collisions.
   - Normalized coordinate format:
     $$\text{lat} = \text{round}(rawLat \times 10^5) / 10^5, \quad \text{lon} = \text{round}(rawLon \times 10^5) / 10^5$$
3. **Signed Zero & Boundary Safety**:
   - Coordinates like `-0.0` normalize deterministically to `0.0`.
   - `NaN`, `Infinity`, non-numerical types, and out-of-bounds coordinates ($lat \notin [-90, 90]$, $lon \notin [-180, 180]$) are rejected at the edge.

---

## 3. Indian Subcontinent Bounding & Validation

Geographic boundaries for Indian territory and maritime economic zones are enforced to prevent erroneous overseas geocoding results:

```typescript
export const INDIA_BOUNDS = {
  minLat: 6.0,  // Encompasses Indira Point & Great Nicobar (6.75°N)
  maxLat: 37.6, // Encompasses Northern Kashmir / Ladakh (37.1°N)
  minLon: 68.0, // Encompasses Western Gujarat (Guhar Moti 68.5°E)
  maxLon: 97.5, // Encompasses Eastern Arunachal Pradesh (Kibithu 97.0°E)
};
```

- Any location result resolved outside these bounds during Indian place search is filtered out.
- Overseas coordinates requested directly (e.g., for maritime or global analysis) are handled honestly without re-centering to Delhi or Mumbai.

---

## 4. Geocoding & Reverse Geocoding Pipeline Integrity

### 4.1 Forward Geocoding
- Queries to Open-Meteo Geocoding API and OpenStreetMap Nominatim are routed through secure server-side proxies (`/api/geocode` and `/api/search-location`) with strict **8-second timeouts** and upstream rate-limit propagation (`429`, `504`).
- Results are strictly validated: records missing valid numerical `latitude` or `longitude` are discarded.
- **Zero Silent Substitution**: If a place search yields 0 matches, the system displays an honest empty state (`"No locations found"`). It **never** substitutes a default city like Mumbai or Delhi.

### 4.2 Reverse Geocoding & Reverse-Cache Precision
- When converting coordinates to a human-readable name (e.g., GPS geolocation, map click, or radar tap), reverse geocoding **MUST NEVER alter the requested coordinates**.
- Reverse geocoding enriches place metadata (`name`, `state`, `district`, `postcode`) while preserving the exact input coordinates:
  $$\text{resolvedLocation.latitude} \equiv \text{requestedCoordinates.latitude}$$
  $$\text{resolvedLocation.longitude} \equiv \text{requestedCoordinates.longitude}$$
- **Reverse-Geocoding Cache Precision**: Nominatim reverse-geocode caching operates at **5-decimal precision** (`norm.lat.toFixed(5)_norm.lon.toFixed(5)`), matching $\approx 1.1\text{ m}$ ground resolution. This guarantees that nearby distinct coordinates (e.g., points that share 4 decimals but differ at 5 decimals) are isolated and cannot receive another request's cached coordinates. Even upon a cache hit, the returned object clones and guarantees the exact request's normalized coordinates.
- **Offline / Failure Fallback**: If reverse geocoding is unreachable or fails, the system constructs a transparent coordinate descriptor (e.g., `Location (18.5204°N, 73.8567°E)`), retaining the exact user coordinates rather than assigning the nearest known metropolis.

### 4.3 Standardized Spatial Deduplication (150m)
- Standardized across all geocoders and location resolution pipelines (`LocationResolver` and `NominatimProvider`) using the centralized constant `LOCATION_DEDUPLICATION_THRESHOLD_KM = 0.15` (150 meters) in `coordinateUtils.ts`.
- Multiple geocoder hits for the same physical entity within **150 meters** ($\le 0.15\text{ km}$) are deduplicated using high-precision Haversine calculations.
- Distinct locations separated by $> 150\text{ meters}$ are strictly preserved as separate selectable options.

### 4.4 Outside-India GPS & Coordinate Metadata Honesty
- When user coordinates lie outside the domestic Indian boundary region ($[6.0, 37.6]^\circ\text{N}$, $[68.0, 97.5]^\circ\text{E}$):
  - The system honestly flags them as outside standard Indian bounds without falsely assigning `state: 'India'`.
  - In `LocationResolver.resolveFromCoordinates()`, un-geocoded or offline fallback state defaults to `'Unknown'` (or the genuine foreign region when reverse-geocoded), preserving strict geographic veracity.

---

## 5. Fallback Hierarchy Location Invariant

The 6-tier resilient fallback hierarchy guarantees that meteorological degradation never causes spatial shifting:

| Tier | Name | Location Policy | Coordinate Rule |
| :--- | :--- | :--- | :--- |
| **Level 0** | Fresh Live Data | User requested location | Exact coordinates sent to numerical models |
| **Level 1** | Same-Location Cache | User requested location | Exact cache match ($< 0.001\text{ km}$ / $\approx 1\text{ m}$) |
| **Level 2** | Alternate Provider | User requested location | Identical coordinates queried from secondary numerical model (GFS/ICON) |
| **Level 3** | Partial Data | User requested location | Failed subsystems marked offline; coordinates unchanged |
| **Level 4** | Derived Intelligence | User requested location | Convective/agro formulas computed for exact coordinates |
| **Level 5** | Honest Unavailable | User requested location | Displays retry UI with original location name & coordinates intact |

### Invariant Rule
> *"Fallback may change the provider or data status, but must NEVER return another city's weather under the user's selected location name."*

---

## 6. Stale Request & Concurrency Protection

In rapid user interaction (e.g., user selects Location A, then immediately switches to Location B):
- An asynchronous sequence counter (`activeWeatherRequestSeqRef`) tracks the active location request.
- If request A completes after request B has already been initiated, response A is discarded immediately.
- The UI is guaranteed to reflect only the latest selected location, preventing out-of-order race conditions from displaying Location A's telemetry under Location B's banner.

---

## 7. Data Provenance & Transparency Contract

Every weather response contains an immutable `DataProvenance` structure that documents coordinate alignment:

```typescript
export interface DataProvenance {
  sourceId: string;
  sourceName: string;
  sourceType: 'live' | 'cache' | 'derived' | 'partial' | 'unavailable';
  fallbackLevel: 0 | 1 | 2 | 3 | 4 | 5;
  isExactMatch: boolean;
  requestedCoordinates: { latitude: number; longitude: number };
  providerCoordinates?: { latitude: number; longitude: number };
  coordinateMismatchWarning?: boolean;
  approximateDistanceKm?: number;
  limitations: string[];
}
```

- If an explicit approximate cache entry is utilized (opt-in only), `isExactMatch` is set to `false`, `approximateDistanceKm` is populated with actual Haversine distance, and confidence is visibly degraded.
- Normal Level 1 fallback strictly requires `isExactMatch: true`.

---

## 8. Verification Matrix (Phase 4E Suite)

All 23 critical location reliability requirements are verified via `scripts/verify_phase4e.ts`:

| Test ID | Requirement | Verification Method | Status |
| :---: | :--- | :--- | :---: |
| **1** | Coordinate validity & boundary enforcement | Unit boundary testing | **PASS** |
| **2** | Indian subcontinent bounds verification ($[6.0, 37.6]\text{N}, [68.0, 97.5]\text{E}$) | Geodetic boundary testing | **PASS** |
| **3** | Deterministic 5-decimal coordinate normalization ($\approx 1.1\text{m}$) | Precision & signed-zero test | **PASS** |
| **4** | Haversine distance calculation accuracy | Geodetic distance validation | **PASS** |
| **5** | Reverse geocoding preserves exact coordinates | Integration geocoding test | **PASS** |
| **6** | Reverse geocoding failure fallback preserves coordinates | Remote/offline fallback test | **PASS** |
| **7** | Nominatim provider input validation & health tracking | Unit validation & health test | **PASS** |
| **8** | Spatial deduplication precision ($<150\text{m}$ grouped, $>150\text{m}$ preserved) | Spatial threshold test | **PASS** |
| **9** | No silent substitution on unmatched search queries | Zero-result honesty test | **PASS** |
| **10** | India bounding box enforcement on location catalog & results | Catalog integrity test | **PASS** |
| **11** | WeatherCacheManager exact coordinate enforcement ($<1\text{m}$) | Cache key & retrieval test | **PASS** |
| **12** | Approximate cache retrieval is strictly opt-in | Cache opt-in transparency test | **PASS** |
| **13** | FallbackManager `trySameLocationCache` preserves location | Fallback recovery test | **PASS** |
| **14** | FallbackManager Level 5 Honest Unavailable State integrity | Honest state validation | **PASS** |
| **15** | DataProvenance coordinate tracking & transparency | Provenance inspection test | **PASS** |
| **16** | Saved locations service coordinate validation & normalization | Database service test | **PASS** |
| **17** | Search history service coordinate validation | Database service test | **PASS** |
| **18** | End-to-end Fallback Hierarchy location invariant | Live-to-fallback invariant test | **PASS** |
| **19** | 4-decimal reverse-cache collision protection & 5-decimal isolation | Regression cache collision test | **PASS** |
| **20** | 5-decimal reverse-cache exact coordinate preservation on cache hit | Regression cache hit integrity test | **PASS** |
| **21** | Actual LocationResolver dedup threshold standardized to 150m (0.15km) | Unit dedup threshold standardization test | **PASS** |
| **22** | 150m grouped / >150m preserved in LocationResolver deduplication | Integration spatial boundary test | **PASS** |
| **23** | Outside-India GPS & coordinate metadata consistency (no forced state="India") | Regression metadata integrity test | **PASS** |
