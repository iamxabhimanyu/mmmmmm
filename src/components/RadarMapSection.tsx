import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import {
  Play,
  Pause,
  RotateCcw,
  Layers,
  MapPin,
  Search,
  Crosshair,
  ZoomIn,
  ZoomOut,
  Info,
  CloudRain,
  Cloud,
  Thermometer,
  Wind,
  ShieldAlert,
  Radio,
  X,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Loader2,
  Check,
  Compass,
  Globe,
  Waves,
  Droplets,
} from 'lucide-react';
import { LocationInfo, CurrentWeather, WeatherAlert } from '../types';
import { NormalizedMarine, NormalizedFloodRisk } from '../services/providers/providerTypes';
import { searchIndianLocations, fetchLiveWeatherData } from '../services/weatherService';
import {
  fetchRainViewerMetadata,
  getRadarTileUrl,
  getSatelliteTileUrl,
  RainViewerMetadata,
  RadarFrame,
  REGIONAL_OBSERVATION_STATIONS,
  SEVERE_WEATHER_RISK_ZONES,
  IMD_DWR_CONFIG,
  reverseGeocodeLocation,
  SevereWeatherRiskZone,
} from '../services/radarTileService';
import { IMD_RADAR_STATIONS } from '../data/constants';

export type MapLayerType =
  | 'radar'
  | 'satellite'
  | 'nasa-gibs'
  | 'temp'
  | 'wind'
  | 'marine'
  | 'flood'
  | 'risk'
  | 'stations';

interface RadarMapSectionProps {
  location: LocationInfo;
  onSelectLocation?: (newLocation: LocationInfo) => void;
  onNavigateToForecast?: () => void;
  temperatureUnit?: 'C' | 'F';
  marine?: NormalizedMarine;
  flood?: NormalizedFloodRisk;
  alerts?: WeatherAlert[];
  currentWeather?: CurrentWeather;
}

interface TappedWeatherInfo {
  location: LocationInfo;
  weather: CurrentWeather;
  isLoading: boolean;
}

