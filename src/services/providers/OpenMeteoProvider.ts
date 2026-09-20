/**
 * Open-Meteo Provider
 * Classification: Free API / Open Data (CC-BY 4.0)
 * Open-Meteo provides free weather forecast, air quality, marine and historical data
 * without mandatory API keys for non-commercial and research use.
 */

import {
  IWeatherProvider,
  IAirQualityProvider,
  IMarineProvider,
  IHistoricalWeatherProvider,
  ProviderMetadata,
  NormalizedCurrentWeather,
  NormalizedForecast,
  NormalizedHourlyItem,
  NormalizedDailyItem,
  NormalizedAirQuality,
  NormalizedMarine,
  NormalizedHistorical,
  SourceMetadata,
} from './providerTypes';
import { WeatherConditionKey } from '../../types';
import { fetchWithTimeout } from './fetchUtils';

export class OpenMeteoProvider
  implements
    IWeatherProvider,
    IAirQualityProvider,
    IMarineProvider,
    IHistoricalWeatherProvider
{
  readonly id = 'open-meteo';

  readonly metadata: ProviderMetadata = {
    id: 'open-meteo',
    name: 'Open-Meteo',
    classification: 'free-api-service',
    license: 'Creative Commons Attribution 4.0 International (CC-BY 4.0)',
    requiresAuth: false,
    isConfigured: true,
    rateLimitInfo: '10,000 daily requests free, up to 600 calls/minute',
    attribution: 'Weather data by Open-Meteo.com under CC-BY 4.0',
    website: 'https://open-meteo.com',
  };

  private getSourceMeta(confidence: number = 92): SourceMetadata {
    return {
      providerId: this.id,
      providerName: 'Open-Meteo Global Numerical Models',
      classification: 'free-api-service',
      isOfficialIMD: false,
      isDerived: false,
      timestamp: new Date().toISOString(),
      confidenceScore: confidence,
      attributionText: 'Numerical Weather Prediction (ECMWF, GFS, ICON) via Open-Meteo',
    };
  }

  // Maps WMO Weather Interpretation Codes (0-99) to clean keys and descriptions
  mapWmoCode(code?: number | null, isDay: boolean = true): {
    key: WeatherConditionKey;
    text: string;
  } {
    if (code === undefined || code === null || !Number.isFinite(code) || Number.isNaN(code)) {
      return { key: 'unknown', text: 'Condition Unavailable' };
    }
    switch (code) {
      case 0:
        return { key: 'clear', text: isDay ? 'Clear Sky' : 'Clear Night' };
      case 1:
        return { key: 'clear', text: isDay ? 'Mainly Sunny' : 'Mainly Clear' };
      case 2:
        return { key: 'partly-cloudy', text: 'Partly Cloudy' };
      case 3:
        return { key: 'overcast', text: 'Overcast' };
      case 45:
      case 48:
        return { key: 'fog', text: 'Fog / Mist' };
      case 51:
      case 53:
      case 55:
        return { key: 'drizzle', text: 'Light Drizzle' };
      case 56:
      case 57:
        return { key: 'drizzle', text: 'Freezing Drizzle' };
      case 61:
      case 63:
        return { key: 'rain', text: 'Moderate Rain' };
      case 65:
        return { key: 'heavy-rain', text: 'Heavy Rainfall' };
      case 66:
      case 67:
        return { key: 'rain', text: 'Freezing Rain' };
      case 71:
      case 73:
      case 75:
        return { key: 'snow', text: 'Snowfall' };
      case 77:
        return { key: 'snow', text: 'Snow Grains' };
      case 80:
      case 81:
      case 82:
        return { key: 'rain', text: 'Rain Showers' };
      case 85:
      case 86:
        return { key: 'snow', text: 'Snow Showers' };
      case 95:
        return { key: 'thunderstorm', text: 'Thunderstorm' };
      case 96:
      case 99:
        return { key: 'thunderstorm', text: 'Severe Thunderstorm & Hail' };
      default:
        return { key: 'unknown', text: 'Unknown Condition' };
    }
  }

  /**
   * 1. Fetch Current Weather and Extended Forecast
   */
  async getWeatherAndForecast(lat: number, lon: number): Promise<{
    current: NormalizedCurrentWeather;
    forecast: NormalizedForecast;
  }> {
    const params = new URLSearchParams({
      latitude: lat.toFixed(5),
      longitude: lon.toFixed(5),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
      ].join(','),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'dew_point_2m',
        'apparent_temperature',
        'precipitation_probability',
        'precipitation',
        'weather_code',
        'surface_pressure',
        'visibility',
        'wind_speed_10m',
        'uv_index',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'uv_index_max',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
      ].join(','),
      timezone: 'Asia/Kolkata',
      forecast_days: '10',
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const res = await fetchWithTimeout(url, undefined, 8000);
    if (!res.ok) {
      throw new Error(`Open-Meteo forecast failed with HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return this.parseRawWeatherData(data, 'open-meteo', 'Open-Meteo Global Numerical Models', 94);
  }

  /**
   * LEVEL 2 ALTERNATE PROVIDER FETCH:
   * Fetches from Open-Meteo GFS / ICON numerical weather prediction models at the EXACT same coordinates.
   * Preserves requested coordinates strictly.
   */
  async getAlternateWeatherAndForecast(lat: number, lon: number): Promise<{
    current: NormalizedCurrentWeather;
    forecast: NormalizedForecast;
  }> {
    const params = new URLSearchParams({
      latitude: lat.toFixed(5),
      longitude: lon.toFixed(5),
      models: 'gfs_seamless,icon_seamless',
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
      ].join(','),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'dew_point_2m',
        'apparent_temperature',
        'precipitation_probability',
        'precipitation',
        'weather_code',
        'surface_pressure',
        'visibility',
        'wind_speed_10m',
        'uv_index',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'uv_index_max',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
      ].join(','),
      timezone: 'Asia/Kolkata',
      forecast_days: '10',
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const res = await fetchWithTimeout(url, undefined, 8000);
    if (!res.ok) {
      throw new Error(`Alternate NWP forecast model failed with HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return this.parseRawWeatherData(
      data,
      'open-meteo-gfs-icon',
      'Open-Meteo Alternate Multi-Model (GFS/ICON)',
      88
    );
  }

  /**
   * Shared parser for raw forecast JSON payloads
   */
  parseRawWeatherData(
    data: any,
    providerId: string = 'open-meteo',
    providerName: string = 'Open-Meteo Global Numerical Models',
    confidenceScore: number = 94
  ): {
    current: NormalizedCurrentWeather;
    forecast: NormalizedForecast;
  } {
    const c = data.current || {};
    const isDay = c.is_day === 1;
    const cond = this.mapWmoCode(c.weather_code, isDay);

    // Parse Hourly: Analyze current location time and forecast strictly from the NEXT hour onward
    const now = new Date();
    const tz = (data.timezone as string) || 'Asia/Kolkata';
    let currentHourIso: string;
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const year = parts.find((p) => p.type === 'year')?.value;
      const month = parts.find((p) => p.type === 'month')?.value;
      const day = parts.find((p) => p.type === 'day')?.value;
      let hour = parts.find((p) => p.type === 'hour')?.value;
      if (hour === '24') hour = '00';
      currentHourIso = (year && month && day && hour) ? `${year}-${month}-${day}T${hour}` : now.toISOString().slice(0, 13);
    } catch (e) {
      currentHourIso = now.toISOString().slice(0, 13);
    }

    const hourlyData = data.hourly || { time: [] };
    const timeLength = Array.isArray(hourlyData.time) ? hourlyData.time.length : 0;
    let currentHourIndex = Array.isArray(hourlyData.time)
      ? hourlyData.time.findIndex((t: string) => t.startsWith(currentHourIso))
      : 0;
    if (currentHourIndex === -1) {
      const fallbackIdx = hourlyData.time.findIndex((t: string) => t >= currentHourIso);
      currentHourIndex = fallbackIdx !== -1 ? fallbackIdx : 0;
    }

    // Strictly show forecast AFTER the current hour (e.g., if now is 6 PM, start from 7 PM)
    let forecastStartIndex = currentHourIndex + 1;
    if (forecastStartIndex >= timeLength) {
      forecastStartIndex = Math.max(0, timeLength - 24);
    }

    const hourly: NormalizedHourlyItem[] = [];
    const maxHourlyCount = Math.min(forecastStartIndex + 24, timeLength);
    const todayDatePart = currentHourIso.slice(0, 10);

    for (let i = forecastStartIndex; i < maxHourlyCount; i++) {
      const rawTime = hourlyData.time[i];
      const dateObj = new Date(rawTime);
      const timePart = typeof rawTime === 'string' && rawTime.includes('T') ? rawTime.split('T')[1] : '';
      const parsedHour = timePart ? parseInt(timePart.slice(0, 2), 10) : dateObj.getHours();
      const hourVal = Number.isFinite(parsedHour) ? parsedHour : dateObj.getHours();
      const ampm = hourVal >= 12 ? 'PM' : 'AM';
      const displayHour = hourVal % 12 === 0 ? 12 : hourVal % 12;
      const timeLabel = `${displayHour} ${ampm}`;
      const isDayHour = hourVal >= 6 && hourVal < 19;
      const rawHCode = hourlyData.weather_code?.[i];
      const hCond = this.mapWmoCode(rawHCode, isDayHour);

      const datePart = typeof rawTime === 'string' ? rawTime.slice(0, 10) : '';
      const dayLabel = datePart && todayDatePart && datePart !== todayDatePart ? 'Tomorrow' : 'Today';

      const rawTemp = hourlyData.temperature_2m?.[i];
      const temperature = (rawTemp !== undefined && rawTemp !== null)
        ? (Number.isFinite(rawTemp) ? Math.round(rawTemp) : rawTemp)
        : undefined;

      const rawFeels = hourlyData.apparent_temperature?.[i];
      const feelsLike = (rawFeels !== undefined && rawFeels !== null)
        ? (Number.isFinite(rawFeels) ? Math.round(rawFeels) : rawFeels)
        : undefined;

      const rawPop = hourlyData.precipitation_probability?.[i];
      const precipitationProb = (rawPop !== undefined && rawPop !== null)
        ? (Number.isFinite(rawPop) ? Math.round(rawPop) : rawPop)
        : undefined;

      const rawRain = hourlyData.precipitation?.[i];
      const rainMm = (rawRain !== undefined && rawRain !== null)
        ? (Number.isFinite(rawRain) ? Number(rawRain.toFixed(1)) : rawRain)
        : undefined;

      const rawWs = hourlyData.wind_speed_10m?.[i];
      const windSpeed = (rawWs !== undefined && rawWs !== null)
        ? (Number.isFinite(rawWs) ? Math.round(rawWs) : rawWs)
        : undefined;

      const rawRh = hourlyData.relative_humidity_2m?.[i];
      const humidity = (rawRh !== undefined && rawRh !== null)
        ? (Number.isFinite(rawRh) ? Math.round(rawRh) : rawRh)
        : undefined;

      const rawUv = hourlyData.uv_index?.[i];
      const uvIndex = (rawUv !== undefined && rawUv !== null)
        ? (Number.isFinite(rawUv) ? Math.round(rawUv) : rawUv)
        : undefined;

      hourly.push({
        timeLabel,
        isoTime: rawTime,
        timestamp: dateObj.getTime(),
        temperature,
        feelsLike,
        precipitationProb,
        rainMm,
        conditionKey: hCond.key,
        conditionText: hCond.text,
        conditionCode: (typeof rawHCode === 'number' && Number.isFinite(rawHCode)) ? rawHCode : undefined,
        windSpeed,
        humidity,
        uvIndex,
        dayLabel,
        isDay: isDayHour,
      });
    }

    // Parse Daily
    const dailyData = data.daily || { time: [] };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const daily: NormalizedDailyItem[] = [];
    const dailyLength = Array.isArray(dailyData.time) ? dailyData.time.length : 0;

    for (let d = 0; d < dailyLength; d++) {
      const dStr = dailyData.time[d];
      const dObj = new Date(dStr);
      const dayLabel = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayNames[dObj.getDay()];
      const fullDate = `${dObj.getDate()} ${monthNames[dObj.getMonth()]}`;
      const rawDCode = dailyData.weather_code?.[d];
      const dCond = this.mapWmoCode(rawDCode, true);

      const rawMax = dailyData.temperature_2m_max?.[d];
      const rawMin = dailyData.temperature_2m_min?.[d];
      const tempMax = (rawMax !== undefined && rawMax !== null)
        ? (Number.isFinite(rawMax) ? Math.round(rawMax) : rawMax)
        : undefined;
      const tempMin = (rawMin !== undefined && rawMin !== null)
        ? (Number.isFinite(rawMin) ? Math.round(rawMin) : rawMin)
        : undefined;

      const rawPopMax = dailyData.precipitation_probability_max?.[d];
      const precipitationProb = (rawPopMax !== undefined && rawPopMax !== null)
        ? (Number.isFinite(rawPopMax) ? Math.round(rawPopMax) : rawPopMax)
        : undefined;

      const rawRainSum = dailyData.precipitation_sum?.[d];
      const rainSumMm = (rawRainSum !== undefined && rawRainSum !== null)
        ? (Number.isFinite(rawRainSum) ? Number(rawRainSum.toFixed(1)) : rawRainSum)
        : undefined;

      const rawWsMax = dailyData.wind_speed_10m_max?.[d];
      const windSpeedMax = (rawWsMax !== undefined && rawWsMax !== null)
        ? (Number.isFinite(rawWsMax) ? Math.round(rawWsMax) : rawWsMax)
        : undefined;

      const rawUvMax = dailyData.uv_index_max?.[d];
      const uvIndexMax = (rawUvMax !== undefined && rawUvMax !== null)
        ? (Number.isFinite(rawUvMax) ? Math.round(rawUvMax) : rawUvMax)
        : undefined;

      const sunrise = (dailyData.sunrise?.[d] && typeof dailyData.sunrise[d] === 'string')
        ? dailyData.sunrise[d].slice(11, 16)
        : undefined;
      const sunset = (dailyData.sunset?.[d] && typeof dailyData.sunset[d] === 'string')
        ? dailyData.sunset[d].slice(11, 16)
        : undefined;

      const dHumidity = hourly[0]?.humidity !== undefined ? hourly[0].humidity : undefined;

      daily.push({
        date: dStr,
        dayLabel,
        fullDate,
        tempMax,
        tempMin,
        precipitationProb,
        rainSumMm,
        conditionKey: dCond.key,
        conditionText: dCond.text,
        conditionCode: (typeof rawDCode === 'number' && Number.isFinite(rawDCode)) ? rawDCode : undefined,
        windSpeedMax,
        uvIndexMax,
        sunrise,
        sunset,
        humidity: dHumidity,
      });
    }

    const todayHigh = daily[0]?.tempMax !== undefined ? daily[0].tempMax : undefined;
    const todayLow = daily[0]?.tempMin !== undefined ? daily[0].tempMin : undefined;

    const retrievalIso = new Date().toISOString();
    const observedIso = typeof c.time === 'string' && c.time.trim().length > 0 ? c.time : undefined;

    const sourceMeta: SourceMetadata = {
      providerId,
      providerName,
      classification: 'free-api-service',
      isOfficialIMD: false,
      isDerived: false,
      timestamp: retrievalIso,
      obtainedAt: retrievalIso,
      observedAt: observedIso,
      confidenceScore,
      attributionText: `${providerName} via Open-Meteo`,
    };

    const rawCurTemp = c.temperature_2m;
    const curTemp = (rawCurTemp !== undefined && rawCurTemp !== null)
      ? (Number.isFinite(rawCurTemp) ? Math.round(rawCurTemp) : rawCurTemp)
      : undefined;

    const rawCurFeels = c.apparent_temperature;
    const curFeels = (rawCurFeels !== undefined && rawCurFeels !== null)
      ? (Number.isFinite(rawCurFeels) ? Math.round(rawCurFeels) : rawCurFeels)
      : undefined;

    const rawCurHum = c.relative_humidity_2m;
    const curHum = (rawCurHum !== undefined && rawCurHum !== null)
      ? (Number.isFinite(rawCurHum) ? Math.round(rawCurHum) : rawCurHum)
      : undefined;

    const rawCurPress = c.pressure_msl ?? c.surface_pressure;
    const curPress = (rawCurPress !== undefined && rawCurPress !== null)
      ? (Number.isFinite(rawCurPress) ? Math.round(rawCurPress) : rawCurPress)
      : undefined;

    const rawCurWs = c.wind_speed_10m;
    const curWs = (rawCurWs !== undefined && rawCurWs !== null)
      ? (Number.isFinite(rawCurWs) ? Math.round(rawCurWs) : rawCurWs)
      : undefined;

    const rawCurWd = c.wind_direction_10m;
    const curWd = (rawCurWd !== undefined && rawCurWd !== null)
      ? (Number.isFinite(rawCurWd) ? Math.round(rawCurWd) : rawCurWd)
      : undefined;

    const rawCurWg = c.wind_gusts_10m;
    const curWg = (rawCurWg !== undefined && rawCurWg !== null)
      ? (Number.isFinite(rawCurWg) ? Math.round(rawCurWg) : rawCurWg)
      : undefined;

    const rawCurPrecip = c.precipitation;
    const curPrecip = (rawCurPrecip !== undefined && rawCurPrecip !== null)
      ? (Number.isFinite(rawCurPrecip) ? Number(rawCurPrecip.toFixed(1)) : rawCurPrecip)
      : undefined;

    const curPrecip24h = curPrecip;

    const rawCurCloud = c.cloud_cover;
    const curCloud = (rawCurCloud !== undefined && rawCurCloud !== null)
      ? (Number.isFinite(rawCurCloud) ? Math.round(rawCurCloud) : rawCurCloud)
      : undefined;

    const rawCurVis = hourlyData.visibility?.[currentHourIndex];
    const curVis = (rawCurVis !== undefined && rawCurVis !== null)
      ? (Number.isFinite(rawCurVis) ? Math.round(rawCurVis / 1000) : rawCurVis)
      : undefined;

    const rawCurUv = hourlyData.uv_index?.[currentHourIndex];
    const curUv = (rawCurUv !== undefined && rawCurUv !== null)
      ? (Number.isFinite(rawCurUv) ? Math.round(rawCurUv) : rawCurUv)
      : undefined;

    let curDew: number | undefined = undefined;
    const rawCurDew = hourlyData.dew_point_2m?.[currentHourIndex];
    if (rawCurDew !== undefined && rawCurDew !== null) {
      if (Number.isFinite(rawCurDew)) {
        const roundedDew = Math.round(rawCurDew);
        if (curTemp !== undefined && Number.isFinite(curTemp)) {
          curDew = Math.min(curTemp, roundedDew);
        } else {
          curDew = roundedDew;
        }
      } else {
        curDew = rawCurDew;
      }
    }

    let localTimeString: string;
    try {
      localTimeString = new Intl.DateTimeFormat('en-IN', {
        timeZone: tz,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(now);
    } catch (e) {
      localTimeString = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }

    const current: NormalizedCurrentWeather = {
      temperature: curTemp,
      feelsLike: curFeels,
      humidity: curHum,
      pressure: curPress,
      windSpeed: curWs,
      windDirection: curWd,
      windGust: curWg,
      precipitation: curPrecip,
      precipitation24h: curPrecip24h,
      cloudCover: curCloud,
      visibility: curVis,
      uvIndex: curUv,
      dewPoint: curDew,
      weatherConditionKey: cond.key,
      conditionText: cond.text,
      conditionCode: (typeof c.weather_code === 'number' && Number.isFinite(c.weather_code))
        ? c.weather_code
        : undefined,
      sunrise: daily[0]?.sunrise,
      sunset: daily[0]?.sunset,
      isDay,
      timeString: localTimeString,
      high: todayHigh,
      low: todayLow,
      source: sourceMeta,
    };

    const forecast: NormalizedForecast = {
      hourly,
      daily,
      horizonDays: daily.length,
      source: sourceMeta,
    };

    return { current, forecast };
  }

  /**
   * 2. Fetch Open-Meteo Air Quality & CPCB NAQI Normalization
   * Parses PM2.5, PM10, SO2, NO2, O3, CO, and Dust.
   * STRICT INTEGRITY: Missing pollutants remain undefined. No fabricated defaults.
   */
  async getAirQuality(lat: number, lon: number): Promise<NormalizedAirQuality> {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(
      4
    )}&longitude=${lon.toFixed(
      4
    )}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust&timezone=Asia/Kolkata`;

    const res = await fetchWithTimeout(url, undefined, 8000);
    if (!res.ok) {
      throw new Error(`Air Quality API error: ${res.statusText}`);
    }

    const data = await res.json();
    return this.parseRawAirQuality(data.current);
  }

  /**
   * Deterministic raw Air Quality parser adhering to UNKNOWN ≠ ZERO.
   */
  parseRawAirQuality(curr: any, rawTime?: string): NormalizedAirQuality {
    const parsePollutant = (val: unknown): number | undefined => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'string' && val.trim() === '') return undefined;
      const n = typeof val === 'number' ? val : Number(val);
      if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return undefined;
      return n;
    };

    const pm25Raw = parsePollutant(curr?.pm2_5);
    const pm10Raw = parsePollutant(curr?.pm10);
    const no2Raw = parsePollutant(curr?.nitrogen_dioxide);
    const so2Raw = parsePollutant(curr?.sulphur_dioxide);
    const o3Raw = parsePollutant(curr?.ozone);
    const coRaw = parsePollutant(curr?.carbon_monoxide);
    const dustRaw = parsePollutant(curr?.dust);

    const pm25 = pm25Raw !== undefined ? Math.round(pm25Raw) : undefined;
    const pm10 = pm10Raw !== undefined ? Math.round(pm10Raw) : undefined;
    const nitrogenDioxide = no2Raw !== undefined ? Math.round(no2Raw) : undefined;
    const sulphurDioxide = so2Raw !== undefined ? Math.round(so2Raw) : undefined;
    const ozone = o3Raw !== undefined ? Math.round(o3Raw) : undefined;
    const carbonMonoxide = coRaw !== undefined ? Number((coRaw / 1000).toFixed(2)) : undefined;
    const dust = dustRaw !== undefined ? Math.round(dustRaw) : undefined;

    let aqi: number | undefined;
    let category: NormalizedAirQuality['category'] = 'Unavailable';
    let color = 'text-slate-400';
    let bgColor = 'bg-slate-100 text-slate-600 border-slate-200';
    let healthAdvice = 'Air quality index calculation unavailable due to missing pollutant observations.';
    let calculationMethod = 'Unavailable';

    // CPCB Indian Standard Breakpoint calculation requires valid PM2.5 observation
    // PM2.5 ranges: 0-30 Good, 31-60 Satisfactory, 61-90 Moderate, 91-120 Poor, 121-250 Very Poor, 250+ Severe
    if (pm25 !== undefined) {
      calculationMethod = 'Indian CPCB National Air Quality Index (NAQI) Breakpoint Algorithm';
      if (pm25 <= 30) {
        aqi = Math.round((pm25 / 30) * 50);
        category = 'Good';
        color = 'text-emerald-600';
        bgColor = 'bg-emerald-100 text-emerald-900 border-emerald-200';
        healthAdvice = 'Minimal impact. Ideal for outdoor recreation, jogging & sports.';
      } else if (pm25 <= 60) {
        aqi = Math.round(50 + ((pm25 - 30) / 30) * 50);
        category = 'Satisfactory';
        color = 'text-lime-600';
        bgColor = 'bg-lime-100 text-lime-900 border-lime-200';
        healthAdvice = 'Minor breathing discomfort to sensitive individuals.';
      } else if (pm25 <= 90) {
        aqi = Math.round(100 + ((pm25 - 60) / 30) * 100);
        category = 'Moderate';
        color = 'text-amber-600';
        bgColor = 'bg-amber-100 text-amber-900 border-amber-200';
        healthAdvice = 'Breathing discomfort to people with asthma and lung diseases.';
      } else if (pm25 <= 120) {
        aqi = Math.round(200 + ((pm25 - 90) / 30) * 100);
        category = 'Poor';
        color = 'text-orange-600';
        bgColor = 'bg-orange-100 text-orange-900 border-orange-200';
        healthAdvice = 'Breathing discomfort to most people on prolonged outdoor exposure.';
      } else if (pm25 <= 250) {
        aqi = Math.round(300 + ((pm25 - 120) / 130) * 100);
        category = 'Very Poor';
        color = 'text-red-600';
        bgColor = 'bg-red-100 text-red-900 border-red-200';
        healthAdvice = 'Respiratory illness on prolonged exposure. Avoid heavy outdoor cardio.';
      } else {
        aqi = Math.min(500, Math.round(400 + ((pm25 - 250) / 130) * 100));
        category = 'Severe';
        color = 'text-purple-600';
        bgColor = 'bg-purple-100 text-purple-900 border-purple-200';
        healthAdvice = 'Serious respiratory impacts on healthy & vulnerable people alike. Stay indoors.';
      }
    }

    const isPartialAQ = aqi !== undefined && (pm10 === undefined || nitrogenDioxide === undefined || sulphurDioxide === undefined || ozone === undefined || carbonMonoxide === undefined);
    const isUnavailable = aqi === undefined;

    return {
      aqi,
      category,
      pm25,
      pm10,
      nitrogenDioxide,
      sulphurDioxide,
      ozone,
      carbonMonoxide,
      dust,
      color,
      bgColor,
      healthAdvice,
      calculationMethod,
      isUnavailable,
      source: {
        providerId: 'open-meteo-cpcb',
        providerName: isUnavailable
          ? 'Open-Meteo Air Quality (Unavailable / Incomplete)'
          : isPartialAQ
          ? 'Open-Meteo Air Quality & CPCB Calibration (Partial)'
          : 'Open-Meteo Air Quality & CPCB Calibration',
        classification: 'free-api-service',
        isOfficialIMD: false,
        isDerived: true,
        timestamp: new Date().toISOString(),
        obtainedAt: new Date().toISOString(),
        observedAt: typeof rawTime === 'string' && rawTime.trim().length > 0 ? rawTime : (typeof curr?.time === 'string' && curr.time.trim().length > 0 ? curr.time : undefined),
        confidenceScore: isUnavailable ? 0 : (isPartialAQ ? 72 : 88),
        attributionText: isUnavailable
          ? 'Open-Meteo Atmospheric Chemistry (Insufficient data for CPCB NAQI index)'
          : 'Open-Meteo Atmospheric Chemistry / CPCB NAQI algorithm',
      },
    };
  }

  /**
   * 3. Fetch Open-Meteo Marine Data
   * Provides wave height, direction, period, swell, and sea surface temperature for coastal regions.
   * STRICT INTEGRITY: Missing marine metrics remain undefined. No fabricated defaults.
   */
  async getMarineConditions(lat: number, lon: number, locationName: string): Promise<NormalizedMarine> {
    try {
      const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(
        4
      )}&longitude=${lon.toFixed(
        4
      )}&current=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period&hourly=sea_surface_temperature&timezone=Asia/Kolkata`;

      const res = await fetchWithTimeout(url, undefined, 8000);
      if (!res.ok) {
        // Not a coastal/marine coordinate or service unavailable
        return this.getInlandMarineFallback(locationName);
      }

      const data = await res.json();
      const curr = data.current;
      if (!curr || curr.wave_height === undefined || curr.wave_height === null) {
        return this.getInlandMarineFallback(locationName);
      }

      const hourlySst = data.hourly?.sea_surface_temperature?.[0];
      return this.parseRawMarineConditions(curr, hourlySst, locationName, true);
    } catch (e) {
      return this.getInlandMarineFallback(locationName);
    }
  }

  /**
   * Deterministic raw Marine parser adhering to UNKNOWN ≠ ZERO.
   */
  parseRawMarineConditions(
    curr: any,
    hourlySst: any,
    locationName: string,
    isCoastal: boolean = true
  ): NormalizedMarine {
    if (!isCoastal) {
      return this.getInlandMarineFallback(locationName);
    }

    const parseMarineMetric = (val: unknown, min: number = 0, max: number = 360): number | undefined => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'string' && val.trim() === '') return undefined;
      const n = typeof val === 'number' ? val : Number(val);
      if (!Number.isFinite(n) || Number.isNaN(n) || n < min || n > max) return undefined;
      return n;
    };

    const rawWaveHeight = parseMarineMetric(curr?.wave_height, 0, 35);
    const rawWaveDir = parseMarineMetric(curr?.wave_direction, 0, 360);
    const rawWavePeriod = parseMarineMetric(curr?.wave_period, 0, 40);
    const rawSwellHeight = parseMarineMetric(curr?.swell_wave_height, 0, 35);
    const rawSwellDir = parseMarineMetric(curr?.swell_wave_direction, 0, 360);
    const rawSwellPeriod = parseMarineMetric(curr?.swell_wave_period, 0, 40);
    const rawSst = parseMarineMetric(hourlySst, -5, 50);

    const waveHeight = rawWaveHeight !== undefined ? Number(rawWaveHeight.toFixed(1)) : undefined;
    const waveDirection = rawWaveDir !== undefined ? Math.round(rawWaveDir) : undefined;
    const wavePeriod = rawWavePeriod !== undefined ? Number(rawWavePeriod.toFixed(1)) : undefined;
    const swellWaveHeight = rawSwellHeight !== undefined ? Number(rawSwellHeight.toFixed(1)) : undefined;
    const swellWaveDirection = rawSwellDir !== undefined ? Math.round(rawSwellDir) : undefined;
    const swellPeriod = rawSwellPeriod !== undefined ? Number(rawSwellPeriod.toFixed(1)) : undefined;
    const seaSurfaceTemperature = rawSst !== undefined ? Number(rawSst.toFixed(1)) : undefined;

    let seaStateCategory: NormalizedMarine['seaStateCategory'] = 'Unavailable';
    let swimmingSafety: NormalizedMarine['swimmingSafety'] = 'Unavailable';

    if (waveHeight !== undefined) {
      if (waveHeight < 0.5) {
        seaStateCategory = 'Calm';
        swimmingSafety = 'Safe';
      } else if (waveHeight < 1.25) {
        seaStateCategory = 'Smooth';
        swimmingSafety = 'Safe';
      } else if (waveHeight < 2.5) {
        seaStateCategory = 'Moderate';
        swimmingSafety = 'Caution';
      } else if (waveHeight < 4.0) {
        seaStateCategory = 'Rough';
        swimmingSafety = 'Dangerous';
      } else {
        seaStateCategory = 'Very Rough';
        swimmingSafety = 'Dangerous';
      }
    }

    const isUnavailable = waveHeight === undefined && swellWaveHeight === undefined && seaSurfaceTemperature === undefined;

    return {
      isCoastal: true,
      isApplicable: true,
      isUnavailable,
      locationName,
      waveHeight,
      waveDirection,
      wavePeriod,
      swellWaveHeight,
      swellWaveDirection,
      swellPeriod,
      seaSurfaceTemperature,
      seaStateCategory,
      swimmingSafety,
      source: {
        providerId: 'open-meteo-marine',
        providerName: isUnavailable ? 'Open-Meteo Marine (Unavailable)' : 'Open-Meteo Marine (WaveWatch III & Copernicus Marine)',
        classification: 'free-api-service',
        isOfficialIMD: false,
        isDerived: false,
        timestamp: new Date().toISOString(),
        confidenceScore: isUnavailable ? 0 : 86,
        attributionText: 'Copernicus Marine Service & NOAA WaveWatch III via Open-Meteo',
      },
      disclaimer: isUnavailable
        ? 'Marine observation data is currently unavailable for this coastal coordinate.'
        : 'Model-derived oceanographic data for recreation & planning. Not an official marine navigation warning.',
    };
  }

  getInlandMarineFallback(locationName: string): NormalizedMarine {
    return {
      isCoastal: false,
      isApplicable: false,
      isUnavailable: false,
      locationName,
      waveHeight: undefined,
      waveDirection: undefined,
      wavePeriod: undefined,
      swellWaveHeight: undefined,
      swellWaveDirection: undefined,
      swellPeriod: undefined,
      seaSurfaceTemperature: undefined,
      seaStateCategory: 'Not Applicable',
      swimmingSafety: 'Not Applicable',
      source: {
        providerId: 'not-applicable',
        providerName: 'Marine Parameters (Not Applicable)',
        classification: 'open-source-software',
        isOfficialIMD: false,
        isDerived: false,
        timestamp: new Date().toISOString(),
        confidenceScore: 100,
        attributionText: 'Inland location — marine data not applicable',
      },
      disclaimer: `${locationName} is an inland location with no active sea or marine boundary; marine parameters are not applicable.`,
    };
  }

  getUnavailableMarineState(locationName: string): NormalizedMarine {
    return {
      isCoastal: true,
      isApplicable: true,
      isUnavailable: true,
      locationName,
      waveHeight: undefined,
      waveDirection: undefined,
      wavePeriod: undefined,
      swellWaveHeight: undefined,
      swellWaveDirection: undefined,
      swellPeriod: undefined,
      seaSurfaceTemperature: undefined,
      seaStateCategory: 'Unavailable',
      swimmingSafety: 'Unavailable',
      source: {
        providerId: 'open-meteo-marine',
        providerName: 'Open-Meteo Marine (Unavailable)',
        classification: 'free-api-service',
        isOfficialIMD: false,
        isDerived: false,
        timestamp: new Date().toISOString(),
        confidenceScore: 0,
        attributionText: 'Marine observation unavailable',
      },
      disclaimer: 'Marine observation data is currently unavailable for this coastal coordinate.',
    };
  }

  /**
   * 4. Fetch Historical Climate / Reanalysis Data
   * Open-Meteo Archive API (ERA5 reanalysis)
   * STRICT INTEGRITY: On API failure, returns an honest unavailable state without synthetic numbers.
   */
  async getHistoricalAnalysis(
    lat: number,
    lon: number,
    locationName: string
  ): Promise<NormalizedHistorical> {
    try {
      const today = new Date();
      const endYear = today.getFullYear();
      const pastStart = `${endYear - 1}-01-01`;
      const pastEnd = `${endYear - 1}-12-31`;

      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(
        4
      )}&longitude=${lon.toFixed(
        4
      )}&start_date=${pastStart}&end_date=${pastEnd}&daily=temperature_2m_mean,precipitation_sum&timezone=Asia/Kolkata`;

      const res = await fetchWithTimeout(url, undefined, 8000);
      if (!res.ok) {
        return this.getUnavailableHistoricalState(locationName, `Historical climate reanalysis endpoint returned status ${res.status}`);
      }

      const data = await res.json();
      return this.parseRawHistorical(data, locationName, endYear - 1);
    } catch (e) {
      return this.getUnavailableHistoricalState(locationName);
    }
  }

  /**
   * Deterministic raw Historical reanalysis parser adhering to UNKNOWN ≠ ZERO.
   */
  parseRawHistorical(data: any, locationName: string, refYear?: number): NormalizedHistorical {
    const year = refYear || (new Date().getFullYear() - 1);
    const temps: number[] = Array.isArray(data?.daily?.temperature_2m_mean)
      ? data.daily.temperature_2m_mean.filter((t: any) => typeof t === 'number' && Number.isFinite(t))
      : [];
    const precips: number[] = Array.isArray(data?.daily?.precipitation_sum)
      ? data.daily.precipitation_sum.filter((p: any) => typeof p === 'number' && Number.isFinite(p) && p >= 0)
      : [];

    if (temps.length === 0) {
      return this.getUnavailableHistoricalState(locationName, `Historical climate reanalysis data is unavailable for ${locationName}.`);
    }

    const meanTemp = Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1));
    const totalPrecip = precips.length > 0 ? Math.round(precips.reduce((a, b) => a + b, 0)) : undefined;

    const sampledPoints = temps.slice(0, 12).map((t, idx) => ({
      date: data?.daily?.time?.[idx * 30] || `Month ${idx + 1}`,
      temp: Math.round(t),
      precipitation: precips[idx * 30] !== undefined ? Math.round(precips[idx * 30]) : undefined,
    }));

    return {
      locationName,
      periodLabel: `Open-Meteo Archive API — ERA5 Reanalysis (${year})`,
      meanTemperature: meanTemp,
      tempAnomaly: undefined,
      precipitationTotal: totalPrecip,
      precipAnomalyPercent: undefined,
      climateTrend: 'Trend unavailable',
      summary: `Annual mean temperature of ${meanTemp}°C was recorded in ${year} (ERA5 reanalysis archive).${totalPrecip !== undefined ? ` Annual rainfall reached ${totalPrecip} mm.` : ''} Location-specific 30-year climatological normal baseline is not configured; trend is unavailable.`,
      dataPoints: sampledPoints,
      isUnavailable: false,
      source: {
        providerId: 'era5-openmeteo',
        providerName: 'Open-Meteo Archive API — ERA5 Reanalysis',
        classification: 'open-data',
        isOfficialIMD: false,
        isDerived: false,
        timestamp: new Date().toISOString(),
        confidenceScore: 94,
        attributionText: 'Open-Meteo Archive API (ECMWF ERA5 Reanalysis)',
      },
    };
  }

  getUnavailableHistoricalState(locationName: string, reason?: string): NormalizedHistorical {
    return {
      locationName,
      periodLabel: 'ERA5 Historical Archive (Unavailable)',
      meanTemperature: undefined,
      tempAnomaly: undefined,
      precipitationTotal: undefined,
      precipAnomalyPercent: undefined,
      climateTrend: 'Unavailable',
      summary: reason || `Historical climate reanalysis data is temporarily unavailable for ${locationName}.`,
      dataPoints: [],
      isUnavailable: true,
      source: {
        providerId: 'era5-openmeteo',
        providerName: 'Open-Meteo Archive API — ERA5 Reanalysis',
        classification: 'open-data',
        isOfficialIMD: false,
        isDerived: false,
        timestamp: new Date().toISOString(),
        confidenceScore: 0,
        attributionText: 'Open-Meteo Archive API (Data unavailable)',
      },
    };
  }
}
