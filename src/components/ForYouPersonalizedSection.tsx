import React from 'react';
import {
  Sparkles,
  Clock,
  ArrowRight,
  SlidersHorizontal,
  Activity,
  Car,
  Compass,
  HeartPulse,
  Users,
  Sprout,
  Ship,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { PersonaIntelligence, PersonaType, SupportedLanguage } from '../types';
import { getOnboardingText } from '../data/translations';

interface ForYouPersonalizedSectionProps {
  primaryIntelligence: PersonaIntelligence;
  allSelectedIntelligences: PersonaIntelligence[];
  selectedPersonas: PersonaType[];
  onSelectPrimaryPersona: (persona: PersonaType) => void;
  onOpenManagePersonas: () => void;
  onOpenDetails: (intelligence: PersonaIntelligence) => void;
  language?: SupportedLanguage;
}

export const ForYouPersonalizedSection: React.FC<ForYouPersonalizedSectionProps> = ({
  primaryIntelligence,
  allSelectedIntelligences,
  selectedPersonas,
  onSelectPrimaryPersona,
  onOpenManagePersonas,
  onOpenDetails,
  language = 'en',
}) => {
  const texts = getOnboardingText(language);

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

  const PrimaryIcon = getPersonaIcon(primaryIntelligence.iconName);

  const getScoreBadgeClass = (score: number, label?: string) => {
    if (label === 'Unavailable' || label === 'Not Applicable') {
      return 'bg-slate-100 text-slate-700 border-slate-200';
    }
    if (score >= 85) return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    if (score >= 70) return 'bg-sky-50 text-sky-700 border-sky-200/80';
    if (score >= 55) return 'bg-amber-50 text-amber-700 border-amber-200/80';
    return 'bg-rose-50 text-rose-700 border-rose-200/80';
  };

  const otherIntelligences = allSelectedIntelligences.filter(
    (intel) => intel.personaId !== primaryIntelligence.personaId
  );

  return (
    <section className="w-full max-w-2xl mx-auto px-4 my-3">
      <div className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-xs">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                {texts.forYou}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/60 uppercase tracking-wider">
                Personalized
              </span>
            </div>
          </div>

          <button
            id="for-you-switch-mode-btn"
            onClick={onOpenManagePersonas}
            className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-900 transition-colors py-2 px-3 rounded-full hover:bg-sky-50 min-h-[40px] touch-manipulation active:scale-95"
            title="Switch or customize persona modes"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{texts.switchMode}</span>
          </button>
        </div>

        {/* Multi-Persona Pill Switcher if user has multiple selected */}
        {allSelectedIntelligences.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 pt-0.5 px-0.5 no-scrollbar mb-2 border-b border-slate-100 overscroll-x-contain touch-pan-x">
            {allSelectedIntelligences.map((intel) => {
              const Icon = getPersonaIcon(intel.iconName);
              const isActive = intel.personaId === primaryIntelligence.personaId;

              return (
                <button
                  key={intel.personaId}
                  id={`for-you-persona-${intel.personaId}`}
                  onClick={() => onSelectPrimaryPersona(intel.personaId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full text-xs font-semibold shrink-0 transition-all touch-manipulation active:scale-95 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{intel.label.split('/')[0].trim()}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {intel.scoreLabel === 'Unavailable' || intel.scoreLabel === 'Not Applicable' ? '—' : intel.score}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* PRIMARY PERSONA INTELLIGENCE CARD (Full Format) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-sky-50/70 to-slate-50/60 border border-sky-100/90 shadow-2xs space-y-3">
          {/* 1. PERSONA + 2. SCORE / STATUS */}
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2.5 rounded-2xl bg-sky-600 text-white shadow-xs shrink-0">
                <PrimaryIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">
                  Primary Intelligence
                </span>
                <h4 className="text-sm xs:text-base font-bold text-slate-900 leading-tight truncate">
                  {primaryIntelligence.label}
                </h4>
              </div>
            </div>

            {/* Score pill */}
            <div
              className={`px-3 py-1.5 rounded-2xl border flex items-center gap-1.5 shrink-0 self-start xs:self-auto ${getScoreBadgeClass(
                primaryIntelligence.score,
                primaryIntelligence.scoreLabel
              )}`}
            >
              {primaryIntelligence.scoreLabel === 'Unavailable' || primaryIntelligence.scoreLabel === 'Not Applicable' ? (
                <span className="text-xs font-semibold">{primaryIntelligence.scoreLabel}</span>
              ) : (
                <>
                  <span className="text-base font-extrabold tracking-tight">
                    {primaryIntelligence.score}
                  </span>
                  <span className="text-xs font-semibold">
                    {primaryIntelligence.scoreLabel}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 3. MOST IMPORTANT WINDOW */}
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between p-2.5 rounded-xl bg-white/90 border border-slate-200/80 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  {texts.bestWindow}
                </span>
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                  {primaryIntelligence.bestWindow}
                </p>
              </div>
            </div>

            {primaryIntelligence.avoidWindow && (
              <div className="xs:text-right xs:pl-2 xs:border-l xs:border-slate-100 min-w-0">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  {texts.avoidWindow}
                </span>
                <p className="text-xs font-bold text-amber-900 truncate max-w-[200px]">
                  {primaryIntelligence.avoidWindow.split('(')[0]}
                </p>
              </div>
            )}
          </div>

          {/* 4. 3–5 KEY CONDITIONS */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {primaryIntelligence.keyConditions.slice(0, 4).map((cond, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/80 border border-black/[0.04] text-[11px] font-medium text-slate-700"
              >
                <span className="text-slate-400 font-normal">{cond.label}:</span>
                <span className="font-bold text-slate-900">{cond.value}</span>
              </span>
            ))}
          </div>

          {/* 5. ACTIONABLE RECOMMENDATION */}
          <p className="text-xs text-slate-600 leading-relaxed pt-1">
            {primaryIntelligence.recommendation}
          </p>

          {/* 6. SEE DETAILS BUTTON */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-sky-100/60">
            <button
              id="for-you-see-details-btn"
              onClick={() => onOpenDetails(primaryIntelligence)}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-full bg-sky-50 hover:bg-sky-100 text-xs font-bold text-sky-800 transition-all group touch-manipulation active:scale-95"
            >
              <span>{texts.seeDetails}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <span className="text-[10px] text-slate-600 font-medium">
              {primaryIntelligence.provenance?.primarySource
                ? `Source: ${primaryIntelligence.provenance.primarySource}`
                : primaryIntelligence.isModelDerived
                ? 'Model-Derived Atmospheric Assessment'
                : 'Verified Atmospheric Telemetry'}
            </span>
          </div>
        </div>

        {/* COMPACT SUMMARIES FOR OTHER SELECTED PERSONAS */}
        {otherIntelligences.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1 block">
              Other Selected Modes
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {otherIntelligences.map((other) => {
                const Icon = getPersonaIcon(other.iconName);
                return (
                  <button
                    key={other.personaId}
                    onClick={() => onOpenDetails(other)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {other.label.split('/')[0].trim()}
                          </span>
                          <span className="text-[10px] font-bold text-slate-600">
                            • {other.scoreLabel === 'Unavailable' || other.scoreLabel === 'Not Applicable' ? other.scoreLabel : `${other.score} ${other.scoreLabel}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {other.bestWindow}
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
