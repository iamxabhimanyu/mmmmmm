/**
 * AutoLocationManager Service
 *
 * Handles:
 * 1. Automatic acquisition of exact user GPS location on initial app entry.
 * 2. Periodic ("time by time") automatic background location reloads for exact microclimate coordinates.
 * 3. Real-time movement detection (triggers exact reload if user moves > 300 meters).
 * 4. Tab visibility re-sync (checks location freshness when returning to the app).
 * 5. State subscriptions and user control (toggle auto-reload, interval picker, manual one-tap GPS refresh).
 */

import { NormalizedLocation } from '../types';
import { locationResolver } from './LocationResolver';
import { haversineDistanceKm } from '../utils/coordinateUtils';

export type AutoLocationStatus = 'idle' | 'acquiring' | 'tracking' | 'error' | 'permission_denied';

export interface AutoLocationState {
  status: AutoLocationStatus;
  isEnabled: boolean;
  intervalMinutes: number;
  lastFix: {
    lat: number;
    lon: number;
    accuracy?: number;
    timestamp: number;
  } | null;
  lastResolvedLocation: NormalizedLocation | null;
  lastSyncTimestamp: number | null;
  errorMessage: string | null;
  isAcquiring: boolean;
}

type LocationCallback = (
  location: NormalizedLocation,
  reason: 'initial' | 'timer' | 'movement' | 'manual'
) => void;

type StateListener = (state: AutoLocationState) => void;

class AutoLocationManager {
  private status: AutoLocationStatus = 'idle';
  private isEnabled: boolean = true;
  private intervalMinutes: number = 3; // default: 3-minute reload cycle
  private lastFix: { lat: number; lon: number; accuracy?: number; timestamp: number } | null = null;
  private lastResolvedLocation: NormalizedLocation | null = null;
  private lastSyncTimestamp: number | null = null;
  private errorMessage: string | null = null;
  private isAcquiring: boolean = false;

  private timerId: ReturnType<typeof setInterval> | null = null;
  private watchId: number | null = null;
  private locationCallback: LocationCallback | null = null;
  private stateListeners: Set<StateListener> = new Set();

  private readonly MOVEMENT_THRESHOLD_KM = 0.3; // 300 meters movement triggers immediate reload
  private readonly STORAGE_ENABLED_KEY = 'mausam_auto_location_enabled';
  private readonly STORAGE_INTERVAL_KEY = 'mausam_auto_location_interval';

  constructor() {
    this.hydrateSettings();
  }

  private hydrateSettings() {
    try {
      const storedEnabled = localStorage.getItem(this.STORAGE_ENABLED_KEY);
      if (storedEnabled !== null) {
        this.isEnabled = storedEnabled === 'true';
      }

      const storedInterval = localStorage.getItem(this.STORAGE_INTERVAL_KEY);
      if (storedInterval !== null) {
        const parsed = parseInt(storedInterval, 10);
        if ([1, 2, 3, 5, 10, 15].includes(parsed)) {
          this.intervalMinutes = parsed;
        }
      }
    } catch (e) {
      // Storage access blocked or restricted
    }
  }

  public getState(): AutoLocationState {
    return {
      status: this.status,
      isEnabled: this.isEnabled,
      intervalMinutes: this.intervalMinutes,
      lastFix: this.lastFix,
      lastResolvedLocation: this.lastResolvedLocation,
      lastSyncTimestamp: this.lastSyncTimestamp,
      errorMessage: this.errorMessage,
      isAcquiring: this.isAcquiring,
    };
  }

