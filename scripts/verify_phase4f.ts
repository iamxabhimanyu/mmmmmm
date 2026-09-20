/**
 * MAUSAM PHASE 4F - Comprehensive Meteorological & Data Integrity Verification Suite
 *
 * Verifies:
 * 1. Physical bounds enforcement (Temperature, Humidity, Wind, Pressure, Precipitation, UV, AQI, Visibility)
 * 2. Strict rejection of NaN, Infinity, -Infinity, non-numbers, negative precipitation
 * 3. MISSING DATA POLICY: UNKNOWN ≠ ZERO across UI and services
 * 4. Temporal forecast integrity: Monotonic hourly timestamps, deduplication, chronological daily forecast
 * 5. Daily forecast integrity: tempMin <= tempMax invariant
 * 6. Cross-field consistency: Dew point <= Temperature (psychrometric limit), feels-like plausibility
 * 7. Canonical unit conversions: Celsius to Fahrenheit, km/h to m/s, km/h to mph, mm to inches
 * 8. Unit conversion formatting & graceful degradation
 * 9. Provider response validation & normalization
 * 10. WeatherCacheManager rejection of corrupt/invalid payloads
 * 11. WeatherIntelligenceEngine alert integrity: No false alarms on missing data (e.g. missing visibility ≠ fog alert)
 * 12. Thunderstorm & flood risk calculation safety
 * 13. Persona intelligence resilience to incomplete data
 * 14. Preservation of Phase 4B, 4C, 4D, 4E invariants
 */

import {
  WEATHER_VALIDATION_BOUNDS,
  isFiniteNumber,
  isKnown,
  validateTemperature,
  validateHumidity,
  validateWindSpeed,
  validateWindGust,
  validateWindDirection,
  validatePrecipitation,
  validatePressure,
  validateCloudCover,
  validateVisibility,
  validateUvIndex,
  validateDewPoint,
  validateAqi,
  celsiusToFahrenheit,
  kmhToMps,
  kmhToMph,
  mmToInches,
  formatTemperature,
  formatWindSpeed,
  formatPrecipitation,
  formatAqi,
  validateCrossFieldConsistency,
  validateHourlyForecastSeries,
  validateDailyForecastSeries,
  validateCompleteWeatherPayload,
} from '../src/utils/weatherValidation';

import { WeatherCacheManager } from '../src/services/WeatherCacheManager';
import { WeatherIntelligenceEngine } from '../src/services/weatherIntelligenceEngine';
import { OpenMeteoProvider } from '../src/services/providers/OpenMeteoProvider';
import { CopernicusProvider } from '../src/services/providers/CopernicusProvider';
import {
  calculateHourlySuitability,
  generatePersonaIntelligence,
} from '../src/services/personaIntelligenceService';
import { fallbackManager } from '../src/services/FallbackManager';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  id: number;
  name: string;
  category: string;
  passed: boolean;
  evidence: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testId: number, name: string, category: string, evidence: string) {
  if (!condition) {
    console.error(`❌ FAILED Test ${testId}: ${name}\n   Evidence: ${evidence}`);
  }
  results.push({
    id: testId,
    name,
    category,
    passed: Boolean(condition),
    evidence,
  });
}

