# MAUSAM — Phase 4G Intelligence Reliability & Decision Integrity

## 1. Governing Core Principles

The MAUSAM Indian Weather Intelligence application strictly enforces two non-negotiable architectural mandates across all layers:

```
REAL DATA > DERIVED DATA > EXPLANATION
```
and
```
UNKNOWN ≠ SAFE
UNKNOWN ≠ LOW RISK
UNKNOWN ≠ GOOD
UNKNOWN ≠ ZERO
```

No UI component, service, fallback, demo dataset, or intelligence function may present fabricated, synthetic, or illustrative values as live/current observations.

---

## 2. Single Source of Truth (SSoT) Architecture

### Canonical Intelligence Engine (`src/services/weatherIntelligenceEngine.ts`)
All domain-specific weather intelligence is centralized into `weatherIntelligenceEngine.ts`. This engine computes:
- **AgroMet Advisory**: Agricultural warnings, sowing recommendations, spray feasibility, livestock stress indices, and irrigation guidance based on actual temperature, humidity, rainfall, and wind conditions.
- **Marine & Coastal Intelligence**: Wave height, swell direction, sea surface temperature, sea state categorization, and swimming safety.
- **Hydrological Catchment & Flood Risk**: River basin discharge estimation, 3-day catchment rainfall, river trends, and flood risk categorization.
- **Thunderstorm & Convective Nowcasting**: CAPE convective instability proxies, lightning likelihood, squall gust risk, and peak active windows.
- **Tropical Cyclone Surveillance**: Active storm tracking across the Bay of Bengal and Arabian Sea, max sustained winds, and central pressure monitoring.
- **Air Quality Intelligence**: CPCB NAQI standard categorization, sub-index calculations, and health advisories.
- **Copernicus ERA5 Climate History**: 30-year climate reanalysis baselines and temperature/precipitation anomalies.

### Legacy Bridge Deprecation (`src/services/weatherService.ts`)
Direct generation of agricultural advisories in `weatherService.ts` (`generateAgroMetAdvisory`) is deprecated and superseded by `weatherIntelligenceEngine.ts`'s canonical `computeAgroMetAdvisory`. All consumers resolve intelligence through `getCompleteWeatherIntelligence()`.

---

## 3. Geospatial & Map Telemetry Integrity (`RadarMapSection.tsx`)

### Elimination of Hardcoded Simulated Stations
- **No Fabricated Data**: Legacy hardcoded station arrays (`COASTAL_STATIONS`, `BASIN_STATIONS`) containing static or random wave heights, water levels, or temperatures have been completely eliminated.
- **Props-Driven Architecture**: `RadarMapSection` receives live telemetry from `App.tsx`:
  - `marine?: NormalizedMarine`
  - `flood?: NormalizedFloodRisk`
  - `alerts?: WeatherAlert[]`
  - `currentWeather?: WeatherData`
- **Reference Waypoints vs. Live Telemetry**:
  - The map renders reference waypoints (`REGIONAL_OBSERVATION_STATIONS`) to indicate monitoring stations across India.
  - When active city telemetry is available, the active station pin renders verified live observations.
  - Waypoints clearly disclose that interactive taps query live point-forecast APIs.
- **Contextual Layer Status Banners**:
  - Every active layer (`marine`, `flood`, `temp`, `wind`, `risk`) displays an explicit status banner communicating data availability, sensor limitations, and interaction instructions.
- **Measured Metrics**:
  - Invented "Rain Likelihood" heuristics (e.g. `cloudCover > 50 ? 35% : 10%`) have been replaced with direct, measured meteorological readings (`Cloud Cover: X%`).

---

## 4. UI Component Confidence & Claim Strength Audit

| Component | Audit Scope | Reliability Hardening Implemented |
|---|---|---|
| `MausamMarineCard` | Coastal marine & swimming safety | Explicit `isUnavailable` guard; prevents missing/unknown wave conditions from defaulting to green ("Safe"); displays explicit "Unavailable" badges and metric disclaimers. |
| `MausamThunderstormCard` | Convective risk & lightning | Unknown risk levels never default to emerald green; explicit `Unavailable` state when convective models are offline. |
| `MausamFloodRiskCard` | Catchment runoff & river trend | Standardized terminology: "Mausam Catchment Runoff / Hydrology Model (Open-Meteo precipitation input)"; explicitly marked as derived model, not direct GloFAS/CWC river-gauge telemetry. Dedicated offline state when precipitation inputs fail. |
| `MausamCycloneCard` | Cyclone tracking & basin alerts | Added `isUnavailable` check; distinguishes official IMD RSMC bulletins from numerical model surveillance. |
| `MausamHistoricalClimateCard` | ERA5 climate reanalysis | Explicit `isUnavailable` check when archive reanalysis data is missing or empty; anomalies rendered with exact signs and baseline notices. |
| `TravelModeSection` | Highway corridor route | Prominently displays "Illustrative Corridor • Not Live" badge and amber transparency notice; road conditions use sample reference values; strictly flagged `isLive: false`. |
| `MausamGramSection` | Citizen ground truth observations | Uses actual current station temperature and allows citizen user temperature input rather than arbitrary hardcoded values. |

---

## 5. Verification & Regression Testing

The intelligence reliability suite validates:
1. **Single Source of Truth**: AgroMet and marine intelligence produce consistent decisions across all consumers.
2. **Offline & Partial Fallbacks**: Missing parameters result in `Unavailable` or `Unknown` statuses rather than false reassurances (`Low`, `Safe`, or `Good`).
3. **Attribution & Transparency**: Every subsystem preserves `SourceMetadata` including `providerId`, `attributionText`, `isOfficialIMD`, and freshness timestamps.
4. **Interactive Map Verification**: Tapping points queries real Open-Meteo point forecasts without synthetic fallback values.

---

## 6. Phase 4H-C Provenance & Precision Standards

### 1. Coordinate Precision Standard (`toFixed(5)`)
- **5-Decimal Precision (~1.1m on ground)**: Canonical coordinate normalization (`coordinateUtils.ts`) and cache-key generation (`WeatherCacheManager.ts`) enforce `norm.lat.toFixed(5)` and `norm.lon.toFixed(5)`.
- **Collision Prevention**: Eliminates cache-key collisions between distinct micro-locations (e.g., Pune stations separated by ~30–50 meters that would collide under 4 decimals). Verified by Phase 4D regression test 37.

### 2. Hydrology Model Terminology
- **Truthful Model Attribution**: Standardized across UI, provider metadata, and logs as **Mausam Catchment Runoff / Hydrology Model (Open-Meteo precipitation input)**.
- **Explicit Disclaimers**: Clarifies: *"Derived model; not direct GloFAS or Central Water Commission (CWC) river-gauge telemetry."*
- **No False Official Claims**: Preserves `isOfficialIMD: false` and `isDerived: true` across all hydrological payloads.

### 3. Travel Mode Limitations
- **Unmistakable Status**: Marked with **Illustrative Corridor • Not Live** badge and persistent contextual alert banner.
- **Reference Simulation**: Discloses that real-time highway waypoint sensor telemetry is offline; displays sample reference values only.

