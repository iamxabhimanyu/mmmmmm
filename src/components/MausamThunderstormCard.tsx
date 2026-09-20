import React from 'react';
import { Zap, AlertTriangle, ShieldCheck, Clock, Wind, Info } from 'lucide-react';
import { NormalizedThunderstormRisk } from '../services/providers/providerTypes';

interface MausamThunderstormCardProps {
  thunderstorm: NormalizedThunderstormRisk;
}

export const MausamThunderstormCard: React.FC<MausamThunderstormCardProps> = ({
  thunderstorm,
}) => {
  if (
    thunderstorm.source?.providerId === 'unavailable' ||
    thunderstorm.peakWindow === 'N/A' ||
    thunderstorm.riskLevel === 'Unavailable'
  ) {
    return (
      <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-slate-100 text-slate-500 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                Mausam Thunderstorm Risk
              </h3>
              <p className="text-[11px] text-slate-400">
                Convective Instability & Lightning Surveillance
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
            Unavailable
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {thunderstorm.advisory || 'Convective nowcasting and thunderstorm modeling are temporarily offline.'}
        </p>
      </div>
    );
  }

  const isHigh = thunderstorm.riskLevel === 'Severe' || thunderstorm.riskLevel === 'High';
  const isElevated = thunderstorm.riskLevel === 'Elevated' || thunderstorm.riskLevel === 'Moderate';
  const isLow = thunderstorm.riskLevel === 'Low';

  const riskBadgeStyle = isHigh
    ? 'bg-amber-100 text-amber-900 border-amber-300'
    : isElevated
    ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
    : isLow
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : 'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-xl shrink-0 ${
              isHigh
                ? 'bg-amber-100 text-amber-900'
                : isElevated
                ? 'bg-yellow-100 text-yellow-900'
                : isLow
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
              Mausam Thunderstorm Risk
            </h3>
            <p className="text-[11px] text-slate-400">
              Convective Instability & Lightning Surveillance
            </p>
          </div>
        </div>

        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${riskBadgeStyle}`}>
          {thunderstorm.riskLevel} Risk ({thunderstorm.riskScore}%)
        </span>
      </div>

      <p className="text-xs text-slate-700 leading-relaxed mb-3">
        {thunderstorm.advisory}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-2">
        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-400 block flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" /> Lightning Likelihood
          </span>
          <span className="text-sm font-semibold text-slate-800 block mt-0.5">
            {thunderstorm.lightningLikelihood}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-400 block flex items-center gap-1">
            <Wind className="w-3 h-3 text-sky-500" /> Peak Squall Gust
          </span>
          <span className="text-sm font-semibold text-slate-800 block mt-0.5">
            {typeof thunderstorm.gustRiskKmph === 'number' ? `${thunderstorm.gustRiskKmph} km/h` : '—'}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-400 block flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" /> Active Window
          </span>
          <span className="text-sm font-semibold text-slate-800 block mt-0.5">
            {thunderstorm.peakWindow}
          </span>
        </div>
      </div>

      {isHigh && (
        <div className="mt-3 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-950">
          <span className="font-semibold block mb-1">Safety Actions:</span>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900">
            {thunderstorm.safetyTips.map((tip, idx) => (
              <li key={idx}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Model Transparency Disclaimer */}
      <div className="mt-3 flex items-start gap-1.5 p-2 rounded-xl bg-slate-50 text-[10px] text-slate-500 border border-slate-100">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          <strong>Data Attribution & Notice:</strong> Model-derived convective stability algorithm.
          Source: {thunderstorm.source.attributionText}. Not an official IMD lightning bulletin.
        </span>
      </div>
    </div>
  );
};
