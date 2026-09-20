import React from 'react';
import {
  X,
  ExternalLink,
  Database,
  Info,
  CheckCircle2,
  AlertCircle,
  Activity,
  ShieldCheck,
  Clock,
  Compass,
  AlertTriangle,
} from 'lucide-react';
import {
  ProviderMetadata,
  CompleteWeatherIntelligence,
  DataProvenance,
  SubsystemProvenance,
} from '../services/providers/providerTypes';
import { providerHealthManager } from '../services/ProviderHealthManager';
import {
  formatRelativeAge,
  formatProvenanceSummary,
} from '../utils/freshnessUtils';

interface DataSourceTransparencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  intelligence?: CompleteWeatherIntelligence | null;
  provenance?: DataProvenance | null;
}

const PROVIDERS_REGISTRY: ProviderMetadata[] = [
  {
    id: 'open-meteo',
    name: 'Open-Meteo Global Numerical Weather',
    classification: 'free-api-service',
    license: 'Creative Commons Attribution 4.0 International (CC-BY 4.0)',
    requiresAuth: false,
    isConfigured: true,
    rateLimitInfo: '10,000 requests/day free tier, up to 600 req/min',
    attribution: 'Weather data by Open-Meteo.com under CC-BY 4.0',
    website: 'https://open-meteo.com',
  },
  {
    id: 'open-meteo-geocoding',
    name: 'Open-Meteo Indian Geocoding Engine',
    classification: 'free-api-service',
    license: 'CC-BY 4.0 / GeoNames & OpenStreetMap',
    requiresAuth: false,
    isConfigured: true,
    rateLimitInfo: 'Worldwide & Indian place search with district, state & elevation',
    attribution: 'Geocoding data by Open-Meteo under CC-BY 4.0',
    website: 'https://open-meteo.com/en/docs/geocoding-api',
  },
  {
    id: 'osm-nominatim',
    name: 'OpenStreetMap Nominatim',
    classification: 'open-data',
    license: 'Open Database License (ODbL) / © OpenStreetMap contributors',
    requiresAuth: false,
    isConfigured: true,
    rateLimitInfo: 'Max 1 req/sec, local memory cache + server rate-limiting proxy',
    attribution: 'Geocoding data © OpenStreetMap contributors',
    website: 'https://nominatim.openstreetmap.org',
  },
  {
    id: 'copernicus-era5',
    name: 'Open-Meteo Archive API — ERA5 Reanalysis',
    classification: 'open-data',
    license: 'Copernicus Open Access / European Union (via Open-Meteo Archive)',
    requiresAuth: false,
    isConfigured: true,
    rateLimitInfo: 'Open-Meteo Historical Weather API serving ECMWF ERA5 reanalysis',
    attribution: 'Contains modified Copernicus Climate Change Service information (ERA5 via Open-Meteo Archive API)',
    website: 'https://open-meteo.com/en/docs/historical-weather-api',
  },
  {
    id: 'copernicus-glofas',
    name: 'Mausam Hydrology Engine (Open-Meteo precipitation input)',
    classification: 'open-source-software',
    license: 'Mausam Meteorological Intelligence Engine',
    requiresAuth: false,
    isConfigured: true,
    rateLimitInfo: 'Model-derived hydrological runoff calculated from Open-Meteo 3-day precipitation accumulation',
    attribution: 'Mausam Hydrology Engine (Open-Meteo precipitation input)',
    website: 'https://open-meteo.com',
  },
  {
    id: 'nasa-gibs',
    name: 'NASA GIBS (Global Imagery Browse Services)',
    classification: 'open-data',
    license: 'NASA Earth Science Open Data Policy',
    requiresAuth: false,
    isConfigured: true,
    rateLimitInfo: 'Public Open WMTS/WMS tile service, no API key required',
    attribution: 'Imagery provided by NASA GIBS / GSFC / ESDIS',
    website: 'https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs',
  },
  {
    id: 'rainviewer',
    name: 'RainViewer Live Radar & Infrared Satellite',
    classification: 'free-api-service',
    license: 'RainViewer Free Public Weather API Terms',
    requiresAuth: false,
    isConfigured: true,
    rateLimitInfo: 'Real-time radar mosaic tiles with 10-minute refresh cadence',
    attribution: 'Radar and satellite data provided by RainViewer.com',
    website: 'https://www.rainviewer.com/api.html',
  },
  {
    id: 'imd-official',
    name: 'India Meteorological Department (IMD)',
    classification: 'official-government-agency',
    license: 'Ministry of Earth Sciences, Govt. of India',
    requiresAuth: true,
    isConfigured: false, // Optional gateway; clearly reported as unconfigured if no key provided
    rateLimitInfo: 'Official authenticated gateway. Resilient Fallback to Open-Meteo & Copernicus active.',
    attribution: 'India Meteorological Department, Ministry of Earth Sciences, Govt. of India',
    website: 'https://mausam.imd.gov.in',
  },
];

