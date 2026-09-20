/**
 * NASA GIBS (Global Imagery Browse Services) Satellite Provider
 * Classification: Open Data / Free API Service (NASA Open Science Policy)
 * NASA GIBS provides full-resolution, visual representations of NASA Earth science data.
 * Does not require authentication or API keys.
 */

import { ISatelliteProvider, ProviderMetadata, SatelliteLayerOption } from './providerTypes';

export class NasaGibsProvider implements ISatelliteProvider {
  readonly id = 'nasa-gibs';

  readonly metadata: ProviderMetadata = {
    id: 'nasa-gibs',
    name: 'NASA GIBS Earth Data',
    classification: 'open-data',
    license: 'NASA Open Data Policy (Free and Open for Public Use)',
    requiresAuth: false,
    isConfigured: true,
    rateLimitInfo: 'Open public service; standard Web Map Tile Service (WMTS / EPSG:3857)',
    attribution: 'Imagery provided by NASA GIBS, operated by NASA/GSFC/ESDIS',
    website: 'https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs',
  };

  /**
   * Returns available NASA GIBS satellite layers formatted for Leaflet EPSG:3857 Web Mercator.
   * Uses yesterday's date if current date tiles are still compiling in GIBS pipeline.
   */
  async getSatelliteLayers(dateOverride?: string): Promise<SatelliteLayerOption[]> {
    const d = new Date();
    // Default to yesterday to guarantee complete global swath coverage
    d.setUTCDate(d.getUTCDate() - 1);
    const dateStr = dateOverride || d.toISOString().slice(0, 10);

    return [
      {
        id: 'viirs-truecolor',
        name: 'NASA VIIRS True Color',
        description: 'High-resolution true color optical imagery from Suomi NPP VIIRS instrument',
        type: 'nasa-gibs',
        tileUrlTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${dateStr}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        timeString: dateStr,
        attribution: 'NASA Worldview / GIBS (VIIRS True Color)',
        maxZoom: 9,
        opacity: 0.85,
      },
      {
        id: 'modis-terra',
        name: 'NASA MODIS Terra Satellite',
        description: 'Natural color reflectance capturing cloud decks, monsoon surges & cyclones',
        type: 'nasa-gibs',
        tileUrlTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${dateStr}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        timeString: dateStr,
        attribution: 'NASA Worldview / GIBS (MODIS Terra)',
        maxZoom: 9,
        opacity: 0.85,
      },
      {
        id: 'cloud-top-temp',
        name: 'Cloud Top Temperature',
        description: 'Infrared thermal cloud height; colder tops (< -50°C) indicate severe convective storms',
        type: 'nasa-gibs',
        tileUrlTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Aqua_Cloud_Top_Temp_Day/default/${dateStr}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
        timeString: dateStr,
        attribution: 'NASA GIBS (MODIS Aqua Cloud Top Temp)',
        maxZoom: 6,
        opacity: 0.65,
      },
      {
        id: 'atmospheric-water-vapor',
        name: 'AIRS Water Vapor',
        description: 'Mid-tropospheric atmospheric moisture depicting monsoonal channels & troughs',
        type: 'nasa-gibs',
        tileUrlTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/AIRS_Precipitation_Day/default/${dateStr}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
        timeString: dateStr,
        attribution: 'NASA GIBS (AIRS Atmospheric Sounding)',
        maxZoom: 6,
        opacity: 0.65,
      },
    ];
  }
}
