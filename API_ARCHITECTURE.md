# MAUSAM Weather Intelligence API Architecture

## 1. Architectural Overview

Mausam adopts a **Provider-Agnostic, Unified Engine Architecture**. The system decouples raw external data ingestion from UI rendering through strict adapter interfaces, normalized domain schemas, in-memory caching, and a multi-tier fallback pipeline.

```
                    ┌──────────────────────────────────────────────┐
                    │               User Interface                 │
                    │   (Hero, Radar, Alerts, Personas, AgroMet)   │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │      WeatherIntelligenceEngine (Singleton)   │
                    │   - Stale-While-Revalidate In-Memory Cache   │
                    │   - Convective Thunderstorm Algorithm        │
                    │   - Multi-Model Consensus & Normalization    │
                    │   - Legacy Adapter (100% Backward Compat)    │
                    └──────────────────────┬───────────────────────┘
                                           │
         ┌───────────────┬─────────────────┼────────────────┬───────────────┐
         ▼               ▼                 ▼                ▼               ▼
┌─────────────────┐┌──────────────┐┌──────────────┐┌───────────────┐┌───────────────┐
│ OpenMeteoAdapter││NominatimAdapt││NasaGibsAdapt ││CopernicusAdapt││  GlofasAdapt  │
│ - ECMWF/GFS     ││- OSM Search  ││- MODIS Tiles ││- ERA5 Climate ││- River Flow   │
│ - CAMS AQI      ││- Reverse Geo ││- VIIRS Tiles ││- Climatology  ││- Flood Alert  │
│ - Marine WAM    ││              ││              ││               ││               │
└─────────────────┘└──────────────┘└──────────────┘└───────────────┘└───────────────┘
```

---

## 2. Core Modules & Provider Interfaces

Every external service implements a strictly typed provider interface (`src/services/providers/providerTypes.ts`):

1. **`IWeatherProvider`**:
   - Primary source for surface weather, hourly forecast, and multi-day outlooks.
   - Standard output: `NormalizedCurrentWeather`, `NormalizedForecast`.

2. **`IAirQualityProvider`**:
   - Particulate matter (PM2.5, PM10) and gaseous pollutants.
   - Computes CPCB Indian National AQI category and dominant pollutant.

3. **`IMarineProvider`**:
   - Wave dynamics for coastal stations (`significantWaveHeight`, `swellPeriod`, `seaTemperature`).
   - Automatically detects whether a station is coastal or inland to preserve clean UI presentation.

4. **`ISatelliteProvider`**:
   - Web Mercator tile endpoint generation for NASA GIBS daily MODIS / VIIRS true-color composites.

5. **`IFloodProvider`**:
   - River discharge and catchment runoff estimated by Mausam Hydrology Engine using Open-Meteo precipitation input.

6. **`IHistoricalWeatherProvider`**:
   - Computes 10-year monthly temperature and rainfall baseline departures using Open-Meteo Archive API (ERA5 reanalysis).

7. **`ICycloneProvider`**:
   - North Indian Ocean (Arabian Sea and Bay of Bengal) tropical cyclone tracking and coastal threat advisories.

---

## 3. Data Normalization & Provenance Model

Every normalized object carries an immutable `source: SourceMetadata` stamp:

```typescript
export interface SourceMetadata {
  providerId: string;
  providerName: string;
  classification: 'open-source-software' | 'open-data' | 'free-api-service' | 'official-government-agency';
  isOfficialIMD: boolean;
  isDerived: boolean;
  timestamp: string;
  confidenceScore: number; // 0 - 100
  attributionText: string;
}
```

This guarantees complete traceability across the UI, enabling users to click *"View Sources"* to verify data origins.

---

## 4. Convective Thunderstorm & Lightning Risk Engine

Because raw NWP forecasts may understate sudden pre-monsoon squalls (e.g., Kalbaisakhi/Nor'westers), Mausam implements a dedicated convective instability model:

$$\text{RiskScore} = f(\text{WMO Convective Code}, \text{Rain Rate}, \text{Precipitation Prob}, \text{Dew Point / Humidity}, \text{Wind Gust})$$

- **Severe (Score $\ge 75$)**: CAPE extreme instability, squally gusts $\ge 60$ km/h, widespread lightning risk.
- **High (Score $55-74$)**: High convective energy, scattered lightning strikes, gusty winds.
- **Elevated (Score $35-54$)**: Moderate instability, localized thunder showers.
- **Moderate / Low (Score $< 35$)**: Stable atmospheric column.

---

## 5. Reverse Geocoding & High-Performance Caching

- **Cache TTL**: 10 minutes (`600,000 ms`) for weather intelligence, 24 hours for geocoding.
- **Cache Strategy**: Keyed by rounded geographic coordinate pair `loc-${lat.toFixed(3)}-${lon.toFixed(3)}`.
- **Stale Serving**: In the event of network dropouts or transient provider timeouts, the engine serves stale cached intelligence marked with a warning note, rather than crashing the client interface.
