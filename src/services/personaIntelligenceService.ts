import {
  CurrentWeather,
  HourlyForecastItem,
  DailyForecastItem,
  AirQualityData,
  PersonaType,
  PersonaIntelligence,
  PersonaHourlyScore,
  PersonaMetricItem,
} from '../types';
import { NormalizedMarine } from './providers/providerTypes';

/**
 * Evaluates hour-by-hour weather suitability for a given persona.
 * Generates scores from 0-100 for each upcoming hour.
 */
export function calculateHourlySuitability(
  persona: PersonaType,
  hourly: HourlyForecastItem[],
  airQuality: AirQualityData,
  marine?: NormalizedMarine
): PersonaHourlyScore[] {
  const safeHourly = Array.isArray(hourly) ? hourly : [];
  return safeHourly.slice(0, 16).map((h) => {
    const hasValidTemp = typeof h?.temperature === 'number' && Number.isFinite(h.temperature);
    const hasValidRain = typeof h?.precipitationProb === 'number' && Number.isFinite(h.precipitationProb);
    const hasValidAqi = typeof airQuality?.aqi === 'number' && Number.isFinite(airQuality.aqi);
    const hasValidUv = typeof h?.uvIndex === 'number' && Number.isFinite(h.uvIndex);
    const hasValidWind = typeof h?.windSpeed === 'number' && Number.isFinite(h.windSpeed);

    if (!hasValidTemp && !hasValidRain) {
      return {
        time: h?.time || '—',
        score: 50,
        status: 'Avoid',
        temp: undefined,
        rainProb: undefined,
        conditionText: h?.conditionText || 'Data Unavailable',
        note: 'Weather data unavailable',
      };
    }

    // Track evaluated evidence count
    let evaluatedCount = 0;
    if (hasValidTemp) evaluatedCount++;
    if (hasValidRain) evaluatedCount++;
    if (hasValidAqi) evaluatedCount++;
    if (hasValidUv) evaluatedCount++;
    if (hasValidWind) evaluatedCount++;

    const temp = hasValidTemp ? h.temperature : undefined;
    const rain = hasValidRain ? h.precipitationProb : undefined;
    const uv = hasValidUv ? h.uvIndex : undefined;
    const wind = hasValidWind ? h.windSpeed : undefined;
    const aqi = hasValidAqi ? airQuality.aqi : undefined;

    let score = 85;
    let note = '';

    // If critical evidence is sparse (less than 2 verified metrics), start with cautious score
    if (evaluatedCount < 2) {
      score = 60;
    }

    switch (persona) {
      case 'runner': {
        // Ideal running temp: 16-24°C, rain < 20%, AQI < 100, UV < 6
        if (temp !== undefined) {
          if (temp > 34) score -= 35;
          else if (temp > 30) score -= 20;
          else if (temp < 12) score -= 10;
        }

        if (rain !== undefined) {
          if (rain > 50) score -= 35;
          else if (rain > 20) score -= 15;
        }

        if (uv !== undefined) {
          if (uv >= 8) score -= 20;
          else if (uv >= 6) score -= 10;
        }

        if (aqi !== undefined) {
          if (aqi > 200) score -= 30;
          else if (aqi > 100) score -= 15;
        }

        if (wind !== undefined && wind > 25) score -= 15;

        if (evaluatedCount < 2) {
          note = 'Limited observations available';
        } else if (score >= 80) {
          note = rain === undefined ? 'Favorable temp (Rain unobserved)' : aqi === undefined ? 'Good conditions (AQI unmonitored)' : 'Prime running conditions';
        } else if (score >= 65) {
          note = 'Good; hydrate well';
        } else if (temp !== undefined && temp > 30) {
          note = 'High thermal stress';
        } else if (rain !== undefined && rain > 40) {
          note = 'Wet track risk';
        } else {
          note = 'Suboptimal weather';
        }
        break;
      }

      case 'commuter': {
        // Transit & road safety: rain, fog/visibility, wind
        if (rain !== undefined) {
          if (rain >= 70) score -= 40;
          else if (rain >= 40) score -= 20;
        }

        if (h.conditionKey === 'thunderstorm') score -= 35;
        if (h.conditionKey === 'fog') score -= 30;
        if (wind !== undefined && wind > 35) score -= 20;

        if (evaluatedCount < 2 && rain === undefined) {
          note = 'Transit data incomplete (Rain unobserved)';
        } else if (score >= 80) {
          note = rain === undefined ? 'Transit fair (Rain unobserved)' : 'Clear transit';
        } else if (rain !== undefined && rain >= 50) {
          note = 'Rain delays likely';
        } else if (h.conditionKey === 'fog') {
          note = 'Low visibility';
        } else {
          note = 'Allow 10m buffer';
        }
        break;
      }

      case 'traveller': {
        if (rain !== undefined && rain >= 60) score -= 30;
        if (h.conditionKey === 'fog') score -= 25;
        if (h.conditionKey === 'thunderstorm') score -= 35;
        if (temp !== undefined && temp > 38) score -= 20;

        if (evaluatedCount < 2) {
          note = 'Route telemetry partial';
        } else if (score >= 80) {
          note = rain === undefined ? 'Normal highway pace (Rain unobserved)' : 'Ideal travel window';
        } else if (score >= 65) {
          note = 'Normal highway pace';
        } else {
          note = 'Proceed with caution';
        }
        break;
      }

      case 'health': {
        // Highly sensitive to AQI, PM2.5, extreme heat, and peak UV
        if (aqi !== undefined) {
          if (aqi > 300) score -= 50;
          else if (aqi > 200) score -= 35;
          else if (aqi > 100) score -= 18;
        }

        if (uv !== undefined) {
          if (uv >= 8) score -= 25;
          else if (uv >= 6) score -= 15;
        }

        if (temp !== undefined) {
          if (temp >= 38) score -= 25;
          else if (temp >= 33) score -= 15;
        }

        if (aqi === undefined) {
          note = 'AQI unobserved at station';
          if (score > 70) score = 70;
        } else if (score >= 80) {
          note = 'Clean air & mild UV';
        } else if (aqi > 200) {
          note = 'Poor AQI — mask up';
        } else if (uv !== undefined && uv >= 7) {
          note = 'Peak UV radiation';
        } else {
          note = 'Moderate sensitivity';
        }
        break;
      }

      case 'family': {
        // Sensitive to rain, thunderstorms, extreme heat and peak midday sun
        if (rain !== undefined && rain >= 50) score -= 35;
        if (h.conditionKey === 'thunderstorm') score -= 40;
        if (temp !== undefined) {
          if (temp > 35) score -= 30;
          else if (temp > 32) score -= 15;
        }
        if (uv !== undefined && uv >= 7) score -= 20;
        if (aqi !== undefined && aqi > 150) score -= 25;

        if (rain === undefined && temp === undefined) {
          note = 'Outdoor play telemetry unavailable';
        } else if (score >= 80) {
          note = rain === undefined ? 'Outdoor play (Rain unobserved)' : 'Safe for outdoor play';
        } else if (temp !== undefined && temp > 32) {
          note = 'Stay in the shade';
        } else if (rain !== undefined && rain >= 40) {
          note = 'Indoor play suggested';
        } else {
          note = 'Moderate conditions';
        }
        break;
      }

      case 'farmer': {
        // Farm operations: spray safety, rainfall arrival, wind drift
        if (wind !== undefined && wind > 20) score -= 30; // spray drift
        if (rain !== undefined && rain > 40) score -= 35; // wash-off
        if (temp !== undefined && temp > 38) score -= 20; // heat stress

        if (wind === undefined || rain === undefined) {
          note = 'Farm telemetry partial (Wind/rain unobserved)';
          if (score > 70) score = 70;
        } else if (score >= 80) {
          note = 'Favorable field work';
        } else if (wind > 20) {
          note = 'High spray drift risk';
        } else if (rain > 40) {
          note = 'Rain expected — pause spray';
        } else {
          note = 'Monitor moisture';
        }
        break;
      }

      case 'marine': {
        const isInland = Boolean(marine && (!marine.isCoastal || marine.isApplicable === false));
        if (isInland) {
          score = 50;
          note = 'Marine conditions not applicable';
          break;
        }

        const hasValidWave = typeof marine?.waveHeight === 'number' && Number.isFinite(marine.waveHeight);

        // Adjust score based on validated wave height if available
        if (hasValidWave) {
          if (marine!.waveHeight! > 2.5) score -= 45;
          else if (marine!.waveHeight! > 1.5) score -= 25;
        }

        // Coastal safety: wind speed, thunderstorms, rainfall
        if (wind !== undefined) {
          if (wind > 35) score -= 45;
          else if (wind > 22) score -= 25;
        }

        if (h.conditionKey === 'thunderstorm') score -= 40;
        if (rain !== undefined && rain >= 50) score -= 20;

        if (score < 50 && wind !== undefined && wind > 30) {
          note = 'Rough chop & gusts';
        } else if (h.conditionKey === 'thunderstorm') {
          note = 'Offshore storm risk';
        } else if (hasValidWave) {
          if (marine!.waveHeight! > 2.0) note = 'Rough seas & heavy surf';
          else if (marine!.waveHeight! > 1.2) note = 'Moderate swell';
          else note = 'Calm sea state';
        } else if (wind !== undefined && wind <= 20) {
          note = 'Calm wind conditions';
        } else {
          note = 'Marine observation unavailable';
        }
        break;
      }

      default:
        break;
    }

    score = Math.max(15, Math.min(98, score));
    let status: PersonaHourlyScore['status'] = 'Ideal';
    if (score < 50) status = 'Avoid';
    else if (score < 70) status = 'Fair';
    else if (score < 85) status = 'Good';

    return {
      time: h.time,
      score,
      status,
      temp: hasValidTemp ? h.temperature : undefined,
      rainProb: hasValidRain ? h.precipitationProb : undefined,
      conditionText: h.conditionText,
      note,
      dayLabel: h.dayLabel || 'Today',
      isToday: h.dayLabel !== 'Tomorrow',
    };
  });
}

