# MAUSAM Open-Source & Free Weather Data Sources Catalog

This catalog documents all open-source, open-data, and free data providers integrated into the **Mausam Weather Intelligence Engine**.

---

## 1. Open-Meteo Weather & Marine API
* **Provider**: Open-Meteo GmbH
* **Classification**: Free API Service / Open Data Aggregator
* **License**: Attribution 4.0 International (CC BY 4.0)
* **Website**: [https://open-meteo.com/](https://open-meteo.com/)
* **Authentication**: None required for non-commercial & standard tiers (up to 10,000 daily calls).
* **Underlying Scientific Models**:
  * **ECMWF IFS**: European Centre for Medium-Range Weather Forecasts (9 km resolution)
  * **GFS / HRRR**: National Oceanic and Atmospheric Administration (NOAA)
  * **ICON**: German National Meteorological Service (Deutscher Wetterdienst, DWD)
  * **CAMS**: Copernicus Atmosphere Monitoring Service (European air quality & aerosol models)
  * **ECMWF WAM**: Wave Action Model for marine significant wave height and sea swell
* **Endpoints Integrated**:
  * `https://api.open-meteo.com/v1/forecast`: Surface temperature, apparent temperature, relative humidity, pressure, wind gusts, dew point, cloud cover, WMO precipitation codes.
  * `https://air-quality-api.open-meteo.com/v1/air-quality`: Particulate matter (PM2.5, PM10), Nitrogen Dioxide (NO2), Sulphur Dioxide (SO2), Ozone (O3), Carbon Monoxide (CO), Saharan/Thar mineral dust.
  * `https://marine-api.open-meteo.com/v1/marine`: Significant wave height, wave direction, wave period, swell wave height.
* **Attribution Requirement**: *"Weather data by Open-Meteo.com under CC BY 4.0"*.

---

## 2. OpenStreetMap & Nominatim Geocoding
* **Provider**: OpenStreetMap Foundation (OSMF)
* **Classification**: Open Source Geospatial Data & Software
* **License**: Open Data Commons Open Database License (ODbL)
* **Website**: [https://nominatim.openstreetmap.org/](https://nominatim.openstreetmap.org/)
* **Authentication**: None. Requires an identifiable User-Agent header and max 1 request/second rate-limiting compliance.
* **Capabilities**:
  * Free-form text search across Indian states, districts, tehsils, and urban pin codes.
  * Reverse geocoding of GPS latitude/longitude coordinates to localized administrative names.
* **Attribution Requirement**: *"© OpenStreetMap contributors"*.

---

## 3. NASA Global Imagery Browse Services (GIBS)
* **Provider**: NASA Earth Observing System Data and Information System (EOSDIS)
* **Classification**: Public Domain / US Government Open Data
* **License**: Free and unrestricted open data access
* **Website**: [https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs](https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs)
* **Authentication**: None required for WMTS / Tile service.
* **Integrated Layers**:
  * `MODIS_Terra_CorrectedReflectance_TrueColor`: Natural-color imagery showing cloud formations, tropical cyclones, snow cover, and aerosol plumes over the Indian subcontinent.
  * `VIIRS_SNPP_CorrectedReflectance_TrueColor`: High-resolution Suomi NPP true-color imagery.
* **Projection / Tile Scheme**: Web Mercator EPSG:3857, Level 0–9.
* **Attribution Requirement**: *"We acknowledge the use of imagery provided by NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Observing System Data and Information System (EOSDIS)."*

---

## 4. Open-Meteo Archive API — Copernicus ERA5 Reanalysis
* **Provider**: Open-Meteo Historical Weather API serving ECMWF / Copernicus Climate Change Service (C3S) ERA5 Reanalysis
* **Classification**: Open Access European Climate Data
* **License**: Creative Commons Attribution 4.0 International (CC BY 4.0) & Copernicus Open Data Policy
* **Website**: [https://open-meteo.com/en/docs/historical-weather-api](https://open-meteo.com/en/docs/historical-weather-api) / [https://cds.climate.copernicus.eu/](https://cds.climate.copernicus.eu/)
* **Integrated Datasets**:
  * **ERA5 Atmospheric Reanalysis (via Open-Meteo Archive)**: 10-year monthly temperature and precipitation normals used in Mausam to compute historical baseline deviations and climate anomalies.
* **Attribution Requirement**: *"Contains modified Copernicus Climate Change Service information (ERA5 via Open-Meteo Archive API)."*

---

## 5. Mausam Hydrology Engine (Open-Meteo Precipitation Input)
* **Provider**: Mausam Algorithmic Intelligence Engine with Open-Meteo precipitation input
* **Classification**: Model-Derived Algorithmic Intelligence
* **License**: Mausam Meteorological Intelligence Engine Open Access
* **Website**: [https://open-meteo.com/](https://open-meteo.com/)
* **Integrated Metrics**:
  * Modeled upstream river discharge ($m^3/s$) estimated from 3-day precipitation accumulation.
  * River basin definitions and flood risk thresholds across major Indian river basins (Ganga, Brahmaputra, Godavari, Krishna, Narmada, Mahanadi).
* **Attribution & Notice**: *"Model-derived flood-risk estimate calculated by Mausam from precipitation inputs. This is not direct Copernicus GloFAS river-discharge data and is not an official CWC/state flood bulletin."*

---

## 6. Official Indian Meteorological & Emergency Formats (IMD / NDMA / CAP India)
* **Agencies Referenced**:
  * **IMD**: India Meteorological Department (Ministry of Earth Sciences, Govt of India)
  * **NDMA**: National Disaster Management Authority (Govt of India)
  * **CAP India**: Common Alerting Protocol (C-DAC / NDMA disaster alert exchange standard)
* **Format Compliance**:
  * Cyclone track parameters (Latitude, Longitude, Intensity, Category, Basin - Arabian Sea & Bay of Bengal).
  * 4-Stage Cyclone Warning System: Pre-Cyclone Watch, Cyclone Alert (Yellow), Cyclone Warning (Orange), Post-Landfall Outlook (Red).
  * Indian National AQI (NAQI) breakpoints defined by the Central Pollution Control Board (CPCB).
* **Transparency Policy**:
  * Mausam explicitly labels derived risk models as *"Mausam Thunderstorm Risk Algorithm"* or *"Derived Hydrological Model"*, and strictly reserves official badges for authenticated CAP / IMD bulletin feeds.