  public subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    for (const listener of this.stateListeners) {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[AutoLocationManager] Listener error:', err);
      }
    }
  }

  /**
   * Acquire exact user location via GPS and reverse geocode.
   */
  public async acquireExactLocation(
    reason: 'initial' | 'timer' | 'movement' | 'manual' = 'manual',
    force = false
  ): Promise<NormalizedLocation | null> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      this.status = 'error';
      this.errorMessage = 'Geolocation is not supported by your browser or environment.';
      this.notify();
      return null;
    }

    this.isAcquiring = true;
    this.status = 'acquiring';
    this.errorMessage = null;
    this.notify();

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          const now = Date.now();

          // Check if movement is negligible and we already have a recent fix (unless forced)
          if (!force && this.lastFix && this.lastResolvedLocation) {
            const distance = haversineDistanceKm(this.lastFix.lat, this.lastFix.lon, lat, lon);
            const isFresh = now - this.lastFix.timestamp < this.intervalMinutes * 60 * 1000;
            if (distance < this.MOVEMENT_THRESHOLD_KM && isFresh && reason === 'timer') {
              // Same location, update fix timestamp without re-fetching reverse geocode
              this.lastFix = { lat, lon, accuracy, timestamp: now };
              this.lastSyncTimestamp = now;
              this.isAcquiring = false;
              this.status = 'tracking';
              this.notify();
              resolve(this.lastResolvedLocation);
              return;
            }
          }

          this.lastFix = { lat, lon, accuracy, timestamp: now };
          this.lastSyncTimestamp = now;

          try {
            // Resolve exact locality, district, village, city, and preserve exact coordinates
            const resolved = await locationResolver.resolveFromCoordinates(lat, lon);
            resolved.isCurrent = true;
            this.lastResolvedLocation = resolved;
            this.status = 'tracking';
            this.isAcquiring = false;
            this.errorMessage = null;
            this.notify();

            if (this.locationCallback) {
              this.locationCallback(resolved, reason);
            }
            resolve(resolved);
          } catch (resErr: any) {
            console.warn('[AutoLocationManager] Reverse geocode fallback to raw GPS:', resErr);
            const fallbackLoc: NormalizedLocation = {
              id: `gps-${lat.toFixed(5)}_${lon.toFixed(5)}`,
              name: 'Exact GPS Position',
              displayName: `GPS (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`,
              state: 'India',
              country: 'India',
              countryCode: 'IN',
              latitude: lat,
              longitude: lon,
              lat,
              lon,
              source: 'gps',
              isCurrent: true,
            };
            this.lastResolvedLocation = fallbackLoc;
            this.status = 'tracking';
            this.isAcquiring = false;
            this.notify();

            if (this.locationCallback) {
              this.locationCallback(fallbackLoc, reason);
            }
            resolve(fallbackLoc);
          }
        },
        (error) => {
          this.isAcquiring = false;
          if (error.code === error.PERMISSION_DENIED) {
            this.status = 'permission_denied';
            this.errorMessage = 'Location permission was denied. Enable GPS in browser settings to auto-detect location.';
          } else if (error.code === error.TIMEOUT) {
            this.status = 'error';
            this.errorMessage = 'GPS request timed out. Retrying on next cycle.';
          } else {
            this.status = 'error';
            this.errorMessage = error.message || 'Unable to retrieve your current location.';
          }
          this.notify();
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 15000,
        }
      );
    });
  }

  /**
   * Start time-by-time auto tracking and periodic reload.
   */
  public startAutoTracking(callback: LocationCallback) {
    this.locationCallback = callback;
    this.stopTimersAndWatchers();

    if (!this.isEnabled) {
      return;
    }

    // 1. Periodic reload timer: auto-reloads location every intervalMinutes
    const intervalMs = this.intervalMinutes * 60 * 1000;
    this.timerId = setInterval(() => {
      if (this.isEnabled && typeof document !== 'undefined' && !document.hidden) {
        this.acquireExactLocation('timer', false);
      }
    }, intervalMs);

    // 2. Continuous watchPosition for real-time movement detection
    if (typeof window !== 'undefined' && navigator.geolocation) {
      try {
        this.watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            if (this.lastFix) {
              const movedKm = haversineDistanceKm(this.lastFix.lat, this.lastFix.lon, lat, lon);
              if (movedKm >= this.MOVEMENT_THRESHOLD_KM) {
                // User moved significantly (> 300m) -> trigger reload for exact location
                this.acquireExactLocation('movement', true);
              }
            }
          },
          (err) => {
            // Non-fatal watch error (e.g. temporary loss of satellite lock)
            console.debug('[AutoLocationManager] Watch position notice:', err.message);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 20000,
          }
        );
      } catch (e) {
        console.warn('[AutoLocationManager] watchPosition unavailable:', e);
      }
    }

    // 3. Document visibility change: refresh if user was away for more than the interval
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && !document.hidden && this.isEnabled) {
      const now = Date.now();
      const elapsed = now - (this.lastSyncTimestamp || 0);
      if (elapsed > this.intervalMinutes * 60 * 1000) {
        this.acquireExactLocation('timer', false);
      }
    }
  };

  private stopTimersAndWatchers() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  public stopAutoTracking() {
    this.stopTimersAndWatchers();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.status = 'idle';
    this.notify();
  }

  public setAutoEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    try {
      localStorage.setItem(this.STORAGE_ENABLED_KEY, String(enabled));
    } catch (e) {}

    if (enabled) {
      if (this.locationCallback) {
        this.startAutoTracking(this.locationCallback);
      }
      this.acquireExactLocation('manual', true);
    } else {
      this.stopAutoTracking();
    }
    this.notify();
  }

  public setIntervalMinutes(minutes: number) {
    if (![1, 2, 3, 5, 10, 15].includes(minutes)) return;
    this.intervalMinutes = minutes;
    try {
      localStorage.setItem(this.STORAGE_INTERVAL_KEY, String(minutes));
    } catch (e) {}

    // Restart timer with new interval if active
    if (this.isEnabled && this.locationCallback) {
      this.startAutoTracking(this.locationCallback);
    }
    this.notify();
  }

  /**
   * Formatted relative time string of the last sync
   */
  public getLastSyncRelativeString(): string {
    if (!this.lastSyncTimestamp) return 'Not yet synced';
    const diffSec = Math.floor((Date.now() - this.lastSyncTimestamp) / 1000);
    if (diffSec < 20) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return `${Math.floor(diffMin / 60)}h ago`;
  }
}

export const autoLocationManager = new AutoLocationManager();
