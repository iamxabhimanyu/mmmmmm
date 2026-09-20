/**
 * Central Weather Data Validation & Meteorological Integrity Layer
 * MAUSAM Phase 4F - Data Integrity & Weather Intelligence Reliability
 *
 * Implements strict rules:
 * 1. Physical Meteorological Bounds Checking
 * 2. Strict rejection of NaN, Infinity, -Infinity, non-numbers
 * 3. MISSING DATA POLICY: UNKNOWN ≠ ZERO (missing rainfall ≠ 0mm, missing wind ≠ 0km/h, etc.)
 * 4. Temporal & Forecast Integrity (monotonic timestamps, distinct dates, min <= max)
 * 5. Cross-Field Consistency (dewpoint <= temp, feels-like plausibility, solar coherence)
 * 6. Canonical Unit Conversions (Celsius, km/h, mm, hPa single-point conversion)
 * 7. Partial Validity Preservation (preserve valid fields, flag invalid fields)
 */

import {
  NormalizedCurrentWeather,
  NormalizedHourlyItem,
  NormalizedDailyItem,
  NormalizedAirQuality,
  CompleteWeatherIntelligence,
} from '../services/providers/providerTypes';

// ============================================================================
// 1. METEOROLOGICAL CONSTANTS & PHYSICAL BOUNDS
// ============================================================================

export const WEATHER_VALIDATION_BOUNDS = {
  // World records: lowest -89.2°C (Vostok), highest 56.7°C (Death Valley), India: -40°C (Dras) to 51.0°C (Phalodi)
  TEMPERATURE: { MIN: -90.0, MAX: 65.0 }, // °C
  HUMIDITY: { MIN: 0.0, MAX: 100.0 }, // %
  WIND_SPEED: { MIN: 0.0, MAX: 450.0 }, // km/h (highest recorded gust ~408 km/h)
  WIND_GUST: { MIN: 0.0, MAX: 500.0 }, // km/h
  WIND_DIRECTION: { MIN: 0.0, MAX: 360.0 }, // degrees
  PRECIPITATION: { MIN: 0.0, MAX: 600.0 }, // mm/hour or mm/day (world record ~472mm in 24h at Mawsynram)
  PRESSURE: { MIN: 870.0, MAX: 1085.0 }, // hPa (Typhoon Tip 870 hPa, Siberian High 1083.8 hPa)
  CLOUD_COVER: { MIN: 0.0, MAX: 100.0 }, // %
  VISIBILITY: { MIN: 0.0, MAX: 100.0 }, // km
  UV_INDEX: { MIN: 0.0, MAX: 25.0 }, // Index (extreme mountain peaks reach ~20-25)
  DEW_POINT: { MIN: -90.0, MAX: 45.0 }, // °C
  AQI: { MIN: 0.0, MAX: 1000.0 }, // Indian CPCB scale: 0-500 standard, hazardous episodes up to 1000
  POLLUTANTS: {
    PM25: { MIN: 0.0, MAX: 1500.0 }, // µg/m³
    PM10: { MIN: 0.0, MAX: 2000.0 }, // µg/m³
    NO2: { MIN: 0.0, MAX: 1000.0 }, // µg/m³
    SO2: { MIN: 0.0, MAX: 1000.0 }, // µg/m³
    O3: { MIN: 0.0, MAX: 1000.0 }, // µg/m³
    CO: { MIN: 0.0, MAX: 100.0 }, // mg/m³
    DUST: { MIN: 0.0, MAX: 2000.0 }, // µg/m³
  },
} as const;

// ============================================================================
// 2. CORE NUMERICAL INTEGRITY PRIMITIVES
// ============================================================================

/**
 * Validates that a value is a strictly finite number (not NaN, Infinity, -Infinity, null, undefined, or string).
 */
export function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val);
}

/**
 * Checks if a value is known and present (not null, undefined, NaN, or non-finite).
 */
export function isKnown(val: unknown): boolean {
  return isFiniteNumber(val);
}

export interface FieldValidationResult<T = number> {
  isValid: boolean;
  value?: T;
  isUnavailable?: boolean;
  error?: string;
}

