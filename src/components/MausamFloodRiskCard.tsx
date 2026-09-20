import React from 'react';
import { Droplets, TrendingUp, TrendingDown, Minus, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { NormalizedFloodRisk } from '../services/providers/providerTypes';

interface MausamFloodRiskCardProps {
  flood: NormalizedFloodRisk;
}

export const MausamFloodRiskCard: React.FC<MausamFloodRiskCardProps> = ({ flood }) => {
  if (
    flood.riskLevel === 'Unavailable' ||
    flood.isUnavailable === true ||
    flood.forecastPeriod === 'Unavailable' ||
    flood.source?.providerId === 'unavailable'
  ) {
    return (
      <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-slate-100 text-slate-500 shrink-0">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                Mausam Flood Risk & Catchment Runoff
              </h3>
              <p className="text-[11px] text-slate-400">
                Mausam Hydrology Engine • {flood.basinName}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
            Unavailable
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {flood.advisory || 'Catchment flood risk estimation is temporarily unavailable for this region.'}
        </p>
      </div>
    );
  }

  const isSevere = flood.riskLevel === 'Severe';
  const isHigh = flood.riskLevel === 'High';
  const isModerate = flood.riskLevel === 'Moderate';
  const isLow = flood.riskLevel === 'Low';

  const riskBadgeStyle = isSevere
    ? 'bg-rose-100 text-rose-800 border-rose-300'
    : isHigh
    ? 'bg-orange-100 text-orange-800 border-orange-300'
    : isModerate
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : isLow
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : 'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-xl shrink-0 ${
              isSevere
                ? 'bg-rose-100 text-rose-800'
                : isHigh
                ? 'bg-orange-100 text-orange-800'
                : isModerate
                ? 'bg-amber-100 text-amber-800'
                : isLow
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            <Droplets className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
              Mausam Flood Risk & Catchment Runoff
            </h3>
            <p className="text-[11px] text-slate-400">
              Mausam Hydrology Engine • {flood.basinName}
            </p>
          </div>
        </div>

        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${riskBadgeStyle}`}>
          {flood.riskLevel} Flood Risk
        </span>
      </div>

      <p className="text-xs text-slate-700 leading-relaxed mb-3">
        {flood.advisory}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2">
        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-400 block">Basin Discharge</span>
          <span className="text-sm font-semibold text-slate-800 block mt-0.5">
            ~{flood.riverDischargeM3s?.toLocaleString()} m³/s
          </span>
          <span className="text-[10px] text-slate-500">Modeled flow</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-400 block">Return Period</span>
          <span className="text-sm font-semibold text-slate-800 block mt-0.5 truncate">
            {flood.returnPeriodEst}
          </span>
          <span className="text-[10px] text-slate-500">Historical stat</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-400 block">Catchment Rain (3d)</span>
          <span className="text-sm font-semibold text-slate-800 block mt-0.5">
            {flood.catchmentRainfall3DayMm} mm
          </span>
          <span className="text-[10px] text-slate-500">Runoff driver</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-400 block">River Trend</span>
          <span className="text-sm font-semibold text-slate-800 block mt-0.5 flex items-center gap-1">
            {flood.trend === 'Rising' ? (
              <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
            ) : flood.trend === 'Receding' ? (
              <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{flood.trend}</span>
          </span>
          <span className="text-[10px] text-slate-500">{flood.forecastPeriod}</span>
        </div>
      </div>

      {/* Model Transparency Disclaimer */}
      <div className="mt-3 flex items-start gap-1.5 p-2 rounded-xl bg-slate-50 text-[10px] text-slate-500 border border-slate-100">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          <strong>Data Attribution & Notice:</strong> {flood.disclaimer} Source:{' '}
          {flood.source.attributionText}.
        </span>
      </div>
    </div>
  );
};
