import {
  NormalizedLocation,
  LocationInfo,
  WeatherAlert,
} from '../types';
import { CompleteWeatherIntelligence } from './providers/providerTypes';
import {
  NotificationPreference,
  Notification,
  CreateNotificationParams,
  NotificationSeverity,
  NotificationSourceType,
  SavedLocation,
} from '../types/database';

export interface AlertNotificationCandidate {
  title: string;
  message: string;
  severity: NotificationSeverity;
  hazard: string;
  location_name: string;
  latitude: number;
  longitude: number;
  source: string;
  source_type: NotificationSourceType;
  preferenceCategory: keyof Omit<NotificationPreference, 'user_id' | 'created_at' | 'updated_at' | 'saved_locations_only'>;
  dedupKey: string;
  metadata: Record<string, any>;
}

/**
 * Maps existing WeatherAlert severity to NotificationSeverity
 */
export function mapAlertSeverity(sev: WeatherAlert['severity']): NotificationSeverity {
  switch (sev) {
    case 'severe':
      return 'critical';
    case 'warning':
      return 'warning';
    case 'advisory':
      return 'watch';
    case 'info':
    default:
      return 'info';
  }
}

/**
 * Evaluates active weather intelligence against user preferences and location constraints
 * to generate candidate notifications.
 * Strictly uses existing MAUSAM weather intelligence calculations; never fabricates values.
 */
