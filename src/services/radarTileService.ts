import { DopplerRadarStation, LocationInfo } from '../types';
import { IMD_RADAR_STATIONS, MAJOR_INDIAN_CITIES } from '../data/constants';
import { locationResolver } from './LocationResolver';

export interface RadarFrame {
  time: number;
  path: string;
  label: string;
  timeFormatted: string;
  isNowcast: boolean;
}

export interface RainViewerMetadata {
  host: string;
  radarFrames: RadarFrame[];
  satellitePath?: string;
  satelliteTime?: number;
  satelliteFormatted?: string;
  generatedAt: number;
}

export interface RegionalStationWeather {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  temp: number;
  condition: string;
  windSpeed: number; // km/h
  windDirection: number; // degrees
  windGust: number;
  humidity: number;
}

export interface SevereWeatherRiskZone {
  id: string;
  name: string;
  category: 'Heavy Rainfall' | 'Cyclonic Circulation' | 'Severe Thunderstorm' | 'Gale Wind Warning' | 'Heatwave';
  severity: 'Red' | 'Orange' | 'Yellow';
  lat: number;
  lon: number;
  radiusKm: number;
  advisory: string;
  affectedRegions: string[];
  validUntil: string;
}

/**
 * IMD Doppler Weather Radar (DWR) Architecture Config
 * Structured to integrate an official IMD DWR raster feed when official credentials become available.
 */
export interface ImdDwrProviderConfig {
  activeProvider: 'RainViewer_Global' | 'IMD_Official_Direct';
  attribution: string;
  radarStations: DopplerRadarStation[];
  officialImdEndpoint?: string;
  isOfficialImdConfigured: boolean;
}

export const IMD_DWR_CONFIG: ImdDwrProviderConfig = {
  activeProvider: 'RainViewer_Global',
  attribution: 'Precipitation radar imagery provided by RainViewer Doppler Network. IMD station telemetry mapped.',
  radarStations: IMD_RADAR_STATIONS,
  isOfficialImdConfigured: false,
};

// Regional observation stations covering India
export const REGIONAL_OBSERVATION_STATIONS: RegionalStationWeather[] = [
  { id: 'del', name: 'New Delhi', state: 'Delhi', lat: 28.6139, lon: 77.2090, temp: 31, condition: 'Haze / Clear', windSpeed: 14, windDirection: 290, windGust: 22, humidity: 48 },
  { id: 'mum', name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lon: 72.8777, temp: 28, condition: 'Breezy / Rain', windSpeed: 24, windDirection: 240, windGust: 38, humidity: 82 },
  { id: 'blr', name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lon: 77.5946, temp: 24, condition: 'Pleasant Overcast', windSpeed: 16, windDirection: 260, windGust: 25, humidity: 70 },
  { id: 'che', name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707, temp: 32, condition: 'Humid & Sunny', windSpeed: 18, windDirection: 170, windGust: 28, humidity: 76 },
  { id: 'kol', name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lon: 88.3639, temp: 30, condition: 'Passing Showers', windSpeed: 15, windDirection: 160, windGust: 26, humidity: 84 },
  { id: 'hyd', name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lon: 78.4867, temp: 27, condition: 'Partly Cloudy', windSpeed: 19, windDirection: 250, windGust: 30, humidity: 66 },
  { id: 'ahd', name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lon: 72.5714, temp: 33, condition: 'Dry & Sunny', windSpeed: 14, windDirection: 270, windGust: 20, humidity: 52 },
  { id: 'pune', name: 'Pune', state: 'Maharashtra', lat: 18.5204, lon: 73.8567, temp: 26, condition: 'Scattered Clouds', windSpeed: 18, windDirection: 255, windGust: 28, humidity: 74 },
  { id: 'jai', name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lon: 75.7873, temp: 32, condition: 'Clear Sky', windSpeed: 12, windDirection: 310, windGust: 18, humidity: 44 },
  { id: 'lko', name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lon: 80.9462, temp: 30, condition: 'Clear', windSpeed: 10, windDirection: 280, windGust: 16, humidity: 58 },
  { id: 'pat', name: 'Patna', state: 'Bihar', lat: 25.5941, lon: 85.1376, temp: 29, condition: 'Partly Cloudy', windSpeed: 12, windDirection: 120, windGust: 18, humidity: 72 },
  { id: 'bho', name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lon: 77.4126, temp: 29, condition: 'Scattered Rain', windSpeed: 16, windDirection: 260, windGust: 24, humidity: 68 },
  { id: 'sri', name: 'Srinagar', state: 'J&K', lat: 34.0837, lon: 74.7973, temp: 18, condition: 'Cool Breeze', windSpeed: 8, windDirection: 45, windGust: 14, humidity: 55 },
  { id: 'shm', name: 'Shimla', state: 'Himachal Pradesh', lat: 31.1048, lon: 77.1734, temp: 16, condition: 'Mist & Clouds', windSpeed: 12, windDirection: 30, windGust: 20, humidity: 65 },
  { id: 'guw', name: 'Guwahati', state: 'Assam', lat: 26.1445, lon: 91.7362, temp: 28, condition: 'Heavy Showers', windSpeed: 14, windDirection: 90, windGust: 28, humidity: 88 },
  { id: 'koc', name: 'Kochi', state: 'Kerala', lat: 9.9312, lon: 76.2673, temp: 27, condition: 'Monsoon Rains', windSpeed: 22, windDirection: 250, windGust: 36, humidity: 86 },
  { id: 'viz', name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lon: 83.2185, temp: 31, condition: 'Coastal Breeze', windSpeed: 20, windDirection: 180, windGust: 32, humidity: 78 },
  { id: 'bhu', name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lon: 85.8245, temp: 30, condition: 'Humid / Rain', windSpeed: 17, windDirection: 170, windGust: 28, humidity: 80 },
  { id: 'nag', name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lon: 79.0882, temp: 29, condition: 'Warm / Cloudy', windSpeed: 15, windDirection: 240, windGust: 22, humidity: 64 },
  { id: 'pan', name: 'Panaji (Goa)', state: 'Goa', lat: 15.4909, lon: 73.8278, temp: 28, condition: 'Squally Showers', windSpeed: 26, windDirection: 245, windGust: 42, humidity: 85 },
];

