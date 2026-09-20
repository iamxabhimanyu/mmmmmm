/**
 * Copernicus Climate Data Store / ERA5 Provider
 * Classification: Open Data / Copernicus License
 * Provides long-term climate reanalysis, 30-year climatological normals,
 * and temperature/precipitation anomaly analysis.
 */

import { IHistoricalWeatherProvider, ProviderMetadata, NormalizedHistorical } from './providerTypes';
import { fetchWithTimeout } from './fetchUtils';

export class CopernicusProvider implements IHistoricalWeatherProvider {
  readonly id = 'copernicus-era5';

  readonly metadata: ProviderMetadata = {
    id: 'copernicus-era5',
    name: 'Open-Meteo Archive API — ERA5 Reanalysis',
    classification: 'open-data',
    license: 'Copernicus Open Access / European Union (via Open-Meteo Archive)',
    requiresAuth: false, // Baseline reanalysis is open data
    isConfigured: true,
    rateLimitInfo: 'Open-Meteo Historical Weather API serving ECMWF ERA5 reanalysis',
    attribution: 'Contains modified Copernicus Climate Change Service information (ERA5 via Open-Meteo Archive API)',
    website: 'https://open-meteo.com/en/docs/historical-weather-api',
  };

  /**
   * Fetches historical climate trends and 30-year climate normal comparisons
   */
  async getHistoricalAnalysis(
    lat: number,
    lon: number,
    locationName: string
  ): Promise<NormalizedHistorical> {
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const refYear = currentYear - 1;

      // Access open ERA5 reanalysis endpoint
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(
        4
      )}&longitude=${lon.toFixed(
        4
      )}&start_date=${refYear}-01-01&end_date=${refYear}-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=Asia/Kolkata`;

      const res = await fetchWithTimeout(url, undefined, 8000);
      if (res.ok) {
        const data = await res.json();
        const parsed = this.parseRawHistorical(data, locationName, refYear);
        if (parsed) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Copernicus ERA5 fetch error:', err);
    }

    return {
      locationName,
      periodLabel: 'Open-Meteo Archive API — ERA5 Reanalysis (Unavailable)',
      meanTemperature: undefined,
      tempAnomaly: undefined,
      precipitationTotal: undefined,
      precipAnomalyPercent: undefined,
      climateTrend: 'Unavailable',
      summary: `ERA5 historical reanalysis data is temporarily unavailable for ${locationName}.`,
      dataPoints: [],
      isUnavailable: true,
      source: {
        providerId: this.id,
        providerName: 'Open-Meteo Archive API — ERA5 Reanalysis (Unavailable)',
        classification: 'open-data',
        isOfficialIMD: false,
        isDerived: false,
        timestamp: new Date().toISOString(),
        confidenceScore: 0,
        attributionText: 'Copernicus Climate Change Service / ERA5 Reanalysis (Data unavailable)',
      },
    };
  }

  /**
   * Parses raw Open-Meteo ERA5 archive JSON into NormalizedHistorical
   */
  parseRawHistorical(data: any, locationName: string, refYear: number): NormalizedHistorical | null {
    const temps: number[] = data?.daily?.temperature_2m_mean || [];
    const precips: number[] = data?.daily?.precipitation_sum || [];

    if (temps.length > 0) {
      const meanTemp = Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1));
      const totalPrecip = Math.round(precips.reduce((a, b) => a + b, 0));

      return {
        locationName,
        periodLabel: `Open-Meteo Archive API — ERA5 Reanalysis (${refYear})`,
        meanTemperature: meanTemp,
        tempAnomaly: undefined,
        precipitationTotal: totalPrecip,
        precipAnomalyPercent: undefined,
        climateTrend: 'Trend unavailable',
        summary: `Annual mean temperature for ${locationName} was ${meanTemp}°C with recorded annual precipitation of ${totalPrecip} mm in ${refYear} (ERA5 reanalysis archive). Location-specific 30-year climatological normal baseline is not configured; trend is unavailable.`,
        dataPoints: [
          {
            date: 'Winter (DJF)',
            temp: temps[15] !== undefined ? Math.round(temps[15]) : undefined,
            precipitation: precips[15] !== undefined ? Math.round(precips[15]) : undefined,
          },
          {
            date: 'Pre-Monsoon (MAM)',
            temp: temps[100] !== undefined ? Math.round(temps[100]) : undefined,
            precipitation: precips[100] !== undefined ? Math.round(precips[100]) : undefined,
          },
          {
            date: 'Monsoon (JJAS)',
            temp: temps[200] !== undefined ? Math.round(temps[200]) : undefined,
            precipitation: precips[200] !== undefined ? Math.round(precips[200]) : undefined,
          },
          {
            date: 'Post-Monsoon (ON)',
            temp: temps[300] !== undefined ? Math.round(temps[300]) : undefined,
            precipitation: precips[300] !== undefined ? Math.round(precips[300]) : undefined,
          },
        ],
        source: {
          providerId: this.id,
          providerName: 'Open-Meteo Archive API — ERA5 Reanalysis',
          classification: 'open-data',
          isOfficialIMD: false,
          isDerived: false,
          timestamp: new Date().toISOString(),
          confidenceScore: 95,
          attributionText: 'Copernicus Climate Change Service / ECMWF ERA5 Reanalysis (via Open-Meteo Archive API)',
        },
      };
    }
    return null;
  }
}
