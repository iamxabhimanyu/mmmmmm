import React from 'react';
import { Compass, Wind, ShieldAlert, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { NormalizedCyclone } from '../services/providers/providerTypes';

interface MausamCycloneCardProps {
  cyclone: NormalizedCyclone;
}

export const MausamCycloneCard: React.FC<MausamCycloneCardProps> = ({ cyclone }) => {
  if (cyclone.isUnavailable === true || cyclone.source?.providerId === 'unavailable') {
    return (
      <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-slate-100 text-slate-500 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                Tropical Cyclone Surveillance
              </h3>
              <p className="text-[11px] text-slate-400">
                North Indian Ocean (Bay of Bengal & Arabian Sea)
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
            Unavailable
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {cyclone.bulletinSummary || 'Tropical cyclone surveillance feed is temporarily offline.'}
        </p>
      </div>
    );
  }

  const hasStorm = cyclone.hasActiveStorm;

  return (
    <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-xl shrink-0 ${
              hasStorm ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'
            }`}
          >
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
              Tropical Cyclone Surveillance
            </h3>
            <p className="text-[11px] text-slate-400">
              North Indian Ocean (Bay of Bengal & Arabian Sea)
            </p>
          </div>
        </div>

        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
            hasStorm
              ? 'bg-rose-100 text-rose-800 border-rose-300'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {hasStorm ? 'Active Cyclonic Storm' : 'No Active Cyclone'}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
            cyclone.source.isOfficialIMD
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-sky-50 text-sky-700 border-sky-200'
          }`}
        >
          {cyclone.source.isOfficialIMD ? 'Official IMD RSMC' : 'Mausam Storm Surveillance (Open Data)'}
        </span>
        <span className="text-[10px] text-slate-400">
          Updated: {new Date(cyclone.source.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <p className="text-xs text-slate-700 leading-relaxed mb-3">
        {cyclone.bulletinSummary || 'No depression, deep depression, or cyclonic system detected over Indian coastal waters.'}
      </p>

      {hasStorm && cyclone.cycloneName ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2">
          <div className="p-2.5 rounded-2xl bg-rose-50/70 border border-rose-100">
            <span className="text-[10px] text-slate-400 block">Cyclone Name</span>
            <span className="text-sm font-semibold text-rose-950 block mt-0.5">
              {cyclone.cycloneName}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 block">Basin</span>
            <span className="text-sm font-semibold text-slate-800 block mt-0.5">
              {cyclone.basin}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 block">Intensity</span>
            <span className="text-sm font-semibold text-slate-800 block mt-0.5">
              {cyclone.currentIntensity || 'Cyclonic Storm'}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 block">Max Winds</span>
            <span className="text-sm font-semibold text-slate-800 block mt-0.5">
              {cyclone.maxSustainedWindsKmph} km/h
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 flex items-center gap-2.5 text-xs text-emerald-950">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Both Arabian Sea and Bay of Bengal maritime basins are quiescent. Sea surface temperatures and wind shear favor normal coastal weather.
          </span>
        </div>
      )}

      {/* Attribution */}
      <div className="mt-3 flex items-start gap-1.5 p-2 rounded-xl bg-slate-50 text-[10px] text-slate-500 border border-slate-100">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          <strong>Source Notice:</strong> {cyclone.source.attributionText}.
        </span>
      </div>
    </div>
  );
};