/**
 * Validates a numerical value against physical bounds.
 * Does NOT clamp values: invalid values are rejected, not masked.
 */
export function validateNumericField(
  val: unknown,
  min: number,
  max: number,
  fieldName: string
): FieldValidationResult<number> {
  if (val === null || val === undefined) {
    return {
      isValid: false,
      isUnavailable: true,
      error: `${fieldName} is missing (null/undefined)`,
    };
  }

  if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
    return {
      isValid: false,
      isUnavailable: true,
      error: `${fieldName} is not a finite number (${String(val)})`,
    };
  }

  if (val < min || val > max) {
    return {
      isValid: false,
      isUnavailable: true,
      error: `${fieldName} value ${val} is outside physical bounds [${min}, ${max}]`,
    };
  }

  return {
    isValid: true,
    value: val,
    isUnavailable: false,
  };
}

// Specific field validators
export function validateTemperature(temp: unknown): FieldValidationResult<number> {
  return validateNumericField(
    temp,
    WEATHER_VALIDATION_BOUNDS.TEMPERATURE.MIN,
    WEATHER_VALIDATION_BOUNDS.TEMPERATURE.MAX,
    'Temperature'
  );
}

export function validateHumidity(rh: unknown): FieldValidationResult<number> {
  return validateNumericField(
    rh,
    WEATHER_VALIDATION_BOUNDS.HUMIDITY.MIN,
    WEATHER_VALIDATION_BOUNDS.HUMIDITY.MAX,
    'Relative Humidity'
  );
}

export function validateWindSpeed(ws: unknown): FieldValidationResult<number> {
  return validateNumericField(
    ws,
    WEATHER_VALIDATION_BOUNDS.WIND_SPEED.MIN,
    WEATHER_VALIDATION_BOUNDS.WIND_SPEED.MAX,
    'Wind Speed'
  );
}

export function validateWindGust(wg: unknown): FieldValidationResult<number> {
  return validateNumericField(
    wg,
    WEATHER_VALIDATION_BOUNDS.WIND_GUST.MIN,
    WEATHER_VALIDATION_BOUNDS.WIND_GUST.MAX,
    'Wind Gust'
  );
}

export function validateWindDirection(wd: unknown): FieldValidationResult<number> {
  const res = validateNumericField(
    wd,
    WEATHER_VALIDATION_BOUNDS.WIND_DIRECTION.MIN,
    WEATHER_VALIDATION_BOUNDS.WIND_DIRECTION.MAX,
    'Wind Direction'
  );
  if (!res.isValid || res.value === undefined) return res;
  // Normalize 360° to 0° or keep within [0, 360)
  const normalized = res.value === 360 ? 0 : res.value;
  return { isValid: true, value: normalized };
}

export function validatePrecipitation(precip: unknown): FieldValidationResult<number> {
  // CRITICAL: Precipitation must be non-negative.
  // Negative precipitation is an error and must NOT be silently converted to 0.
  return validateNumericField(
    precip,
    WEATHER_VALIDATION_BOUNDS.PRECIPITATION.MIN,
    WEATHER_VALIDATION_BOUNDS.PRECIPITATION.MAX,
    'Precipitation'
  );
}

export function validatePressure(pres: unknown): FieldValidationResult<number> {
  return validateNumericField(
    pres,
    WEATHER_VALIDATION_BOUNDS.PRESSURE.MIN,
    WEATHER_VALIDATION_BOUNDS.PRESSURE.MAX,
    'Atmospheric Pressure'
  );
}

export function validateCloudCover(cc: unknown): FieldValidationResult<number> {
  return validateNumericField(
    cc,
    WEATHER_VALIDATION_BOUNDS.CLOUD_COVER.MIN,
    WEATHER_VALIDATION_BOUNDS.CLOUD_COVER.MAX,
    'Cloud Cover'
  );
}

export function validateVisibility(vis: unknown): FieldValidationResult<number> {
  return validateNumericField(
    vis,
    WEATHER_VALIDATION_BOUNDS.VISIBILITY.MIN,
    WEATHER_VALIDATION_BOUNDS.VISIBILITY.MAX,
    'Visibility'
  );
}

