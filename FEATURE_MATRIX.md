# MAUSAM Feature Matrix & Provider Implementation Map

| Capability | Status | Primary Data Provider | Provider Classification | Update Frequency | Latency / Resolution | Fallback Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Current Weather Conditions** | **LIVE** | Open-Meteo GFS/ECMWF Seamless | Free API / Open Data | Hourly | ~15-20 min / 11 km grid | In-memory Stale Cache (TTL 10m) -> Multi-source retry |
| **Hourly Forecast (24h - 48h)** | **LIVE** | Open-Meteo High-Res Numerical | Free API / Open Data | Hourly | 1-hour steps / 0.1° grid | Cached forecast interpolation |
| **10-Day Extended Outlook** | **LIVE** | Open-Meteo Global Ensemble | Free API / Open Data | 4x daily | Daily summaries | Last successful 10-day ensemble snapshot |
| **Air Quality Index (CPCB)** | **LIVE** | Open-Meteo CAMS Atmospheric Model | Free API / Open Data | Hourly | PM2.5, PM10, NO2, SO2, O3, CO, Dust | Derived AQI category fallback (CPCB sub-indices) |
| **Convective Thunderstorm Risk** | **DERIVED** | Mausam Convective Engine (Open-Meteo Cape/Wind/WMO) | Derived Algorithmic Model | Hourly | 12-hour forward window | Atmospheric stability score derivation |
| **Monsoon Flood Hydrology** | **DERIVED** | Mausam Hydrology Engine (Open-Meteo precipitation input) | Model-Derived Algorithmic | Daily | Catchment precipitation runoff & basin threshold modeling | Return period runoff estimation & elevation heuristics |
| **Tropical Cyclone Surveillance** | **OFFICIAL / DERIVED** | IMD RSMC New Delhi & JTWC Bulletins | Official Gov Agency / Public Advisories | 3-6 hours during active systems | NIO basin track & intensity | Fallback to seasonal baseline & preparedness watch |
| **Coastal Marine & Wave Dynamics** | **LIVE** | Open-Meteo Marine (ECMWF WAM) | Free API / Open Data | 3-hourly | Significant wave height, swell period, sea surface temp | Coastal proximity guard (suppressed for inland cities) |
| **Historical Climate Trends** | **LIVE** | Open-Meteo Archive API — ERA5 Reanalysis | Open Data (via Open-Meteo) | 10-year baseline | Monthly anomaly comparison | ERA5 2014-2024 regional climatology normals |
| **Precipitation Radar Map** | **LIVE** | Open-Meteo Global Precipitation Tiles | Free Open Geospatial Tiles | 15-30 min | Global Leaflet raster tiles | Precipitation probability vector overlay |
| **NASA GIBS True-Color Satellite** | **LIVE** | NASA Earthdata GIBS (MODIS Terra/Aqua) | Open Data (NASA Open Access) | Daily overpasses | 250m TrueColor (Corrected Reflectance) | Standard OpenStreetMap / CartoDB base tile |
| **Wind Streamline Dynamics Map** | **LIVE** | Open-Meteo Surface 10m Wind Grid | Free Geospatial Model | Hourly | Global vector wind speed tiles | Local wind barbs & Beaufort scale badges |
| **Location Geocoding & Search** | **LIVE** | OSM Nominatim + Curated Indian Tier 1-3 Cities | Open Source Software / OpenStreetMap | Real-time | Sub-district resolution | Curated 50+ Indian Metropolitan & District stations |
| **Reverse Geolocation** | **LIVE** | OSM Nominatim Reverse Geocoding API | Open Source Software / OpenStreetMap | Real-time | Exact GPS coordinate pinning | Nearest Major Indian City Euclidean fallback |
| **Krishi Agro-Met Advisories** | **DERIVED** | Mausam Agrometeorological Engine | Algorithmic Expert System | Daily | Crop phenology & microclimate | District seasonal crop advisory table |
| **Highway Travel Weather** | **DERIVED** | Mausam Highway Corridor Router | Algorithmic Route Matrix | Real-time | Key transit routes (e.g., Mumbai-Pune Expressway) | Origin-Destination waypoint estimation |
| **Disaster & Emergency Alerts** | **OFFICIAL / DERIVED** | IMD / NDMA / CAP India Schema | Official Gov Schema & Live Thresholds | Real-time | Color-coded Red/Orange/Yellow/Green | Local severe condition threshold generation |

---

### Status Definitions
- **LIVE**: Directly retrieved from an open-source or free data service with real-time updates.
- **DERIVED**: Scientifically derived from open numerical weather variables (e.g., CAPE, wind shear, moisture saturation).
- **OFFICIAL**: Aligned with official government agency formats (IMD RSMC New Delhi, NDMA, CAP India).
- **OPEN-DATA**: Sourced from public open-science archives (NASA EOSDIS, Copernicus CDS).
