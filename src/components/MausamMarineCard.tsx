import React from 'react';
import { Waves, Compass, AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { NormalizedMarine } from '../services/providers/providerTypes';

interface MausamMarineCardProps {
  marine: NormalizedMarine;
}

export const MausamMarineCard: React.FC<MausamMarineCardProps> = ({ marine }) => {
  if (!marine.isCoastal) {
    return null;
  }

  if (marine.isUnavailable || marine.source?.providerId === 'unavailable') {
    return (
      <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-slate-100 text-slate-500 shrink-0">
              <Waves className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                Marine & Coastal Sea State
              </h3>
              <p className="text-[11px] text-slate-400">
                Copernicus Marine & WaveWatch III via Open-Meteo
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
            Unavailable
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {marine.disclaimer || 'Coastal marine and wave observations are temporarily unavailable.'}
        </p>
      </div>
    );
  }

  const isDangerous = marine.swimmingSafety === 'Dangerous';
  const isCaution = marine.swimmingSafety === 'Caution';
  const isSafe = marine.swimmingSafety === 'Safe';

  const badgeStyle = isDangerous
    ? 'bg-rose-100 text-rose-800 border-rose-200'
    : isCaution
    ? 'bg-amber-100 text-amber-800 border-amber-200'
    : isSafe
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : 'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-cyan-100 text-cyan-800 shrink-0">
            <Waves className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
              Marine & Coastal Sea State
            </h3>
            <p className="text-[11px] text-slate-400">
              Copernicus Marine & WaveWatch III via Open-Meteo
            </p>
          </div>
        </div>

        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badgeStyle}`}>
          {marine.seaStateCategory || 'Unavailable'} Sea ({marine.swimmingSafety || 'Unavailable'})
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2">
        <div className="p-2.5 rounded-2xl bg-cyan-50/70 border border-cyan-100/60">
          <span className="text-[10px] text-slate-400 block">Wave Height</span>
          <span className="text-base font-semibold text-cyan-950 block mt-0.5">
            {typeof marine.waveHeight === 'number' ? `${marine.waveHeight} m` : 'Unavailable'}
          </span>
          <span className="text-[10px] text-slate-500">
            {typeof marine.wavePeriod === 'number' ? `Period: ${marine.wavePeriod}s` : 'Period: N/A'}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-sky-50/70 border border-sky-100/60">
          <span className="text-[10px] text-slate-400 block">Swell Waves</span>
          <span className="text-base font-semibold text-sky-950 block mt-0.5">
            {typeof marine.swellWaveHeight === 'number' ? `${marine.swellWaveHeight} m` : 'Unavailable'}
          </span>
          <span className="text-[10px] text-slate-500">
            {typeof marine.swellWaveDirection === 'number' ? `From ${marine.swellWaveDirection}°` : 'Direction: N/A'}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-teal-50/70 border border-teal-100/60">
          <span className="text-[10px] text-slate-400 block">Sea Surface Temp</span>
          <span className="text-base font-semibold text-teal-950 block mt-0.5">
            {typeof marine.seaSurfaceTemperature === 'number' ? `${marine.seaSurfaceTemperature}°C` : 'Unavailable'}
          </span>
          <span className="text-[10px] text-slate-500">Coastal SST</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-100/60">
          <span className="text-[10px] text-slate-400 block">Beach / Bathing</span>
          <span
            className={`text-base font-semibold block mt-0.5 ${
              isDangerous
                ? 'text-rose-700'
                : isCaution
                ? 'text-amber-700'
                : isSafe
                ? 'text-emerald-700'
                : 'text-slate-600'
            }`}
          >
            {marine.swimmingSafety || 'Unavailable'}
          </span>
          <span className="text-[10px] text-slate-500">Shore condition</span>
        </div>
      </div>

      {/* Model Transparency Disclaimer */}
      <div className="mt-2.5 flex items-start gap-1.5 p-2 rounded-xl bg-slate-50 text-[10px] text-slate-500 border border-slate-100">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          <strong>Data Attribution & Notice:</strong> {marine.disclaimer} Source:{' '}
          {marine.source.attributionText}.
        </span>
      </div>
    </div>
  );
};