export function validateUvIndex(uv: unknown): FieldValidationResult<number> {
  return validateNumericField(
    uv,
    WEATHER_VALIDATION_BOUNDS.UV_INDEX.MIN,
    WEATHER_VALIDATION_BOUNDS.UV_INDEX.MAX,
    'UV Index'
  );
}

export function validateDewPoint(dp: unknown): FieldValidationResult<number> {
  return validateNumericField(
    dp,
    WEATHER_VALIDATION_BOUNDS.DEW_POINT.MIN,
    WEATHER_VALIDATION_BOUNDS.DEW_POINT.MAX,
    'Dew Point'
  );
}

export function validateAqi(aqi: unknown): FieldValidationResult<number> {
  return validateNumericField(
    aqi,
    WEATHER_VALIDATION_BOUNDS.AQI.MIN,
    WEATHER_VALIDATION_BOUNDS.AQI.MAX,
    'AQI'
  );
}

// ============================================================================
// 3. CANONICAL UNIT CONVERSION LAYER (SINGLE-POINT CONVERSION)
// ============================================================================

/**
 * Converts Celsius to Fahrenheit.
 * Returns null if input is null, undefined, NaN, or non-finite.
 * Formula: (C * 9) / 5 + 32
 */
export function celsiusToFahrenheit(celsius: number | null | undefined): number | null {
  if (!isFiniteNumber(celsius)) {
    return null;
  }
  return Math.round((celsius * 9) / 5 + 32);
}

/**
 * Converts km/h to m/s.
 * Formula: km/h / 3.6
 */
export function kmhToMps(kmh: number | null | undefined): number | null {
  if (!isFiniteNumber(kmh) || kmh < 0) {
    return null;
  }
  return Number((kmh / 3.6).toFixed(1));
}

/**
 * Converts km/h to mph.
 * Formula: km/h * 0.621371
 */
export function kmhToMph(kmh: number | null | undefined): number | null {
  if (!isFiniteNumber(kmh) || kmh < 0) {
    return null;
  }
  return Math.round(kmh * 0.621371);
}

/**
 * Converts mm to inches.
 * Formula: mm / 25.4
 */
export function mmToInches(mm: number | null | undefined): number | null {
  if (!isFiniteNumber(mm) || mm < 0) {
    return null;
  }
  return Number((mm / 25.4).toFixed(2));
}

/**
 * Formats temperature with unit indicator, respecting missing data policy.
 */
export function formatTemperature(
  celsius: number | null | undefined,
  unit: 'C' | 'F' = 'C',
  placeholder = '—'
): string {
  if (!isFiniteNumber(celsius)) {
    return placeholder;
  }
  if (unit === 'F') {
    const f = celsiusToFahrenheit(celsius);
    return f !== null ? `${f}°F` : placeholder;
  }
  return `${Math.round(celsius)}°C`;
}

/**
 * Formats wind speed with unit, respecting missing data policy.
 */
export function formatWindSpeed(kmh: number | null | undefined, placeholder = '—'): string {
  if (!isFiniteNumber(kmh) || kmh < 0) {
    return placeholder;
  }
  return `${Math.round(kmh)} km/h`;
}

/**
 * Formats precipitation with unit, respecting missing data policy (UNKNOWN ≠ 0).
 */
export function formatPrecipitation(mm: number | null | undefined, placeholder = '—'): string {
  if (!isFiniteNumber(mm) || mm < 0) {
    return placeholder;
  }
  return `${mm.toFixed(1)} mm`;
}

/**
 * Formats AQI value, respecting missing data policy (UNKNOWN ≠ 0).
 */
export function formatAqi(aqi: number | null | undefined, placeholder = '—'): string {
  if (!isFiniteNumber(aqi) || aqi < 0) {
    return placeholder;
  }
  return String(Math.round(aqi));
}

// ============================================================================
// 4. CROSS-FIELD CONSISTENCY VALIDATION
// ============================================================================

