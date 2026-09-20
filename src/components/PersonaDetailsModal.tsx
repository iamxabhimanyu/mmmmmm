import React from 'react';
import {
  X,
  Sparkles,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Activity,
  Car,
  Compass,
  HeartPulse,
  Users,
  Sprout,
  Ship,
  ShieldAlert,
  Droplets,
  Wind,
  Sun,
  Eye,
} from 'lucide-react';
import { PersonaIntelligence, SupportedLanguage } from '../types';
import { getTranslation } from '../data/translations';

interface PersonaDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  intelligence: PersonaIntelligence;
  language?: SupportedLanguage;
  onActionClick?: (actionType: string) => void;
}

export const PersonaDetailsModal: React.FC<PersonaDetailsModalProps> = ({
  isOpen,
  onClose,
  intelligence,
  language = 'en',
  onActionClick,
}) => {
  if (!isOpen) return null;

  const getPersonaIcon = (name: string) => {
    switch (name) {
      case 'Activity':
        return Activity;
      case 'Car':
        return Car;
      case 'Compass':
        return Compass;
      case 'HeartPulse':
        return HeartPulse;
      case 'Users':
        return Users;
      case 'Sprout':
        return Sprout;
      case 'Ship':
        return Ship;
      default:
        return Activity;
    }
  };

  const IconComp = getPersonaIcon(intelligence.iconName);

  const getScoreColor = (score: number) => {
    if (intelligence.scoreLabel === 'Unavailable' || intelligence.scoreLabel === 'Not Applicable') {
      return 'text-slate-600 bg-slate-100 border-slate-200';
    }
    if (score >= 85) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'text-sky-600 bg-sky-50 border-sky-200';
    if (score >= 55) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-sky-600 text-white shadow-xs shrink-0">
              <IconComp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">{intelligence.label}</h3>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getScoreColor(
                    intelligence.score
                  )}`}
                >
                  {intelligence.scoreLabel === 'Unavailable' || intelligence.scoreLabel === 'Not Applicable'
                    ? intelligence.scoreLabel
                    : `${intelligence.score} • ${intelligence.scoreLabel}`}
                </span>
                {intelligence.confidenceLevel && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                      intelligence.confidenceLevel === 'High'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : intelligence.confidenceLevel === 'Moderate'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : intelligence.confidenceLevel === 'Low'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {intelligence.confidenceLevel} Confidence
                  </span>
                )}
                {intelligence.isModelDerived && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-500 border-slate-200 shrink-0">
                    Model-Derived
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium truncate">{intelligence.advisoryHeadline}</p>
            </div>
          </div>
          <button
            id="persona-details-close-btn"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200/60 active:bg-slate-300 text-slate-400 hover:text-slate-700 transition-colors touch-manipulation active:scale-95 shrink-0"
            aria-label="Close details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Primary Question & Answer Banner */}
          <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-100 space-y-1">
            <div className="flex items-center gap-1.5 text-sky-800 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Personalized Direct Guidance</span>
            </div>
            <p className="text-xs font-semibold text-slate-600 italic">"{intelligence.primaryQuestion}"</p>
            <p className="text-xs sm:text-sm font-medium text-slate-900 mt-1 leading-relaxed">
              {intelligence.primaryAnswer}
            </p>
          </div>

          {/* Windows: Best vs Avoid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100/80 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Most Important Window</span>
              </div>
              <p className="text-sm font-bold text-emerald-950">{intelligence.bestWindow}</p>
              {intelligence.bestWindowSub && (
                <p className="text-xs text-emerald-700 leading-snug">{intelligence.bestWindowSub}</p>
              )}
            </div>

            {intelligence.avoidWindow ? (
              <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-100/80 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Caution / Avoid Window</span>
                </div>
                <p className="text-sm font-bold text-amber-950">{intelligence.avoidWindow}</p>
                {intelligence.avoidWindowReason && (
                  <p className="text-xs text-amber-700 leading-snug">{intelligence.avoidWindowReason}</p>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-700 text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>Daytime Safety</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">Stable throughout daytime</p>
                <p className="text-xs text-slate-500">No severe atmospheric spikes detected.</p>
              </div>
            )}
          </div>

          {/* Key Conditions Badges */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Key Conditions</h4>
            <div className="flex flex-wrap gap-2">
              {intelligence.keyConditions.map((cond, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/80 flex items-center gap-2"
                >
                  <span className="text-xs text-slate-500 font-medium">{cond.label}:</span>
                  <span className="text-xs font-bold text-slate-900">{cond.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prioritized Metrics Table/Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Prioritized Meteorological Metrics
            </h4>
            <div className="space-y-1.5">
              {intelligence.prioritizedMetrics.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-100 transition-colors"
                >
                  <span className="text-xs font-medium text-slate-700">{item.label}</span>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900 block">{item.value}</span>
                    {item.subValue && <span className="text-[10px] text-slate-500 block">{item.subValue}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hourly Suitability Timeline */}
          {intelligence.hourlySuitability && intelligence.hourlySuitability.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Hourly Suitability Timeline
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {intelligence.hourlySuitability.slice(0, 10).map((h, i) => {
                  const isBest = h.score >= 85;
                  const isCaution = h.score < 60;
                  return (
                    <div
                      key={i}
                      className={`min-w-[88px] max-w-[100px] p-2 rounded-2xl border text-center shrink-0 flex flex-col items-center justify-between transition-all ${
                        isBest
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          : isCaution
                          ? 'bg-amber-50 border-amber-200 text-amber-950'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-semibold text-slate-700">{h.time}</span>
                        {h.dayLabel && (
                          <span className="text-[9px] font-medium text-slate-400 leading-none mt-0.5">
                            {h.dayLabel}
                          </span>
                        )}
                      </div>
                      <div className="my-1">
                        <span className="text-sm font-bold block">{h.score}</span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider block opacity-75">
                          {h.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-600 font-medium">
                        {h.temp !== undefined ? `${h.temp}°C` : '—'}
                      </span>
                      {h.note && (
                        <span className="text-[9px] text-slate-500 line-clamp-2 mt-1 px-0.5 leading-tight">
                          {h.note}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* What to Carry / Action Checklist */}
          {intelligence.whatToCarryOrAction && intelligence.whatToCarryOrAction.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                <span>Action Checklist & What to Carry</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {intelligence.whatToCarryOrAction.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
          {intelligence.actionButton && onActionClick ? (
            <button
              id="persona-details-action-btn"
              onClick={() => {
                onActionClick(intelligence.actionButton!.actionType);
                onClose();
              }}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 active:scale-95 text-white text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs touch-manipulation"
            >
              <span>{intelligence.actionButton.label}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex-1 text-[11px] text-slate-500 font-medium truncate">
              {intelligence.provenance?.primarySource
                ? `Source: ${intelligence.provenance.primarySource}`
                : intelligence.isModelDerived
                ? 'Model-Derived Meteorological Assessment'
                : 'Atmospheric Telemetry & Forecasts'}
            </div>
          )}

          <button
            id="persona-details-footer-close-btn"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 text-xs sm:text-sm font-semibold transition-colors touch-manipulation active:scale-95 shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