export const RadarMapSection: React.FC<RadarMapSectionProps> = ({
  location,
  onSelectLocation,
  onNavigateToForecast,
  temperatureUnit = 'C',
  marine,
  flood,
  alerts,
  currentWeather,
}) => {
  // Layer & Map state
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('radar');

  // RainViewer Radar & Satellite state
  const [rainViewerData, setRainViewerData] = useState<RainViewerMetadata | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1000); // ms per frame
  const [isTileLoading, setIsTileLoading] = useState<boolean>(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Tapped Location & Selected Radar Station State
  const [tappedPoint, setTappedPoint] = useState<TappedWeatherInfo | null>(null);
  const [selectedRiskZone, setSelectedRiskZone] = useState<SevereWeatherRiskZone | null>(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  // DOM & Map references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer references
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const weatherTileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const tapMarkerRef = useRef<L.Marker | null>(null);

  // 1. Fetch RainViewer Live Metadata
  useEffect(() => {
    let isMounted = true;
    fetchRainViewerMetadata().then((meta) => {
      if (!isMounted) return;
      setRainViewerData(meta);
      if (meta.radarFrames.length > 0) {
        // Set default to latest historical frame (or nowcast)
        const nowIndex = meta.radarFrames.findIndex((f) => f.label === 'Live Now');
        setCurrentFrameIndex(nowIndex !== -1 ? nowIndex : meta.radarFrames.length - 1);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Initialize Leaflet Map Instance
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [location.lat, location.lon],
        zoom: 7,
        minZoom: 4,
        maxZoom: 16,
        zoomControl: false,
        attributionControl: true,
        fadeAnimation: true,
      });

      // Standard OpenStreetMap base raster tile layer
      const baseLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      baseTileLayerRef.current = baseLayer;

      // Group for weather vector overlays (stations, risk zones, wind)
      const overlayGroup = L.layerGroup().addTo(map);
      overlayGroupRef.current = overlayGroup;

      // User location marker
      const userDotIcon = L.divIcon({
        className: 'user-loc-marker',
        html: `
          <div class="relative flex items-center justify-center w-7 h-7">
            <div class="absolute w-7 h-7 bg-sky-500/25 rounded-full animate-ping"></div>
            <div class="relative w-4 h-4 bg-sky-600 border-2 border-white rounded-full shadow-md flex items-center justify-center">
              <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const userMarker = L.marker([location.lat, location.lon], {
        icon: userDotIcon,
        interactive: true,
        title: location.name,
      }).addTo(map);

      userMarker.bindTooltip(
        `<div class="px-2 py-0.5 text-xs font-semibold text-slate-800">📍 ${location.name} (Active)</div>`,
        { direction: 'top', offset: [0, -10] }
      );

      userMarkerRef.current = userMarker;

      // Map Click Event -> Tap anywhere to inspect live weather
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        handleMapTap(lat, lng);
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update User marker position when prop location changes
  useEffect(() => {
    if (userMarkerRef.current && mapInstanceRef.current) {
      userMarkerRef.current.setLatLng([location.lat, location.lon]);
      userMarkerRef.current.setTooltipContent(
        `<div class="px-2 py-0.5 text-xs font-semibold text-slate-800">📍 ${location.name} (Active)</div>`
      );
    }
  }, [location]);

  // 3. Map Tap Handler: Fetches real weather and displays bottom sheet
  const handleMapTap = useCallback(async (lat: number, lon: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Show temporary pin marker
    if (tapMarkerRef.current) {
      tapMarkerRef.current.setLatLng([lat, lon]);
    } else {
      const tapIcon = L.divIcon({
        className: 'tap-marker',
        html: `
          <div class="relative flex items-center justify-center w-8 h-8">
            <div class="w-8 h-8 bg-rose-500/20 rounded-full animate-ping absolute"></div>
            <div class="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = L.marker([lat, lon], { icon: tapIcon, zIndexOffset: 1000 }).addTo(map);
      tapMarkerRef.current = marker;
    }

    // Set initial loading state
    setTappedPoint({
      location: {
        id: `tap-${lat.toFixed(5)}_${lon.toFixed(5)}`,
        name: 'Analyzing Weather...',
        state: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
        country: 'India',
        lat,
        lon,
      },
      weather: {
        temperature: 0,
        feelsLike: 0,
        conditionCode: 0,
        conditionKey: 'partly-cloudy',
        conditionText: 'Loading real-time conditions...',
        high: 0,
        low: 0,
        humidity: 0,
        windSpeed: 0,
        windDirection: 0,
        windGust: 0,
        pressure: 1012,
        visibility: 10,
        uvIndex: 0,
        dewPoint: 0,
        precipitation24h: 0,
        cloudCover: 0,
        sunrise: '06:00 AM',
        sunset: '06:30 PM',
        isDay: true,
        time: 'Now',
      },
      isLoading: true,
    });

    try {
      const [resolvedLoc, weatherRes] = await Promise.all([
        reverseGeocodeLocation(lat, lon),
        fetchLiveWeatherData(lat, lon),
      ]);

      setTappedPoint({
        location: resolvedLoc,
        weather: weatherRes.current,
        isLoading: false,
      });
    } catch (err) {
      console.warn('Failed to load tapped point weather:', err);
      setTappedPoint((prev) => (prev ? { ...prev, isLoading: false } : null));
    }
  }, []);

  // 4. Update Map Overlays based on activeLayer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // A. Remove existing raster weather tile layer
    if (weatherTileLayerRef.current) {
      map.removeLayer(weatherTileLayerRef.current);
      weatherTileLayerRef.current = null;
    }

    // B. Clear vector overlays
    if (overlayGroupRef.current) {
      overlayGroupRef.current.clearLayers();
    }

    // Layer 1: REAL RAIN RADAR (RainViewer API)
    if (activeLayer === 'radar' && rainViewerData) {
      const frames = rainViewerData.radarFrames;
      if (frames.length > 0) {
        const frame = frames[currentFrameIndex] || frames[frames.length - 1];
        const tileUrl = getRadarTileUrl(rainViewerData.host, frame.path, 2, true);

        const radarTile = L.tileLayer(tileUrl, {
          opacity: 0.75,
          zIndex: 10,
          maxZoom: 16,
        }).addTo(map);

        weatherTileLayerRef.current = radarTile;
      }
    }

    // Layer 2: REAL SATELLITE INFRARED CLOUDS (RainViewer API)
    else if (activeLayer === 'satellite' && rainViewerData && rainViewerData.satellitePath) {
      const satUrl = getSatelliteTileUrl(rainViewerData.host, rainViewerData.satellitePath);
      const satTile = L.tileLayer(satUrl, {
        opacity: 0.65,
        zIndex: 10,
        maxZoom: 16,
      }).addTo(map);

      weatherTileLayerRef.current = satTile;
    }

    // Layer 2B: NASA GIBS SATELLITE (MODIS & VIIRS True Color Open Earth Data)
    else if (activeLayer === 'nasa-gibs') {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 1);
      const dateStr = d.toISOString().slice(0, 10);
      const gibsUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${dateStr}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

      const gibsTile = L.tileLayer(gibsUrl, {
        opacity: 0.85,
        zIndex: 10,
        maxZoom: 9,
      }).addTo(map);

      weatherTileLayerRef.current = gibsTile;
    }

    // Layer 3: TEMPERATURE LAYER (Live active temperature + Regional reference waypoints)
    else if (activeLayer === 'temp' && overlayGroupRef.current) {
      if (currentWeather && typeof currentWeather.temperature === 'number' && Number.isFinite(currentWeather.temperature)) {
        const currentTempVal = temperatureUnit === 'F' ? Math.round((currentWeather.temperature * 9) / 5 + 32) : currentWeather.temperature;
        const currentTempIcon = L.divIcon({
          className: 'current-temp-badge',
          html: `
            <div class="flex items-center gap-1 px-2.5 py-1 rounded-full shadow-lg text-xs font-bold bg-sky-600 text-white border-2 border-white select-none cursor-pointer">
              <span>📍 ${location.name}: ${currentTempVal}°${temperatureUnit}</span>
            </div>
          `,
          iconSize: [130, 28],
          iconAnchor: [65, 14],
        });
        const currentMarker = L.marker([location.lat, location.lon], { icon: currentTempIcon });
        currentMarker.bindTooltip(
          `<div class="p-1 text-xs"><strong>${location.name}</strong><br/>Live Temperature: <strong>${currentTempVal}°${temperatureUnit}</strong></div>`,
          { direction: 'top' }
        );
        overlayGroupRef.current?.addLayer(currentMarker);
      }

      // Regional observation reference stations: Tap to query live data
      REGIONAL_OBSERVATION_STATIONS.forEach((st) => {
        const waypointIcon = L.divIcon({
          className: 'station-waypoint-badge',
          html: `
            <div class="flex items-center gap-1 px-2 py-0.5 rounded-full shadow-xs text-[11px] font-medium bg-white/95 text-slate-700 border border-slate-300 select-none cursor-pointer hover:bg-sky-50 transition-colors">
              <span>📍 ${st.name}</span>
            </div>
          `,
          iconSize: [84, 22],
          iconAnchor: [42, 11],
        });

        const marker = L.marker([st.lat, st.lon], { icon: waypointIcon });
        marker.bindTooltip(
          `<div class="p-1 text-xs">📍 <strong>${st.name}</strong><br/>Reference Station<br/><em>Tap to fetch live observations</em></div>`,
          { direction: 'top' }
        );
        marker.on('click', () => handleMapTap(st.lat, st.lon));
        overlayGroupRef.current?.addLayer(marker);
      });
    }

    // Layer 4: WIND FLOW VECTOR LAYER (Live active wind + Regional reference waypoints)
    else if (activeLayer === 'wind' && overlayGroupRef.current) {
      if (currentWeather && typeof currentWeather.windSpeed === 'number' && Number.isFinite(currentWeather.windSpeed)) {
        const currentWindIcon = L.divIcon({
          className: 'current-wind-badge',
          html: `
            <div class="flex items-center gap-1 px-2.5 py-1 rounded-full shadow-lg text-xs font-bold bg-slate-900 text-sky-200 border-2 border-sky-400 select-none cursor-pointer">
              <span>💨 ${location.name}: ${currentWeather.windSpeed} km/h</span>
            </div>
          `,
          iconSize: [140, 28],
          iconAnchor: [70, 14],
        });
        const currentMarker = L.marker([location.lat, location.lon], { icon: currentWindIcon });
        currentMarker.bindTooltip(
          `<div class="p-1 text-xs"><strong>${location.name}</strong><br/>Live Wind Speed: <strong>${currentWeather.windSpeed} km/h</strong></div>`,
          { direction: 'top' }
        );
        overlayGroupRef.current?.addLayer(currentMarker);
      }

      REGIONAL_OBSERVATION_STATIONS.forEach((st) => {
        const waypointIcon = L.divIcon({
          className: 'wind-waypoint-badge',
          html: `
            <div class="flex items-center gap-1 px-2 py-0.5 rounded-full shadow-xs text-[11px] font-medium bg-slate-900/90 text-sky-200 border border-sky-400/40 select-none cursor-pointer hover:bg-slate-800 transition-colors">
              <span>💨 ${st.name}</span>
            </div>
          `,
          iconSize: [84, 22],
          iconAnchor: [42, 11],
        });

        const marker = L.marker([st.lat, st.lon], { icon: waypointIcon });
        marker.bindTooltip(
          `<div class="p-1 text-xs">💨 <strong>${st.name}</strong><br/>Reference Station<br/><em>Tap to fetch live wind telemetry</em></div>`,
          { direction: 'top' }
        );
        marker.on('click', () => handleMapTap(st.lat, st.lon));
        overlayGroupRef.current?.addLayer(marker);
      });
    }

    // Layer 4B: COASTAL MARINE & WAVE OBSERVATION LAYER (Option A: Live Telemetry Only)
    else if (activeLayer === 'marine' && overlayGroupRef.current) {
      if (marine && marine.isCoastal && !marine.isUnavailable && marine.waveHeight !== undefined) {
        const badgeColor = marine.swimmingSafety === 'Safe' ? 'bg-cyan-700 text-white' : 'bg-amber-600 text-white';
        const marineIcon = L.divIcon({
          className: 'marine-badge',
          html: `
            <div class="flex items-center gap-1 px-2.5 py-1 rounded-full shadow-md text-[11px] font-semibold ${badgeColor} border border-white/60 backdrop-blur-md select-none cursor-pointer">
              <span>🌊 ${marine.waveHeight} m</span>
              <span class="text-[9px] opacity-80 hidden xs:inline">(${marine.seaSurfaceTemperature !== undefined ? marine.seaSurfaceTemperature + '°C' : 'SST N/A'})</span>
            </div>
          `,
          iconSize: [95, 26],
          iconAnchor: [47, 13],
        });

        const marker = L.marker([location.lat, location.lon], { icon: marineIcon });
        marker.bindTooltip(
          `<div class="p-1 text-xs font-semibold">🌊 <strong>${location.name} (Live Marine Telemetry)</strong><br/>Wave Height: ${marine.waveHeight} m<br/>Wave Period: ${marine.wavePeriod !== undefined ? marine.wavePeriod + 's' : 'Unavailable'}<br/>SST: ${marine.seaSurfaceTemperature !== undefined ? marine.seaSurfaceTemperature + '°C' : 'Unavailable'}<br/>Sea State: ${marine.seaStateCategory}<br/>Swimming Safety: ${marine.swimmingSafety}</div>`,
          { direction: 'top' }
        );
        overlayGroupRef.current?.addLayer(marker);
      }
    }

    // Layer 4C: MAUSAM RIVER BASIN FLOOD RISK LAYER (Model-derived runoff)
    else if (activeLayer === 'flood' && overlayGroupRef.current) {
      if (flood && !flood.isUnavailable && flood.riskLevel !== 'Unavailable') {
        const floodColor = flood.riskLevel === 'High' ? '#e11d48' : flood.riskLevel === 'Moderate' ? '#f59e0b' : '#10b981';
        const floodIcon = L.divIcon({
          className: 'flood-basin-badge',
          html: `
            <div class="flex items-center gap-1 px-2.5 py-1 rounded-full shadow-md text-[11px] font-semibold text-white border border-white/60 select-none cursor-pointer" style="background-color: ${floodColor};">
              <span>💧 ${location.name.split(' ')[0]}</span>
              <span class="text-[9px] opacity-90">${flood.riskLevel}</span>
            </div>
          `,
          iconSize: [95, 26],
          iconAnchor: [47, 13],
        });

        const marker = L.marker([location.lat, location.lon], { icon: floodIcon });
        marker.bindTooltip(
          `<div class="p-1 text-xs">💧 <strong>${location.name} (Hydrological Model)</strong><br/>Catchment: ${flood.basinName}<br/>3-Day Rain: ${flood.catchmentRainfall3DayMm !== undefined ? flood.catchmentRainfall3DayMm + ' mm' : 'Unavailable'}<br/>Discharge: ${flood.riverDischargeM3s !== undefined ? '~' + flood.riverDischargeM3s + ' m³/s' : 'Unavailable (sensor offline)'}<br/>Flood Risk: <strong>${flood.riskLevel}</strong></div>`,
          { direction: 'top' }
        );
        overlayGroupRef.current?.addLayer(marker);
      }
    }

    // Layer 5: SEVERE WEATHER ALERT & HIGH-RISK ZONES
    else if (activeLayer === 'risk' && overlayGroupRef.current) {
      if (alerts && alerts.length > 0) {
        const maxSeverity = alerts.some((a) => a.severity === 'Severe')
          ? 'Red'
          : alerts.some((a) => a.severity === 'Moderate')
          ? 'Orange'
          : 'Yellow';
        const color = maxSeverity === 'Red' ? '#e11d48' : maxSeverity === 'Orange' ? '#ea580c' : '#ca8a04';

        const activeCircle = L.circle([location.lat, location.lon], {
          radius: 40000,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.2,
          dashArray: '5, 8',
        });
        activeCircle.bindTooltip(
          `<div class="p-1 text-xs"><strong>${alerts[0].event}</strong><br/>Severity: ${alerts[0].severity}<br/>${alerts[0].headline}</div>`,
          { direction: 'top' }
        );
        overlayGroupRef.current?.addLayer(activeCircle);
      }

      // Climatological Severe Weather Reference Watch Zones
      SEVERE_WEATHER_RISK_ZONES.forEach((zone) => {
        const color =
          zone.severity === 'Red' ? '#e11d48' : zone.severity === 'Orange' ? '#ea580c' : '#ca8a04';

        const circle = L.circle([zone.lat, zone.lon], {
          radius: zone.radiusKm * 1000,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.14,
          dashArray: '5, 8',
        });

        circle.bindTooltip(
          `
            <div class="p-1 text-xs">
              <span class="font-bold text-slate-900 block">⚠️ ${zone.name}</span>
              <span class="text-rose-700 font-semibold text-[10px]">${zone.category} • ${zone.severity} Climatological Watch</span>
              <span class="text-slate-600 block text-[10px] mt-0.5">${zone.validUntil}</span>
            </div>
          `,
          { direction: 'top', className: 'risk-tooltip' }
        );

        circle.on('click', () => setSelectedRiskZone(zone));
        overlayGroupRef.current?.addLayer(circle);

        // Center warning icon badge
        const alertIcon = L.divIcon({
          className: 'alert-zone-icon',
          html: `
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white animate-bounce cursor-pointer" style="background-color: ${color};">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const alertMarker = L.marker([zone.lat, zone.lon], { icon: alertIcon });
        alertMarker.on('click', () => setSelectedRiskZone(zone));
        overlayGroupRef.current?.addLayer(alertMarker);
      });
    }

    // Layer 6: IMD DOPPLER RADAR (DWR) NETWORK & RANGES
    else if (activeLayer === 'stations' && overlayGroupRef.current) {
      IMD_RADAR_STATIONS.forEach((station) => {
        // Operational 250km radar range circle
        const rangeCircle = L.circle([station.lat, station.lon], {
          radius: (station.rangeKm || 250) * 1000,
          color: '#0284c7',
          weight: 1.5,
          dashArray: '4, 6',
          fillColor: '#38bdf8',
          fillOpacity: 0.06,
        });

        // Radar dish icon marker
        const radarIcon = L.divIcon({
          className: 'radar-station-icon',
          html: `
            <div class="flex items-center gap-1 bg-white/95 text-slate-800 px-2 py-0.5 rounded-full shadow-md border border-sky-400 text-[10px] font-bold cursor-pointer hover:bg-sky-50 transition-colors">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>${station.name} (${station.type})</span>
            </div>
          `,
          iconSize: [110, 24],
          iconAnchor: [55, 12],
        });

        const marker = L.marker([station.lat, station.lon], { icon: radarIcon });
        marker.on('click', () => {
          map.flyTo([station.lat, station.lon], 8, { duration: 1.2 });
          handleMapTap(station.lat, station.lon);
        });

        overlayGroupRef.current?.addLayer(rangeCircle);
        overlayGroupRef.current?.addLayer(marker);
      });
    }
  }, [
    activeLayer,
    currentFrameIndex,
    rainViewerData,
    temperatureUnit,
    handleMapTap,
    marine,
    flood,
    alerts,
    currentWeather,
    location,
  ]);

  // 5. Radar Animation Loop when Playing
  useEffect(() => {
    let timer: any = null;
    if (isPlaying && rainViewerData && rainViewerData.radarFrames.length > 0) {
      timer = setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % rainViewerData.radarFrames.length);
      }, playbackSpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, rainViewerData, playbackSpeed]);

  // 6. Search Locations handler
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchIndianLocations(q);
      setSearchResults(results.slice(0, 6));
    } catch (err) {
      console.warn('Map location search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchedLocation = (loc: LocationInfo) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([loc.lat, loc.lon], 9, { duration: 1.2 });
    }
    handleMapTap(loc.lat, loc.lon);
  };

  // Re-center on user's current location
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([location.lat, location.lon], 8, { duration: 1.2 });
    }
  };

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  const currentFrame =
    rainViewerData && rainViewerData.radarFrames.length > 0
      ? rainViewerData.radarFrames[currentFrameIndex]
      : null;

  return (
    <section className="w-full max-w-2xl mx-auto px-2 sm:px-4 my-2">
      <div className="bg-white/90 backdrop-blur-md rounded-3xl p-3 sm:p-4 border border-black/[0.05] shadow-xs flex flex-col">
        {/* Module Header & Search Trigger */}
        <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>Interactive Weather Map & Radar</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Live Doppler radar, satellite clouds, regional isotherms & severe risk zones
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Search Toggle Button */}
            <button
              id="map-search-toggle-btn"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="min-h-[38px] px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors touch-manipulation active:scale-95"
              aria-label="Search map location"
            >
              <Search className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden xs:inline">Search</span>
            </button>

            {/* Info / IMD DWR Attribution Toggle */}
            <button
              id="map-info-toggle-btn"
              onClick={() => setIsInfoExpanded(!isInfoExpanded)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors touch-manipulation active:scale-95"
              title="Provider & Methodology details"
              aria-label="Provider details"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Provider & IMD Source Architecture Notice */}
        {isInfoExpanded && (
          <div className="mb-3 p-3 bg-sky-50/90 border border-sky-100 rounded-2xl text-xs text-slate-700 space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-sky-900">
                <Radio className="w-4 h-4 text-sky-600" />
                <span>Radar & Weather Data Architecture</span>
              </div>
              <button
                onClick={() => setIsInfoExpanded(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="leading-relaxed">
              • <strong>Precipitation Radar & Satellite:</strong> Powered by RainViewer real-time Doppler radar tile feeds and infrared cloud composites with actual UTC timestamps.
            </p>
            <p className="leading-relaxed">
              • <strong>IMD Doppler Radar Network:</strong> IMD S-Band, C-Band, and X-Band Doppler Weather Radar (DWR) stations (Colaba, Delhi, Chennai, Kolkata, etc.) are mapped with their 250km operational envelopes. Ready to receive official IMD DWR raster layers when authenticated API feeds are available.
            </p>
          </div>
        )}

        {/* In-Map Search Input Overlay */}
        {isSearchOpen && (
          <div className="mb-3 relative z-30">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 shadow-sm">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                id="map-location-search-input"
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search Indian city, district, or town..."
                className="w-full bg-transparent text-xs text-slate-800 focus:outline-none placeholder:text-slate-400 py-1"
                autoFocus
              />
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
              ) : searchQuery ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Search Suggestions Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 z-40 max-h-56 overflow-y-auto">
                {searchResults.map((res) => (
                  <button
                    key={`${res.lat}-${res.lon}`}
                    onClick={() => handleSelectSearchedLocation(res)}
                    className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-sky-50 flex items-center justify-between transition-colors touch-manipulation"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 block">{res.name}</span>
                      <span className="text-[11px] text-slate-500">
                        {res.state}, {res.country}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Weather Layer Switcher Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2 mb-2 select-none touch-pan-x">
          <button
            id="map-layer-tab-radar"
            onClick={() => setActiveLayer('radar')}
            className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all touch-manipulation active:scale-95 ${
              activeLayer === 'radar'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span>Rain Radar</span>
          </button>

          <button
            id="map-layer-tab-satellite"
            onClick={() => setActiveLayer('satellite')}
            className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all touch-manipulation active:scale-95 ${
              activeLayer === 'satellite'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Satellite Clouds</span>
          </button>

          <button
            id="map-layer-tab-nasa-gibs"
            onClick={() => setActiveLayer('nasa-gibs')}
            className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all touch-manipulation active:scale-95 ${
              activeLayer === 'nasa-gibs'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>NASA Earth</span>
          </button>

          <button
            id="map-layer-tab-temp"
            onClick={() => setActiveLayer('temp')}
            className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all touch-manipulation active:scale-95 ${
              activeLayer === 'temp'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            <span>Temperature</span>
          </button>

          <button
            id="map-layer-tab-wind"
            onClick={() => setActiveLayer('wind')}
            className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all touch-manipulation active:scale-95 ${
              activeLayer === 'wind'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>Wind Flow</span>
          </button>

          <button
            id="map-layer-tab-marine"
            onClick={() => setActiveLayer('marine')}
            className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all touch-manipulation active:scale-95 ${
              activeLayer === 'marine'
                ? 'bg-cyan-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>Coastal Waves</span>
          </button>

          <button
            id="map-layer-tab-flood"
            onClick={() => setActiveLayer('flood')}
            className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all touch-manipulation active:scale-95 ${
              activeLayer === 'flood'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>River Flood</span>
          </button>

          <button
            id="map-layer-tab-risk"
            onClick={() => setActiveLayer('risk')}
            className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all touch-manipulation active:scale-95 ${
              activeLayer === 'risk'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Severe Risk</span>
          </button>

          <button
            id="map-layer-tab-stations"
            onClick={() => setActiveLayer('stations')}
            className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all touch-manipulation active:scale-95 ${
              activeLayer === 'stations'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>IMD Radars</span>
          </button>
        </div>

        {/* Layer Contextual Status Banner */}
        {activeLayer === 'marine' && (
          <div className="mb-2 px-3 py-1.5 rounded-xl text-xs bg-sky-50 text-sky-900 border border-sky-200 flex items-center gap-2">
            <Waves className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>
              {marine && marine.isCoastal && !marine.isUnavailable && marine.waveHeight !== undefined
                ? `Coastal Marine Telemetry: Live Open-Meteo marine observations for ${location.name}. Regional ocean buoy raster grid is currently unavailable (requires INCOIS buoy telemetry integration). Tap any coastal area on the map to query live coastal telemetry.`
                : `Coastal Marine Observations Unavailable: ${location.name} is inland or oceanographic buoy telemetry is not connected. Tap any coastal location on the map to query live marine telemetry.`}
            </span>
          </div>
        )}
        {activeLayer === 'flood' && (
          <div className="mb-2 px-3 py-1.5 rounded-xl text-xs bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-2">
            <Droplets className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              {flood && !flood.isUnavailable && flood.riskLevel !== 'Unavailable'
                ? `River Basin Hydrological Model: Displaying calculated catchment runoff for ${location.name}. Live regional river gauge telemetry is unavailable (requires Central Water Commission CWC telemetry). Tap any river basin to calculate catchment runoff.`
                : `River Basin Hydrological Data: Streamflow telemetry is unavailable for this sector. Tap any river basin on the map to evaluate catchment runoff.`}
            </span>
          </div>
        )}
        {activeLayer === 'temp' && (
          <div className="mb-2 px-3 py-1.5 rounded-xl text-xs bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-2">
            <Thermometer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              Regional Temperature Stations: Reference station waypoints shown. Tap any station or point on the map to query live meteorological telemetry.
            </span>
          </div>
        )}
        {activeLayer === 'wind' && (
          <div className="mb-2 px-3 py-1.5 rounded-xl text-xs bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-2">
            <Wind className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              Surface Wind Vectors: Reference station waypoints shown. Tap any station or point on the map to query live wind speed and gust observations.
            </span>
          </div>
        )}
        {activeLayer === 'risk' && (
          <div className="mb-2 px-3 py-1.5 rounded-xl text-xs bg-rose-50 text-rose-900 border border-rose-200 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>
              {alerts && alerts.length > 0
                ? `Active Severe Weather Alerts: Displaying ${alerts.length} active severe weather advisory for ${location.name}.`
                : `Severe Weather Surveillance: No active severe weather warnings detected for ${location.name} in current numerical model run. Tap any region to inspect local convective and thermal risk.`}
            </span>
          </div>
        )}

        {/* Map Canvas Viewport with Touch-Friendly Floating Controls */}
        <div className="relative w-full h-[52vh] sm:h-[62vh] min-h-[390px] rounded-2xl overflow-hidden border border-slate-200/80 shadow-inner">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Floating Right Control Cluster: Zoom In/Out, Re-center, Base Map Toggle */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 bg-white/90 backdrop-blur-md rounded-2xl p-1 shadow-md border border-slate-200/70">
            <button
              id="map-zoom-in-btn"
              onClick={handleZoomIn}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 text-slate-700 active:scale-95 transition-all touch-manipulation"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              id="map-zoom-out-btn"
              onClick={handleZoomOut}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 text-slate-700 active:scale-95 transition-all touch-manipulation"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-6 h-px bg-slate-200 mx-auto my-0.5" />
            <button
              id="map-recenter-btn"
              onClick={handleRecenter}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-sky-50 active:bg-sky-100 text-sky-600 active:scale-95 transition-all touch-manipulation"
              title="Center on Current Location"
              aria-label="Center on Current Location"
            >
              <Crosshair className="w-4 h-4" />
            </button>
            <button
              id="map-base-style-toggle-btn"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.panTo([location.lat, location.lon]);
                }
              }}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 text-slate-700 active:scale-95 transition-all touch-manipulation text-[10px] font-bold"
              title="Basemap: OpenStreetMap"
              aria-label="Basemap: OpenStreetMap"
            >
              <Layers className="w-4 h-4 text-emerald-600" />
            </button>
          </div>

          {/* Floating Tap-Anywhere Hint (Auto-fades) */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none bg-slate-900/70 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[10px] font-medium flex items-center gap-1 shadow-sm">
            <span>👆 Tap anywhere on map for live weather</span>
          </div>

          {/* Floating Timestamp Badge when in Radar or Satellite Mode */}
          {(activeLayer === 'radar' || activeLayer === 'satellite') && (
            <div className="absolute bottom-8 left-3 z-10 bg-slate-900/85 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-medium px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  currentFrame?.isNowcast ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <span className="truncate max-w-[130px] sm:max-w-none">
                {activeLayer === 'radar'
                  ? currentFrame?.label || 'Live Radar'
                  : `INSAT / Sat: ${rainViewerData?.satelliteFormatted || 'Live'}`}
              </span>
            </div>
          )}

          {/* Color Scale Legend */}
          {activeLayer === 'radar' && (
            <div className="absolute bottom-8 right-3 z-10 bg-white/90 backdrop-blur-md px-2 py-1 rounded-full shadow-sm border border-slate-200 text-[9px] sm:text-[10px] font-medium text-slate-600 flex items-center gap-1 sm:gap-1.5">
              <span className="hidden xs:inline">Light</span>
              <div className="w-12 sm:w-16 h-1.5 sm:h-2 rounded-full bg-gradient-to-r from-sky-300 via-emerald-400 via-amber-400 to-rose-600" />
              <span className="hidden xs:inline">Severe</span>
            </div>
          )}

          {activeLayer === 'temp' && (
            <div className="absolute bottom-8 right-3 z-10 bg-white/90 backdrop-blur-md px-2 py-1 rounded-full shadow-sm border border-slate-200 text-[9px] sm:text-[10px] font-medium text-slate-600 flex items-center gap-1 sm:gap-1.5">
              <span>Cool</span>
              <div className="w-12 sm:w-16 h-1.5 sm:h-2 rounded-full bg-gradient-to-r from-blue-500 via-emerald-500 via-amber-500 to-rose-600" />
              <span>Hot</span>
            </div>
          )}
        </div>

        {/* Tapped Location Weather Card (Slide up from map tap) */}
        {tappedPoint && (
          <div className="mt-3 p-3.5 bg-gradient-to-r from-sky-50/90 to-slate-50/90 rounded-2xl border border-sky-100 shadow-xs relative animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              id="tapped-location-close-btn"
              onClick={() => setTappedPoint(null)}
              className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              aria-label="Close weather card"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start justify-between gap-3 pr-8">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {tappedPoint.location.name}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 ml-5 truncate">
                  {tappedPoint.location.state} • {tappedPoint.location.lat.toFixed(2)}°N,{' '}
                  {tappedPoint.location.lon.toFixed(2)}°E
                </p>
              </div>

              {!tappedPoint.isLoading && (
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold text-slate-900 tracking-tight">
                    {temperatureUnit === 'F'
                      ? Math.round((tappedPoint.weather.temperature * 9) / 5 + 32)
                      : Math.round(tappedPoint.weather.temperature)}
                    °{temperatureUnit}
                  </div>
                  <div className="text-[10px] font-medium text-slate-600">
                    {tappedPoint.weather.conditionText}
                  </div>
                </div>
              )}
            </div>

            {tappedPoint.isLoading ? (
              <div className="flex items-center gap-2 py-3 text-xs text-sky-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Fetching live meteorological readings from Open-Meteo...</span>
              </div>
            ) : (
              <>
                {/* Metrics Pill Grid */}
                <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-sky-100/80 text-center">
                  <div className="bg-white/80 rounded-xl p-1.5 border border-black/[0.04]">
                    <span className="text-[10px] text-slate-500 block">Cloud Cover</span>
                    <span className="text-xs font-bold text-sky-700">
                      {typeof tappedPoint.weather.cloudCover === 'number'
                        ? `${tappedPoint.weather.cloudCover}%`
                        : 'Unavailable'}
                    </span>
                  </div>
                  <div className="bg-white/80 rounded-xl p-1.5 border border-black/[0.04]">
                    <span className="text-[10px] text-slate-500 block">Wind Speed</span>
                    <span className="text-xs font-bold text-slate-800">
                      {tappedPoint.weather.windSpeed} km/h
                    </span>
                  </div>
                  <div className="bg-white/80 rounded-xl p-1.5 border border-black/[0.04]">
                    <span className="text-[10px] text-slate-500 block">Humidity</span>
                    <span className="text-xs font-bold text-slate-800">
                      {tappedPoint.weather.humidity}%
                    </span>
                  </div>
                </div>

                {/* Actions: Set as Active City & View Forecast */}
                <div className="flex items-center gap-2 mt-2.5">
                  {onSelectLocation && (
                    <button
                      id="tapped-set-as-active-btn"
                      onClick={() => {
                        onSelectLocation(tappedPoint.location);
                        setTappedPoint(null);
                      }}
                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all touch-manipulation active:scale-95 flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Set as Active City</span>
                    </button>
                  )}

                  {onNavigateToForecast && (
                    <button
                      id="tapped-view-forecast-btn"
                      onClick={() => {
                        if (onSelectLocation) onSelectLocation(tappedPoint.location);
                        onNavigateToForecast();
                      }}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-semibold transition-all touch-manipulation active:scale-95 flex items-center gap-1"
                    >
                      <span>10-Day Forecast</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Selected Severe Weather Risk Zone Card */}
        {selectedRiskZone && (
          <div className="mt-3 p-3.5 bg-rose-50/90 rounded-2xl border border-rose-200 shadow-xs relative animate-in fade-in duration-150">
            <button
              onClick={() => setSelectedRiskZone(null)}
              className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-700 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 font-bold text-rose-800 text-sm">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>{selectedRiskZone.name} Alert</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                {selectedRiskZone.severity}
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
              {selectedRiskZone.advisory}
            </p>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
              <span>Regions: {selectedRiskZone.affectedRegions.join(', ')}</span>
              <span>•</span>
              <span>{selectedRiskZone.validUntil}</span>
            </div>
          </div>
        )}

        {/* Radar Animation Controls & Timeline Scrubber (Active when layer is radar) */}
        {activeLayer === 'radar' && rainViewerData && rainViewerData.radarFrames.length > 0 && (
          <div className="mt-3 bg-slate-50 p-2 sm:p-2.5 rounded-2xl border border-slate-200/60">
            <div className="flex items-center gap-2">
              {/* Play / Pause Button */}
              <button
                id="radar-playback-toggle-btn"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all shadow-xs shrink-0 touch-manipulation"
                title={isPlaying ? 'Pause Radar Loop' : 'Play Radar Loop'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              {/* Interactive Timeline Scrubber Slider */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1 px-0.5">
                  <span>{rainViewerData.radarFrames[0]?.label || '-2h'}</span>
                  <span className="text-sky-700 font-bold">
                    {currentFrame?.label || 'Now'} ({currentFrameIndex + 1}/
                    {rainViewerData.radarFrames.length})
                  </span>
                  <span>
                    {rainViewerData.radarFrames[rainViewerData.radarFrames.length - 1]?.label ||
                      'Nowcast'}
                  </span>
                </div>
                <input
                  id="radar-timeline-scrubber"
                  type="range"
                  min={0}
                  max={rainViewerData.radarFrames.length - 1}
                  value={currentFrameIndex}
                  onChange={(e) => {
                    setCurrentFrameIndex(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer touch-manipulation"
                />
              </div>

              {/* Reset to Latest Live Now Frame */}
              <button
                id="radar-reset-to-live-btn"
                onClick={() => {
                  const nowIndex = rainViewerData.radarFrames.findIndex(
                    (f) => f.label === 'Live Now'
                  );
                  setCurrentFrameIndex(
                    nowIndex !== -1 ? nowIndex : rainViewerData.radarFrames.length - 1
                  );
                  setIsPlaying(false);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/70 active:bg-slate-200 transition-colors shrink-0 touch-manipulation active:scale-95"
                title="Jump to Live Now"
                aria-label="Jump to Live Now"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
