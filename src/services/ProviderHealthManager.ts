/**
 * Provider Health System
 * Tracks provider status (healthy / degraded / unavailable)
 * Prevents retry storms and guides fallback decisions.
 */

import { ProviderHealthStatus, ProviderHealthState } from './providers/providerTypes';

class ProviderHealthManager {
  private healthMap = new Map<string, ProviderHealthStatus>();

  constructor() {
    this.initProviders([
      { id: 'open-meteo', name: 'Open-Meteo Global Numerical Weather' },
      { id: 'open-meteo-gfs-icon', name: 'Open-Meteo Alternate Multi-Model (GFS/ICON)' },
      { id: 'open-meteo-geocoding', name: 'Open-Meteo Geocoding Engine' },
      { id: 'osm-nominatim', name: 'OpenStreetMap Nominatim Geocoder' },
      { id: 'imd-official', name: 'India Meteorological Department (IMD)' },
      { id: 'copernicus-era5', name: 'Open-Meteo Archive API — ERA5 Reanalysis' },
      { id: 'copernicus-glofas', name: 'Mausam Hydrology Engine (Open-Meteo precipitation input)' },
      { id: 'nasa-gibs', name: 'NASA GIBS Satellite Imagery' },
      { id: 'rainviewer', name: 'RainViewer Live Radar Tiles' },
      { id: 'mausam-cache', name: 'MAUSAM Same-Location Cache' },
    ]);
  }

  private initProviders(list: { id: string; name: string }[]) {
    for (const item of list) {
      this.healthMap.set(item.id, {
        providerId: item.id,
        name: item.name,
        status: item.id === 'imd-official' ? 'unavailable' : 'healthy',
        consecutiveFailures: 0,
        lastSuccessTime: item.id === 'imd-official' ? null : Date.now(),
        lastFailureTime: null,
        cooldownUntil: null,
        lastError: item.id === 'imd-official' ? 'Official ministry gateway unconfigured (optional)' : null,
      });
    }
  }

  private sanitizeErrorMessage(error?: any): string {
    if (!error) return 'Connection failed';
    let msg = typeof error === 'string' ? error : error?.message || String(error);

    // Remove any stack traces or multi-line outputs
    if (msg.includes('\n')) {
      msg = msg.split('\n')[0];
    }
    if (msg.includes(' at ')) {
      msg = msg.split(' at ')[0];
    }

    // Sanitize credentials, keys, or tokens in query parameters
    msg = msg.replace(/([?&](key|token|auth|secret|password|apikey|api_key)=)[^&]+/gi, '$1[REDACTED]');

    // Strip full internal/external URLs to just host or endpoint name
    msg = msg.replace(/https?:\/\/[^\s/$.?#].[^\s]*/gi, (url) => {
      try {
        const parsed = new URL(url);
        return parsed.hostname;
      } catch {
        return '[endpoint]';
      }
    });

    // Truncate to maximum 120 chars
    if (msg.length > 120) {
      msg = msg.slice(0, 117) + '...';
    }

    return msg.trim() || 'Service request failed';
  }

  recordSuccess(providerId: string): void {
    const p = this.healthMap.get(providerId);
    if (!p) return;
    p.status = 'healthy';
    p.consecutiveFailures = 0;
    p.lastSuccessTime = Date.now();
    p.cooldownUntil = null;
    p.lastError = null;
  }

  recordFailure(providerId: string, error?: any): void {
    const p = this.healthMap.get(providerId);
    if (!p) return;

    p.consecutiveFailures += 1;
    p.lastFailureTime = Date.now();
    p.lastError = this.sanitizeErrorMessage(error);

    const now = Date.now();
    if (p.consecutiveFailures >= 5) {
      p.status = 'unavailable';
      p.cooldownUntil = now + 120_000; // 2 minutes cooldown
    } else if (p.consecutiveFailures >= 2) {
      p.status = 'degraded';
      p.cooldownUntil = now + 30_000; // 30 seconds cooldown
    }
  }

  isAvailable(providerId: string): boolean {
    const p = this.healthMap.get(providerId);
    if (!p) return true;

    if (providerId === 'imd-official') {
      return false; // Optional gateway
    }

    if (p.status === 'healthy') {
      return true;
    }

    const now = Date.now();
    // If cooldown is active, prevent retry storm
    if (p.cooldownUntil) {
      if (now < p.cooldownUntil) {
        return false;
      }
      // Cooldown expired: allow a probe attempt
      return true;
    }

    return p.status !== 'unavailable';
  }

  getStatus(providerId: string): ProviderHealthState {
    const p = this.healthMap.get(providerId);
    if (!p) return 'healthy';

    // If cooldown has expired for an unavailable provider, treat as degraded/probing
    if (p.cooldownUntil && Date.now() >= p.cooldownUntil && p.status === 'unavailable') {
      return 'degraded';
    }

    return p.status;
  }

  getHealth(providerId: string): ProviderHealthStatus | undefined {
    return this.healthMap.get(providerId);
  }

  getAllHealth(): ProviderHealthStatus[] {
    return Array.from(this.healthMap.values());
  }

  resetAll(): void {
    for (const [id, val] of this.healthMap.entries()) {
      if (id !== 'imd-official') {
        val.status = 'healthy';
        val.consecutiveFailures = 0;
        val.cooldownUntil = null;
        val.lastError = null;
      }
    }
  }
}

export const providerHealthManager = new ProviderHealthManager();