/**
 * Main Weather Intelligence Engine
 * Interprets real-time weather & forecast specifically for each persona.
 */
export function generatePersonaIntelligence(
  persona: PersonaType,
  weather: CurrentWeather,
  hourly: HourlyForecastItem[],
  daily: DailyForecastItem[],
  airQuality: AirQualityData,
  locationName: string,
  marine?: NormalizedMarine
): PersonaIntelligence {
  const hourlyScores = calculateHourlySuitability(persona, hourly, airQuality, marine);

  const isWeatherUnavailable = Boolean((weather as any)?.isUnavailable);
  const hasTemp = typeof weather?.temperature === 'number' && Number.isFinite(weather.temperature);
  const hasFeelsLike = typeof weather?.feelsLike === 'number' && Number.isFinite(weather.feelsLike);
  const hasRain24 = typeof weather?.precipitation24h === 'number' && Number.isFinite(weather.precipitation24h);
  const hasWind = typeof weather?.windSpeed === 'number' && Number.isFinite(weather.windSpeed);
  const hasAqi = typeof airQuality?.aqi === 'number' && Number.isFinite(airQuality.aqi);
  const hasUv = typeof weather?.uvIndex === 'number' && Number.isFinite(weather.uvIndex);
  const hasVis = typeof weather?.visibility === 'number' && Number.isFinite(weather.visibility) && weather.visibility > 0;

  const missingMetrics: string[] = [];
  if (!hasTemp) missingMetrics.push('Temperature');
  if (!hasWind) missingMetrics.push('Wind Speed');
  if (!hasRain24 && hourly.every((h) => typeof h.precipitationProb !== 'number')) missingMetrics.push('Precipitation');
  if (!hasAqi) missingMetrics.push('Air Quality (AQI)');
  if (!hasVis) missingMetrics.push('Visibility');
  if (!hasUv) missingMetrics.push('UV Index');

  let confidenceLevel: 'High' | 'Moderate' | 'Low' | 'Unavailable' = 'High';
  if (isWeatherUnavailable || hourlyScores.length === 0 || !hasTemp) {
    confidenceLevel = 'Unavailable';
  } else if (missingMetrics.length >= 3) {
    confidenceLevel = 'Low';
  } else if (missingMetrics.length >= 1) {
    confidenceLevel = 'Moderate';
  }

  let bestWindow = 'Window Unavailable';
  let bestWindowSub = 'Hourly timeline observations unavailable';
  let avoidWindow: string | undefined;
  let avoidWindowReason: string | undefined;
  let score = 0;
  let scoreLabel: PersonaIntelligence['scoreLabel'] = 'Unavailable';

  if (hourlyScores.length > 0 && !isWeatherUnavailable && hasTemp) {
    let maxWindowScore = -1;
    let bestHourIdx = 0;
    if (hourlyScores.length >= 2) {
      for (let i = 0; i < Math.min(hourlyScores.length - 1, 10); i++) {
        const avg = (hourlyScores[i].score + hourlyScores[i + 1].score) / 2;
        if (avg > maxWindowScore) {
          maxWindowScore = avg;
          bestHourIdx = i;
        }
      }
    }

    const bestItem = hourlyScores[bestHourIdx];
    const endItem = hourlyScores[Math.min(bestHourIdx + 2, hourlyScores.length - 1)];
    const startHour = bestItem?.time || '06:00 AM';
    const endHour = endItem?.time || '08:00 AM';
    const dayPrefix = bestItem?.dayLabel === 'Tomorrow' ? 'Tomorrow ' : '';
    bestWindow = `${dayPrefix}${startHour} – ${endHour}`;
    bestWindowSub = 'Favorable atmospheric conditions';

    const worstHour = hourlyScores.reduce((worst, cur) => (cur.score < worst.score ? cur : worst), hourlyScores[0]);
    if (worstHour && worstHour.score < 60) {
      const worstDayPrefix = worstHour.dayLabel === 'Tomorrow' ? 'Tomorrow ' : '';
      avoidWindow = `${worstDayPrefix}${worstHour.time}`;
      avoidWindowReason = worstHour.note || 'Unfavorable weather conditions';
    }

    const scoreCount = Math.min(hourlyScores.length, 8);
    const avgSuitability = Math.round(hourlyScores.slice(0, 8).reduce((acc, cur) => acc + cur.score, 0) / scoreCount);
    score = avgSuitability;
    if (score >= 88) scoreLabel = 'Excellent';
    else if (score >= 75) scoreLabel = 'Good';
    else if (score >= 60) scoreLabel = 'Moderate';
    else scoreLabel = 'Caution';
  }

  // 1. RUNNER / FITNESS
  if (persona === 'runner' || persona === 'outdoor') {
    const trackDryness = hasRain24
      ? weather.precipitation24h > 10 || weather.conditionKey === 'rain'
        ? 'Wet & Slippery'
        : weather.precipitation24h > 2
        ? 'Damp Pavement'
        : 'Dry & Clean Track'
      : 'Track Surface Unobserved';

    const thermalComfort = hasFeelsLike
      ? weather.feelsLike > 35
        ? 'Very Hot / Oppressive'
        : weather.feelsLike > 30
        ? 'Warm & Humid'
        : weather.feelsLike < 15
        ? 'Crisp & Cool'
        : 'Optimal Thermal Comfort'
      : 'Thermal Comfort Unobserved';

    const hydrationNeed = hasFeelsLike
      ? weather.feelsLike > 33 || (weather.humidity !== undefined && weather.humidity > 80)
        ? 'High (500-750ml/hr + Electrolytes)'
        : weather.feelsLike > 27
        ? 'Moderate (350-500ml/hr)'
        : 'Standard Hydration (250ml)'
      : 'Standard Hydration';

    const validHourlyRain = hourly.slice(0, 6).map((h) => h.precipitationProb).filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
    const rainProbNext6h = validHourlyRain.length > 0 ? Math.max(...validHourlyRain) : undefined;
    const heatRisk = hasTemp ? (weather.temperature >= 35 ? 'High Heat Risk' : weather.temperature >= 30 ? 'Moderate' : 'Low') : 'Heat Risk Unobserved';

    let recommendation = '';
    if (scoreLabel === 'Unavailable') {
      recommendation = `Running suitability is currently unavailable because required meteorological parameters are unobserved for ${locationName}. Exercise caution before outdoor workouts.`;
    } else {
      recommendation = `Running Score ${score} — ${scoreLabel}. Optimal workout window: ${bestWindow}. `;
      if (hasTemp && weather.temperature > 30) {
        recommendation += 'Elevated thermal load outdoors; carry electrolytes and prioritize early morning runs.';
      } else if (rainProbNext6h !== undefined && rainProbNext6h > 40) {
        recommendation += 'Scattered rain likelihood ahead; wear shoes with reliable rubber grip and consider a water-resistant layer.';
      } else if (scoreLabel === 'Caution') {
        recommendation += 'Suboptimal weather for outdoor cardio. Consider indoor workouts or lighter intensity.';
      } else {
        recommendation += 'Great conditions for road and trail running. Minimal wind resistance and comfortable humidity.';
      }
    }

    return {
      personaId: 'runner',
      label: 'Runner / Fitness',
      iconName: 'Activity',
      score,
      scoreLabel,
      confidenceLevel,
      missingMetrics,
      isModelDerived: true,
      primaryQuestion: 'What is the best and safest time for me to exercise outdoors?',
      primaryAnswer: scoreLabel === 'Unavailable'
        ? 'Running workout suitability cannot be determined from available telemetry.'
        : `Best workout window is ${bestWindow}. Conditions are rated ${scoreLabel} with ${thermalComfort.toLowerCase()}.`,
      bestWindow,
      bestWindowSub: `Thermal comfort: ${thermalComfort}`,
      avoidWindow: avoidWindow ? avoidWindow : undefined,
      avoidWindowReason: avoidWindowReason || (scoreLabel === 'Unavailable' ? undefined : 'Peak heat or surface moisture'),
      keyConditions: [
        { label: 'Feels Like', value: hasFeelsLike ? `${weather.feelsLike}°C` : 'Unavailable', status: hasFeelsLike && weather.feelsLike > 32 ? 'caution' : hasFeelsLike ? 'good' : 'neutral' },
        { label: 'Rain Prob', value: rainProbNext6h !== undefined ? `${rainProbNext6h}%` : 'Unavailable', status: rainProbNext6h !== undefined && rainProbNext6h > 40 ? 'caution' : rainProbNext6h !== undefined ? 'good' : 'neutral' },
        {
          label: 'AQI',
          value: hasAqi ? `${airQuality.aqi} (${airQuality?.category || 'Unavailable'})` : 'Unavailable',
          status: !hasAqi ? 'neutral' : (airQuality.aqi! > 150 ? 'caution' : 'good'),
        },
        { label: 'Track Dryness', value: trackDryness, status: trackDryness === 'Wet & Slippery' ? 'caution' : trackDryness === 'Track Surface Unobserved' ? 'neutral' : 'good' },
        { label: 'Peak UV', value: hasUv ? `Index ${weather.uvIndex}` : 'Unavailable', status: hasUv && weather.uvIndex >= 7 ? 'caution' : hasUv ? 'good' : 'neutral' },
      ],
      recommendation,
      advisoryHeadline: scoreLabel === 'Unavailable' ? `Outdoor workout conditions unobserved across ${locationName}` : `${scoreLabel} outdoor cardio conditions across ${locationName}`,
      prioritizedMetrics: [
        { label: 'Workout Score', value: scoreLabel === 'Unavailable' ? 'Unavailable' : `${score} / 100`, subValue: scoreLabel, status: score >= 75 && scoreLabel !== 'Unavailable' ? 'good' : 'moderate' },
        { label: 'Best Workout Window', value: bestWindow, subValue: scoreLabel === 'Unavailable' ? 'Telemetry unavailable' : 'Lowest heat & pollution', status: scoreLabel === 'Unavailable' ? 'neutral' : 'good' },
        { label: 'Thermal Comfort', value: thermalComfort, subValue: hasTemp ? `Actual ${weather.temperature}°C` : 'Temp unavailable', status: 'neutral' },
        { label: 'Hydration Need', value: hydrationNeed, status: hasFeelsLike && weather.feelsLike > 30 ? 'caution' : 'good' },
        { label: 'Track Dryness', value: trackDryness, subValue: hasRain24 ? `Rain past 24h: ${weather.precipitation24h} mm` : 'Rain past 24h unobserved', status: 'neutral' },
        {
          label: 'Rain Probability',
          value: rainProbNext6h !== undefined ? `${rainProbNext6h}%` : 'Unavailable',
          subValue: 'Next 6 hours',
          status: rainProbNext6h === undefined ? 'neutral' : (rainProbNext6h > 35 ? 'caution' : 'good'),
        },
        {
          label: 'Air Quality (AQI)',
          value: hasAqi ? `${airQuality.aqi}` : 'Unavailable',
          subValue: airQuality?.pm25 !== undefined ? `PM2.5: ${airQuality.pm25} µg/m³` : 'Monitoring station data unavailable',
          status: hasAqi && airQuality.aqi! > 100 ? 'caution' : 'neutral',
        },
        { label: 'UV Index', value: hasUv ? `${weather.uvIndex}` : 'Unavailable', subValue: hasUv ? (weather.uvIndex >= 6 ? 'Sunscreen recommended' : 'Low radiation') : 'UV unobserved', status: hasUv && weather.uvIndex >= 6 ? 'caution' : 'good' },
        { label: 'Wind & Gusts', value: hasWind ? `${weather.windSpeed} km/h` : 'Unavailable', subValue: typeof weather.windGust === 'number' ? `Gusts up to ${weather.windGust} km/h` : 'Gust data unavailable', status: 'neutral' },
        { label: 'Recommended Activity', value: hasFeelsLike && weather.feelsLike > 34 ? 'Indoor Gym / Treadmill' : scoreLabel === 'Unavailable' ? 'Verify local conditions' : 'Outdoor 5k/10k Running', status: scoreLabel === 'Unavailable' ? 'neutral' : 'good' },
      ],
      hourlySuitability: hourlyScores,
      whatToCarryOrAction: [
        'Hydration flask or electrolyte drink (minimum 500ml)',
        hasUv && weather.uvIndex >= 5 ? 'UV-blocking running sunglasses & visor cap' : 'Lightweight breathable sports top',
        rainProbNext6h !== undefined && rainProbNext6h > 30 ? 'Waterproof running pouch for smartphone' : 'Reflective wristband for low-light dawn runs',
      ],
    };
  }

  // 2. DAILY COMMUTER
  if (persona === 'commuter' || persona === 'general' || persona === 'student') {
    const validRainNext4h = hourly.slice(0, 4).map((h) => h.precipitationProb).filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
    const maxRainNext4h = validRainNext4h.length > 0 ? Math.max(...validRainNext4h) : undefined;
    const rainIntensity =
      weather.conditionKey === 'heavy-rain'
        ? 'Heavy Downpour'
        : weather.conditionKey === 'rain'
        ? 'Moderate Rain'
        : maxRainNext4h !== undefined && maxRainNext4h > 40
        ? 'Scattered Showers'
        : maxRainNext4h !== undefined
        ? 'Dry & Clear'
        : 'Unknown Precipitation';

    const roadCondition =
      (hasRain24 && weather.precipitation24h > 15) || weather.conditionKey === 'heavy-rain'
        ? 'Waterlogging Risk on Low Roads'
        : (hasRain24 && weather.precipitation24h > 2) || weather.conditionKey === 'rain'
        ? 'Slick Bitumen Pavement'
        : hasRain24
        ? 'Dry Highway Asphalt'
        : 'Road Surface Condition Unobserved';

    const hasVisibility = typeof weather.visibility === 'number' && Number.isFinite(weather.visibility) && weather.visibility > 0;
    const fogStatus = !hasVisibility
      ? 'Visibility Unavailable'
      : weather.visibility < 2
      ? 'Dense Fog'
      : weather.visibility < 5
      ? 'Moderate Mist'
      : 'Clear Visibility';
    const departureWindow = bestWindow;

    let recommendation = '';
    if (scoreLabel === 'Unavailable') {
      recommendation = `Commute conditions are currently unobserved for ${locationName}. Check local transit authorities for road and rail status.`;
    } else {
      recommendation = `Commute Safety Score ${score} — ${scoreLabel}. Best departure window: ${departureWindow}. `;
      if (maxRainNext4h !== undefined && maxRainNext4h > 50) {
        recommendation += `Rain likelihood (${maxRainNext4h}%) may trigger waterlogging and slow moving arterial traffic. Keep rain poncho and allow 20 mins buffer.`;
      } else if (hasVisibility && weather.visibility < 3) {
        recommendation += `Morning mist/fog reducing highway visibility (${weather.visibility} km). Use low-beam headlamps and keep double stopping distance.`;
      } else if (hasVisibility) {
        recommendation += 'Traffic weather is favorable with dry roads and clear visibility throughout commute corridors.';
      } else {
        recommendation += 'Commute conditions are steady. Highway visibility telemetry is unobserved; drive with standard precaution.';
      }
    }

    return {
      personaId: 'commuter',
      label: 'Daily Commuter',
      iconName: 'Car',
      score,
      scoreLabel,
      confidenceLevel,
      missingMetrics,
      isModelDerived: true,
      primaryQuestion: 'When should I travel and what weather risks should I expect?',
      primaryAnswer: scoreLabel === 'Unavailable'
        ? 'Commute weather suitability cannot be determined from available telemetry.'
        : `Best departure: ${departureWindow}. Road conditions: ${roadCondition.toLowerCase()}.`,
      bestWindow: departureWindow,
      bestWindowSub: scoreLabel === 'Unavailable' ? 'Transit observations unavailable' : 'Lowest probability of transit delays',
      avoidWindow: avoidWindow ? `${avoidWindow}` : undefined,
      avoidWindowReason: avoidWindowReason || (scoreLabel === 'Unavailable' ? undefined : 'Peak commuter rush and weather risks'),
      keyConditions: [
        { label: 'Road Status', value: roadCondition.split(' ')[0], status: roadCondition.includes('Waterlogging') ? 'caution' : roadCondition.includes('Unobserved') ? 'neutral' : 'good' },
        { label: 'Rain Likelihood', value: maxRainNext4h !== undefined ? `${maxRainNext4h}%` : 'Unavailable', status: maxRainNext4h !== undefined && maxRainNext4h > 40 ? 'caution' : maxRainNext4h !== undefined ? 'good' : 'neutral' },
        { label: 'Visibility', value: hasVisibility ? `${weather.visibility} km` : 'Unavailable', status: !hasVisibility ? 'neutral' : (weather.visibility < 4 ? 'caution' : 'good') },
        { label: 'Wind Gusts', value: typeof weather.windGust === 'number' ? `${weather.windGust} km/h` : 'Unavailable', status: typeof weather.windGust === 'number' && weather.windGust > 30 ? 'caution' : 'good' },
        { label: 'Transit Risk', value: maxRainNext4h !== undefined && maxRainNext4h > 45 ? 'Medium' : scoreLabel === 'Unavailable' ? 'Unknown' : 'Low', status: maxRainNext4h !== undefined && maxRainNext4h > 45 ? 'caution' : scoreLabel === 'Unavailable' ? 'neutral' : 'good' },
      ],
      recommendation,
      advisoryHeadline: `Transit & Commute Outlook for ${locationName}`,
      prioritizedMetrics: [
        { label: 'Commute Safety Score', value: scoreLabel === 'Unavailable' ? 'Unavailable' : `${score} / 100`, subValue: scoreLabel, status: score >= 75 && scoreLabel !== 'Unavailable' ? 'good' : 'moderate' },
        { label: 'Recommended Departure', value: departureWindow, subValue: scoreLabel === 'Unavailable' ? 'Telemetry unobserved' : 'Clear traffic window', status: scoreLabel === 'Unavailable' ? 'neutral' : 'good' },
        { label: 'Road Weather Risk', value: roadCondition, subValue: hasRain24 ? `Past rain: ${weather.precipitation24h} mm` : 'Past rain unobserved', status: roadCondition.includes('Dry') ? 'good' : roadCondition.includes('Unobserved') ? 'neutral' : 'caution' },
        { label: 'Rain Intensity', value: rainIntensity, subValue: maxRainNext4h !== undefined ? `Chance: ${maxRainNext4h}% next 4h` : 'Precipitation unavailable', status: maxRainNext4h !== undefined && maxRainNext4h > 30 ? 'caution' : 'good' },
        { label: 'Road Visibility', value: hasVisibility ? `${weather.visibility} km (${fogStatus})` : 'Unavailable', status: !hasVisibility ? 'neutral' : (weather.visibility > 5 ? 'good' : 'caution') },
        { label: 'Thunderstorm / Lightning', value: weather.conditionKey === 'thunderstorm' ? 'Active Risk' : 'Low Risk', status: weather.conditionKey === 'thunderstorm' ? 'caution' : 'good' },
        { label: 'Wind & Gusts', value: hasWind ? `${weather.windSpeed} km/h` : 'Unavailable', subValue: typeof weather.windGust === 'number' ? `Peak gusts ${weather.windGust} km/h` : 'Gust data unavailable', status: 'neutral' },
        { label: 'Flood / Waterlogging Risk', value: hasRain24 && weather.precipitation24h > 20 ? 'High on subways' : hasRain24 ? 'Minimal' : 'Unobserved', status: hasRain24 && weather.precipitation24h > 20 ? 'caution' : hasRain24 ? 'good' : 'neutral' },
      ],
      hourlySuitability: hourlyScores,
      whatToCarryOrAction: [
        maxRainNext4h !== undefined && maxRainNext4h > 25 ? 'Foldable umbrella or waterproof commuter poncho' : 'Light windcheater jacket',
        'Check metro / suburban railway status before stepping out',
        'Two-wheeler riders: inspect tire treads and keep visor clean',
      ],
      actionButton: {
        label: 'Open Live Radar & Rain Tracker',
        actionType: 'radar',
      },
    };
  }

  // 3. TRAVELLER
  if (persona === 'traveller') {
    const hasVisibility = typeof weather.visibility === 'number' && Number.isFinite(weather.visibility) && weather.visibility > 0;
    const highwayVis = hasVisibility ? (weather.visibility >= 8 ? 'Excellent (> 8 km)' : `${weather.visibility} km (Caution in Ghats)`) : 'Unavailable';
    const ghatFog = hasVisibility ? (weather.visibility < 3 ? 'Present' : 'Clear') : 'Unavailable';
    const stormRisk = weather.conditionKey === 'thunderstorm' ? 'High' : 'Low to Isolated';
    const pavementTemp = hasTemp ? `${weather.temperature + 4}°C` : 'Unavailable';

    let recommendation = '';
    if (scoreLabel === 'Unavailable') {
      recommendation = `Travel weather conditions are currently unobserved for ${locationName}. Check official highway and railway updates before departing.`;
    } else {
      recommendation = `Travel Score ${score} — ${scoreLabel}. Best journey departure: ${bestWindow}. `;
      if (weather.conditionKey === 'thunderstorm' || (hasRain24 && weather.precipitation24h > 20)) {
        recommendation += 'Intermittent intense cloudbursts along route corridors. Carry emergency road kit and avoid overnight ghat driving.';
      } else if (hasVisibility && weather.visibility < 3) {
        recommendation += 'Low visibility or ghat mist along corridors. Maintain safe headway and use fog lamps.';
      } else if (hasVisibility) {
        recommendation += 'Highway weather is steady and favorable for intercity road travel and railway schedules.';
      } else {
        recommendation += 'Highway travel conditions are steady; highway visibility telemetry is unobserved.';
      }
    }

    return {
      personaId: 'traveller',
      label: 'Traveller',
      iconName: 'Compass',
      score,
      scoreLabel,
      confidenceLevel,
      missingMetrics,
      isModelDerived: true,
      primaryQuestion: 'How suitable is the weather for my journey?',
      primaryAnswer: scoreLabel === 'Unavailable'
        ? 'Travel weather suitability cannot be determined from available telemetry.'
        : `Travel conditions are rated ${scoreLabel} (${score}/100). Best window: ${bestWindow}.`,
      bestWindow,
      bestWindowSub: scoreLabel === 'Unavailable' ? 'Route observations unavailable' : 'Optimal highway visibility and mild pavement temperature',
      avoidWindow: avoidWindow ? avoidWindow : undefined,
      avoidWindowReason: avoidWindowReason || (scoreLabel === 'Unavailable' ? undefined : 'Low visibility or sudden convective showers'),
      keyConditions: [
        { label: 'Highway Vis', value: hasVisibility ? highwayVis.split(' ')[0] : 'Unavailable', status: !hasVisibility ? 'neutral' : (weather.visibility > 6 ? 'good' : 'caution') },
        { label: 'Storm Risk', value: stormRisk, status: stormRisk === 'High' ? 'caution' : 'good' },
        { label: 'Pavement Temp', value: pavementTemp, status: 'neutral' },
        { label: 'Ghat Fog', value: ghatFog, status: !hasVisibility ? 'neutral' : (weather.visibility < 3 ? 'caution' : 'good') },
        { label: 'Trip Rating', value: scoreLabel, status: score >= 75 && scoreLabel !== 'Unavailable' ? 'good' : 'moderate' },
      ],
      recommendation,
      advisoryHeadline: `Intercity & Highway Travel Intelligence for ${locationName}`,
      prioritizedMetrics: [
        { label: 'Travel Suitability Score', value: scoreLabel === 'Unavailable' ? 'Unavailable' : `${score} / 100`, subValue: scoreLabel, status: score >= 75 && scoreLabel !== 'Unavailable' ? 'good' : 'moderate' },
        { label: 'Best Travel Window', value: bestWindow, subValue: scoreLabel === 'Unavailable' ? 'Telemetry unavailable' : 'Smooth cruise conditions', status: scoreLabel === 'Unavailable' ? 'neutral' : 'good' },
        { label: 'Highway Visibility', value: highwayVis, status: !hasVisibility ? 'neutral' : (weather.visibility > 6 ? 'good' : 'caution') },
        { label: 'Rain / Storm Risk', value: stormRisk, subValue: `Current: ${weather.conditionText || 'Unobserved'}`, status: stormRisk === 'High' ? 'caution' : 'good' },
        { label: 'Temperature & Feels', value: hasTemp ? `${weather.temperature}°C / Feels ${hasFeelsLike ? weather.feelsLike : weather.temperature}°C` : 'Unavailable', status: 'neutral' },
        { label: 'UV Radiation', value: hasUv ? `UV ${weather.uvIndex}` : 'Unavailable', subValue: 'Car window UV exposure', status: 'neutral' },
        {
          label: 'Air Quality on Route',
          value: hasAqi ? `AQI ${airQuality.aqi} (${airQuality?.category || 'Unavailable'})` : 'Unavailable',
          status: hasAqi ? (airQuality.aqi! > 150 ? 'caution' : 'good') : 'neutral',
        },
      ],
      hourlySuitability: hourlyScores,
      whatToCarryOrAction: [
        'All-weather rain jacket & spare warm pullover for air-conditioned transit',
        'Polarized driving sunglasses & high-lumen vehicle fog lamps',
        'Portable power bank & offline digital route maps',
        'First aid travel kit with hydration salts',
      ],
      actionButton: {
        label: 'Explore Journey Route Waypoints',
        actionType: 'travel',
      },
    };
  }

  // 4. FARMER / GARDENER
  if (persona === 'farmer') {
    const validDailyRain = daily.slice(0, 3).map((d) => d.precipitationProb).filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
    const rainNext3Days = validDailyRain.length > 0 ? Math.max(...validDailyRain) : undefined;
    const isRainExpected = (rainNext3Days !== undefined && rainNext3Days > 45) || weather.conditionKey === 'rain';

    const spraySafety =
      rainNext3Days === undefined
        ? 'Caution: Rain forecast unavailable'
        : weather.windSpeed < 14 && rainNext3Days < 30
        ? 'Safe to Spray (Calm Winds & No Rain)'
        : weather.windSpeed > 18
        ? 'Avoid: High Wind Drift (> 15 km/h)'
        : 'Caution: Rain Likely Within 24-48h';

    const irrigationAdvisory = isRainExpected
      ? 'Withhold Irrigation — Rain showers expected in 12-24h'
      : weather.temperature > 34
      ? 'Evening Irrigation Recommended to counter evapotranspiration'
      : 'Maintain standard watering cycle';

    const soilMoisture =
      weather.precipitation24h > 20
        ? 'Qualitative: High Surface Dampness'
        : weather.humidity > 70
        ? 'Qualitative: Adequate Ambient Moisture'
        : 'Qualitative: Moderate Moisture (In-situ probe unavailable)';

    const evapotranspiration = weather.temperature > 32 ? 'High (4.8 - 5.5 mm/day)' : 'Moderate (3.2 - 4.0 mm/day)';
    const pestDiseaseRisk =
      weather.humidity > 80 && weather.temperature > 26
        ? 'Elevated Fungal / Blast Risk (High Humidity)'
        : 'Low to Normal Infestation Risk';

    let recommendation = `Agro-Met Score ${score} — ${scoreLabel}. `;
    if (isRainExpected) {
      const probText = rainNext3Days !== undefined ? ` (${rainNext3Days}% prob)` : '';
      recommendation += `Rainfall expected across district within 24 hours${probText}. Withhold chemical spray and scheduled canal/borewell irrigation to prevent nutrient leaching.`;
    } else if (weather.windSpeed > 18) {
      recommendation += `Surface wind speed is ${weather.windSpeed} km/h. Postpone foliar pesticide sprays to avoid droplet drift and loss.`;
    } else {
      recommendation += `Weather is stable and favorable for intercultural operations, field leveling, and scheduled farm activities.`;
    }

    const firstIso = hourly[0]?.isoTime;
    const firstHour = firstIso && firstIso.includes('T')
      ? parseInt(firstIso.split('T')[1].slice(0, 2), 10)
      : new Date().getHours();

    let farmerBestWindow: string;
    let farmerAvoidWindow: string;
    let farmerAvoidReason: string;

    if (isRainExpected) {
      farmerBestWindow = 'Withhold chemical spray operations';
      farmerAvoidWindow = firstHour >= 18 ? 'Tonight / Tomorrow (Rain Risk)' : 'Upcoming Hours (Rain Arrival)';
      farmerAvoidReason = 'Rain arrival washes out chemical inputs and fertilizer';
    } else if (firstHour >= 18) {
      farmerBestWindow = 'Tomorrow 06:00 AM – 09:30 AM';
      farmerAvoidWindow = 'Tomorrow 12:00 PM – 03:00 PM';
      farmerAvoidReason = 'Peak evapotranspiration and leaf scorch';
    } else if (firstHour < 10) {
      farmerBestWindow = 'Today 06:30 AM – 09:30 AM';
      farmerAvoidWindow = 'Today 12:00 PM – 03:00 PM';
      farmerAvoidReason = 'Peak evapotranspiration and leaf scorch';
    } else {
      farmerBestWindow = 'Tomorrow 06:00 AM – 09:30 AM';
      farmerAvoidWindow = 'Current Midday (Until 03:30 PM)';
      farmerAvoidReason = 'High thermal drift and rapid evaporation';
    }

    return {
      personaId: 'farmer',
      label: 'Farmer / Gardener',
      iconName: 'Sprout',
      score,
      scoreLabel,
      confidenceLevel,
      missingMetrics,
      isModelDerived: true,
      primaryQuestion: 'What action should I take on my farm based on the upcoming weather?',
      primaryAnswer: scoreLabel === 'Unavailable'
        ? 'Agro-meteorological suitability cannot be determined from available telemetry.'
        : isRainExpected
        ? 'Withhold irrigation and postpone chemical sprays — rain expected in 12-24h.'
        : 'Favorable window for field intercultural operations and crop protection sprays.',
      bestWindow: farmerBestWindow,
      bestWindowSub: 'Calm morning winds (< 10 km/h) ideal for spray operations',
      avoidWindow: farmerAvoidWindow,
      avoidWindowReason: farmerAvoidReason,
      keyConditions: [
        { label: 'Rain Forecast', value: rainNext3Days !== undefined ? `${rainNext3Days}% 3-Day` : 'Unavailable', status: rainNext3Days !== undefined && rainNext3Days > 40 ? 'caution' : rainNext3Days !== undefined ? 'good' : 'neutral' },
        { label: 'Spray Safety', value: spraySafety.split(' ')[0], status: spraySafety.startsWith('Safe') ? 'good' : 'caution' },
        { label: 'Soil Moisture', value: soilMoisture.split(' ')[1] || soilMoisture, status: 'neutral' },
        { label: 'Water Loss (ET)', value: evapotranspiration.split(' ')[0], status: 'neutral' },
        { label: 'Pest Alert', value: pestDiseaseRisk.startsWith('Elevated') ? 'Watch' : 'Low', status: pestDiseaseRisk.startsWith('Elevated') ? 'caution' : 'good' },
      ],
      recommendation,
      advisoryHeadline: `Model-Derived Agro-Met Advisory for ${locationName} Agricultural Sector`,
      prioritizedMetrics: [
        { label: 'Farm Activity Score', value: scoreLabel === 'Unavailable' ? 'Unavailable' : `${score} / 100`, subValue: scoreLabel, status: score >= 70 && scoreLabel !== 'Unavailable' ? 'good' : 'caution' },
        { label: 'Rainfall Forecast & Timing', value: isRainExpected ? `Expected within 24h (${rainNext3Days !== undefined ? `${rainNext3Days}%` : 'High'})` : 'Dry spell next 3 days', status: isRainExpected ? 'caution' : 'good' },
        { label: 'Irrigation Recommendation', value: irrigationAdvisory, status: isRainExpected ? 'caution' : 'good' },
        { label: 'Chemical Spray Window', value: spraySafety, subValue: hasWind ? `Current wind: ${weather.windSpeed} km/h` : 'Wind unobserved', status: spraySafety.startsWith('Safe') ? 'good' : 'caution' },
        { label: 'Soil Moisture Estimate', value: soilMoisture, subValue: hasRain24 ? `Past 24h rain: ${weather.precipitation24h} mm` : 'Past rain unobserved', status: 'neutral' },
        { label: 'Evapotranspiration (ET)', value: evapotranspiration, subValue: 'Crop water demand', status: 'neutral' },
        { label: 'Pest & Disease Watch', value: pestDiseaseRisk, subValue: typeof weather.humidity === 'number' ? `Relative humidity: ${weather.humidity}%` : 'Humidity unobserved', status: pestDiseaseRisk.startsWith('Elevated') ? 'caution' : 'good' },
        { label: 'Sowing / Harvesting Window', value: isRainExpected ? 'Cover harvested produce in mandi' : 'Favorable field prep window', status: 'good' },
      ],
      hourlySuitability: hourlyScores,
      whatToCarryOrAction: [
        isRainExpected ? 'Cover threshing floor and seed bags with waterproof tarpaulins' : 'Ensure drip irrigation lines and filters are cleared',
        'Clean drainage channels in low-lying paddy/cotton fields',
        'Kisan Call Centre 24x7 toll-free helpline: 1800-180-1551',
      ],
      actionButton: {
        label: 'Open Full Krishi Agro-Met Advisory',
        actionType: 'agromet',
      },
    };
  }

  // 5. HEALTH & AIR-CONSCIOUS
  if (persona === 'health' || persona === 'safety') {
    const hasAqi = typeof airQuality?.aqi === 'number' && Number.isFinite(airQuality.aqi);
    const aqiRisk = !hasAqi
      ? 'Monitoring Station Telemetry Unavailable'
      : airQuality.aqi! > 300
      ? 'Severe Health Alert (Avoid Outdoors)'
      : airQuality.aqi! > 200
      ? 'Very Poor (Breathing Discomfort)'
      : airQuality.aqi! > 100
      ? 'Moderate (Sensitive Individuals Alert)'
      : 'Low Risk (Clean Ambient Air)';

    const uvRisk = hasUv
      ? weather.uvIndex >= 8
        ? 'Very High (Sunburn < 15 mins)'
        : weather.uvIndex >= 6
        ? 'High (Sun Protection Required)'
        : 'Low to Moderate'
      : 'UV Index Unobserved';

    const heatStress = hasFeelsLike
      ? weather.feelsLike >= 38
        ? 'Severe Heat Stress (Heatwave Watch)'
        : weather.feelsLike >= 32
        ? 'Moderate Heat Index (Drink frequent water)'
        : 'Comfortable Heat Balance'
      : 'Heat Stress Unobserved';

    const firstIso = hourly[0]?.isoTime;
    const firstHour = firstIso && firstIso.includes('T')
      ? parseInt(firstIso.split('T')[1].slice(0, 2), 10)
      : new Date().getHours();

    let safeWindow: string;
    let highExposureWindow: string;

    if (firstHour >= 18) {
      safeWindow = 'Tomorrow 06:00 AM – 08:30 AM';
      highExposureWindow = 'Tomorrow 11:30 AM – 03:30 PM';
    } else if (firstHour < 9) {
      safeWindow = 'Today 06:00 AM – 08:30 AM';
      highExposureWindow = 'Today 11:30 AM – 03:30 PM';
    } else if (firstHour >= 9 && firstHour < 16) {
      safeWindow = 'Today 05:00 PM – 07:00 PM';
      highExposureWindow = 'Current Midday (Until 03:30 PM)';
    } else {
      safeWindow = 'Today 05:00 PM – 07:30 PM';
      highExposureWindow = 'Tomorrow 11:30 AM – 03:30 PM';
    }

    let recommendation = '';
    if (scoreLabel === 'Unavailable') {
      recommendation = `Air quality and environmental health indicators are currently unobserved for ${locationName}. Check local CPCB monitoring boards for verified index values.`;
    } else {
      recommendation = `Health & Air Safety Score ${score} — ${scoreLabel}. Safe outdoor window: ${safeWindow}. `;
      if (hasAqi && airQuality.aqi! > 180) {
        recommendation += `Air quality is ${airQuality.category} (AQI ${airQuality.aqi}, PM2.5 ${airQuality.pm25 ?? 'N/A'} µg/m³). Sensitive individuals should wear an N95 mask outdoors and run indoor HEPA purifiers.`;
      } else if (hasUv && weather.uvIndex >= 7) {
        recommendation += `Peak UV Index reaches ${weather.uvIndex} around midday. Avoid direct sun exposure between ${highExposureWindow} to protect skin and eyes.`;
      } else if (hasAqi) {
        recommendation += `Air quality is ${airQuality.category} and thermal levels are benign. Favorable conditions for outdoor walks and fresh air ventilation.`;
      } else {
        recommendation += `Air quality monitoring is currently unavailable. Thermal levels are benign with safe outdoor activity windows.`;
      }
    }

    return {
      personaId: 'health',
      label: 'Health & Air-Conscious',
      iconName: 'HeartPulse',
      score,
      scoreLabel,
      confidenceLevel,
      missingMetrics,
      isModelDerived: true,
      primaryQuestion: 'How safe is it for me to spend time outdoors today?',
      primaryAnswer: scoreLabel === 'Unavailable'
        ? 'Health & environmental air safety cannot be determined from available telemetry.'
        : hasAqi
        ? `Air quality is ${airQuality.category} (AQI ${airQuality.aqi}). Safe outdoor window: ${safeWindow}.`
        : `Air quality data is currently unavailable. Safe outdoor window: ${safeWindow}.`,
      bestWindow: safeWindow,
      bestWindowSub: 'Lowest particulate concentration and mild temperature',
      avoidWindow: highExposureWindow,
      avoidWindowReason: 'Combined peak UV index and ground-level secondary ozone',
      keyConditions: [
        {
          label: 'CPCB AQI',
          value: hasAqi ? `${airQuality.aqi} (${airQuality?.category || 'Unavailable'})` : 'Unavailable',
          status: !hasAqi ? 'neutral' : (airQuality.aqi! > 150 ? 'caution' : 'good'),
        },
        {
          label: 'PM2.5 Level',
          value: airQuality?.pm25 !== undefined ? `${airQuality.pm25} µg/m³` : 'Unavailable',
          status: airQuality?.pm25 === undefined ? 'neutral' : (airQuality.pm25 > 60 ? 'caution' : 'good'),
        },
        { label: 'UV Radiation', value: hasUv ? `${weather.uvIndex} (${uvRisk.split(' ')[0]})` : 'Unavailable', status: hasUv && weather.uvIndex >= 6 ? 'caution' : hasUv ? 'good' : 'neutral' },
        { label: 'Heat Stress', value: heatStress.split(' ')[0], status: hasFeelsLike && weather.feelsLike > 34 ? 'caution' : 'good' },
        {
          label: 'Mask Advice',
          value: hasAqi ? (airQuality.aqi! > 150 ? 'N95 Advised' : 'Optional') : 'Unavailable',
          status: !hasAqi ? 'neutral' : (airQuality.aqi! > 150 ? 'caution' : 'good'),
        },
      ],
      recommendation,
      advisoryHeadline: `Respiratory & Environmental Health Index for ${locationName}`,
      prioritizedMetrics: [
        { label: 'Health Safety Score', value: scoreLabel === 'Unavailable' ? 'Unavailable' : `${score} / 100`, subValue: scoreLabel, status: score >= 75 && scoreLabel !== 'Unavailable' ? 'good' : 'moderate' },
        {
          label: 'Indian CPCB AQI',
          value: hasAqi ? `${airQuality.aqi}` : 'Unavailable',
          subValue: airQuality?.category || 'Unavailable',
          status: !hasAqi ? 'neutral' : (airQuality.aqi! <= 100 ? 'good' : 'caution'),
        },
        {
          label: 'Fine PM2.5 Particles',
          value: airQuality?.pm25 !== undefined ? `${airQuality.pm25} µg/m³` : 'Unavailable',
          subValue: 'CPCB 24h standard: 60',
          status: airQuality?.pm25 === undefined ? 'neutral' : (airQuality.pm25 <= 60 ? 'good' : 'caution'),
        },
        {
          label: 'Coarse PM10 Particles',
          value: airQuality?.pm10 !== undefined ? `${airQuality.pm10} µg/m³` : 'Unavailable',
          subValue: 'CPCB 24h standard: 100',
          status: airQuality?.pm10 === undefined ? 'neutral' : (airQuality.pm10 <= 100 ? 'good' : 'caution'),
        },
        { label: 'Air Quality Risk Status', value: aqiRisk, status: !hasAqi ? 'neutral' : (airQuality.aqi! <= 100 ? 'good' : 'caution') },
        { label: 'UV Radiation Level', value: hasUv ? `Index ${weather.uvIndex}` : 'Unavailable', subValue: uvRisk, status: hasUv && weather.uvIndex < 6 ? 'good' : hasUv ? 'caution' : 'neutral' },
        { label: 'Heat Index & Comfort', value: hasFeelsLike ? `${weather.feelsLike}°C (${heatStress})` : 'Unavailable', status: 'neutral' },
        { label: 'Ambient Humidity', value: typeof weather.humidity === 'number' ? `${weather.humidity}%` : 'Unavailable', subValue: typeof weather.dewPoint === 'number' ? `Dew point: ${weather.dewPoint}°C` : undefined, status: 'neutral' },
      ],
      hourlySuitability: hourlyScores,
      whatToCarryOrAction: [
        hasAqi && airQuality.aqi! > 120 ? 'Certified N95/N99 particulate respirator mask' : 'Broad-spectrum SPF 30+ mineral sunscreen',
        'Keep room windows closed during morning vehicular rush hours (8-10 AM)',
        'Maintain hydration with lemon water or coconut water',
      ],
    };
  }

  // 6. FAMILY
  if (persona === 'family') {
    const hasAqi = typeof airQuality?.aqi === 'number' && Number.isFinite(airQuality.aqi);
    const validEveningRain = hourly.slice(4, 10).map((h) => h.precipitationProb).filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
    const rainProbEvening = validEveningRain.length > 0 ? Math.max(...validEveningRain) : undefined;
    const firstIso = hourly[0]?.isoTime;
    const firstHour = firstIso && firstIso.includes('T')
      ? parseInt(firstIso.split('T')[1].slice(0, 2), 10)
      : new Date().getHours();

    let safePlayWindow: string;
    let familyAvoidWindow: string;
    let familyAvoidReason: string;

    const isUpcomingRain = (hourly[0]?.precipitationProb !== undefined && hourly[0].precipitationProb > 40) ||
      weather.conditionKey === 'thunderstorm';

    if (isUpcomingRain) {
      safePlayWindow = 'Indoor family activities recommended';
      familyAvoidWindow = firstHour >= 19 ? 'Tonight / Early Morning' : `Upcoming 1-3 Hours (${hourly[0]?.time || 'Now'})`;
      familyAvoidReason = 'Rain or thunderstorm risk — keep children indoors';
    } else if (firstHour >= 19) {
      safePlayWindow = 'Tomorrow 08:30 AM – 10:30 AM & 04:30 PM – 06:30 PM';
      familyAvoidWindow = 'Tomorrow 12:00 PM – 03:30 PM';
      familyAvoidReason = 'Peak ultraviolet rays and strong direct sunshine';
    } else if (firstHour >= 16) {
      safePlayWindow = 'Today 05:00 PM – 07:00 PM';
      familyAvoidWindow = 'Tomorrow 12:00 PM – 03:30 PM';
      familyAvoidReason = 'Peak ultraviolet rays and strong direct sunshine';
    } else if (firstHour < 10) {
      safePlayWindow = 'Today 08:30 AM – 10:30 AM & 04:30 PM – 06:30 PM';
      familyAvoidWindow = 'Today 12:00 PM – 03:30 PM';
      familyAvoidReason = 'Peak ultraviolet rays and strong direct sunshine';
    } else {
      safePlayWindow = 'Today 04:30 PM – 06:45 PM';
      familyAvoidWindow = 'Current Midday (Until 03:30 PM)';
      familyAvoidReason = 'Peak ultraviolet rays and high ambient heat';
    }

    const hasFirstHourRain = hourly[0]?.precipitationProb !== undefined && Number.isFinite(hourly[0]?.precipitationProb);
    const schoolCommute = hasFirstHourRain
      ? (hourly[0]!.precipitationProb! > 40
        ? 'Rain Showers Expected — Pack Kids Raincoat'
        : 'Dry & Calm Commute — Normal School Transit')
      : 'Commute Rain Telemetry Unavailable';

    let recommendation = '';
    if (scoreLabel === 'Unavailable') {
      recommendation = `Family outdoor activity suitability is currently unavailable due to unobserved meteorological parameters for ${locationName}. Exercise caution before planning outdoor events.`;
    } else {
      recommendation = `Family Safety Score ${score} — ${scoreLabel}. Ideal safe play window: ${safePlayWindow}. `;
      if (weather.conditionKey === 'thunderstorm') {
        recommendation += 'Thunderstorm activity detected. Keep children indoors, unplug sensitive electronics, and avoid open balconies.';
      } else if (hasTemp && weather.temperature > 33) {
        recommendation += 'Warm afternoon temperatures. Ensure children drink water before playing outside; shift park visits to sunset hours.';
      } else {
        recommendation += 'Pleasant, stable weather for family outings, playground activities, and outdoor evening walks.';
      }
    }

    return {
      personaId: 'family',
      label: 'Family',
      iconName: 'Users',
      score,
      scoreLabel,
      confidenceLevel,
      missingMetrics,
      isModelDerived: true,
      primaryQuestion: 'When is it safest for my family and children to go outside?',
      primaryAnswer: scoreLabel === 'Unavailable'
        ? 'Outdoor family safety cannot be determined from available telemetry.'
        : `Safest outdoor play window is ${safePlayWindow}. Weather is rated ${scoreLabel}.`,
      bestWindow: safePlayWindow,
      bestWindowSub: 'Comfortable temperatures, mild breeze, and low UV levels',
      avoidWindow: familyAvoidWindow,
      avoidWindowReason: familyAvoidReason,
      keyConditions: [
        { label: 'Outdoor Play', value: scoreLabel, status: score >= 75 && scoreLabel !== 'Unavailable' ? 'good' : 'moderate' },
        { label: 'Evening Rain', value: rainProbEvening !== undefined ? `${rainProbEvening}%` : 'Unavailable', status: rainProbEvening !== undefined && rainProbEvening > 35 ? 'caution' : (rainProbEvening !== undefined ? 'good' : 'neutral') },
        { label: 'School Bus Weather', value: schoolCommute.split(' ')[0], status: hasFirstHourRain ? 'good' : 'neutral' },
        { label: 'Kids UV Risk', value: hasUv ? (weather.uvIndex >= 6 ? 'High' : 'Moderate') : 'Unavailable', status: hasUv && weather.uvIndex >= 6 ? 'caution' : hasUv ? 'good' : 'neutral' },
        {
          label: 'Air Purity',
          value: hasAqi ? (airQuality.category || 'Unavailable') : 'Unavailable',
          status: !hasAqi ? 'neutral' : (airQuality.aqi! > 120 ? 'caution' : 'good'),
        },
      ],
      recommendation,
      advisoryHeadline: `Family & Children Outdoor Safety in ${locationName}`,
      prioritizedMetrics: [
        { label: 'Family Safety Score', value: scoreLabel === 'Unavailable' ? 'Unavailable' : `${score} / 100`, subValue: scoreLabel, status: score >= 75 && scoreLabel !== 'Unavailable' ? 'good' : 'moderate' },
        { label: 'Safe Play Window', value: safePlayWindow, subValue: 'Playground & park hours', status: 'good' },
        { label: 'School Commute Conditions', value: schoolCommute, status: hasFirstHourRain ? 'good' : 'neutral' },
        { label: 'Temperature & Feels', value: hasTemp ? `${weather.temperature}°C / Feels ${hasFeelsLike ? weather.feelsLike : weather.temperature}°C` : 'Unavailable', status: 'neutral' },
        { label: 'Heat & Sun Risk', value: hasTemp ? (weather.temperature > 34 ? 'Caution: Direct Sun' : 'Safe & Pleasant') : 'Unavailable', status: hasTemp && weather.temperature > 34 ? 'caution' : hasTemp ? 'good' : 'neutral' },
        { label: 'Rain & Lightning Probability', value: rainProbEvening !== undefined ? `${rainProbEvening}% evening chance` : 'Unavailable', subValue: weather.conditionText, status: rainProbEvening === undefined ? 'neutral' : (rainProbEvening > 35 ? 'caution' : 'good') },
        { label: 'UV Index for Children', value: hasUv ? `Level ${weather.uvIndex}` : 'Unavailable', subValue: 'Kids skin is twice as sensitive', status: hasUv && weather.uvIndex >= 6 ? 'caution' : hasUv ? 'good' : 'neutral' },
        {
          label: 'Neighborhood Air (AQI)',
          value: hasAqi ? `${airQuality.aqi} (${airQuality?.category || 'Unavailable'})` : 'Unavailable',
          status: !hasAqi ? 'neutral' : (airQuality.aqi! > 100 ? 'caution' : 'good'),
        },
      ],
      hourlySuitability: hourlyScores,
      whatToCarryOrAction: [
        'Water bottle for every family member (stay hydrated)',
        hasUv && weather.uvIndex >= 6 ? 'Sun protection hats and child-safe mineral sunscreen' : 'Light cotton clothing',
        rainProbEvening !== undefined && rainProbEvening > 30 ? 'Compact umbrella in the diaper/stroller bag' : 'Mosquito repellent patches for evening parks',
      ],
    };
  }

  // 7. BEACH / MARINE
  // Dedicated Beach / Marine intelligence
  const isInland = Boolean(marine && (!marine.isCoastal || marine.isApplicable === false));

  if (isInland) {
    return {
      personaId: 'marine',
      label: 'Beach / Marine',
      iconName: 'Ship',
      score: 0,
      scoreLabel: 'Not Applicable',
      confidenceLevel: 'Unavailable',
      missingMetrics: ['Coastal/Marine Waters (Inland location)'],
      isModelDerived: true,
      primaryQuestion: 'Are the beach and sea conditions safe and suitable?',
      primaryAnswer: 'Marine conditions are not applicable at this location.',
      bestWindow: 'N/A',
      bestWindowSub: 'Inland location — no coastal or marine waters',
      avoidWindow: undefined,
      avoidWindowReason: undefined,
      keyConditions: [
        { label: 'Wave Height', value: 'Not Applicable', status: 'neutral' },
        { label: 'Sea State', value: 'Not Applicable', status: 'neutral' },
        { label: 'Tide Status', value: 'Not Applicable', status: 'neutral' },
        { label: 'Rip Currents', value: 'Not Applicable', status: 'neutral' },
        { label: 'Sea Surface Temp', value: 'Not Applicable', status: 'neutral' },
      ],
      recommendation: 'Marine conditions are not applicable at this location.',
      advisoryHeadline: `Marine Conditions Not Applicable for ${locationName}`,
      prioritizedMetrics: [
        { label: 'Beach / Marine Status', value: 'Not Applicable', subValue: 'Inland location', status: 'neutral' },
        { label: 'Significant Wave Height', value: 'Not Applicable', subValue: 'No oceanographic observation', status: 'neutral' },
        { label: 'Wave Period', value: 'Not Applicable', subValue: 'Not applicable', status: 'neutral' },
        { label: 'Coastal Wind & Gusts', value: weather.windSpeed !== undefined ? `${weather.windSpeed} km/h` : 'Unavailable', subValue: 'Inland wind', status: 'neutral' },
        { label: 'Tide Timings (Est.)', value: 'Not Applicable', status: 'neutral' },
        { label: 'Swimming Suitability', value: 'Not Applicable', status: 'neutral' },
        { label: 'Rip Current Warning', value: 'Not Applicable', status: 'neutral' },
        { label: 'Sea Surface Temperature', value: 'Not Applicable', status: 'neutral' },
        { label: 'Fishermen Coastal Advisory', value: 'Not Applicable (Inland location)', status: 'neutral' },
      ],
      hourlySuitability: hourlyScores,
      whatToCarryOrAction: [
        'Marine activities and coastal forecasts are not applicable at this inland location.',
      ],
      actionButton: {
        label: 'Open Doppler Radar Coastal View',
        actionType: 'radar',
      },
    };
  }

  // Coastal / Marine location
  const hasWaveHeight = typeof marine?.waveHeight === 'number' && Number.isFinite(marine.waveHeight);
  const actualWaveHeight = hasWaveHeight ? marine!.waveHeight! : undefined;

  const hasWavePeriod = typeof marine?.wavePeriod === 'number' && Number.isFinite(marine.wavePeriod);
  const actualWavePeriod = hasWavePeriod ? marine!.wavePeriod! : undefined;

  const hasWaveDir = typeof marine?.waveDirection === 'number' && Number.isFinite(marine.waveDirection);
  const actualWaveDir = hasWaveDir ? marine!.waveDirection! : undefined;

  const hasSwellDir = typeof marine?.swellWaveDirection === 'number' && Number.isFinite(marine.swellWaveDirection);
  const hasSst = typeof marine?.seaSurfaceTemperature === 'number' && Number.isFinite(marine.seaSurfaceTemperature);
  const actualSst = hasSst ? marine!.seaSurfaceTemperature! : undefined;

  const hasValidMarineObs = hasWaveHeight || (marine?.seaStateCategory && marine.seaStateCategory !== 'Unavailable' && marine.seaStateCategory !== 'Not Applicable');

  // Wave height display: never synthesize
  const waveHeightDisplay = hasWaveHeight ? `${actualWaveHeight} m` : 'Unavailable';

  // Sea State determination
  const seaState: string =
    marine?.seaStateCategory && marine.seaStateCategory !== 'Unavailable' && marine.seaStateCategory !== 'Not Applicable'
      ? marine.seaStateCategory
      : hasWaveHeight
      ? actualWaveHeight! > 2.0
        ? 'Rough to Very Rough'
        : actualWaveHeight! > 1.2
        ? 'Moderate Swell'
        : 'Smooth to Slight'
      : 'Unavailable';

  // Rip Current Risk: Only evaluate if validated wave height exists
  const ripCurrentRisk = hasWaveHeight
    ? actualWaveHeight! > 1.8
      ? 'High (Stay in Patrolled Zones)'
      : 'Low to Moderate'
    : 'Unable to determine';

  // Swimming Suitability: Missing marine observations cannot produce "Safe" swimming
  const swimmingSuitability = hasWaveHeight
    ? actualWaveHeight! > 2.0 || weather.conditionKey === 'thunderstorm'
      ? 'Hazardous (Red Flag on Beaches)'
      : actualWaveHeight! > 1.3
      ? 'Caution Advised for Casual Swimmers'
      : 'Favorable in Designated Bathing Zones'
    : weather.conditionKey === 'thunderstorm' || (weather.windSpeed !== undefined && weather.windSpeed > 35)
    ? 'Hazardous (High winds / storms)'
    : 'Unable to determine';

  // Sea Surface Temperature: ONLY from actual marine provider SST. Never from air temperature.
  const sstDisplay = hasSst ? `${actualSst}°C` : 'Unavailable';

  // Wave Period & Direction
  const wavePeriodDisplay = hasWavePeriod ? `${actualWavePeriod} seconds` : 'Wave period unavailable';
  const waveDirectionDisplay = hasSwellDir
    ? `${marine!.swellWaveDirection}° swell`
    : hasWaveDir
    ? `${actualWaveDir}° wave direction`
    : 'Wave direction unavailable';

  // Marine Safety Recommendation
  let recommendation = '';
  if (hasValidMarineObs && hasWaveHeight) {
    recommendation = `Marine & Beach Safety Score ${score} — ${scoreLabel}. Sea state is ${seaState.toLowerCase()} with wave heights near ${actualWaveHeight} m. `;
    if (actualWaveHeight > 2.0 || (weather.windSpeed !== undefined && weather.windSpeed > 30)) {
      recommendation += 'Model-derived marine conditions indicate squally coastal winds and heavy surf. Verify official Coast Guard/INCOIS advisories before offshore activity.';
    } else if (weather.windSpeed !== undefined && weather.windSpeed <= 25 && weather.conditionKey !== 'thunderstorm') {
      recommendation += 'Model-derived marine conditions indicate favorable coastal weather. Great daylight for beach promenade walks, water sports, and harbor navigation. Check official local flags and beach advisories.';
    } else {
      recommendation += 'Model-derived marine conditions indicate caution advised for coastal activities due to localized winds or swell. Verify official maritime advisories.';
    }
  } else {
    // Insufficient evidence: Never create a reassuring recommendation from missing data
    recommendation = 'Marine safety cannot be determined from the available observations.';
    if (weather.conditionKey === 'thunderstorm' || (weather.windSpeed !== undefined && weather.windSpeed > 30)) {
      recommendation += ' Squally coastal winds or storm activity detected; exercise caution.';
    }
  }

  const primaryAnswer = hasValidMarineObs && hasWaveHeight
    ? `Sea state: ${seaState} with ~${actualWaveHeight}m waves. Swimming is ${swimmingSuitability.toLowerCase()}.`
    : 'Marine safety cannot be determined from the available observations.';

  const effectiveScore = hasValidMarineObs && hasWaveHeight ? score : 0;
  const effectiveScoreLabel = hasValidMarineObs && hasWaveHeight ? scoreLabel : 'Unavailable';
  const marineMissing = [...missingMetrics];
  if (!hasWaveHeight) marineMissing.push('Wave Height');
  if (!hasSst) marineMissing.push('Sea Surface Temperature');
  const effectiveConfidence: 'High' | 'Moderate' | 'Low' | 'Unavailable' =
    hasValidMarineObs && hasWaveHeight ? confidenceLevel : 'Unavailable';

  const firstIso = hourly[0]?.isoTime;
  const firstHour = firstIso && firstIso.includes('T')
    ? parseInt(firstIso.split('T')[1].slice(0, 2), 10)
    : new Date().getHours();

  let marineBestWindow = 'N/A';
  let marineAvoidWindow: string | undefined = undefined;
  let marineAvoidReason: string | undefined = undefined;

  if (hasValidMarineObs && hasWaveHeight) {
    if (firstHour >= 19) {
      marineBestWindow = 'Tomorrow 06:30 AM – 09:30 AM';
      marineAvoidWindow = 'Tomorrow 11:00 AM – 03:00 PM';
      marineAvoidReason = 'High UV glare off seawater and intense midday heat';
    } else if (firstHour >= 16) {
      marineBestWindow = 'Today 05:00 PM – 07:00 PM';
      marineAvoidWindow = 'Tomorrow 11:00 AM – 03:00 PM';
      marineAvoidReason = 'High UV glare off seawater and intense midday heat';
    } else if (firstHour < 10) {
      marineBestWindow = 'Today 06:30 AM – 09:30 AM';
      marineAvoidWindow = 'Today 11:00 AM – 03:00 PM';
      marineAvoidReason = 'High UV glare off seawater and sand reflection';
    } else {
      marineBestWindow = 'Today 04:30 PM – 06:30 PM';
      marineAvoidWindow = 'Current Midday (Until 03:30 PM)';
      marineAvoidReason = 'High UV glare off seawater and hot sand';
    }
  }

  return {
    personaId: 'marine',
    label: 'Beach / Marine',
    iconName: 'Ship',
    score: effectiveScore,
    scoreLabel: effectiveScoreLabel,
    confidenceLevel: effectiveConfidence,
    missingMetrics: marineMissing,
    isModelDerived: true,
    primaryQuestion: 'Are the beach and sea conditions safe and suitable?',
    primaryAnswer,
    bestWindow: marineBestWindow,
    bestWindowSub: hasValidMarineObs && hasWaveHeight ? 'Calm sea breezes and low UV reflection' : 'Marine observation data unavailable',
    avoidWindow: marineAvoidWindow,
    avoidWindowReason: marineAvoidReason,
    keyConditions: [
      {
        label: 'Wave Height',
        value: waveHeightDisplay,
        status: hasWaveHeight && actualWaveHeight! > 1.8 ? 'caution' : hasWaveHeight ? 'good' : 'neutral',
      },
      {
        label: 'Sea State',
        value: seaState,
        status: seaState.includes('Rough') ? 'caution' : seaState === 'Unavailable' ? 'neutral' : 'good',
      },
      {
        label: 'Tide Status',
        value: 'Tide information unavailable',
        status: 'neutral',
      },
      {
        label: 'Rip Currents',
        value: ripCurrentRisk,
        status: ripCurrentRisk.startsWith('High') ? 'caution' : 'neutral',
      },
      {
        label: 'Sea Surface Temp',
        value: sstDisplay,
        status: hasSst ? 'good' : 'neutral',
      },
    ],
    recommendation,
    advisoryHeadline: `Model-Derived Coastal & Marine Advisory for ${locationName}`,
    prioritizedMetrics: [
      {
        label: 'Beach / Marine Score',
        value: hasValidMarineObs && hasWaveHeight ? `${score} / 100` : 'Unavailable',
        subValue: effectiveScoreLabel,
        status: hasValidMarineObs && hasWaveHeight && score >= 75 ? 'good' : 'neutral',
      },
      {
        label: 'Significant Wave Height',
        value: hasWaveHeight ? `${actualWaveHeight} metres` : 'Unavailable',
        subValue: seaState,
        status: hasWaveHeight && actualWaveHeight! > 1.8 ? 'caution' : 'neutral',
      },
      {
        label: 'Wave Period',
        value: wavePeriodDisplay,
        subValue: waveDirectionDisplay,
        status: 'neutral',
      },
      {
        label: 'Coastal Wind & Gusts',
        value: weather.windSpeed !== undefined ? `${weather.windSpeed} km/h` : 'Unavailable',
        subValue: weather.windGust !== undefined ? `Gusts up to ${weather.windGust} km/h` : 'Gust data unavailable',
        status: weather.windSpeed !== undefined && weather.windSpeed > 25 ? 'caution' : 'good',
      },
      {
        label: 'Tide Timings (Est.)',
        value: 'Tide information unavailable',
        status: 'neutral',
      },
      {
        label: 'Swimming Suitability',
        value: swimmingSuitability,
        status: swimmingSuitability.includes('Hazardous') ? 'caution' : 'neutral',
      },
      {
        label: 'Rip Current Warning',
        value: ripCurrentRisk,
        status: ripCurrentRisk.startsWith('High') ? 'caution' : 'neutral',
      },
      {
        label: 'Sea Surface Temperature',
        value: hasSst ? `${actualSst}°C` : 'Unavailable',
        status: hasSst ? 'good' : 'neutral',
      },
      {
        label: 'Fishermen Coastal Advisory',
        value:
          weather.windSpeed !== undefined && weather.windSpeed > 30
            ? 'Model-derived: High wind/swell risk — verify official advisories before venturing offshore'
            : hasWaveHeight
            ? 'Model-derived: Normal coastal conditions indicated — verify official advisories'
            : 'Marine safety cannot be determined from the available observations',
        status: weather.windSpeed !== undefined && weather.windSpeed > 30 ? 'caution' : 'neutral',
      },
    ],
    hourlySuitability: hourlyScores,
    whatToCarryOrAction: hasValidMarineObs && hasWaveHeight
      ? [
          'Swim only between official safety flags in lifeguard-patrolled zones',
          'High-potency waterproof SPF 50+ sunscreen (water reflects 80% UV)',
          'Check Coast Guard Maritime Distress Toll-Free Helpline: 1554',
        ]
      : [
          'Marine observations are unavailable for this coastal location',
          'Verify coastal conditions with local lifeguards or port authorities before entering water',
          'Coast Guard Maritime Distress Toll-Free Helpline: 1554',
        ],
    actionButton: {
      label: 'Open Doppler Radar Coastal View',
      actionType: 'radar',
    },
  };
}