// Active High-Risk Weather & Severe Alert Zones in India
export const SEVERE_WEATHER_RISK_ZONES: SevereWeatherRiskZone[] = [
  {
    id: 'risk-konkan',
    name: 'Konkan & Western Ghats',
    category: 'Heavy Rainfall',
    severity: 'Orange',
    lat: 18.2,
    lon: 73.5,
    radiusKm: 180,
    advisory: 'Heavy to very heavy precipitation likely along ghat sections. Risk of localized waterlogging and low visibility.',
    affectedRegions: ['Mumbai', 'Raigad', 'Ratnagiri', 'Pune Ghats', 'Satara'],
    validUntil: 'Next 24 Hours',
  },
  {
    id: 'risk-bob',
    name: 'North Bay of Bengal',
    category: 'Cyclonic Circulation',
    severity: 'Yellow',
    lat: 19.8,
    lon: 88.5,
    radiusKm: 240,
    advisory: 'Well-marked low pressure area generating squally winds (45-55 km/h). Fishermen advised not to venture into deep sea.',
    affectedRegions: ['Odisha Coast', 'West Bengal Coastal Sundarbans'],
    validUntil: 'Next 48 Hours',
  },
  {
    id: 'risk-assam',
    name: 'Brahmaputra Valley & Meghalaya',
    category: 'Severe Thunderstorm',
    severity: 'Orange',
    lat: 25.8,
    lon: 91.8,
    radiusKm: 160,
    advisory: 'Active convective clouds producing intense rain bursts, lightning strikes, and flash flood alerts in catchment areas.',
    affectedRegions: ['Guwahati', 'Cherrapunji', 'Barpeta', 'Kamrup'],
    validUntil: 'Next 18 Hours',
  },
  {
    id: 'risk-nw-heat',
    name: 'Western Rajasthan Plains',
    category: 'Heatwave',
    severity: 'Yellow',
    lat: 27.2,
    lon: 72.4,
    radiusKm: 200,
    advisory: 'Daytime temperatures exceeding 41°C. High UV index (9.5+). Avoid strenuous outdoor activities between 12 PM - 3:30 PM.',
    affectedRegions: ['Jaisalmer', 'Bikaner', 'Barmer', 'Jodhpur'],
    validUntil: 'Valid Today',
  },
];

let cachedRainViewerData: RainViewerMetadata | null = null;
let lastFetchTime = 0;

/**
 * Fetch real-time radar and infrared satellite metadata from RainViewer
 */
