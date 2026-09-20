# MAUSAM Resilience & Multi-Tier Fallback Strategy

## 1. Resilience Philosophy

Weather intelligence applications in the Indian subcontinent must remain functional across heterogeneous network conditions—ranging from high-speed 5G in metropolitan centers to intermittent 2G/EDGE connectivity in rural agricultural districts.

Mausam enforces a **Zero-Crash, Multi-Tier Fallback Strategy**.

---

## 2. Deterministic 6-Tier Fallback Hierarchy

```
[ Level 0: Fresh Live Data ]
       │ (Primary Open-Meteo NWP fails or times out)
       ▼
[ Level 1: Strict Exact Same-Location Cache ]
       │ (Exact coordinate match only via getExact; NO automatic approximate cache)
       ▼
[ Level 2: Alternate Provider at SAME Coordinates ]
       │ (Secondary numerical model GFS/ICON seamlessly at exact user coordinates)
       ▼
[ Level 3: Partial / Subsystem Data ]
       │ (Core weather succeeds, degraded secondary subsystems gracefully marked)
       ▼
[ Level 4: Derived Intelligence ]
       │ (Mausam convective thunderstorm risk & indices calculated from valid data)
       ▼
[ Level 5: Honest Unavailable State ]
         (Location integrity preserved: NEVER substitute a different location;
          UI displays honest '—' missing indicators, not zero-value placeholders)
```

### Invariant: Location Integrity
**"Location integrity has higher priority than data completeness. Fallback may change the data source, but must never silently change the user's requested location."**
Under no circumstances may another city's coordinates, nearby station, or cached forecast be silently substituted when a requested station's feeds fail.

### Level 0: Fresh Live Data
- Primary retrieval from Open-Meteo Global Numerical Models alongside Copernicus ERA5 (via Open-Meteo Archive), Mausam Hydrology Engine, and IMD advisories.
- Full real-time normalization, sub-second latency, and `confidence: HIGH`.

### Level 1: Strict Exact Same-Location Cache
- **Strictly Exact Coordinates Only**: Normal Level 1 fallback exclusively invokes `weatherCacheManager.getExact(lat, lon)`.
- Automatic approximate cache fallback is **completely removed** from Level 1. If an exact cached record for the requested location does not exist, Level 1 returns `null` and execution immediately proceeds to Level 2.
- Returned records are stamped with `status: cached` or `status: stale`, while strictly retaining the user's requested latitude and longitude.
- Poisoned or failed records (`isUnavailable === true`) are strictly prevented from entering or overwriting valid cache entries.

### Level 2: Alternate Provider at SAME Coordinates
- When primary model is down or in circuit-breaker cooldown, queries secondary GFS/ICON numerical models at the exact same requested latitude and longitude.
- Flagged with `fallbackLevel: 2`, `providerId: open-meteo-gfs-icon`.

### Level 3: Partial / Subsystem Data
- If core temperature and forecast succeed but auxiliary modules (AQI, marine, flood) fail, each subsystem is handled individually without failing the primary request.
- Marked with `fallbackLevel: 3`, `status: partial`. Subsystems that fail are rendered with explicit offline notices rather than false default numbers.

### Level 4: Derived Intelligence
- Convective thunderstorm risk and agricultural indices are computed directly from available verified atmospheric parameters (temperature, surface pressure drops, humidity, wind gusts).
- Model-derived alerts are truthfully labeled: `issuedBy: 'Mausam Intelligence Engine'` and `isOfficialWarning: false`. They are never represented as official government bulletins.

### Level 5: Honest Unavailable State
- If all providers and exact cache fail, returns an honest unavailable state (`isUnavailable: true`, `confidence: UNAVAILABLE`).
- The requested coordinates and location identity remain strictly intact.
- **UI Non-Deception Rule**: When `isUnavailable: true`, the user interface displays honest empty state indicators (`—`) rather than zero-value placeholders (e.g., 0°C temperature, 0 km/h wind, or 0 AQI) which could mislead the user into believing extreme or uncharacteristic weather is occurring.

---

## 3. Graceful Degradation by Subsystem

| Subsystem | Failure Trigger | Degradation Behavior |
| :--- | :--- | :--- |
| **Marine Waves** | Station is inland or Marine API returns 400 | Marine card is gracefully omitted; no empty card or broken chart rendered. |
| **Flood Hydrology** | Catchment station out-of-basin or missing precipitation | Displays nominal catchment baseline with regional monsoon runoff context. |
| **NASA GIBS Tiles** | Tile server 404 or cloud blockage | Leaflet falls back seamlessly to CartoDB Voyager or OpenStreetMap raster tiles. |
| **Geocoding** | Nominatim rate limit (429) or offline | Fallback to instant local client-side search across 50+ major Indian stations. |
| **Tropical Cyclone** | No active system in NIO | Displays active surveillance status: *"No active depressions or cyclonic storms currently tracked in NIO basin"*. |

---

## 4. UI Transparency & Integrity

1. **No Phantom Warnings**: Mausam never labels an algorithmic precipitation estimate as an official IMD Warning.
2. **Provider Attribution**: All cards display their exact scientific source (e.g., *"Source: ECMWF IFS & WAM / Open-Meteo"* or *"Source: Copernicus ERA5 Reanalysis"*).
3. **Audit Modal**: Users can click *"View Sources"* at any time to inspect provider licenses, endpoints, and authentication requirements.