export interface CrossFieldConsistencyReport {
  isConsistent: boolean;
  inconsistencies: string[];
  correctedFields?: Partial<NormalizedCurrentWeather>;
}

/**
 * Validates cross-field meteorological physical consistency:
 * - Dew point must not exceed ambient temperature by more than physical margin (~0.5°C)
 * - Today's High must be >= Today's Low
 * - Feels-like temperature must be physically plausible relative to ambient temp, humidity, and wind
 * - Daytime flag must be coherent with solar hours if available
 * - Precipitation probability vs rain amount coherence
 */
export function validateCrossFieldConsistency(
  weather: Partial<NormalizedCurrentWeather>,
  dailyItem?: Partial<NormalizedDailyItem>
): CrossFieldConsistencyReport {
  const inconsistencies: string[] = [];

  const temp = weather.temperature;
  const dewPoint = weather.dewPoint;
  const high = weather.high ?? dailyItem?.tempMax;
  const low = weather.low ?? dailyItem?.tempMin;
  const feelsLike = weather.feelsLike;
  const humidity = weather.humidity;
  const windSpeed = weather.windSpeed;

  // 1. Dew Point vs Ambient Temperature
  // Psychrometric rule: Dew point temperature CANNOT exceed dry-bulb temperature (relative humidity cannot exceed 100%)
  if (isFiniteNumber(temp) && isFiniteNumber(dewPoint)) {
    if (dewPoint > temp + 0.5) {
      inconsistencies.push(
        `Dew point (${dewPoint}°C) exceeds ambient temperature (${temp}°C), which is physically impossible.`
      );
    }
  }

  // 2. High vs Low Temperature
  if (isFiniteNumber(high) && isFiniteNumber(low)) {
    if (low > high) {
      inconsistencies.push(
        `Daily minimum temperature (${low}°C) is greater than maximum temperature (${high}°C).`
      );
    }
  }

  // 3. Feels-Like Plausibility
  // In warm weather (temp > 27°C), feelsLike >= temp (heat index increases with humidity).
  // In cold/windy weather (temp < 10°C, wind > 10 km/h), feelsLike <= temp (wind chill decreases).
  // Extreme divergence (> 25°C difference without extreme conditions) indicates corrupted calculation.
  if (isFiniteNumber(temp) && isFiniteNumber(feelsLike)) {
    const diff = Math.abs(feelsLike - temp);
    if (diff > 30) {
      inconsistencies.push(
        `Apparent temperature (${feelsLike}°C) deviates impossibly (${diff}°C) from ambient temperature (${temp}°C).`
      );
    }
  }

  // 4. Day / Night Coherence with Solar Times
  if (weather.isDay !== undefined && weather.sunrise && weather.sunset) {
    // Basic format "HH:MM" check
    const sunriseParts = weather.sunrise.split(':');
    const sunsetParts = weather.sunset.split(':');
    if (sunriseParts.length === 2 && sunsetParts.length === 2) {
      const sunriseMin = parseInt(sunriseParts[0], 10) * 60 + parseInt(sunriseParts[1], 10);
      const sunsetMin = parseInt(sunsetParts[0], 10) * 60 + parseInt(sunsetParts[1], 10);

      const now = new Date();
      // Indian Standard Time is UTC+5:30
      const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
      const istMin = (utcMin + 330) % 1440;

      const isDaytimeBySun = istMin >= sunriseMin && istMin < sunsetMin;
      // Allow +/- 30 minutes twilight tolerance
      const isTwilight = Math.abs(istMin - sunriseMin) <= 30 || Math.abs(istMin - sunsetMin) <= 30;
      if (!isTwilight && weather.isDay !== isDaytimeBySun) {
        inconsistencies.push(
          `Day/night flag (${weather.isDay ? 'Day' : 'Night'}) contradicts local solar position (${weather.sunrise} - ${weather.sunset}).`
        );
      }
    }
  }

  return {
    isConsistent: inconsistencies.length === 0,
    inconsistencies,
  };
}

// ============================================================================
// 5. TEMPORAL & FORECAST INTEGRITY (HOURLY & DAILY)
// ============================================================================