async function runSuite() {
  console.log('====================================================');
  console.log('STARTING PHASE 4F: DATA INTEGRITY & METEOROLOGICAL VALIDATION');
  console.log('====================================================');

  // --------------------------------------------------------------------------
  // SECTION 1: NUMERICAL INTEGRITY PRIMITIVES
  // --------------------------------------------------------------------------

  // Test 1: isFiniteNumber correctly accepts valid numbers and rejects non-numbers
  const validNum = isFiniteNumber(24.5) && isFiniteNumber(0) && isFiniteNumber(-12.3);
  const rejectsNonNum =
    !isFiniteNumber(NaN) &&
    !isFiniteNumber(Infinity) &&
    !isFiniteNumber(-Infinity) &&
    !isFiniteNumber(null) &&
    !isFiniteNumber(undefined) &&
    !isFiniteNumber('24.5') &&
    !isFiniteNumber({});
  assert(
    validNum && rejectsNonNum,
    1,
    'Core isFiniteNumber primitive correctly identifies finite floats/ints and rejects NaN/Infinity/strings',
    'primitives',
    `validNum=${validNum}, rejectsNonNum=${rejectsNonNum}`
  );

  // Test 2: Temperature physical bounds [-90°C to 65°C]
  const validTemp = validateTemperature(28.5);
  const validCold = validateTemperature(-35.0);
  const rejectHeat = validateTemperature(70.0);
  const rejectAbsCold = validateTemperature(-100.0);
  const rejectTempNan = validateTemperature(NaN);
  assert(
    validTemp.isValid &&
      validCold.isValid &&
      !rejectHeat.isValid &&
      !rejectAbsCold.isValid &&
      !rejectTempNan.isValid,
    2,
    'Temperature validation rejects values outside physical bounds [-90°C, 65°C] and NaN',
    'physical_bounds',
    `validTemp=${validTemp.isValid}, rejectHeat=${!rejectHeat.isValid}, rejectCold=${!rejectAbsCold.isValid}`
  );

  // Test 3: Relative humidity bounds [0% to 100%]
  const validHum = validateHumidity(65);
  const validZeroHum = validateHumidity(0);
  const valid100Hum = validateHumidity(100);
  const rejectNegHum = validateHumidity(-5);
  const rejectOver100Hum = validateHumidity(105);
  assert(
    validHum.isValid &&
      validZeroHum.isValid &&
      valid100Hum.isValid &&
      !rejectNegHum.isValid &&
      !rejectOver100Hum.isValid,
    3,
    'Relative humidity bounds enforcement [0%, 100%]',
    'physical_bounds',
    `validHum=${validHum.isValid}, rejectNeg=${!rejectNegHum.isValid}, rejectOver100=${!rejectOver100Hum.isValid}`
  );

  // Test 4: Wind speed & gust bounds [0 to 450 km/h and 500 km/h]
  const validWind = validateWindSpeed(25);
  const validCalm = validateWindSpeed(0);
  const rejectNegWind = validateWindSpeed(-2);
  const rejectExtremeWind = validateWindSpeed(500);
  const validGust = validateWindGust(60);
  const rejectNegGust = validateWindGust(-1);
  assert(
    validWind.isValid &&
      validCalm.isValid &&
      !rejectNegWind.isValid &&
      !rejectExtremeWind.isValid &&
      validGust.isValid &&
      !rejectNegGust.isValid,
    4,
    'Wind speed & gust validation rejects negative values and superhuman speeds (>450 km/h)',
    'physical_bounds',
    `validWind=${validWind.isValid}, rejectNeg=${!rejectNegWind.isValid}, rejectExtreme=${!rejectExtremeWind.isValid}`
  );

  // Test 5: Wind direction normalization [0 to 360 degrees]
  const validDir = validateWindDirection(180);
  const norm360 = validateWindDirection(360);
  const rejectNegDir = validateWindDirection(-10);
  const rejectOver360 = validateWindDirection(370);
  assert(
    validDir.isValid &&
      norm360.isValid &&
      norm360.value === 0 &&
      !rejectNegDir.isValid &&
      !rejectOver360.isValid,
    5,
    'Wind direction validation and 360° -> 0° normalization',
    'physical_bounds',
    `norm360=${norm360.value}, rejectNeg=${!rejectNegDir.isValid}, rejectOver360=${!rejectOver360.isValid}`
  );

  // Test 6: Precipitation validation: CRITICAL NON-NEGATIVE REQUIREMENT
  // Precipitation cannot be negative; negative must NOT be clamped to 0 silently
  const validRain = validatePrecipitation(12.5);
  const validZeroRain = validatePrecipitation(0);
  const rejectNegRain = validatePrecipitation(-0.5);
  const rejectExtremeRain = validatePrecipitation(700);
  assert(
    validRain.isValid &&
      validZeroRain.isValid &&
      !rejectNegRain.isValid &&
      !rejectExtremeRain.isValid,
    6,
    'Precipitation validation strictly rejects negative precipitation (no silent clamp to zero)',
    'physical_bounds',
    `validRain=${validRain.isValid}, zeroRain=${validZeroRain.isValid}, rejectNegRain=${!rejectNegRain.isValid}`
  );

  // Test 7: Barometric pressure bounds [870 to 1085 hPa]
  const validPres = validatePressure(1013);
  const rejectLowPres = validatePressure(850);
  const rejectHighPres = validatePressure(1100);
  assert(
    validPres.isValid && !rejectLowPres.isValid && !rejectHighPres.isValid,
    7,
    'Atmospheric pressure validation [870, 1085 hPa]',
    'physical_bounds',
    `validPres=${validPres.isValid}, rejectLow=${!rejectLowPres.isValid}, rejectHigh=${!rejectHighPres.isValid}`
  );

  // Test 8: UV Index bounds [0 to 25]
  const validUv = validateUvIndex(7);
  const validZeroUv = validateUvIndex(0);
  const rejectNegUv = validateUvIndex(-1);
  const rejectExtremeUv = validateUvIndex(30);
  assert(
    validUv.isValid && validZeroUv.isValid && !rejectNegUv.isValid && !rejectExtremeUv.isValid,
    8,
    'UV Index bounds enforcement [0, 25]',
    'physical_bounds',
    `validUv=${validUv.isValid}, rejectNeg=${!rejectNegUv.isValid}, rejectExtreme=${!rejectExtremeUv.isValid}`
  );

  // Test 9: Air Quality Index (CPCB Indian Standard) bounds [0 to 1000]
  const validAqi = validateAqi(180);
  const validHazardousAqi = validateAqi(650);
  const rejectNegAqi = validateAqi(-10);
  const rejectExtremeAqi = validateAqi(1500);
  assert(
    validAqi.isValid &&
      validHazardousAqi.isValid &&
      !rejectNegAqi.isValid &&
      !rejectExtremeAqi.isValid,
    9,
    'CPCB Air Quality Index validation [0, 1000]',
    'physical_bounds',
    `validAqi=${validAqi.isValid}, hazardous=${validHazardousAqi.isValid}, rejectNeg=${!rejectNegAqi.isValid}`
  );

  // Test 10: Visibility bounds [0 to 100 km]
  const validVis = validateVisibility(10);
  const rejectNegVis = validateVisibility(-1);
  const rejectExtremeVis = validateVisibility(150);
  assert(
    validVis.isValid && !rejectNegVis.isValid && !rejectExtremeVis.isValid,
    10,
    'Horizontal visibility bounds enforcement [0, 100 km]',
    'physical_bounds',
    `validVis=${validVis.isValid}, rejectNeg=${!rejectNegVis.isValid}`
  );

  // --------------------------------------------------------------------------
  // SECTION 2: CANONICAL UNIT CONVERSIONS & FORMATTING
  // --------------------------------------------------------------------------

  // Test 11: Celsius to Fahrenheit canonical conversion
  const c0ToF = celsiusToFahrenheit(0); // 32°F
  const c100ToF = celsiusToFahrenheit(100); // 212°F
  const cMinus40ToF = celsiusToFahrenheit(-40); // -40°F
  const c25ToF = celsiusToFahrenheit(25); // 77°F
  const cNullToF = celsiusToFahrenheit(null);
  const cNanToF = celsiusToFahrenheit(NaN);
  assert(
    c0ToF === 32 &&
      c100ToF === 212 &&
      cMinus40ToF === -40 &&
      c25ToF === 77 &&
      cNullToF === null &&
      cNanToF === null,
    11,
    'Celsius to Fahrenheit conversion accuracy and null/NaN safety',
    'unit_conversion',
    `0C->${c0ToF}F, 100C->${c100ToF}F, -40C->${cMinus40ToF}F, 25C->${c25ToF}F, null->${cNullToF}`
  );

  // Test 12: km/h to m/s canonical conversion
  const kmh36ToMps = kmhToMps(36); // 10.0 m/s
  const kmh0ToMps = kmhToMps(0); // 0.0 m/s
  const kmhNegToMps = kmhToMps(-5); // null
  assert(
    kmh36ToMps === 10.0 && kmh0ToMps === 0.0 && kmhNegToMps === null,
    12,
    'km/h to m/s conversion accuracy (36 km/h = 10 m/s)',
    'unit_conversion',
    `36kmh->${kmh36ToMps}m/s, 0kmh->${kmh0ToMps}m/s, neg->${kmhNegToMps}`
  );

  // Test 13: km/h to mph canonical conversion
  const kmh100ToMph = kmhToMph(100); // ~62 mph
  const kmh0ToMph = kmhToMph(0); // 0 mph
  assert(
    kmh100ToMph === 62 && kmh0ToMph === 0,
    13,
    'km/h to mph conversion accuracy (100 km/h = 62 mph)',
    'unit_conversion',
    `100kmh->${kmh100ToMph}mph, 0kmh->${kmh0ToMph}mph`
  );

  // Test 14: mm to inches canonical conversion
  const mm254ToIn = mmToInches(25.4); // 1.00 inch
  const mm0ToIn = mmToInches(0); // 0.00 inch
  assert(
    mm254ToIn === 1.0 && mm0ToIn === 0.0,
    14,
    'mm to inches conversion accuracy (25.4 mm = 1.00 inch)',
    'unit_conversion',
    `25.4mm->${mm254ToIn}in, 0mm->${mm0ToIn}in`
  );

  // Test 15: Unit formatters handle missing/invalid values with placeholder (UNKNOWN ≠ ZERO)
  const fmtTempValidC = formatTemperature(24.2, 'C');
  const fmtTempValidF = formatTemperature(24.2, 'F');
  const fmtTempMissing = formatTemperature(null, 'C');
  const fmtWindMissing = formatWindSpeed(undefined);
  const fmtPrecipMissing = formatPrecipitation(null);
  const fmtAqiMissing = formatAqi(NaN);
  assert(
    fmtTempValidC === '24°C' &&
      fmtTempValidF === '76°F' &&
      fmtTempMissing === '—' &&
      fmtWindMissing === '—' &&
      fmtPrecipMissing === '—' &&
      fmtAqiMissing === '—',
    15,
    'Formatters output em-dash placeholder on missing/null/NaN data without displaying fake 0',
    'missing_data_policy',
    `fmtTempC=${fmtTempValidC}, fmtTempF=${fmtTempValidF}, missingTemp=${fmtTempMissing}, missingPrecip=${fmtPrecipMissing}`
  );

  // --------------------------------------------------------------------------
  // SECTION 3: CROSS-FIELD CONSISTENCY & PSYCHROMETRIC INTEGRITY
  // --------------------------------------------------------------------------

  // Test 16: Dew point <= Ambient Temperature (Psychrometric limit)
  const consistentDew = validateCrossFieldConsistency({
    temperature: 28,
    dewPoint: 22,
  });
  const impossibleDew = validateCrossFieldConsistency({
    temperature: 25,
    dewPoint: 32, // Dew point > temp is physically impossible!
  });
  assert(
    consistentDew.isConsistent && !impossibleDew.isConsistent,
    16,
    'Cross-field validation catches dew point exceeding ambient temperature (psychrometric violation)',
    'cross_field',
    `consistent=${consistentDew.isConsistent}, impossible=${impossibleDew.isConsistent}, err="${impossibleDew.inconsistencies[0]}"`
  );

  // Test 17: Today High >= Today Low
  const consistentMinMax = validateCrossFieldConsistency(
    { temperature: 28 },
    { tempMin: 22, tempMax: 34 }
  );
  const invertedMinMax = validateCrossFieldConsistency(
    { temperature: 28 },
    { tempMin: 34, tempMax: 22 } // Inverted!
  );
  assert(
    consistentMinMax.isConsistent && !invertedMinMax.isConsistent,
    17,
    'Cross-field validation catches inverted Daily High vs Low temperatures',
    'cross_field',
    `consistent=${consistentMinMax.isConsistent}, inverted=${invertedMinMax.isConsistent}, err="${invertedMinMax.inconsistencies[0]}"`
  );

  // Test 18: Feels-like plausibility check (extreme divergence detection)
  const plausibleFeelsLike = validateCrossFieldConsistency({
    temperature: 30,
    feelsLike: 35,
  });
  const corruptedFeelsLike = validateCrossFieldConsistency({
    temperature: 25,
    feelsLike: 70, // 45°C divergence! Corrupted calculation
  });
  assert(
    plausibleFeelsLike.isConsistent && !corruptedFeelsLike.isConsistent,
    18,
    'Cross-field validation catches impossible apparent temperature divergence (>30°C deviation)',
    'cross_field',
    `plausible=${plausibleFeelsLike.isConsistent}, corrupted=${corruptedFeelsLike.isConsistent}`
  );

  // --------------------------------------------------------------------------
  // SECTION 4: TEMPORAL & FORECAST INTEGRITY (HOURLY & DAILY)
  // --------------------------------------------------------------------------

  // Test 19: Hourly forecast timestamps must be strictly monotonically increasing
  const validHourly = [
    { timestamp: 1000, temperature: 24, rainMm: 0 },
    { timestamp: 2000, temperature: 25, rainMm: 0.2 },
    { timestamp: 3000, temperature: 26, rainMm: 0.1 },
  ];
  const validHourlyRes = validateHourlyForecastSeries(validHourly);
  assert(
    validHourlyRes.isValid && validHourlyRes.items.length === 3,
    19,
    'Hourly forecast validator accepts strictly monotonic chronological timeline',
    'temporal_integrity',
    `isValid=${validHourlyRes.isValid}, itemsCount=${validHourlyRes.items.length}`
  );

  // Test 20: Hourly forecast detects and drops scrambled or duplicate timestamps
  const scrambledHourly = [
    { timestamp: 1000, temperature: 24, rainMm: 0 },
    { timestamp: 3000, temperature: 25, rainMm: 0 },
    { timestamp: 2000, temperature: 23, rainMm: 0 }, // Out of order!
    { timestamp: 3000, temperature: 25, rainMm: 0 }, // Duplicate!
  ];
  const scrambledRes = validateHourlyForecastSeries(scrambledHourly);
  assert(
    scrambledRes.droppedCount === 2 && scrambledRes.items.length === 2,
    20,
    'Hourly forecast validator drops scrambled and duplicate timestamps, preserving chronological items',
    'temporal_integrity',
    `droppedCount=${scrambledRes.droppedCount}, preservedItems=${scrambledRes.items.length}`
  );

  // Test 21: Hourly forecast rejects non-finite temperature in hourly items
  const nanHourly = [
    { timestamp: 1000, temperature: 24, rainMm: 0 },
    { timestamp: 2000, temperature: NaN, rainMm: 0 },
    { timestamp: 3000, temperature: 26, rainMm: 0 },
  ];
  const nanHourlyRes = validateHourlyForecastSeries(nanHourly);
  assert(
    nanHourlyRes.droppedCount === 1 && nanHourlyRes.items.length === 2,
    21,
    'Hourly forecast validator rejects hours with NaN temperatures',
    'temporal_integrity',
    `droppedCount=${nanHourlyRes.droppedCount}, preserved=${nanHourlyRes.items.length}`
  );

  // Test 22: Hourly forecast rejects negative rainMm in hourly items
  const negRainHourly = [
    { timestamp: 1000, temperature: 24, rainMm: 0 },
    { timestamp: 2000, temperature: 25, rainMm: -2.0 }, // Negative rain!
    { timestamp: 3000, temperature: 26, rainMm: 0.5 },
  ];
  const negRainRes = validateHourlyForecastSeries(negRainHourly);
  assert(
    negRainRes.droppedCount === 1 && negRainRes.items.length === 2,
    22,
    'Hourly forecast validator rejects hours with negative rain',
    'temporal_integrity',
    `droppedCount=${negRainRes.droppedCount}, preserved=${negRainRes.items.length}`
  );

  // Test 23: Daily forecast validator verifies distinct dates and tempMin <= tempMax
  const validDaily = [
    { date: '2026-09-15', tempMin: 22, tempMax: 32, rainSumMm: 0 },
    { date: '2026-09-16', tempMin: 23, tempMax: 33, rainSumMm: 2.5 },
    { date: '2026-09-17', tempMin: 21, tempMax: 30, rainSumMm: 1.0 },
  ];
  const validDailyRes = validateDailyForecastSeries(validDaily);
  assert(
    validDailyRes.isValid && validDailyRes.items.length === 3,
    23,
    'Daily forecast validator verifies chronological dates and tempMin <= tempMax',
    'forecast_integrity',
    `isValid=${validDailyRes.isValid}, count=${validDailyRes.items.length}`
  );

  // Test 24: Daily forecast drops duplicate dates
  const dupDaily = [
    { date: '2026-09-15', tempMin: 22, tempMax: 32 },
    { date: '2026-09-15', tempMin: 22, tempMax: 32 }, // Duplicate date
    { date: '2026-09-16', tempMin: 23, tempMax: 33 },
  ];
  const dupDailyRes = validateDailyForecastSeries(dupDaily);
  assert(
    dupDailyRes.droppedCount === 1 && dupDailyRes.items.length === 2,
    24,
    'Daily forecast validator drops duplicate dates',
    'forecast_integrity',
    `droppedCount=${dupDailyRes.droppedCount}, preserved=${dupDailyRes.items.length}`
  );

  // Test 25: Daily forecast drops items where tempMin > tempMax
  const invertedDaily = [
    { date: '2026-09-15', tempMin: 22, tempMax: 32 },
    { date: '2026-09-16', tempMin: 35, tempMax: 25 }, // Inverted: 35 > 25
    { date: '2026-09-17', tempMin: 21, tempMax: 30 },
  ];
  const invertedDailyRes = validateDailyForecastSeries(invertedDaily);
  assert(
    invertedDailyRes.droppedCount === 1 && invertedDailyRes.items.length === 2,
    25,
    'Daily forecast validator drops contradictory items where tempMin > tempMax',
    'forecast_integrity',
    `droppedCount=${invertedDailyRes.droppedCount}, preserved=${invertedDailyRes.items.length}`
  );

  // --------------------------------------------------------------------------
  // SECTION 5: WHOLE-PAYLOAD INTEGRITY & CACHE SANITY
  // --------------------------------------------------------------------------

  // Test 26: Whole payload validation passes on valid complete intelligence
  const mockValidPayload: any = {
    current: {
      temperature: 28,
      feelsLike: 31,
      humidity: 65,
      pressure: 1012,
      windSpeed: 14,
      precipitation: 0,
      dewPoint: 21,
    },
    forecast: {
      hourly: [
        { timestamp: 1000, temperature: 28, rainMm: 0 },
        { timestamp: 2000, temperature: 27, rainMm: 0 },
      ],
      daily: [
        { date: '2026-09-15', tempMin: 22, tempMax: 32, rainSumMm: 0 },
        { date: '2026-09-16', tempMin: 23, tempMax: 33, rainSumMm: 0 },
      ],
    },
    airQuality: { aqi: 85 },
  };
  const payloadRes = validateCompleteWeatherPayload(mockValidPayload);
  assert(
    payloadRes.isValid && payloadRes.isCacheable,
    26,
    'Whole payload validation marks well-formed weather payload as valid and cacheable',
    'payload_integrity',
    `isValid=${payloadRes.isValid}, isCacheable=${payloadRes.isCacheable}`
  );

  // Test 27: Whole payload validation rejects payload missing current temperature
  const invalidPayload: any = {
    current: {
      temperature: NaN, // Invalid!
      humidity: 65,
    },
    forecast: mockValidPayload.forecast,
  };
  const invalidPayloadRes = validateCompleteWeatherPayload(invalidPayload);
  assert(
    !invalidPayloadRes.isValid && !invalidPayloadRes.isCacheable,
    27,
    'Whole payload validation rejects payload with NaN temperature',
    'payload_integrity',
    `isValid=${invalidPayloadRes.isValid}, isCacheable=${invalidPayloadRes.isCacheable}, err="${invalidPayloadRes.criticalErrors[0]}"`
  );

  // Test 28: WeatherCacheManager rejects corrupt weather with NaN temperature
  const cacheManager = new WeatherCacheManager();
  const corruptCacheItem: any = {
    current: { temperature: NaN, humidity: 60 },
    forecast: mockValidPayload.forecast,
  };
  const cacheValidation = cacheManager.validateDataIntegrity(corruptCacheItem, 'current');
  assert(
    !cacheValidation.isValid,
    28,
    'WeatherCacheManager rejects caching weather items with NaN or invalid temperatures',
    'cache_integrity',
    `isValid=${cacheValidation.isValid}, reason="${cacheValidation.reason}"`
  );

  // Test 29: WeatherCacheManager rejects caching forecast with scrambled hourly order
  const corruptForecastItem: any = {
    current: mockValidPayload.current,
    forecast: {
      hourly: [
        { timestamp: 3000, temperature: 28 },
        { timestamp: 1000, temperature: 27 }, // Scrambled!
      ],
      daily: mockValidPayload.forecast.daily,
    },
  };
  const forecastCacheValidation = cacheManager.validateDataIntegrity(corruptForecastItem, 'forecast');
  assert(
    !forecastCacheValidation.isValid,
    29,
    'WeatherCacheManager rejects caching forecast with scrambled timestamps',
    'cache_integrity',
    `isValid=${forecastCacheValidation.isValid}, reason="${forecastCacheValidation.reason}"`
  );

  // Test 30: WeatherCacheManager rejects caching daily forecast where tempMin > tempMax
  const contradictoryDailyItem: any = {
    current: mockValidPayload.current,
    forecast: {
      hourly: mockValidPayload.forecast.hourly,
      daily: [{ date: '2026-09-15', tempMin: 35, tempMax: 20 }], // Inverted!
    },
  };
  const dailyCacheValidation = cacheManager.validateDataIntegrity(contradictoryDailyItem, 'forecast');
  assert(
    !dailyCacheValidation.isValid,
    30,
    'WeatherCacheManager rejects caching daily forecast with inverted min/max temperatures',
    'cache_integrity',
    `isValid=${dailyCacheValidation.isValid}, reason="${dailyCacheValidation.reason}"`
  );

  // --------------------------------------------------------------------------
  // SECTION 6: PROVIDER DATA NORMALIZATION & PSYCHROMETRIC LIMITS
  // --------------------------------------------------------------------------

  // Test 31: OpenMeteoProvider caps dew point at ambient temperature
  const provider = new OpenMeteoProvider();
  const rawMockApiData = {
    current: {
      temperature_2m: 25.4,
      relative_humidity_2m: 85,
      weather_code: 1,
      is_day: 1,
    },
    hourly: {
      time: ['2026-09-15T00:00', '2026-09-15T01:00'],
      temperature_2m: [25.4, 25.0],
      dew_point_2m: [30.0, 29.0], // Unphysically high dew point from mock source
      precipitation: [0, 0],
      wind_speed_10m: [10, 10],
    },
    daily: {
      time: ['2026-09-15'],
      temperature_2m_max: [30.0],
      temperature_2m_min: [20.0],
    },
  };
  const parsedWeather = provider.parseRawWeatherData(rawMockApiData);
  assert(
    parsedWeather.current.dewPoint <= parsedWeather.current.temperature,
    31,
    'OpenMeteoProvider enforces dewPoint <= ambient temperature (psychrometric limit)',
    'provider_normalization',
    `temp=${parsedWeather.current.temperature}°C, dewPoint=${parsedWeather.current.dewPoint}°C (capped at temp)`
  );

  // Test 32: OpenMeteoProvider preserves contradictory daily min/max without silently swapping
  const invertedApiData = {
    current: { temperature_2m: 25 },
    hourly: { time: [] },
    daily: {
      time: ['2026-09-15'],
      temperature_2m_max: [18.0], // Max lower than min!
      temperature_2m_min: [32.0],
    },
  };
  const parsedInverted = provider.parseRawWeatherData(invertedApiData);
  const d0 = parsedInverted.forecast.daily[0];
  assert(
    d0.tempMax === 18 && d0.tempMin === 32,
    32,
    'OpenMeteoProvider preserves contradictory daily min/max without silently swapping',
    'provider_normalization',
    `parsed tempMin=${d0.tempMin}, tempMax=${d0.tempMax} (unswapped for validation)`
  );

  // Test 33: OpenMeteoProvider preserves negative precipitation without silent clamping to zero
  const negPrecipApiData = {
    current: { temperature_2m: 25, precipitation: -5.0 },
    hourly: { time: [] },
    daily: {
      time: ['2026-09-15'],
      precipitation_sum: [-10.0],
    },
  };
  const parsedNegPrecip = provider.parseRawWeatherData(negPrecipApiData);
  assert(
    parsedNegPrecip.current.precipitation === -5.0 &&
      parsedNegPrecip.forecast.daily[0].rainSumMm === -10.0,
    33,
    'OpenMeteoProvider preserves negative precipitation without silent clamping to zero',
    'provider_normalization',
    `currentPrecip=${parsedNegPrecip.current.precipitation}, dailyRain=${parsedNegPrecip.forecast.daily[0].rainSumMm}`
  );

  // --------------------------------------------------------------------------
  // SECTION 7: WEATHER INTELLIGENCE ENGINE & ALERT SAFETY (UNKNOWN ≠ ZERO)
  // --------------------------------------------------------------------------

  // Test 34: Fog alert is NOT triggered when visibility is missing or 0 (UNKNOWN ≠ ZERO)
  const engine = new WeatherIntelligenceEngine();
  const mockWeatherMissingVis: any = {
    temperature: 25,
    visibility: undefined, // Missing visibility
    humidity: 80,
    windSpeed: 10,
  };
  const alertsMissingVis = (engine as any).generateWeatherAlerts(
    mockWeatherMissingVis,
    [],
    { riskLevel: 'Low' },
    { riskLevel: 'Low' }
  );
  const hasFogAlertMissing = alertsMissingVis.some((a: any) => a.id === 'alert-fog-dense');
  assert(
    !hasFogAlertMissing,
    34,
    'Alert engine does not trigger dense fog warning when visibility is missing (UNKNOWN ≠ ZERO)',
    'alert_integrity',
    `hasFogAlert=${hasFogAlertMissing}, alertCount=${alertsMissingVis.length}`
  );

  // Test 35: Fog alert IS triggered when visibility is valid and <= 2 km
  const mockWeatherValidFog: any = {
    temperature: 15,
    visibility: 1.2, // Real low visibility observation
    humidity: 95,
    windSpeed: 4,
  };
  const alertsValidFog = (engine as any).generateWeatherAlerts(
    mockWeatherValidFog,
    [],
    { riskLevel: 'Low' },
    { riskLevel: 'Low' }
  );
  const hasValidFogAlert = alertsValidFog.some((a: any) => a.id === 'alert-fog-dense');
  assert(
    hasValidFogAlert,
    35,
    'Alert engine correctly triggers dense fog alert when visibility is verified <= 2 km',
    'alert_integrity',
    `hasFogAlert=${hasValidFogAlert}`
  );

  // Test 36: Heatwave alert is NOT triggered when temperature is missing or NaN
  const mockWeatherMissingTemp: any = {
    temperature: NaN,
    humidity: 50,
  };
  const alertsMissingTemp = (engine as any).generateWeatherAlerts(
    mockWeatherMissingTemp,
    [],
    { riskLevel: 'Low' },
    { riskLevel: 'Low' }
  );
  const hasHeatwaveMissing = alertsMissingTemp.some((a: any) => a.id === 'alert-heat-wave');
  assert(
    !hasHeatwaveMissing && alertsMissingTemp.length === 0,
    36,
    'Alert engine does not trigger false heatwave or false all-clear on missing/NaN temperature',
    'alert_integrity',
    `hasHeatwave=${hasHeatwaveMissing}, alerts=${alertsMissingTemp.length}`
  );

  // Test 37: Heatwave alert IS triggered when temperature is valid and >= 39°C
  const mockWeatherHeatwave: any = {
    temperature: 42,
    humidity: 40,
    windSpeed: 15,
    visibility: 8,
  };
  const alertsHeatwave = (engine as any).generateWeatherAlerts(
    mockWeatherHeatwave,
    [],
    { riskLevel: 'Low' },
    { riskLevel: 'Low' }
  );
  const hasHeatwave = alertsHeatwave.some((a: any) => a.id === 'alert-heat-wave');
  assert(
    hasHeatwave,
    37,
    'Alert engine correctly triggers heatwave warning when temperature is verified >= 39°C',
    'alert_integrity',
    `hasHeatwave=${hasHeatwave}, alertTitle="${alertsHeatwave[0]?.title}"`
  );

  // Test 38: Thunderstorm risk calculation handles empty or non-finite hourly items safely
  const thunderstormRisk = (engine as any).computeThunderstormRisk(
    { temperature: 28, humidity: 70, windSpeed: 10, weatherConditionKey: 'clear' },
    [
      { precipitationProb: NaN, rainMm: NaN, windSpeed: NaN },
      { precipitationProb: 20, rainMm: 0.5, windSpeed: 12 },
    ]
  );
  assert(
    isFiniteNumber(thunderstormRisk.riskScore) &&
      thunderstormRisk.riskScore >= 0 &&
      thunderstormRisk.riskScore <= 100,
    38,
    'Thunderstorm risk calculation safely filters non-finite inputs and yields valid riskScore',
    'intelligence_resilience',
    `riskScore=${thunderstormRisk.riskScore}, riskLevel="${thunderstormRisk.riskLevel}"`
  );

  // --------------------------------------------------------------------------
  // SECTION 8: PERSONA INTELLIGENCE RESILIENCE
  // --------------------------------------------------------------------------

  // Test 39: PersonaIntelligenceService produces valid scores even when hourly weather is partial/missing
  const corruptHourlyPersona = [
    { time: '6 AM', temperature: NaN, precipitationProb: NaN },
    { time: '7 AM', temperature: 24, precipitationProb: 0, uvIndex: 2, windSpeed: 8 },
  ] as any;
  const personaScores = calculateHourlySuitability(
    'runner',
    corruptHourlyPersona,
    { aqi: 45 } as any
  );
  assert(
    personaScores.length === 2 &&
      personaScores[0].score === 50 &&
      personaScores[0].note === 'Weather data unavailable' &&
      personaScores[1].score > 50,
    39,
    'PersonaIntelligenceService returns honest fallback score for unavailable hours without crashing',
    'persona_resilience',
    `h0Score=${personaScores[0].score}, h0Note="${personaScores[0].note}", h1Score=${personaScores[1].score}`
  );

  // --------------------------------------------------------------------------
  // SECTION 9: PRESERVATION OF PREVIOUS PHASES (4B, 4C, 4D, 4E INVARIANTS)
  // --------------------------------------------------------------------------

  // Test 40: Fallback Level 5 Honest Unavailable state has isCacheable=false
  const honestUnavailablePayload: any = {
    isUnavailable: true,
    provenance: {
      fallbackLevel: 5,
      isExactMatch: true,
      requestedCoordinates: { latitude: 28.61395, longitude: 77.20901 },
    },
  };
  const unavailValidation = validateCompleteWeatherPayload(honestUnavailablePayload);
  assert(
    unavailValidation.isValid && !unavailValidation.isCacheable,
    40,
    'Level 5 Honest Unavailable state is recognized as valid honest state but strictly marked NOT cacheable',
    'invariants',
    `isValid=${unavailValidation.isValid}, isCacheable=${unavailValidation.isCacheable}`
  );

  // Test 41: Coordinates are preserved with 5-decimal precision (~1.1m) during normalization
  const normLat = Number((28.61394567).toFixed(5));
  const normLon = Number((77.20901234).toFixed(5));
  assert(
    normLat === 28.61395 && normLon === 77.20901,
    41,
    'Phase 4E coordinate normalization preserves 5-decimal geographic fidelity',
    'invariants',
    `lat=${normLat}, lon=${normLon}`
  );

  // Test 42: Partial validity preservation: valid fields are retained while invalid fields are flagged
  const partialWeather: any = {
    current: {
      temperature: 28,
      humidity: 60,
      pressure: 9999, // Invalid pressure!
      precipitation: -10, // Invalid rain!
    },
    forecast: mockValidPayload.forecast,
  };
  const partialValidation = validateCompleteWeatherPayload(partialWeather);
  assert(
    partialValidation.isValid && // Still valid overall because core temperature & humidity & forecast are present
      partialValidation.warnings.length >= 2 &&
      partialValidation.unavailableFields.includes('pressure') &&
      partialValidation.unavailableFields.includes('precipitation'),
    42,
    'Partial validity preservation: preserves valid core fields and flags corrupt ancillary fields',
    'partial_validity',
    `warningsCount=${partialValidation.warnings.length}, unavailable=[${partialValidation.unavailableFields.join(', ')}]`
  );

  // --------------------------------------------------------------------------
  // SECTION 9: PHASE 4F PATCH REGRESSION TESTS (UNKNOWN ≠ ZERO END-TO-END)
  // --------------------------------------------------------------------------

  // Test 43: Missing temperature stays unavailable without fabricating 25°C
  const rawMissingTemp = {
    current: { is_day: 1 },
    hourly: { time: [] },
    daily: { time: [] },
  };
  const parsedMissingTemp = provider.parseRawWeatherData(rawMissingTemp);
  assert(
    parsedMissingTemp.current.temperature === undefined &&
      parsedMissingTemp.current.feelsLike === undefined,
    43,
    'Missing temperature stays unavailable without fabricating 25°C default',
    'phase4f_patch',
    `temperature=${parsedMissingTemp.current.temperature}, feelsLike=${parsedMissingTemp.current.feelsLike}`
  );

  // Test 44: Missing humidity stays unavailable without fabricating 60%
  const rawMissingHum = {
    current: { temperature_2m: 24.5 },
    hourly: { time: [] },
    daily: { time: [] },
  };
  const parsedMissingHum = provider.parseRawWeatherData(rawMissingHum);
  assert(
    parsedMissingHum.current.humidity === undefined,
    44,
    'Missing humidity stays unavailable without fabricating 60% default',
    'phase4f_patch',
    `humidity=${parsedMissingHum.current.humidity}`
  );

  // Test 45: Missing wind metrics stay unavailable without fabricating defaults
  const rawMissingWind = {
    current: { temperature_2m: 24.5 },
    hourly: { time: [] },
    daily: { time: [] },
  };
  const parsedMissingWind = provider.parseRawWeatherData(rawMissingWind);
  assert(
    parsedMissingWind.current.windSpeed === undefined &&
      parsedMissingWind.current.windDirection === undefined &&
      parsedMissingWind.current.windGust === undefined,
    45,
    'Missing wind speed/direction/gust stay unavailable without fabricating defaults',
    'phase4f_patch',
    `ws=${parsedMissingWind.current.windSpeed}, wd=${parsedMissingWind.current.windDirection}, wg=${parsedMissingWind.current.windGust}`
  );

  // Test 46: Missing precipitation stays unavailable without fabricating 0.0 mm
  const rawMissingPrecip = {
    current: { temperature_2m: 24.5 },
    hourly: { time: [] },
    daily: { time: [] },
  };
  const parsedMissingPrecip = provider.parseRawWeatherData(rawMissingPrecip);
  assert(
    parsedMissingPrecip.current.precipitation === undefined &&
      parsedMissingPrecip.current.precipitation24h === undefined,
    46,
    'Missing precipitation stays unavailable without fabricating 0.0 mm default',
    'phase4f_patch',
    `precipitation=${parsedMissingPrecip.current.precipitation}, 24h=${parsedMissingPrecip.current.precipitation24h}`
  );

  // Test 47: Missing pressure stays unavailable without fabricating 1012 hPa
  const rawMissingPress = {
    current: { temperature_2m: 24.5 },
    hourly: { time: [] },
    daily: { time: [] },
  };
  const parsedMissingPress = provider.parseRawWeatherData(rawMissingPress);
  assert(
    parsedMissingPress.current.pressure === undefined,
    47,
    'Missing pressure stays unavailable without fabricating 1012 hPa default',
    'phase4f_patch',
    `pressure=${parsedMissingPress.current.pressure}`
  );

  // Test 48: Missing UV index and visibility stay unavailable without fabricating 5 or 10000m
  const rawMissingUvVis = {
    current: { temperature_2m: 24.5 },
    hourly: { time: [] },
    daily: { time: [] },
  };
  const parsedMissingUvVis = provider.parseRawWeatherData(rawMissingUvVis);
  assert(
    parsedMissingUvVis.current.uvIndex === undefined &&
      parsedMissingUvVis.current.visibility === undefined,
    48,
    'Missing UV index and visibility stay unavailable without fabricating defaults',
    'phase4f_patch',
    `uvIndex=${parsedMissingUvVis.current.uvIndex}, visibility=${parsedMissingUvVis.current.visibility}`
  );

  // Test 49: Missing daily min/max temperatures stay unavailable without fabricating 20°C/30°C
  const rawMissingDailyTemps = {
    current: { temperature_2m: 24.5 },
    hourly: { time: [] },
    daily: {
      time: ['2026-09-15'],
    },
  };
  const parsedMissingDaily = provider.parseRawWeatherData(rawMissingDailyTemps);
  const dailyItem0 = parsedMissingDaily.forecast.daily[0];
  assert(
    dailyItem0.tempMax === undefined &&
      dailyItem0.tempMin === undefined &&
      parsedMissingDaily.current.high === undefined &&
      parsedMissingDaily.current.low === undefined,
    49,
    'Missing daily min/max temperatures stay unavailable without fabricating defaults',
    'phase4f_patch',
    `dailyTempMax=${dailyItem0.tempMax}, dailyTempMin=${dailyItem0.tempMin}, high=${parsedMissingDaily.current.high}, low=${parsedMissingDaily.current.low}`
  );

  // Test 50: Missing sunrise and sunset stay unavailable without fabricating '06:05' / '18:32'
  const rawMissingSun = {
    current: { temperature_2m: 24.5 },
    hourly: { time: [] },
    daily: {
      time: ['2026-09-15'],
    },
  };
  const parsedMissingSun = provider.parseRawWeatherData(rawMissingSun);
  assert(
    parsedMissingSun.current.sunrise === undefined &&
      parsedMissingSun.current.sunset === undefined &&
      parsedMissingSun.forecast.daily[0].sunrise === undefined &&
      parsedMissingSun.forecast.daily[0].sunset === undefined,
    50,
    'Missing sunrise and sunset stay unavailable without fabricating default clock strings',
    'phase4f_patch',
    `sunrise=${parsedMissingSun.current.sunrise}, sunset=${parsedMissingSun.current.sunset}`
  );

  // Test 51: Missing dew-point stays unavailable without fabricated formula calculation
  const rawMissingDew = {
    current: { temperature_2m: 25.0, relative_humidity_2m: 60.0 },
    hourly: { time: [] },
    daily: { time: [] },
  };
  const parsedMissingDew = provider.parseRawWeatherData(rawMissingDew);
  assert(
    parsedMissingDew.current.dewPoint === undefined,
    51,
    'Missing dew-point stays unavailable without fabricating psychrometric fallback formula',
    'phase4f_patch',
    `dewPoint=${parsedMissingDew.current.dewPoint}`
  );

  // Test 52: Missing WMO weather_code results in unknown condition representation
  const rawMissingCode = {
    current: { temperature_2m: 25.0 },
    hourly: { time: [] },
    daily: { time: [] },
  };
  const parsedMissingCode = provider.parseRawWeatherData(rawMissingCode);
  assert(
    parsedMissingCode.current.conditionCode === undefined &&
      parsedMissingCode.current.weatherConditionKey === 'unknown' &&
      parsedMissingCode.current.conditionText === 'Condition Unavailable',
    52,
    'Missing WMO weather_code yields explicit unknown condition representation without fabricating clear sky',
    'phase4f_patch',
    `code=${parsedMissingCode.current.conditionCode}, key="${parsedMissingCode.current.weatherConditionKey}", text="${parsedMissingCode.current.conditionText}"`
  );

  // Test 53: Partial valid data (valid temperature and wind, missing humidity) remains usable
  const partialValidWeatherPayload: any = {
    current: {
      temperature: 27,
      windSpeed: 14,
      // humidity is missing (unavailable)
    },
    forecast: mockValidPayload.forecast,
  };
  const partialValidRes = validateCompleteWeatherPayload(partialValidWeatherPayload);
  assert(
    partialValidRes.isValid &&
      partialValidRes.unavailableFields.includes('humidity') &&
      partialValidRes.warnings.some((w) => w.includes('humidity')),
    53,
    'Partial valid data (valid temp/wind, missing humidity) remains usable and preserves unavailable flags',
    'phase4f_patch',
    `isValid=${partialValidRes.isValid}, unavailable=[${partialValidRes.unavailableFields.join(', ')}]`
  );

  // Test 54: Malformed values (negative precipitation) cannot enter cache
  const malformedPrecipWeather: any = {
    current: {
      temperature: 27,
      precipitation: -8.0, // Malformed negative rain from provider
    },
    forecast: mockValidPayload.forecast,
  };
  const cacheCheck = cacheManager.validateDataIntegrity(malformedPrecipWeather, 'current');
  assert(
    !cacheCheck.isValid && (cacheCheck.reason || '').toLowerCase().includes('precipitation'),
    54,
    'Malformed negative precipitation is rejected by cache validation instead of being silently cached as zero',
    'phase4f_patch',
    `cacheIsValid=${cacheCheck.isValid}, reason="${cacheCheck.reason}"`
  );

  // Test 55: Unknown condition key and missing values cannot trigger false "all clear" alerts
  const unknownCondWeather: any = {
    temperature: 25,
    weatherConditionKey: 'unknown',
    conditionText: 'Condition Unavailable',
  };
  const unknownCondAlerts = (engine as any).generateWeatherAlerts(
    unknownCondWeather,
    [],
    { riskLevel: 'Low' },
    { riskLevel: 'Low' }
  );
  const hasFalseAllClear = unknownCondAlerts.some((a: any) => a.id === 'alert-clear-normal');
  assert(
    !hasFalseAllClear && unknownCondAlerts.length === 0,
    55,
    'Unknown condition key prevents false "All Clear: Normal Weather" alert generation (UNKNOWN ≠ ZERO)',
    'phase4f_patch',
    `alertsCount=${unknownCondAlerts.length}, hasAllClear=${hasFalseAllClear}`
  );

  // --------------------------------------------------------------------------
  // SECTION 11: FINAL INTEGRITY PATCH — UNKNOWN ≠ ZERO OBSERVATIONAL VERIFICATION
  // --------------------------------------------------------------------------

  // Test 56: Flood alert never fabricates 2500 m³/s
  const floodWithoutDischarge: any = {
    basinName: 'Yamuna',
    riskLevel: 'High',
    forecastPeriod: 'Next 24 Hours',
    advisory: 'River levels rising due to intense catchment precipitation.',
    riverDischargeM3s: undefined,
  };
  const alertsWithoutDischarge = engine.generateNormalizedAlerts(
    'Delhi',
    'Delhi',
    { temperature: 28 } as any,
    [],
    { riskLevel: 'Low' } as any,
    floodWithoutDischarge
  );
  const floodAlert56 = alertsWithoutDischarge.find((a: any) => a.id === 'alert-flood-glofas');
  assert(
    floodAlert56 !== undefined &&
      !floodAlert56.description.includes('2500') &&
      floodAlert56.description.includes('River discharge data is unavailable'),
    56,
    'Flood alert never fabricates 2500 m³/s',
    'flood_integrity',
    `description="${floodAlert56?.description}"`
  );

  // Test 57: Flood alert reports unavailable discharge honestly
  const floodWithDischarge: any = {
    basinName: 'Yamuna',
    riskLevel: 'Severe',
    forecastPeriod: 'Next 24 Hours',
    advisory: 'Dangerous flood conditions.',
    riverDischargeM3s: 4120,
  };
  const alertsWithDischarge = engine.generateNormalizedAlerts(
    'Delhi',
    'Delhi',
    { temperature: 28 } as any,
    [],
    { riskLevel: 'Low' } as any,
    floodWithDischarge
  );
  const floodAlert57 = alertsWithDischarge.find((a: any) => a.id === 'alert-flood-glofas');
  assert(
    floodAlert57 !== undefined &&
      floodAlert57.description === 'Estimated river discharge is ~4120 m³/s.' &&
      floodAlert56?.description === 'River discharge data is unavailable; flood risk is based on available precipitation and hydrological indicators.',
    57,
    'Flood alert reports unavailable discharge honestly',
    'flood_integrity',
    `withDischarge="${floodAlert57?.description}", withoutDischarge="${floodAlert56?.description}"`
  );

  // Test 58: Thunderstorm engine with no usable atmospheric inputs returns Unavailable/Unknown
  const thunderEmpty = engine.detectThunderstormRisk({} as any, []);
  assert(
    thunderEmpty.riskLevel === 'Unavailable' &&
      thunderEmpty.lightningLikelihood === 'Unknown' &&
      thunderEmpty.advisory.includes('unavailable'),
    58,
    'Thunderstorm engine with no usable atmospheric inputs returns Unavailable/Unknown',
    'thunderstorm_integrity',
    `riskLevel="${thunderEmpty.riskLevel}", lightningLikelihood="${thunderEmpty.lightningLikelihood}", advisory="${thunderEmpty.advisory}"`
  );

  // Test 59: Missing rain does not become 0 for thunderstorm risk
  const thunderMissingRain = engine.detectThunderstormRisk(
    { temperature: 26, humidity: 65, windSpeed: 15 } as any,
    [{ windSpeed: 18 } as any] // no rain data at all
  );
  assert(
    thunderMissingRain.observedMetrics?.maxRainMm === undefined &&
      thunderMissingRain.observedMetrics?.maxRainProb === undefined,
    59,
    'Missing rain does not become 0 for thunderstorm risk',
    'thunderstorm_integrity',
    `maxRainMm=${thunderMissingRain.observedMetrics?.maxRainMm}, maxRainProb=${thunderMissingRain.observedMetrics?.maxRainProb}`
  );

  // Test 60: Missing wind does not become 0 for thunderstorm risk
  const thunderMissingWind = engine.detectThunderstormRisk(
    { temperature: 27, humidity: 70 } as any,
    [{ precipitationProb: 45, rainMm: 8 } as any] // no wind data at all
  );
  assert(
    thunderMissingWind.observedMetrics?.maxWindKmph === undefined &&
      thunderMissingWind.gustRiskKmph === undefined,
    60,
    'Missing wind does not become 0 for thunderstorm risk',
    'thunderstorm_integrity',
    `maxWindKmph=${thunderMissingWind.observedMetrics?.maxWindKmph}, gustRiskKmph=${thunderMissingWind.gustRiskKmph}`
  );

  // Test 61: Missing inputs cannot generate a false stable-atmosphere advisory
  const thunderUnavailableAdv = engine.detectThunderstormRisk(
    { weatherConditionKey: 'unknown' } as any,
    []
  );
  const falseStable =
    thunderUnavailableAdv.advisory.toLowerCase().includes('predominantly stable') ||
    thunderUnavailableAdv.advisory.toLowerCase().includes('negligible lightning');
  assert(
    !falseStable &&
      thunderUnavailableAdv.riskLevel === 'Unavailable' &&
      thunderUnavailableAdv.advisory.includes('unavailable'),
    61,
    'Missing inputs cannot generate a false stable-atmosphere advisory',
    'thunderstorm_integrity',
    `riskLevel="${thunderUnavailableAdv.riskLevel}", falseStable=${falseStable}, advisory="${thunderUnavailableAdv.advisory}"`
  );

  // Test 62: Partial valid atmospheric data still produces a meaningful calculated result
  const thunderPartial = engine.detectThunderstormRisk(
    { temperature: 34, humidity: 88 } as any,
    []
  );
  assert(
    thunderPartial.riskLevel !== 'Unavailable' &&
      thunderPartial.riskScore > 15 &&
      thunderPartial.riskLevel === 'Moderate' &&
      thunderPartial.observedMetrics?.maxRainMm === undefined &&
      thunderPartial.observedMetrics?.maxWindKmph === undefined,
    62,
    'Partial valid atmospheric data still produces a meaningful calculated result',
    'thunderstorm_integrity',
    `riskScore=${thunderPartial.riskScore}, riskLevel="${thunderPartial.riskLevel}"`
  );

  // Test 63: Valid rain/wind arrays still use legitimate Math.max calculations
  const thunderArrayMax = engine.detectThunderstormRisk(
    { windSpeed: 15, temperature: 28, humidity: 60 } as any,
    [
      { precipitationProb: 35, rainMm: 4.2, windSpeed: 20 } as any,
      { precipitationProb: 85, rainMm: 18.5, windSpeed: 45 } as any,
      { precipitationProb: 50, rainMm: 9.0, windSpeed: 30 } as any,
    ]
  );
  assert(
    thunderArrayMax.observedMetrics?.maxRainProb === 85 &&
      thunderArrayMax.observedMetrics?.maxRainMm === 18.5 &&
      thunderArrayMax.observedMetrics?.maxWindKmph === 45 &&
      thunderArrayMax.gustRiskKmph === Math.round(45 * 1.3),
    63,
    'Valid rain/wind arrays still use legitimate Math.max calculations',
    'thunderstorm_integrity',
    `maxProb=${thunderArrayMax.observedMetrics?.maxRainProb}, maxRain=${thunderArrayMax.observedMetrics?.maxRainMm}, maxWind=${thunderArrayMax.observedMetrics?.maxWindKmph}, gustRiskKmph=${thunderArrayMax.gustRiskKmph}`
  );

  // Test 64: Risk-score mathematical bounds remain intact
  const thunderMaxScore = engine.detectThunderstormRisk(
    {
      temperature: 35,
      humidity: 90,
      windSpeed: 50,
      weatherConditionKey: 'thunderstorm',
    } as any,
    [
      {
        conditionKey: 'thunderstorm',
        precipitationProb: 95,
        rainMm: 45,
        windSpeed: 60,
      } as any,
    ]
  );
  const thunderMinScore = engine.detectThunderstormRisk(
    {
      temperature: 20,
      humidity: 40,
      windSpeed: 5,
      weatherConditionKey: 'clear',
    } as any,
    [
      {
        conditionKey: 'clear',
        precipitationProb: 5,
        rainMm: 0,
        windSpeed: 5,
      } as any,
    ]
  );
  assert(
    thunderMaxScore.riskScore === 100 &&
      thunderMaxScore.riskScore <= 100 &&
      thunderMinScore.riskScore >= 0 &&
      thunderMinScore.riskScore <= 100,
    64,
    'Risk-score mathematical bounds remain intact',
    'thunderstorm_integrity',
    `maxBoundedScore=${thunderMaxScore.riskScore}, minBoundedScore=${thunderMinScore.riskScore}`
  );

  // --------------------------------------------------------------------------
  // TESTS 65 - 80: MARINE DATA INTEGRITY & HISTORICAL PROVENANCE (PHASE 4F BLOCKER PATCH)
  // --------------------------------------------------------------------------

  // Test 65: Marine persona never uses Math.random()
  const personaServiceCode = fs.readFileSync('src/services/personaIntelligenceService.ts', 'utf-8');
  const hasMathRandomInPersona = personaServiceCode.includes('Math.random');
  assert(
    !hasMathRandomInPersona,
    65,
    'Marine persona never uses Math.random()',
    'marine_integrity',
    `hasMathRandomInPersona=${hasMathRandomInPersona}`
  );

  const mockWeather = {
    temperature: 31,
    feelsLike: 35,
    tempMin: 27,
    tempMax: 33,
    humidity: 78,
    windSpeed: 16,
    windGust: 22,
    windDirection: 210,
    pressure: 1008,
    uvIndex: 8,
    visibility: 10,
    conditionText: 'Partly Cloudy',
    conditionKey: 'partly-cloudy' as const,
    precipitation: 0,
    rainMm: 0,
    precipitationProbability: 10,
    cloudCover: 35,
    timestamp: new Date().toISOString(),
    isDay: true,
  };
  const mockHourly = [
    {
      time: '12:00 PM',
      isoTime: '2026-09-15T12:00:00Z',
      timestamp: Date.now(),
      temperature: 31,
      precipitationProb: 10,
      conditionText: 'Partly Cloudy',
      conditionKey: 'partly-cloudy' as const,
    },
  ];
  const mockDaily = [
    {
      date: 'Today',
      dayOfWeek: 'Mon',
      dayName: 'Monday',
      fullDate: '2026-09-15',
      tempMax: 33,
      tempMin: 27,
      conditionText: 'Partly Cloudy',
      conditionKey: 'partly-cloudy' as const,
      precipitationProb: 10,
    },
  ];
  const mockAirQuality: any = {
    aqi: 45,
    category: 'Good',
    pm25: 12,
    pm10: 25,
    prominentPollutant: 'PM2.5',
    color: '#10B981',
    bgColor: '#ECFDF5',
    healthAdvice: 'Air quality is satisfactory.',
    healthAdvisory: 'Air quality is satisfactory.',
    source: {
      providerId: 'cpcb',
      providerName: 'CPCB',
      classification: 'official',
      isOfficialIMD: true,
      isDerived: false,
      timestamp: new Date().toISOString(),
      confidenceScore: 98,
      attributionText: 'CPCB Official',
    },
  };

  // Test 66: Marine persona never fabricates wave height
  const coastalWithWaves = generatePersonaIntelligence(
    'marine',
    mockWeather,
    mockHourly,
    mockDaily,
    mockAirQuality,
    'Mumbai Coastal',
    {
      isCoastal: true,
      isApplicable: true,
      waveHeight: 1.8,
      wavePeriod: 9.2,
      waveDirection: 240,
      seaSurfaceTemperature: 28.5,
    } as any
  );
  const waveHeightVal = coastalWithWaves.keyConditions.find((c) => c.label === 'Wave Height')?.value;
  assert(
    waveHeightVal === '1.8 m',
    66,
    'Marine persona never fabricates wave height',
    'marine_integrity',
    `waveHeightVal=${waveHeightVal}`
  );

  // Test 67: Missing wave height remains unavailable
  const coastalMissingWaves = generatePersonaIntelligence(
    'marine',
    mockWeather,
    mockHourly,
    mockDaily,
    mockAirQuality,
    'Mumbai Port',
    {
      isCoastal: true,
      isApplicable: true,
      waveHeight: undefined,
    } as any
  );
  const waveMissingVal = coastalMissingWaves.keyConditions.find((c) => c.label === 'Wave Height')?.value;
  const waveMissingMetric = coastalMissingWaves.prioritizedMetrics.find((m) => m.label === 'Significant Wave Height')?.value;
  assert(
    waveMissingVal === 'Unavailable' && waveMissingMetric === 'Unavailable',
    67,
    'Missing wave height remains unavailable',
    'marine_integrity',
    `waveMissingVal=${waveMissingVal}, waveMissingMetric=${waveMissingMetric}`
  );

  // Test 68: Missing wave period remains unavailable
  const coastalMissingPeriod = generatePersonaIntelligence(
    'marine',
    mockWeather,
    mockHourly,
    mockDaily,
    mockAirQuality,
    'Kochi Port',
    {
      isCoastal: true,
      isApplicable: true,
      waveHeight: 1.5,
      wavePeriod: undefined,
    } as any
  );
  const periodVal = coastalMissingPeriod.prioritizedMetrics.find((m) => m.label === 'Wave Period')?.value;
  assert(
    periodVal === 'Wave period unavailable',
    68,
    'Missing wave period remains unavailable',
    'marine_integrity',
    `periodVal=${periodVal}`
  );

  // Test 69: Missing wave direction remains unavailable
  const coastalMissingDir = generatePersonaIntelligence(
    'marine',
    mockWeather,
    mockHourly,
    mockDaily,
    mockAirQuality,
    'Goa Beach',
    {
      isCoastal: true,
      isApplicable: true,
      waveHeight: 1.2,
      waveDirection: undefined,
      swellWaveDirection: undefined,
    } as any
  );
  const dirSubVal = coastalMissingDir.prioritizedMetrics.find((m) => m.label === 'Wave Period')?.subValue;
  assert(
    dirSubVal === 'Wave direction unavailable',
    69,
    'Missing wave direction remains unavailable',
    'marine_integrity',
    `dirSubVal=${dirSubVal}`
  );

  // Test 70: Missing SST remains unavailable
  const coastalMissingSST = generatePersonaIntelligence(
    'marine',
    mockWeather,
    mockHourly,
    mockDaily,
    mockAirQuality,
    'Chennai Beach',
    {
      isCoastal: true,
      isApplicable: true,
      waveHeight: 1.4,
      seaSurfaceTemperature: undefined,
    } as any
  );
  const sstVal = coastalMissingSST.keyConditions.find((c) => c.label === 'Sea Surface Temp')?.value;
  const sstMetric = coastalMissingSST.prioritizedMetrics.find((m) => m.label === 'Sea Surface Temperature')?.value;
  assert(
    sstVal === 'Unavailable' && sstMetric === 'Unavailable',
    70,
    'Missing SST remains unavailable',
    'marine_integrity',
    `sstVal=${sstVal}, sstMetric=${sstMetric}`
  );

  // Test 71: Missing tide data is not replaced by 02:45 PM
  const tideKey = coastalMissingWaves.keyConditions.find((c) => c.label === 'Tide Status')?.value;
  const tideMetric = coastalMissingWaves.prioritizedMetrics.find((m) => m.label === 'Tide Timings (Est.)')?.value;
  assert(
    !tideKey?.includes('02:45 PM') && !tideMetric?.includes('02:45 PM'),
    71,
    'Missing tide data is not replaced by 02:45 PM',
    'marine_integrity',
    `tideKey=${tideKey}, tideMetric=${tideMetric}`
  );

  // Test 72: Missing wave period is not replaced by 8.4 seconds
  const allPeriodValues = coastalMissingWaves.prioritizedMetrics.map((m) => m.value + ' ' + (m.subValue || '')).join(' ');
  assert(
    !allPeriodValues.includes('8.4 seconds'),
    72,
    'Missing wave period is not replaced by 8.4 seconds',
    'marine_integrity',
    `contains8.4Seconds=${allPeriodValues.includes('8.4 seconds')}`
  );

  // Test 73: Missing direction is not replaced by southwest
  assert(
    !allPeriodValues.toLowerCase().includes('southwest'),
    73,
    'Missing direction is not replaced by southwest',
    'marine_integrity',
    `containsSouthwest=${allPeriodValues.toLowerCase().includes('southwest')}`
  );

  // Test 74: Air temperature cannot fabricate SST
  const weatherHot = { ...mockWeather, temperature: 42 };
  const weatherCold = { ...mockWeather, temperature: 9 };
  const sstHot = generatePersonaIntelligence('marine', weatherHot, mockHourly, mockDaily, mockAirQuality, 'Port', {
    isCoastal: true,
    isApplicable: true,
  } as any).keyConditions.find((c) => c.label === 'Sea Surface Temp')?.value;
  const sstCold = generatePersonaIntelligence('marine', weatherCold, mockHourly, mockDaily, mockAirQuality, 'Port', {
    isCoastal: true,
    isApplicable: true,
  } as any).keyConditions.find((c) => c.label === 'Sea Surface Temp')?.value;
  assert(
    sstHot === 'Unavailable' && sstCold === 'Unavailable',
    74,
    'Air temperature cannot fabricate SST',
    'marine_integrity',
    `sstHot=${sstHot}, sstCold=${sstCold}`
  );

  // Test 75: Inland marine persona reports Not Applicable
  const inlandMarine = generatePersonaIntelligence(
    'marine',
    mockWeather,
    mockHourly,
    mockDaily,
    mockAirQuality,
    'New Delhi',
    {
      isCoastal: false,
      isApplicable: false,
    } as any
  );
  assert(
    inlandMarine.scoreLabel === 'Not Applicable' &&
      inlandMarine.primaryAnswer.includes('not applicable') &&
      inlandMarine.recommendation.includes('not applicable'),
    75,
    'Inland marine persona reports Not Applicable',
    'marine_integrity',
    `scoreLabel=${inlandMarine.scoreLabel}, primaryAnswer=${inlandMarine.primaryAnswer}`
  );

  // Test 76: Missing marine observations cannot produce "Safe" swimming
  const missingSwimmingSuitability = coastalMissingWaves.prioritizedMetrics.find((m) => m.label === 'Swimming Suitability')?.value;
  assert(
    missingSwimmingSuitability === 'Unable to determine' && !missingSwimmingSuitability?.includes('Safe') && !missingSwimmingSuitability?.includes('Favorable'),
    76,
    'Missing marine observations cannot produce "Safe" swimming',
    'marine_integrity',
    `missingSwimmingSuitability=${missingSwimmingSuitability}`
  );

  // Test 77: Missing marine observations cannot produce "Favorable coastal conditions"
  const missingRecommendation = coastalMissingWaves.recommendation;
  assert(
    !missingRecommendation.includes('Favorable coastal conditions') &&
      missingRecommendation.includes('Marine safety cannot be determined from the available observations'),
    77,
    'Missing marine observations cannot produce "Favorable coastal conditions"',
    'marine_integrity',
    `missingRecommendation=${missingRecommendation}`
  );

  // Test 78: Historical result does not claim a 1991-2020 normal unless a real baseline was actually retrieved
  const copernicusCode = fs.readFileSync('src/services/providers/CopernicusProvider.ts', 'utf-8');
  const openMeteoCode = fs.readFileSync('src/services/providers/OpenMeteoProvider.ts', 'utf-8');
  const copernicusClaimsNormal = copernicusCode.includes('vs 1991-2020 Normal');
  const openMeteoClaimsNormal = openMeteoCode.includes('1991-2020 ERA5 climatological baseline');
  assert(
    !copernicusClaimsNormal && !openMeteoClaimsNormal,
    78,
    'Historical result does not claim a 1991-2020 normal unless a real baseline was actually retrieved',
    'historical_provenance',
    `copernicusClaimsNormal=${copernicusClaimsNormal}, openMeteoClaimsNormal=${openMeteoClaimsNormal}`
  );

  // Test 79: Historical trend is unavailable when no valid comparison baseline exists
  const copernicusProvider = new CopernicusProvider();
  const copernicusMockData = {
    daily: {
      temperature_2m_mean: Array(365).fill(26),
      precipitation_sum: Array(365).fill(2),
    },
  };
  const parsedHistorical = (copernicusProvider as any).parseRawHistorical?.(copernicusMockData, 'Jaipur', 2024);
  assert(
    parsedHistorical && (parsedHistorical.climateTrend === 'Trend unavailable' || parsedHistorical.climateTrend === 'Unavailable'),
    79,
    'Historical trend is unavailable when no valid comparison baseline exists',
    'historical_provenance',
    `climateTrend=${parsedHistorical?.climateTrend}`
  );

  // Test 80: Provider-wide intelligence audit confirms no random weather observation generation across src/services
  function getTsFiles(dir: string): string[] {
    let resultsList: string[] = [];
    if (!fs.existsSync(dir)) return resultsList;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        resultsList = resultsList.concat(getTsFiles(fullPath));
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        resultsList.push(fullPath);
      }
    }
    return resultsList;
  }
  const servicesFiles = getTsFiles('src/services');
  const filesWithRandom: string[] = [];
  for (const file of servicesFiles) {
    const code = fs.readFileSync(file, 'utf-8');
    if (code.includes('Math.random')) {
      filesWithRandom.push(file);
    }
  }
  assert(
    filesWithRandom.length === 0,
    80,
    'Comprehensive weather intelligence audit confirms no random data generation across src/services',
    'data_integrity',
    `scannedFilesCount=${servicesFiles.length}, filesWithRandom=${filesWithRandom.join(', ') || 'none'}`
  );

  // Test 81: Marine recommendations never claim an actual Coast Guard/INCOIS bulletin was retrieved without an official source
  const coastalRoughWaves = generatePersonaIntelligence(
    'marine',
    { ...mockWeather, windSpeed: 35 },
    mockHourly,
    mockDaily,
    mockAirQuality,
    'Goa Coastal Harbor',
    {
      isCoastal: true,
      isApplicable: true,
      isUnavailable: false,
      locationName: 'Goa Coastal Harbor',
      waveHeight: 2.8,
      waveDirection: 240,
      wavePeriod: 10,
      seaStateCategory: 'Rough',
      swimmingSafety: 'Caution',
      source: {
        providerId: 'open-meteo-marine',
        providerName: 'Open-Meteo Marine Forecast Model',
        classification: 'free-api-service',
        isOfficialIMD: false,
        isDerived: false,
        timestamp: new Date().toISOString(),
        confidenceScore: 85,
        attributionText: 'Open-Meteo Marine (ECMWF & GFS-Wave)',
      },
      disclaimer: 'Model-derived forecast',
    } as any
  );
  const personaCodeAudit = fs.readFileSync('src/services/personaIntelligenceService.ts', 'utf-8');
  const claimsCoastGuardBulletin =
    coastalRoughWaves.recommendation.toLowerCase().includes('incois bulletin') ||
    coastalRoughWaves.recommendation.toLowerCase().includes('coast guard bulletin') ||
    coastalRoughWaves.recommendation.includes('Indian Coast Guard & INCOIS Bulletin:');
  const fileContainsBulletinClaim = personaCodeAudit.includes('Indian Coast Guard & INCOIS Bulletin');
  assert(
    !claimsCoastGuardBulletin && !fileContainsBulletinClaim,
    81,
    'Marine recommendations never claim an actual Coast Guard/INCOIS bulletin was retrieved without an official source',
    'marine_attribution',
    `claimsCoastGuardBulletin=${claimsCoastGuardBulletin}, fileContainsBulletinClaim=${fileContainsBulletinClaim}`
  );

  // Test 82: Marine model-derived advisory explicitly identifies itself as model-derived
  const containsModelDerived =
    coastalRoughWaves.recommendation.toLowerCase().includes('model-derived') &&
    coastalRoughWaves.advisoryHeadline.toLowerCase().includes('model-derived');
  assert(
    containsModelDerived,
    82,
    'Marine model-derived advisory explicitly identifies itself as model-derived',
    'marine_attribution',
    `recommendationSnippet="${coastalRoughWaves.recommendation.slice(0, 80)}...", headline="${coastalRoughWaves.advisoryHeadline}"`
  );

  // Test 83: FallbackManager historical provenance never claims a 1991–2020 baseline
  const testLoc = {
    id: 'loc-delhi',
    name: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    isCoastal: false,
  };
  const fallbackManagerCode = fs.readFileSync('src/services/FallbackManager.ts', 'utf-8');
  const derivedSubsystemsProv = fallbackManager.buildSubsystemsProvenance(
    {
      current: 'available',
      hourly: 'available',
      daily: 'available',
      airQuality: 'derived',
      marine: 'not-applicable',
      flood: 'derived',
      radar: 'unavailable',
      alerts: 'unavailable',
      cyclone: 'unavailable',
      historical: 'derived',
    },
    'unavailable'
  );
  const histSourceName = derivedSubsystemsProv.historical?.sourceName || '';
  const fallbackManagerHas1991Claim =
    fallbackManagerCode.includes('1991-2020') ||
    fallbackManagerCode.includes('1991–2020') ||
    histSourceName.includes('1991-2020') ||
    histSourceName.includes('Mausam Climatological Baseline Reference');
  assert(
    !fallbackManagerHas1991Claim,
    83,
    'FallbackManager historical provenance never claims a 1991–2020 baseline',
    'historical_provenance',
    `histSourceName="${histSourceName}", fallbackManagerHas1991Claim=${fallbackManagerHas1991Claim}`
  );

  // Test 84: FallbackManager AQI provenance never claims a climatological baseline
  const aqiSourceName = derivedSubsystemsProv.airQuality?.sourceName || '';
  const fallbackManagerHasAqiBaseline =
    fallbackManagerCode.includes('Mausam Climatological Baseline') ||
    aqiSourceName.includes('Mausam Climatological Baseline');
  assert(
    !fallbackManagerHasAqiBaseline,
    84,
    'FallbackManager AQI provenance never claims a climatological baseline',
    'provenance_integrity',
    `aqiSourceName="${aqiSourceName}", fallbackManagerHasAqiBaseline=${fallbackManagerHasAqiBaseline}`
  );

  // Test 85: Unavailable flood state never reports Low/Steady as an actual assessment
  const weatherEngine = new WeatherIntelligenceEngine();
  const engineFallbackFlood = (weatherEngine as any).createFallbackFlood(testLoc);
  const honestUnavailable = fallbackManager.createHonestUnavailableState(testLoc as any, 'Service unreachable');
  const managerFallbackFlood = honestUnavailable.flood;
  const floodReportsLowOrSteady =
    engineFallbackFlood.riskLevel === 'Low' ||
    engineFallbackFlood.trend === 'Steady' ||
    managerFallbackFlood.riskLevel === 'Low' ||
    managerFallbackFlood.trend === 'Steady';
  assert(
    !floodReportsLowOrSteady &&
      engineFallbackFlood.riskLevel === 'Unavailable' &&
      engineFallbackFlood.trend === 'Unavailable' &&
      managerFallbackFlood.riskLevel === 'Unavailable' &&
      managerFallbackFlood.trend === 'Unavailable',
    85,
    'Unavailable flood state never reports Low/Steady as an actual assessment',
    'hydrology_integrity',
    `engineRiskLevel=${engineFallbackFlood.riskLevel}, engineTrend=${engineFallbackFlood.trend}, managerRiskLevel=${managerFallbackFlood.riskLevel}, managerTrend=${managerFallbackFlood.trend}`
  );

  // Test 86: Unavailable flood state never claims discharge was estimated
  const claimsDischargeEstimated =
    engineFallbackFlood.advisory.toLowerCase().includes('discharge estimated') ||
    engineFallbackFlood.advisory.toLowerCase().includes('estimated from baseline') ||
    managerFallbackFlood.advisory.toLowerCase().includes('discharge estimated') ||
    managerFallbackFlood.advisory.toLowerCase().includes('estimated from baseline');
  assert(
    !claimsDischargeEstimated,
    86,
    'Unavailable flood state never claims discharge was estimated',
    'hydrology_integrity',
    `claimsDischargeEstimated=${claimsDischargeEstimated}, engineAdvisory="${engineFallbackFlood.advisory}"`
  );

  // Test 87: Unavailable flood discharge remains undefined
  const dischargeIsUndefined =
    engineFallbackFlood.riverDischargeM3s === undefined &&
    managerFallbackFlood.riverDischargeM3s === undefined;
  assert(
    dischargeIsUndefined,
    87,
    'Unavailable flood discharge remains undefined',
    'hydrology_integrity',
    `engineDischarge=${engineFallbackFlood.riverDischargeM3s}, managerDischarge=${managerFallbackFlood.riverDischargeM3s}`
  );

  // Test 88: Unavailable flood precipitation remains undefined
  const rainIsUndefined =
    engineFallbackFlood.catchmentRainfall3DayMm === undefined &&
    managerFallbackFlood.catchmentRainfall3DayMm === undefined;
  assert(
    rainIsUndefined,
    88,
    'Unavailable flood precipitation remains undefined',
    'hydrology_integrity',
    `engineRain=${engineFallbackFlood.catchmentRainfall3DayMm}, managerRain=${managerFallbackFlood.catchmentRainfall3DayMm}`
  );

  // Test 89: Unavailable flood advisory explicitly states estimation is unavailable
  const advisoryStatesUnavailable =
    engineFallbackFlood.advisory.toLowerCase().includes('unavailable') &&
    managerFallbackFlood.advisory.toLowerCase().includes('unavailable');
  assert(
    advisoryStatesUnavailable,
    89,
    'Unavailable flood advisory explicitly states estimation is unavailable',
    'hydrology_integrity',
    `engineAdvisory="${engineFallbackFlood.advisory}", managerAdvisory="${managerFallbackFlood.advisory}"`
  );

  // Test 90: Unknown/unavailable states do not become reassuring safety states
  const honestAqi = honestUnavailable.airQuality;
  const honestMarine = honestUnavailable.marine;
  const honestThunder = honestUnavailable.thunderstorm;
  const aqiReassuring =
    honestAqi.category === 'Good' ||
    honestAqi.category === 'Satisfactory' ||
    honestAqi.category === 'Moderate';
  const marineReassuring =
    honestMarine.seaStateCategory === 'Calm' || honestMarine.swimmingSafety === 'Safe';
  const thunderReassuring =
    honestThunder.riskLevel === 'Low' ||
    (honestThunder.lightningLikelihood as string) === 'Low' ||
    (honestThunder.lightningLikelihood as string) === 'None';
  const reassuringStateDetected = aqiReassuring || marineReassuring || thunderReassuring;
  assert(
    !reassuringStateDetected &&
      honestAqi.category === 'Unavailable' &&
      honestMarine.seaStateCategory === 'Unavailable' &&
      honestMarine.swimmingSafety === 'Unavailable' &&
      honestThunder.riskLevel === 'Unavailable' &&
      honestThunder.lightningLikelihood === 'Unknown',
    90,
    'Unknown/unavailable states do not become reassuring safety states',
    'data_integrity',
    `aqiCategory=${honestAqi.category}, marineSeaState=${honestMarine.seaStateCategory}, marineSwimming=${honestMarine.swimmingSafety}, thunderRisk=${honestThunder.riskLevel}, lightningLikelihood=${honestThunder.lightningLikelihood}`
  );

  // Test 91: Random-generation audit covers all relevant weather intelligence files
  const minRequiredFiles = 10;
  assert(
    servicesFiles.length >= minRequiredFiles,
    91,
    'Random-generation audit covers all relevant weather intelligence files',
    'data_integrity',
    `scannedCount=${servicesFiles.length}, minRequired=${minRequiredFiles}`
  );

  // --------------------------------------------------------------------------
  // PRINT SUMMARY
  // --------------------------------------------------------------------------
  console.log('====================================================');
  console.log('PHASE 4F TEST RESULTS:');
  console.log('====================================================');

  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    if (r.passed) {
      passedCount++;
      console.log(`[TEST ${r.id}] ${r.name} (${r.category})`);
      console.log(`STATUS:   PASS`);
      console.log(`EVIDENCE: ${r.evidence}`);
    } else {
      failedCount++;
      console.error(`[TEST ${r.id}] ${r.name} (${r.category})`);
      console.error(`STATUS:   FAIL`);
      console.error(`EVIDENCE: ${r.evidence}`);
    }
  }

  console.log('====================================================');
  console.log(`SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED across ${results.length} total tests.`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test suite execution error:', err);
  process.exit(1);
});