export function evaluateWeatherAlertsForNotifications(
  weatherIntel: CompleteWeatherIntelligence,
  currentLocation: LocationInfo | NormalizedLocation,
  preferences: NotificationPreference,
  savedLocations: SavedLocation[]
): AlertNotificationCandidate[] {
  const candidates: AlertNotificationCandidate[] = [];

  const lat = typeof (currentLocation as any).latitude === 'number'
    ? (currentLocation as any).latitude
    : currentLocation.lat;
  const lon = typeof (currentLocation as any).longitude === 'number'
    ? (currentLocation as any).longitude
    : currentLocation.lon;
  const locationName = currentLocation.name;

  // Step 8: Check saved_locations_only constraint
  if (preferences.saved_locations_only) {
    const isLocationSaved = savedLocations.some((saved) => {
      const matchCoord = Math.abs(saved.latitude - lat) < 0.05 && Math.abs(saved.longitude - lon) < 0.05;
      const matchName = saved.name.trim().toLowerCase() === locationName.trim().toLowerCase();
      return matchCoord || matchName;
    });

    if (!isLocationSaved) {
      // User has chosen to only receive alerts for saved locations
      return [];
    }
  }

  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const hourBucket = Math.floor(new Date().getHours() / 4); // 4-hour window deduplication

  // 1. Process Existing MAUSAM Weather Alerts
  if (weatherIntel.alerts && weatherIntel.alerts.length > 0) {
    for (const alert of weatherIntel.alerts) {
      // Exclude calm default bulletin ("alert-clear-normal" / fair weather)
      if (alert.id === 'alert-clear-normal' || (alert.severity === 'info' && alert.colorCode === 'Green')) {
        continue;
      }

      let category: keyof Omit<NotificationPreference, 'user_id' | 'created_at' | 'updated_at' | 'saved_locations_only'> | null = null;
      let hazard = 'Weather Advisory';
      let source = alert.issuedBy || 'Mausam Intelligence Engine';
      let sourceType: NotificationSourceType = 'derived';

      // Classify alert into preference categories & identify true source
      if (alert.id === 'alert-thunder-convective') {
        category = 'severe_weather';
        hazard = 'Thunderstorm & Lightning';
        source = 'Mausam Convective Engine';
        sourceType = 'derived';
      } else if (alert.id === 'alert-heavy-rain' || alert.id === 'alert-rain-showers') {
        category = 'rain';
        hazard = alert.id === 'alert-heavy-rain' ? 'Heavy Rain' : 'Rain Showers';
        source = 'Open-Meteo Numerical NWP Model';
        sourceType = 'provider';
      } else if (alert.id === 'alert-flood-glofas') {
        category = 'severe_weather';
        hazard = 'Flood Inundation Watch';
        source = 'Mausam Hydrology Engine';
        sourceType = 'derived';
      } else if (alert.id === 'alert-heat-wave') {
        category = 'temperature';
        hazard = 'Heatwave';
        source = 'Mausam Thermal Stress Model';
        sourceType = 'derived';
      } else if (alert.id === 'alert-fog-dense') {
        category = 'temperature';
        hazard = 'Dense Fog';
        source = 'Open-Meteo Surface Model';
        sourceType = 'provider';
      } else {
        // Fallback categorization based on text
        const lowerHeadline = (alert.headline + ' ' + alert.title).toLowerCase();
        if (lowerHeadline.includes('cyclone') || lowerHeadline.includes('storm') || lowerHeadline.includes('severe') || alert.severity === 'severe') {
          category = 'severe_weather';
          hazard = 'Severe Weather';
        } else if (lowerHeadline.includes('rain') || lowerHeadline.includes('precipitation')) {
          category = 'rain';
          hazard = 'Rain Alert';
        } else if (lowerHeadline.includes('heat') || lowerHeadline.includes('cold') || lowerHeadline.includes('temperature')) {
          category = 'temperature';
          hazard = 'Temperature Alert';
        }
      }

      // Check if user enabled notifications for this category
      if (category && preferences[category]) {
        const mappedSeverity = mapAlertSeverity(alert.severity);
        const dedupKey = `alert_${alert.id}_${locationName.replace(/\s+/g, '_')}_${todayStr}_h${hourBucket}`;

        candidates.push({
          title: alert.title,
          message: alert.headline || alert.description,
          severity: mappedSeverity,
          hazard,
          location_name: locationName,
          latitude: lat,
          longitude: lon,
          source,
          source_type: sourceType,
          preferenceCategory: category,
          dedupKey,
          metadata: {
            original_alert_id: alert.id,
            issued_by: alert.issuedBy,
            valid_until: alert.validUntil,
            color_code: alert.colorCode,
            actionable_advice: alert.actionableAdvice,
            dedup_key: dedupKey,
          },
        });
      }
    }
  }

  // 2. Air Quality Alerts (Existing AQI Intelligence)
  if (preferences.air_quality && weatherIntel.airQuality) {
    const aqi = weatherIntel.airQuality.aqi;
    const category = weatherIntel.airQuality.category;

    // Trigger only if AQI is Poor (201-300), Very Poor (301-400), or Severe/Hazardous (401+)
    if (aqi >= 201 || category === 'Poor' || category === 'Very Poor' || category === 'Severe') {
      const severity: NotificationSeverity = aqi >= 350 ? 'critical' : aqi >= 250 ? 'warning' : 'watch';
      const dedupKey = `aqi_${locationName.replace(/\s+/g, '_')}_${todayStr}_h${hourBucket}`;

      candidates.push({
        title: `Elevated Air Pollution Notice (AQI ${aqi})`,
        message: weatherIntel.airQuality.healthAdvice || `Air quality in ${locationName} is in ${category} category with PM2.5 at ${weatherIntel.airQuality.pm25} µg/m³.`,
        severity,
        hazard: 'Air Quality',
        location_name: locationName,
        latitude: lat,
        longitude: lon,
        source: weatherIntel.airQuality.source?.providerName || 'Mausam AQI Calculation',
        source_type: 'derived',
        preferenceCategory: 'air_quality',
        dedupKey,
        metadata: {
          aqi,
          category,
          pm25: weatherIntel.airQuality.pm25,
          pm10: weatherIntel.airQuality.pm10,
          dedup_key: dedupKey,
        },
      });
    }
  }

  // 3. Cyclone Warnings (Existing Cyclone Intelligence)
  if (preferences.severe_weather && weatherIntel.cyclone && weatherIntel.cyclone.hasActiveStorm) {
    const cyc = weatherIntel.cyclone;
    const cycloneName = cyc.cycloneName || 'Active System';
    const intensity = cyc.currentIntensity || 'Tropical Depression';
    const dedupKey = `cyclone_${cycloneName.replace(/\s+/g, '_')}_${locationName.replace(/\s+/g, '_')}_${todayStr}_h${hourBucket}`;

    candidates.push({
      title: `Cyclone Advisory: ${cycloneName} (${intensity})`,
      message: cyc.bulletinSummary || `Tropical cyclonic system with sustained winds near ${cyc.maxSustainedWindsKmph || 65} km/h affecting the ${cyc.basin || 'maritime basin'}.`,
      severity: 'critical',
      hazard: 'Cyclone',
      location_name: locationName,
      latitude: lat,
      longitude: lon,
      source: cyc.source?.providerName || 'Mausam Storm Surveillance',
      source_type: cyc.source?.isOfficialIMD ? 'official' : 'derived',
      preferenceCategory: 'severe_weather',
      dedupKey,
      metadata: {
        system_name: cycloneName,
        intensity,
        movement: cyc.movementDirection,
        threat_level: cyc.coastalThreatLevel,
        dedup_key: dedupKey,
      },
    });
  }

  // 4. Daily Forecast Summary (Existing Daily Forecast Intelligence)
  if (preferences.daily_forecast && weatherIntel.forecast && weatherIntel.forecast.daily && weatherIntel.forecast.daily.length > 0) {
    const todayForecast = weatherIntel.forecast.daily[0];
    const dedupKey = `daily_forecast_${locationName.replace(/\s+/g, '_')}_${todayStr}`;

    candidates.push({
      title: `Daily Weather Outlook for ${locationName}`,
      message: `Today's high ${Math.round(todayForecast.tempMax)}°C, low ${Math.round(todayForecast.tempMin)}°C. Rain probability ${todayForecast.precipitationProb}%. ${todayForecast.conditionText}.`,
      severity: 'info',
      hazard: 'Daily Forecast',
      location_name: locationName,
      latitude: lat,
      longitude: lon,
      source: 'Open-Meteo Ensemble & Mausam Models',
      source_type: 'provider',
      preferenceCategory: 'daily_forecast',
      dedupKey,
      metadata: {
        date: todayForecast.date,
        max_temp: todayForecast.tempMax,
        min_temp: todayForecast.tempMin,
        rain_prob: todayForecast.precipitationProb,
        dedup_key: dedupKey,
      },
    });
  }

  return candidates;
}

/**
 * Filters out candidates that have already been created or exist in the notification history.
 * Checks against explicit metadata.dedup_key as well as stable event signatures.
 */
export function filterDuplicateCandidates(
  candidates: AlertNotificationCandidate[],
  existingNotifications: Notification[]
): AlertNotificationCandidate[] {
  const existingKeys = new Set<string>();

  for (const notif of existingNotifications) {
    let key: string | null = null;
    if (notif.metadata) {
      if (typeof notif.metadata === 'object' && notif.metadata !== null) {
        key = (notif.metadata as any).dedup_key || null;
      } else if (typeof notif.metadata === 'string') {
        try {
          key = JSON.parse(notif.metadata)?.dedup_key || null;
        } catch {}
      }
    }
    if (key) {
      existingKeys.add(String(key));
    }
  }

  return candidates.filter((candidate) => !existingKeys.has(candidate.dedupKey));
}