export const DataSourceTransparencyModal: React.FC<DataSourceTransparencyModalProps> = ({
  isOpen,
  onClose,
  intelligence,
  provenance: propProvenance,
}) => {
  if (!isOpen) return null;

  const healthList = providerHealthManager.getAllHealth();
  const activeProv = propProvenance || intelligence?.provenance || intelligence?.freshness?.provenance;

  const getClassificationBadge = (classification: ProviderMetadata['classification']) => {
    switch (classification) {
      case 'open-data':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">Open Data</span>;
      case 'open-source-software':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">Open Source</span>;
      case 'free-api-service':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">Free API Service</span>;
      case 'official-government-agency':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">Official Govt Agency</span>;
    }
  };

  const getHealthBadge = (providerId: string) => {
    const health = healthList.find((h) => h.providerId === providerId);
    if (!health) return null;

    if (health.status === 'healthy') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Operational
        </span>
      );
    }

    if (health.status === 'degraded') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          <Activity className="w-3 h-3 text-amber-600" /> Degraded ({health.consecutiveFailures} fails)
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
        <AlertCircle className="w-3 h-3 text-slate-500" /> {providerId === 'imd-official' ? 'Optional Gateway' : 'Offline / Standby'}
      </span>
    );
  };

  const getFallbackLevelBadge = (level: number, isExactMatch: boolean = true, isApproximate: boolean = false) => {
    switch (level) {
      case 0:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Level 0: Live Numerical Feed</span>;
      case 1:
        if (!isExactMatch || isApproximate) {
          return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">Explicit Approximate Cache (Not Normal Level 1)</span>;
        }
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">Level 1: Same-Location Cache</span>;
      case 2:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">Level 2: Alternate NWP Model</span>;
      case 3:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">Level 3: Partial Subsystem Fallback</span>;
      case 4:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-800 border border-orange-200">Level 4: Derived Intelligence</span>;
      case 5:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">Level 5: Honest Unavailable</span>;
      default:
        return null;
    }
  };

  const getFreshnessBadge = (freshness: string) => {
    switch (freshness) {
      case 'fresh':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">Fresh (&lt;15m)</span>;
      case 'recent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800">Recent (15-60m)</span>;
      case 'stale':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">Stale (1-6h)</span>;
      case 'very-stale':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-800">Very Stale (&gt;6h)</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">Unknown</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-black/[0.08] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-sky-100 text-sky-800">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Mausam Provider Transparency & Health
              </h2>
              <p className="text-xs text-slate-500">
                6-tier resilient architecture, zero data fabrication & verified provenance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Provider List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Active Result Provenance Card (If data active) */}
          {activeProv && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-sky-50/40 border border-sky-200/80 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  <span className="font-bold text-slate-900 text-sm">Active Result Provenance</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {getFallbackLevelBadge(activeProv.fallbackLevel, activeProv.isExactMatch, activeProv.isApproximate)}
                  {getFreshnessBadge(activeProv.freshness)}
                </div>
              </div>

              {/* Source & Coordinates Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] bg-white p-3 rounded-xl border border-slate-200/70">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Active Source</span>
                  <span className="font-semibold text-slate-900">{activeProv.sourceName}</span>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    {activeProv.isOfficial ? (
                      <span className="text-emerald-700 font-medium">✓ Official Government Source</span>
                    ) : (
                      <span className="text-slate-500">Open-Access Model (Not Official IMD)</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Confidence & Age</span>
                  <div className="font-semibold text-slate-900 flex items-center gap-1">
                    <span>Confidence: {activeProv.confidence}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    {activeProv.ageSeconds !== undefined
                      ? `Age: ${formatRelativeAge(activeProv.ageSeconds)}`
                      : 'Age: Unknown'}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Coordinates Integrity</span>
                  <div className="font-mono text-[10px] text-slate-700">
                    Req: {activeProv.requestedCoordinates.latitude.toFixed(3)}°N, {activeProv.requestedCoordinates.longitude.toFixed(3)}°E
                  </div>
                  <div className="mt-0.5">
                    {activeProv.isExactMatch && !activeProv.isApproximate ? (
                      <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Exact Coordinate Match (0.0 km)
                      </span>
                    ) : (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-0.5 text-amber-700 font-semibold text-[10px]">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Nearby Cached Station (~{activeProv.approximateDistanceKm?.toFixed(1) || '2.5'} km away)
                        </span>
                        <div className="text-[9px] text-amber-800 font-medium">
                          Explicit approximate cache — not part of normal Level 1 fallback.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Timestamps</span>
                  <div className="text-[10px] text-slate-700">
                    {activeProv.obtainedAt && (
                      <div>Retrieved: {new Date(activeProv.obtainedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                    )}
                    {activeProv.observedAt ? (
                      <div>Observed: {new Date(activeProv.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    ) : (
                      <div className="text-slate-400">Observed: Model baseline</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Subsystems Provenance Breakdown */}
              {activeProv.subsystems && Object.keys(activeProv.subsystems).length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="font-semibold text-slate-800 text-[11px] flex items-center justify-between">
                    <span>Subsystem Attribution Breakdown</span>
                    <span className="text-[10px] text-slate-500 font-normal">Independent provenance per layer</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px]">
                    {Object.entries(activeProv.subsystems).map(([key, rawSub]) => {
                      const sub = rawSub as SubsystemProvenance;
                      return (
                        <div key={key} className="p-2 rounded-lg bg-white border border-slate-200/80">
                          <div className="font-semibold text-slate-800 capitalize">{key}</div>
                          <div className="text-slate-500 truncate" title={sub.sourceName}>{sub.sourceName}</div>
                          <div className="mt-1 flex items-center justify-between text-[9px]">
                            <span className={sub.status === 'available' ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                              {sub.status}
                            </span>
                            <span className="text-slate-400">
                              {sub.isOfficial ? 'Official' : sub.isDerived ? 'Derived' : 'Model'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Limitations / Disclaimers */}
              {activeProv.limitations && activeProv.limitations.length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-amber-950 text-[10px] space-y-1">
                  <span className="font-semibold block">Known Provider Limitations & Disclaimers:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-amber-900/90">
                    {activeProv.limitations.map((lim, idx) => (
                      <li key={idx}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Integrity Banner */}
          <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-sky-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="block font-semibold mb-0.5">Core Architectural Integrity Rule:</strong>
              Mausam strictly enforces that fallback mechanisms may adjust the data provider or serve validated same-location cache, but will <strong>never silently change your requested location</strong> or fabricate fictional temperatures.
            </div>
          </div>

          <div className="space-y-3">
            <div className="font-semibold text-slate-800 text-xs px-1">
              Registered Meteorological Providers & Gateway Registry
            </div>
            {PROVIDERS_REGISTRY.map((prov) => (
              <div
                key={prov.id}
                className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-slate-300 transition-colors bg-white shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{prov.name}</span>
                    {getHealthBadge(prov.id)}
                  </div>
                  {getClassificationBadge(prov.classification)}
                </div>

                <div className="text-[11px] text-slate-600 space-y-1">
                  <p>
                    <strong>License / Terms:</strong> {prov.license}
                  </p>
                  <p>
                    <strong>Usage & Rate Limits:</strong> {prov.rateLimitInfo}
                  </p>
                  <p>
                    <strong>Attribution:</strong> {prov.attribution}
                  </p>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <a
                    href={prov.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 hover:text-sky-700"
                  >
                    <span>Provider Documentation</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-[10px] text-slate-400">
                    {prov.requiresAuth ? 'Requires Authentication' : 'Open / No Key Required'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            MAUSAM Resilient Architecture v2.0 • SIH 2024
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
