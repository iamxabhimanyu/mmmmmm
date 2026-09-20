import React, { useState } from 'react';
import {
  X,
  Check,
  Activity,
  Car,
  Compass,
  HeartPulse,
  Users,
  Sprout,
  Ship,
  Sparkles,
} from 'lucide-react';
import { PersonaType } from '../types';
import { PERSONA_PROFILES } from '../data/constants';

interface PersonaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPersona: PersonaType;
  selectedPersonas?: PersonaType[];
  onSelectPersona: (persona: PersonaType) => void;
  onUpdatePersonas?: (personas: PersonaType[], primary: PersonaType) => void;
}

export const PersonaSelectorModal: React.FC<PersonaSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedPersona,
  selectedPersonas = [selectedPersona],
  onSelectPersona,
  onUpdatePersonas,
}) => {
  if (!isOpen) return null;

  const [localSelected, setLocalSelected] = useState<PersonaType[]>(
    selectedPersonas.length > 0 ? selectedPersonas : [selectedPersona]
  );
  const [localPrimary, setLocalPrimary] = useState<PersonaType>(selectedPersona);

  const getPersonaIcon = (id: PersonaType) => {
    switch (id) {
      case 'runner':
        return Activity;
      case 'commuter':
        return Car;
      case 'traveller':
        return Compass;
      case 'health':
        return HeartPulse;
      case 'family':
        return Users;
      case 'farmer':
        return Sprout;
      case 'marine':
        return Ship;
      default:
        return Activity;
    }
  };

  const handleToggle = (id: PersonaType) => {
    if (localSelected.includes(id)) {
      if (localSelected.length === 1) return; // Keep at least one
      const updated = localSelected.filter((p) => p !== id);
      setLocalSelected(updated);
      if (localPrimary === id) {
        setLocalPrimary(updated[0]);
      }
    } else {
      setLocalSelected((prev) => [...prev, id]);
    }
  };

  const handleSetPrimary = (id: PersonaType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!localSelected.includes(id)) {
      setLocalSelected((prev) => [...prev, id]);
    }
    setLocalPrimary(id);
  };

  const handleSave = () => {
    if (onUpdatePersonas) {
      onUpdatePersonas(localSelected, localPrimary);
    }
    onSelectPersona(localPrimary);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-base font-bold text-slate-900">Personalize Your Weather</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 uppercase">
                {localSelected.length} Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select one or multiple personas. Choose your primary mode for the Home card.
            </p>
          </div>
          <button
            id="persona-modal-close-btn"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors touch-manipulation active:scale-95 shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Persona list */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 overscroll-contain">
          {PERSONA_PROFILES.map((p) => {
            const IconComp = getPersonaIcon(p.id);
            const isChecked = localSelected.includes(p.id);
            const isPrimary = localPrimary === p.id;

            return (
              <div
                key={p.id}
                id={`persona-option-${p.id}`}
                onClick={() => handleToggle(p.id)}
                className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all touch-manipulation ${
                  isPrimary
                    ? 'bg-sky-50/90 border-sky-400 ring-1 ring-sky-400/30'
                    : isChecked
                    ? 'bg-slate-50/90 border-slate-300'
                    : 'bg-white hover:bg-slate-50/80 border-slate-200/80 opacity-80'
                }`}
              >
                {/* Icon */}
                <div
                  className={`p-2.5 rounded-xl shrink-0 mt-0.5 transition-colors ${
                    isPrimary
                      ? 'bg-sky-600 text-white'
                      : isChecked
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <IconComp className="w-5 h-5" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-bold text-slate-900 truncate">{p.label}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{p.description}</p>

                  {/* Primary Selector Pill */}
                  {isChecked && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        id={`persona-set-primary-${p.id}`}
                        onClick={(e) => handleSetPrimary(p.id, e)}
                        className={`text-[11px] font-bold min-h-[36px] px-3 py-1 rounded-full border transition-all touch-manipulation active:scale-95 ${
                          isPrimary
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400 active:bg-slate-100'
                        }`}
                      >
                        {isPrimary ? '★ Primary Mode' : 'Set as Primary'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Checkbox state */}
                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-colors ${
                    isChecked ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 bg-white'
                  }`}
                >
                  {isChecked && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-500 font-medium truncate">
            Primary: <strong className="text-slate-800 capitalize">{localPrimary}</strong>
          </span>
          <button
            id="persona-apply-save-btn"
            onClick={handleSave}
            className="min-h-[44px] px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 touch-manipulation shrink-0"
          >
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
};
