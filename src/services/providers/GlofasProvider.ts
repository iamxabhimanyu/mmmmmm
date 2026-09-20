/**
 * Mausam Catchment Runoff & Hydrology Model Provider
 * Classification: Model-Derived Hydrological Intelligence (Open-Meteo precipitation input)
 * Models river discharge and multi-day catchment accumulation for major Indian river basins.
 * IMPORTANT: Model-derived information; not direct GloFAS or CWC river-gauge telemetry.
 */

import { IFloodProvider, ProviderMetadata, NormalizedFloodRisk } from './providerTypes';
import { fetchWithTimeout } from './fetchUtils';

interface RiverBasinDefinition {
  name: string;
  majorStates: string[];
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  baselineDischargeM3s: number;
}

const INDIAN_RIVER_BASINS: RiverBasinDefinition[] = [
  {
    name: 'Ganga River Basin',
    majorStates: ['Uttar Pradesh', 'Bihar', 'West Bengal', 'Uttarakhand', 'Delhi'],
    minLat: 24.0,
    maxLat: 31.0,
    minLon: 77.0,
    maxLon: 89.0,
    baselineDischargeM3s: 16500,
  },
  {
    name: 'Brahmaputra Valley Basin',
    majorStates: ['Assam', 'Arunachal Pradesh', 'Meghalaya'],
    minLat: 25.0,
    maxLat: 29.5,
    minLon: 89.5,
    maxLon: 96.5,
    baselineDischargeM3s: 19800,
  },
  {
    name: 'Godavari Basin',
    majorStates: ['Maharashtra', 'Telangana', 'Andhra Pradesh', 'Chhattisgarh'],
    minLat: 16.5,
    maxLat: 21.5,
    minLon: 73.5,
    maxLon: 82.5,
    baselineDischargeM3s: 3500,
  },
  {
    name: 'Krishna Basin',
    majorStates: ['Maharashtra', 'Karnataka', 'Telangana', 'Andhra Pradesh'],
    minLat: 13.5,
    maxLat: 19.5,
    minLon: 73.5,
    maxLon: 81.0,
    baselineDischargeM3s: 2200,
  },
  {
    name: 'Narmada Basin',
    majorStates: ['Madhya Pradesh', 'Gujarat'],
    minLat: 21.0,
    maxLat: 23.5,
    minLon: 72.5,
    maxLon: 81.8,
    baselineDischargeM3s: 1400,
  },
  {
    name: 'Mahanadi Basin',
    majorStates: ['Odisha', 'Chhattisgarh'],
    minLat: 19.0,
    maxLat: 23.5,
    minLon: 80.5,
    maxLon: 87.0,
    baselineDischargeM3s: 2100,
  },
  {
    name: 'Indus & Northern Tributaries Basin',
    majorStates: ['Jammu & Kashmir', 'Punjab', 'Himachal Pradesh'],
    minLat: 30.5,
    maxLat: 36.5,
    minLon: 73.5,
    maxLon: 79.5,
    baselineDischargeM3s: 6700,
  },
  {
    name: 'Kaveri Basin',
    majorStates: ['Karnataka', 'Tamil Nadu', 'Kerala'],
    minLat: 10.5,
    maxLat: 13.5,
    minLon: 75.0,
    maxLon: 80.0,
    baselineDischargeM3s: 850,
  },
];

export class GlofasProvider implements IFloodProvider {
  readonly id = 'copernicus-glofas';

  readonly metadata: ProviderMetadata = {
    id: 'copernicus-glofas',
    name: 'Mausam Hydrology Engine (Open-Meteo precipitation input)',
    classification: 'open-source-software',
    license: 'Mausam Meteorological Intelligence Engine',
    requiresAuth: false,
    isConfigured: true,
    rateLimitInfo: 'Model-derived hydrological runoff calculated from Open-Meteo 3-day precipitation accumulation',
    attribution: 'Mausam Hydrology Engine (Open-Meteo precipitation input; derived model, not direct GloFAS/CWC telemetry)',
    website: 'https://open-meteo.com',
  };