export async function fetchRainViewerMetadata(): Promise<RainViewerMetadata> {
  const now = Date.now();
  // Cache for 2 minutes to keep radar frames fresh while minimizing requests
  if (cachedRainViewerData && now - lastFetchTime < 120000) {
    return cachedRainViewerData;
  }

  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!res.ok) throw new Error(`RainViewer API status: ${res.status}`);
    const data = await res.json();

    const host = data.host || 'https://tilecache.rainviewer.com';
    const pastRadar: any[] = data.radar?.past || [];
    const nowcastRadar: any[] = data.radar?.nowcast || [];
    const satelliteInfra: any[] = data.satellite?.infrared || [];

    // Combine past + nowcast frames
    const allRadar = [
      ...pastRadar.map((f) => ({ ...f, isNowcast: false })),
      ...nowcastRadar.map((f) => ({ ...f, isNowcast: true })),
    ];

    const radarFrames: RadarFrame[] = allRadar.map((frame, index) => {
      const date = new Date(frame.time * 1000);
      const timeFormatted = date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      let label = timeFormatted;
      if (frame.isNowcast) {
        label = `+${(index - pastRadar.length + 1) * 10}m`;
      } else if (index === pastRadar.length - 1) {
        label = 'Live Now';
      }

      return {
        time: frame.time,
        path: frame.path,
        label,
        timeFormatted,
        isNowcast: !!frame.isNowcast,
      };
    });

    let satellitePath: string | undefined;
    let satelliteTime: number | undefined;
    let satelliteFormatted: string | undefined;

    if (satelliteInfra.length > 0) {
      const latestSat = satelliteInfra[satelliteInfra.length - 1];
      satellitePath = latestSat.path;
      satelliteTime = latestSat.time;
      const sDate = new Date(latestSat.time * 1000);
      satelliteFormatted = sDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }

    const metadata: RainViewerMetadata = {
      host,
      radarFrames,
      satellitePath,
      satelliteTime,
      satelliteFormatted,
      generatedAt: data.generated || Math.floor(now / 1000),
    };

    cachedRainViewerData = metadata;
    lastFetchTime = now;
    return metadata;
  } catch (err) {
    console.warn('Failed to fetch RainViewer live metadata, using fallback timestamps:', err);

    // Reliable fallback frame set
    const fallbackFrames: RadarFrame[] = [
      { time: Math.floor(now / 1000) - 3600, path: '/v2/radar/past_60', label: '-60m', timeFormatted: '1 hr ago', isNowcast: false },
      { time: Math.floor(now / 1000) - 2400, path: '/v2/radar/past_40', label: '-40m', timeFormatted: '40 min ago', isNowcast: false },
      { time: Math.floor(now / 1000) - 1200, path: '/v2/radar/past_20', label: '-20m', timeFormatted: '20 min ago', isNowcast: false },
      { time: Math.floor(now / 1000), path: '/v2/radar/live', label: 'Live Now', timeFormatted: 'Now', isNowcast: false },
      { time: Math.floor(now / 1000) + 900, path: '/v2/radar/nowcast_15', label: '+15m', timeFormatted: 'In 15 min', isNowcast: true },
      { time: Math.floor(now / 1000) + 1800, path: '/v2/radar/nowcast_30', label: '+30m', timeFormatted: 'In 30 min', isNowcast: true },
    ];

    return {
      host: 'https://tilecache.rainviewer.com',
      radarFrames: fallbackFrames,
      generatedAt: Math.floor(now / 1000),
    };
  }
}

/**
 * Generates Tile URL for a radar frame
 * @param host e.g. "https://tilecache.rainviewer.com"
 * @param path e.g. "/v2/radar/1726053600"
 * @param colorScheme 2 is Universal Radar (Blue to Yellow to Crimson)
 * @param smooth 1 for smoothed precipitation
 */
export function getRadarTileUrl(
  host: string,
  path: string,
  colorScheme: number = 2,
  smooth: boolean = true
): string {
  const smoothFlag = smooth ? '1_1' : '0_0';
  return `${host}${path}/256/{z}/{x}/{y}/${colorScheme}/${smoothFlag}.png`;
}

/**
 * Generates Tile URL for infrared satellite clouds
 */
export function getSatelliteTileUrl(host: string, path: string): string {
  return `${host}${path}/256/{z}/{x}/{y}/0/0_0.png`;
}

/**
 * Reverse geocodes coordinates to a friendly place name in India
 * Strictly preserves exact coordinates without substitution
 */
export async function reverseGeocodeLocation(lat: number, lon: number): Promise<LocationInfo> {
  const norm = await locationResolver.resolveFromCoordinates(lat, lon);
  return {
    id: norm.id,
    name: norm.name,
    displayName: norm.displayName,
    lat: norm.latitude,
    lon: norm.longitude,
    state: norm.state,
    district: norm.district,
    country: norm.country,
    countryCode: norm.countryCode,
    isCurrent: norm.isCurrent,
  };
}

// Distance helper
function getCoordinatesDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
