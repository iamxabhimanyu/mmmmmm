import React from 'react';
import { Sprout, Droplets, Wind, ShieldCheck, AlertCircle, Phone, Calendar } from 'lucide-react';
import { AgroMetAdvisory, CurrentWeather } from '../types';

interface AgroMetSectionProps {
  advisory: AgroMetAdvisory;
  weather: CurrentWeather;
  locationName: string;
}

export const AgroMetSection: React.FC<AgroMetSectionProps> = ({
  advisory,
  weather,
  locationName,
}) => {
  const isSafe = advisory.spraySafety.status === 'Safe';
  const isCaution = advisory.spraySafety.status === 'Caution';

  return (
    <section className="w-full max-w-2xl mx-auto px-4 my-2">
      <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
        {/* Section Header */}
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
              <Sprout className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                Krishi Agro-Met Advisory
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Mausam Model-Derived Agro-Met Advisory • {locationName}
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 self-start xs:self-auto shrink-0">
            {advisory.cropSeason} Season
          </span>
        </div>

        {/* 1. Chemical Spray Safety Card */}
        <div
          className={`p-3.5 rounded-2xl border mb-3 ${
            isSafe
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : isCaution
              ? 'bg-amber-50/70 border-amber-200 text-amber-950'
              : 'bg-rose-50/70 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              {isSafe ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>Pesticide / Foliar Spray Safety</span>
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                isSafe
                  ? 'bg-emerald-600 text-white'
                  : isCaution
                  ? 'bg-amber-500 text-white'
                  : 'bg-rose-600 text-white'
              }`}
            >
              {advisory.spraySafety.status}
            </span>
          </div>

          <p className="text-xs mt-1 leading-relaxed text-slate-800">
            {advisory.spraySafety.reason}
          </p>

          <div className="mt-2 text-[11px] font-medium text-slate-600 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
            <span>Favorable window: <strong>{advisory.spraySafety.nextFavorableWindow}</strong></span>
          </div>
        </div>

        {/* 2. Bento Grid of Field Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {/* Irrigation advisory */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
            <span className="font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-sky-500" />
              Field Irrigation Guidance
            </span>
            <p className="text-slate-600 leading-relaxed">
              {advisory.irrigationAdvisory}
            </p>
          </div>

          {/* Sowing & Harvest */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
            <span className="font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-emerald-500" />
              Harvest & Storage Notice
            </span>
            <p className="text-slate-600 leading-relaxed">
              {advisory.sowingHarvestingNotice}
            </p>
          </div>
        </div>

        {/* 3. Soil Moisture & Pest Warning */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span className="text-slate-400 block text-[11px]">Estimated Soil Moisture</span>
            <span className="font-semibold text-slate-800">{advisory.soilMoistureEst}</span>
          </div>
          <div className="sm:text-right">
            <span className="text-slate-400 block text-[11px]">Pest Infestation Index</span>
            <span className="font-semibold text-slate-800">{advisory.pestDiseaseAlert}</span>
          </div>
        </div>

        {/* Kisan Call Center Helpline */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col xs:flex-row xs:items-center justify-between gap-2 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Kisan Call Centre (Toll-Free 24x7):</span>
          </span>
          <a
            id="kisan-helpline-link"
            href="tel:18001801551"
            className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-full bg-emerald-50 text-emerald-800 font-mono font-bold hover:bg-emerald-100 active:bg-emerald-200 transition-all touch-manipulation active:scale-95 self-start xs:self-auto"
          >
            1800-180-1551
          </a>
        </div>

        {/* Model Transparency Disclaimer */}
        <div className="mt-2 text-[10px] text-slate-400">
          {advisory.sourceAttribution || 'Model-derived advisory calculated from numerical meteorological data. Consult your local Krishi Vigyan Kendra (KVK) for official agricultural bulletins.'}
        </div>
      </div>
    </section>
  );
};