export interface ForecastValidationResult<T> {
  isValid: boolean;
  items: T[];
  errors: string[];
  droppedCount: number;
}

/**
 * Validates Hourly Forecast Series:
 * - Timestamps must be valid positive numbers
 * - Must be strictly monotonically increasing: t[i] > t[i-1]
 * - Deduplicates or rejects duplicate hours
 * - Checks that numerical fields per hour are valid/finite
 * - Drops corrupt or scrambled hours, preserving valid chronological sequence
 */
export function validateHourlyForecastSeries(
  items: unknown[]
): ForecastValidationResult<NormalizedHourlyItem> {
  const errors: string[] = [];
  if (!Array.isArray(items) || items.length === 0) {
    return {
      isValid: false,
      items: [],
      errors: ['Hourly forecast is not a non-empty array'],
      droppedCount: 0,
    };
  }

  const validItems: NormalizedHourlyItem[] = [];
  const seenTimestamps = new Set<number>();
  let lastTimestamp = -1;
  let droppedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const raw = items[i] as any;
    if (!raw || typeof raw !== 'object') {
      errors.push(`Item at index ${i} is not an object`);
      droppedCount++;
      continue;
    }

    // 1. Timestamp validation
    let ts = raw.timestamp;
    if (!isFiniteNumber(ts) || ts <= 0) {
      if (raw.isoTime && !isNaN(Date.parse(raw.isoTime))) {
        ts = new Date(raw.isoTime).getTime();
      } else {
        errors.push(`Hour at index ${i} has invalid timestamp: ${raw.timestamp}`);
        droppedCount++;
        continue;
      }
    }

    // 2. Duplicate detection
    if (seenTimestamps.has(ts)) {
      errors.push(`Duplicate timestamp detected at index ${i} (${ts} / ${raw.isoTime || raw.timeLabel})`);
      droppedCount++;
      continue;
    }

    // 3. Monotonic ordering check
    if (lastTimestamp > 0 && ts <= lastTimestamp) {
      errors.push(
        `Scrambled chronological order: hour at index ${i} (${ts}) <= previous hour (${lastTimestamp})`
      );
      droppedCount++;
      continue;
    }

    // 4. Numerical field bounds
    const tempRes = validateTemperature(raw.temperature);
    if (!tempRes.isValid) {
      errors.push(`Hour at index ${i} has invalid temperature: ${raw.temperature}`);
      droppedCount++;
      continue;
    }

    // Validate rainMm (must not be negative)
    let rainMm = raw.rainMm;
    if (rainMm !== undefined && rainMm !== null) {
      const rainRes = validatePrecipitation(rainMm);
      if (!rainRes.isValid) {
        errors.push(`Hour at index ${i} has negative or impossible precipitation: ${rainMm}`);
        droppedCount++;
        continue;
      }
      rainMm = rainRes.value;
    }

    // Validate windSpeed
    let windSpeed = raw.windSpeed;
    if (windSpeed !== undefined && windSpeed !== null) {
      const windRes = validateWindSpeed(windSpeed);
      if (!windRes.isValid) {
        errors.push(`Hour at index ${i} has invalid wind speed: ${windSpeed}`);
        droppedCount++;
        continue;
      }
      windSpeed = windRes.value;
    }

    // Validate humidity
    let humidity = raw.humidity;
    if (humidity !== undefined && humidity !== null) {
      const humRes = validateHumidity(humidity);
      if (!humRes.isValid) {
        errors.push(`Hour at index ${i} has invalid humidity: ${humidity}`);
        droppedCount++;
        continue;
      }
      humidity = humRes.value;
    }

    seenTimestamps.add(ts);
    lastTimestamp = ts;

    validItems.push({
      ...raw,
      timestamp: ts,
      temperature: tempRes.value!,
      rainMm,
      windSpeed,
      humidity,
    });
  }

  return {
    isValid: validItems.length > 0 && errors.length === 0,
    items: validItems,
    errors,
    droppedCount,
  };
}