  async getFloodRisk(lat: number, lon: number, locationName: string): Promise<NormalizedFloodRisk> {
    // 1. Identify which major Indian river basin this coordinate belongs to
    const matchedBasin = INDIAN_RIVER_BASINS.find(
      (b) => lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon
    );

    const basinName = matchedBasin ? matchedBasin.name : 'Peninsular Coastal Catchment';

    // 2. Fetch 3-day precipitation accumulation from Open-Meteo to ground hydrological discharge
    let catchmentRain3Day: number | undefined = undefined;
    let isPartialPrecip = false;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
        5
      )}&longitude=${lon.toFixed(5)}&daily=precipitation_sum&forecast_days=3&timezone=Asia/Kolkata`;
      const res = await fetchWithTimeout(url, undefined, 8000);
      if (res.ok) {
        const data = await res.json();
        const sums: number[] = data.daily?.precipitation_sum;
        if (Array.isArray(sums) && sums.length > 0) {
          const validSums = sums.filter((s) => typeof s === 'number' && Number.isFinite(s) && s >= 0);
          if (validSums.length === 3) {
            catchmentRain3Day = Math.round(validSums.reduce((a, b) => a + b, 0));
          } else if (validSums.length > 0) {
            catchmentRain3Day = Math.round(validSums.reduce((a, b) => a + b, 0));
            isPartialPrecip = true;
          }
        }
      }
    } catch (e) {
      catchmentRain3Day = undefined;
    }

    // 3. Model flood severity based on hydrological thresholds
    if (catchmentRain3Day === undefined) {
      return {
        basinName,
        locationName,
        riskLevel: 'Unavailable',
        riverDischargeM3s: undefined,
        thresholdLevel: 'Unavailable',
        returnPeriodEst: 'Data Unavailable',
        trend: 'Unavailable',
        catchmentRainfall3DayMm: undefined,
        advisory: 'Flood-risk estimation is unavailable because required precipitation inputs could not be retrieved.',
        confidence: 'Unavailable',
        forecastPeriod: 'Unavailable',
        isUnavailable: true,
        source: {
          providerId: this.id,
          providerName: 'Mausam Hydrology Engine (Data Unavailable)',
          classification: 'open-source-software',
          isOfficialIMD: false,
          isDerived: true,
          timestamp: new Date().toISOString(),
          confidenceScore: 0,
          attributionText: 'Precipitation accumulation data temporarily unavailable',
        },
        disclaimer:
          'Model-derived flood-risk estimate calculated by Mausam from precipitation inputs. Required precipitation observations could not be retrieved.',
      };
    }

    let riskLevel: NormalizedFloodRisk['riskLevel'] = 'Low';
    let returnPeriod = 'Below 2-year normal';
    let trend: NormalizedFloodRisk['trend'] = 'Steady';
    let advisory = `River levels and surface runoff in ${basinName} are within seasonal capacity. Drainage systems operational.`;

    const baseDischarge = matchedBasin ? matchedBasin.baselineDischargeM3s : 900;
    let dischargeMultiplier = 1.0;

    if (catchmentRain3Day > 120) {
      riskLevel = 'Severe';
      returnPeriod = 'Exceeding 20-year flood threshold';
      trend = 'Rising';
      dischargeMultiplier = 2.4;
      advisory = `Critical hydrological surge modeled in ${basinName}. Inundation risk in low-lying riparian floodplains. Keep emergency kits ready.`;
    } else if (catchmentRain3Day > 65) {
      riskLevel = 'High';
      returnPeriod = 'Approaching 5-year return level';
      trend = 'Rising';
      dischargeMultiplier = 1.7;
      advisory = `Significant runoff accumulation in ${basinName}. Riparian embankments and culverts require vigilance.`;
    } else if (catchmentRain3Day > 35) {
      riskLevel = 'Moderate';
      returnPeriod = 'Approaching 2-year threshold';
      trend = 'Rising';
      dischargeMultiplier = 1.25;
      advisory = `Moderate runoff increase modeled. Localized roadside pooling and canal swell possible in urban sectors.`;
    }

    const riverDischarge = Math.round(baseDischarge * dischargeMultiplier);

    // Defensible confidence score: 75% for full 3-day forecast, 40% for partial rainfall days
    const computedConfidenceScore = isPartialPrecip ? 40 : 75;
    const computedConfidenceLabel: 'Low' | 'Model-Derived' = isPartialPrecip ? 'Low' : 'Model-Derived';

    return {
      basinName,
      locationName,
      riskLevel,
      riverDischargeM3s: riverDischarge,
      thresholdLevel: `${riskLevel} Stage (${dischargeMultiplier.toFixed(1)}x normal)`,
      returnPeriodEst: returnPeriod,
      trend,
      catchmentRainfall3DayMm: catchmentRain3Day,
      advisory,
      confidence: computedConfidenceLabel,
      forecastPeriod: 'Next 72 Hours',
      source: {
        providerId: this.id,
        providerName: 'Mausam Hydrology Engine (Open-Meteo precipitation input)',
        classification: 'open-source-software',
        isOfficialIMD: false,
        isDerived: true,
        timestamp: new Date().toISOString(),
        confidenceScore: computedConfidenceScore,
        attributionText: isPartialPrecip
          ? 'Mausam Hydrology Engine calculated from partial precipitation accumulation'
          : 'Mausam Hydrology Engine calculated from Open-Meteo 3-day precipitation accumulation',
      },
      disclaimer:
        'Model-derived flood-risk estimate calculated by Mausam from precipitation inputs. This is not direct Copernicus GloFAS river-discharge data and is not an official CWC/state flood bulletin.',
    };
  }

  /**
   * Deterministic hydrological discharge and flood risk estimation given telemetry inputs.
   * UNKNOWN ≠ SAFE: If precipitation inputs are unobserved, returns riskLevel 'Unavailable'
   * and minimal confidence 0.1. Partial precipitation yields defensible confidence 0.4-0.65.
   */
  estimateDischarge(
    lat: number,
    lon: number,
    inputs?: {
      precipitationCurrentMm?: number;
      precipitation24hMm?: number;
      precipitationSum3DaysMm?: number;
      soilSaturationFactor?: number;
    }
  ): {
    basinName: string;
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe' | 'Unavailable';
    riverDischargeM3s?: number;
    confidence: number;
    advisory: string;
    trend: 'Rising' | 'Steady' | 'Receding' | 'Unavailable';
    returnPeriodEst?: string;
    thresholdLevel?: string;
  } {
    const matchedBasin = INDIAN_RIVER_BASINS.find(
      (b) => lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon
    );
    const basinName = matchedBasin ? matchedBasin.name : 'Peninsular Catchment';
    const baseDischarge = matchedBasin ? matchedBasin.baselineDischargeM3s : 900;

    const hasCurrent =
      typeof inputs?.precipitationCurrentMm === 'number' &&
      Number.isFinite(inputs.precipitationCurrentMm) &&
      inputs.precipitationCurrentMm >= 0;
    const has24h =
      typeof inputs?.precipitation24hMm === 'number' &&
      Number.isFinite(inputs.precipitation24hMm) &&
      inputs.precipitation24hMm >= 0;
    const has3Days =
      typeof inputs?.precipitationSum3DaysMm === 'number' &&
      Number.isFinite(inputs.precipitationSum3DaysMm) &&
      inputs.precipitationSum3DaysMm >= 0;

    // UNKNOWN ≠ SAFE: All precipitation unobserved
    if (!hasCurrent && !has24h && !has3Days) {
      return {
        basinName,
        riskLevel: 'Unavailable',
        riverDischargeM3s: undefined,
        confidence: 0.1,
        advisory: `Hydrological discharge and flood risk are unavailable for ${basinName} because precipitation inputs are unobserved.`,
        trend: 'Unavailable',
        returnPeriodEst: 'Unavailable',
        thresholdLevel: 'Unavailable',
      };
    }

    // Determine completeness & confidence
    let confidence = 0.55; // Partial precipitation default
    let effective3Day = 0;

    if (has3Days) {
      effective3Day = inputs!.precipitationSum3DaysMm!;
      confidence = hasCurrent && has24h ? 0.85 : 0.7;
    } else if (has24h) {
      effective3Day = inputs!.precipitation24hMm! * 2.2;
      confidence = hasCurrent ? 0.6 : 0.5;
    } else if (hasCurrent) {
      effective3Day = inputs!.precipitationCurrentMm! * 6.0;
      confidence = 0.45;
    }

    let riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe' | 'Unavailable' = 'Low';
    let multiplier = 1.0;
    let trend: 'Rising' | 'Steady' | 'Receding' | 'Unavailable' = 'Steady';

    if (effective3Day > 120) {
      riskLevel = 'Severe';
      multiplier = 2.4;
      trend = 'Rising';
    } else if (effective3Day > 65) {
      riskLevel = 'High';
      multiplier = 1.7;
      trend = 'Rising';
    } else if (effective3Day > 35) {
      riskLevel = 'Moderate';
      multiplier = 1.25;
      trend = 'Rising';
    }

    const discharge = Math.round(baseDischarge * multiplier);

    return {
      basinName,
      riskLevel,
      riverDischargeM3s: discharge,
      confidence,
      advisory: `Modeled hydrological risk in ${basinName} is ${riskLevel}. Discharge estimated at ~${discharge} m³/s.`,
      trend,
      returnPeriodEst: riskLevel === 'Severe' ? 'Exceeding 20-year flood threshold' : 'Normal',
      thresholdLevel: `${riskLevel} Stage`,
    };
  }
}
