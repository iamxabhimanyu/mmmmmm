import React from 'react';
import { History, TrendingUp, TrendingDown, Thermometer, CloudRain, Info } from 'lucide-react';
import { NormalizedHistorical } from '../services/providers/providerTypes';

interface MausamHistoricalClimateCardProps {
  historical: NormalizedHistorical;
}

export const MausamHistoricalClimateCard: React.FC<MausamHistoricalClimateCardProps> = ({
  historical,
}) => {
  if (
    historical.isUnavailable === true ||
    historical.source?.providerId === 'unavailable' ||
    !historical.dataPoints ||
    historical.dataPoints.length === 0
  ) {
    return (
      <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-100 text-purple-800 shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                Copernicus ERA5 Climate History
              </h3>
              <p className="text-[11px] text-slate-400">
                Open-Meteo Archive API Reanalysis
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
            Unavailable
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {historical.summary || 'Historical climate reanalysis data is temporarily unavailable for this station.'}
        </p>
      </div>
    );
  }

  const isWarming = historical.climateTrend === 'Warming';
  const isCooling = historical.climateTrend === 'Cooling';

  return (
    <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-purple-100 text-purple-800 shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
              Copernicus ERA5 Climate History
            </h3>
            <p className="text-[11px] text-slate-400">
              Open-Meteo Archive API Reanalysis
            </p>
          </div>
        </div>

        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
            isWarming
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : isCooling
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-slate-100 text-slate-800 border-slate-200'
          }`}
        >
          {historical.climateTrend === 'Unavailable' || historical.climateTrend === 'Trend unavailable' || !historical.climateTrend
            ? 'Trend Unavailable'
            : typeof historical.tempAnomaly === 'number'
            ? `${historical.climateTrend} Trend (${historical.tempAnomaly >= 0 ? '+' : ''}${historical.tempAnomaly}°C)`
            : `${historical.climateTrend} Trend`}
        </span>
      </div>

      <p className="text-xs text-slate-700 leading-relaxed mb-3">
        {historical.summary}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-2">
        <div className="p-2.5 rounded-2xl bg-purple-50/60 border border-purple-100/60">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-purple-500" /> Mean Annual Temp
          </span>
          <span className="text-base font-semibold text-purple-950 block mt-0.5">
            {typeof historical.meanTemperature === 'number' ? `${historical.meanTemperature}°C` : 'Unavailable'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {typeof historical.tempAnomaly === 'number'
              ? `Anomaly: ${historical.tempAnomaly >= 0 ? '+' : ''}${historical.tempAnomaly}°C`
              : 'Anomaly: Unavailable'}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-indigo-50/60 border border-indigo-100/60">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <CloudRain className="w-3 h-3 text-indigo-500" /> Total Rainfall
          </span>
          <span className="text-base font-semibold text-indigo-950 block mt-0.5">
            {typeof historical.precipitationTotal === 'number' ? `${historical.precipitationTotal} mm` : 'Unavailable'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {typeof historical.precipAnomalyPercent === 'number'
              ? `Anomaly: ${historical.precipAnomalyPercent >= 0 ? '+' : ''}${historical.precipAnomalyPercent}%`
              : 'Anomaly: Unavailable'}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-400 block">Archive Source</span>
          <span className="text-sm font-semibold text-slate-800 block mt-0.5 truncate">
            {historical.periodLabel || 'ERA5 Archive'}
          </span>
          <span className="text-[10px] text-slate-500 block">Baseline not configured</span>
        </div>
      </div>

      {/* Seasonal breakdown bars */}
      <div className="mt-3 space-y-1.5">
        <span className="text-[11px] font-semibold text-slate-600 block">Seasonal Samples:</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {historical.dataPoints.map((pt, idx) => (
            <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-100/80 text-center">
              <span className="text-[10px] text-slate-500 block truncate">{pt.date}</span>
              <span className="text-xs font-semibold text-slate-800 block mt-0.5">{pt.temp}°C</span>
              <span className="text-[10px] text-sky-600">{pt.precipitation} mm</span>
            </div>
          ))}
        </div>
      </div>

      {/* Attribution */}
      <div className="mt-3 flex items-start gap-1.5 p-2 rounded-xl bg-slate-50 text-[10px] text-slate-500 border border-slate-100">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          <strong>Data Attribution & Notice:</strong> {historical.source.attributionText}.
        </span>
      </div>
    </div>
  );
};