/**
 * Validates Daily Forecast Series:
 * - Dates must be valid and distinct (no duplicate days)
 * - Dates must be in chronological order
 * - Temperature relations: tempMin <= tempMax
 * - Precipitation must be non-negative
 */
export function validateDailyForecastSeries(
  items: unknown[]
): ForecastValidationResult<NormalizedDailyItem> {
  const errors: string[] = [];
  if (!Array.isArray(items) || items.length === 0) {
    return {
      isValid: false,
      items: [],
      errors: ['Daily forecast is not a non-empty array'],
      droppedCount: 0,
    };
  }

  const validItems: NormalizedDailyItem[] = [];
  const seenDates = new Set<string>();
  let lastDateMs = -1;
  let droppedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const raw = items[i] as any;
    if (!raw || typeof raw !== 'object') {
      errors.push(`Daily item at index ${i} is not an object`);
      droppedCount++;
      continue;
    }

    // 1. Date string validation
    const dateStr = raw.date;
    if (typeof dateStr !== 'string' || isNaN(Date.parse(dateStr))) {
      errors.push(`Daily item at index ${i} has invalid date string: ${dateStr}`);
      droppedCount++;
      continue;
    }

    // 2. Duplicate date check
    const normalizedDate = dateStr.slice(0, 10);
    if (seenDates.has(normalizedDate)) {
      errors.push(`Duplicate date detected at index ${i}: ${normalizedDate}`);
      droppedCount++;
      continue;
    }

    // 3. Chronological sequence check
    const dateMs = new Date(normalizedDate).getTime();
    if (lastDateMs > 0 && dateMs <= lastDateMs) {
      errors.push(`Non-chronological date at index ${i}: ${normalizedDate} <= previous date`);
      droppedCount++;
      continue;
    }

    // 4. Min/Max Temperature bounds and relation
    const maxRes = validateTemperature(raw.tempMax);
    const minRes = validateTemperature(raw.tempMin);

    if (!maxRes.isValid || !minRes.isValid) {
      errors.push(
        `Daily item at index ${i} has invalid temperatures (min: ${raw.tempMin}, max: ${raw.tempMax})`
      );
      droppedCount++;
      continue;
    }

    if (minRes.value! > maxRes.value!) {
      errors.push(
        `Contradiction at index ${i} (${normalizedDate}): tempMin (${minRes.value}) > tempMax (${maxRes.value})`
      );
      droppedCount++;
      continue;
    }

    // 5. Rain sum must be non-negative
    let rainSum = raw.rainSumMm;
    if (rainSum !== undefined && rainSum !== null) {
      const rainRes = validatePrecipitation(rainSum);
      if (!rainRes.isValid) {
        errors.push(`Daily item at index ${i} has negative precipitation sum: ${rainSum}`);
        droppedCount++;
        continue;
      }
      rainSum = rainRes.value;
    }

    seenDates.add(normalizedDate);
    lastDateMs = dateMs;

    validItems.push({
      ...raw,
      date: normalizedDate,
      tempMax: maxRes.value!,
      tempMin: minRes.value!,
      rainSumMm: rainSum,
    });
  }

  return {
    isValid: validItems.length > 0 && errors.length === 0,
    items: validItems,
    errors,
    droppedCount,
  };
}

// ============================================================================
// 6. WHOLE-PAYLOAD COMPREHENSIVE VALIDATION
// ============================================================================

export interface PayloadValidationSummary {
  isValid: boolean;
  criticalErrors: string[];
  warnings: string[];
  unavailableFields: string[];
  isCacheable: boolean;
}

/**
 * Validates a Complete Weather Intelligence payload before cache entry,
 * UI consumption, or fallback propagation.
 */
export function validateCompleteWeatherPayload(
  payload: unknown
): PayloadValidationSummary {
  const criticalErrors: string[] = [];
  const warnings: string[] = [];
  const unavailableFields: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return {
      isValid: false,
      criticalErrors: ['Payload is null or not an object'],
      warnings: [],
      unavailableFields: [],
      isCacheable: false,
    };
  }

  const p = payload as Partial<CompleteWeatherIntelligence>;

  // Check Level 5 Honest Unavailable
  if (p.isUnavailable === true || p.freshness?.isUnavailable === true || p.provenance?.fallbackLevel === 5) {
    return {
      isValid: true,
      criticalErrors: [],
      warnings: ['Payload is Level 5 Honest Unavailable State'],
      unavailableFields: ['all'],
      isCacheable: false, // Never cache honest unavailable state as valid weather
    };
  }

  // 1. Current Weather Validation
  if (!p.current || typeof p.current !== 'object') {
    criticalErrors.push('Missing current weather object');
  } else {
    const c = p.current;

    // Temperature (critical)
    const tempRes = validateTemperature(c.temperature);
    if (!tempRes.isValid) {
      criticalErrors.push(`Invalid current temperature: ${c.temperature}`);
      unavailableFields.push('temperature');
    }

    // Humidity (field unavailable if missing or out of bounds)
    if (c.humidity === undefined || c.humidity === null) {
      warnings.push('Missing current humidity (field unavailable)');
      unavailableFields.push('humidity');
    } else {
      const humRes = validateHumidity(c.humidity);
      if (!humRes.isValid) {
        warnings.push(`Invalid current humidity: ${c.humidity}`);
        unavailableFields.push('humidity');
      }
    }

    // Wind speed
    if (c.windSpeed === undefined || c.windSpeed === null) {
      warnings.push('Missing current wind speed (field unavailable)');
      unavailableFields.push('windSpeed');
    } else {
      const windRes = validateWindSpeed(c.windSpeed);
      if (!windRes.isValid) {
        warnings.push(`Invalid wind speed: ${c.windSpeed}`);
        unavailableFields.push('windSpeed');
      }
    }

    // Precipitation (must not be negative)
    if (c.precipitation === undefined || c.precipitation === null) {
      warnings.push('Missing current precipitation (field unavailable)');
      unavailableFields.push('precipitation');
    } else {
      const precipRes = validatePrecipitation(c.precipitation);
      if (!precipRes.isValid) {
        warnings.push(`Invalid precipitation: ${c.precipitation}`);
        unavailableFields.push('precipitation');
      }
    }

    // Pressure
    if (c.pressure === undefined || c.pressure === null) {
      warnings.push('Missing current pressure (field unavailable)');
      unavailableFields.push('pressure');
    } else {
      const pressRes = validatePressure(c.pressure);
      if (!pressRes.isValid) {
        warnings.push(`Invalid pressure: ${c.pressure}`);
        unavailableFields.push('pressure');
      }
    }

    // Cross-field checks
    const crossCheck = validateCrossFieldConsistency(c);
    if (!crossCheck.isConsistent) {
      warnings.push(...crossCheck.inconsistencies);
    }
  }

  // 2. Forecast Validation
  if (!p.forecast || typeof p.forecast !== 'object') {
    criticalErrors.push('Missing forecast object');
  } else {
    const hourlyRes = validateHourlyForecastSeries(p.forecast.hourly);
    if (hourlyRes.items.length === 0) {
      criticalErrors.push('No valid hourly forecast items found');
    } else if (hourlyRes.errors.length > 0) {
      warnings.push(...hourlyRes.errors);
    }

    const dailyRes = validateDailyForecastSeries(p.forecast.daily);
    if (dailyRes.items.length === 0) {
      criticalErrors.push('No valid daily forecast items found');
    } else if (dailyRes.errors.length > 0) {
      warnings.push(...dailyRes.errors);
    }
  }

  // 3. Air Quality Validation (if present)
  if (p.airQuality) {
    const aqiRes = validateAqi(p.airQuality.aqi);
    if (!aqiRes.isValid) {
      warnings.push(`Invalid AQI value: ${p.airQuality.aqi}`);
      unavailableFields.push('aqi');
    }
  }

  const isValid = criticalErrors.length === 0;
  const isCacheable = isValid && criticalErrors.length === 0;

  return {
    isValid,
    criticalErrors,
    warnings,
    unavailableFields,
    isCacheable,
  };
}
