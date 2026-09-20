import React, { useState } from 'react';
import {
  AlertTriangle,
  Info,
  ChevronRight,
  ShieldAlert,
  Clock,
  MapPin,
  X,
  Phone,
  CheckCircle2,
} from 'lucide-react';
import { WeatherAlert } from '../types';
import { EMERGENCY_HELPLINES } from '../data/constants';

interface AlertsBannerProps {
  alerts: WeatherAlert[];
  onViewAllAlerts?: () => void;
}

export const AlertsBanner: React.FC<AlertsBannerProps> = ({
  alerts,
  onViewAllAlerts,
}) => {
  const [activeModalAlert, setActiveModalAlert] = useState<WeatherAlert | null>(null);

  if (!alerts || alerts.length === 0) return null;

  // Prioritize highest severity
  const activeAlert = alerts.find((a) => a.severity === 'severe' || a.severity === 'warning') || alerts[0];

  if (activeAlert.severity === 'info' && activeAlert.colorCode === 'Green') {
    // Discreet calm status
    return (
      <section className="w-full max-w-2xl mx-auto px-4 my-2">
        <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              {activeAlert.isOfficialWarning ? 'Official IMD Bulletin: ' : 'Weather Status: '}
              <span className="font-normal text-emerald-800">{activeAlert.headline}</span>
            </span>
          </div>
          <button
            id="alerts-bulletin-btn"
            onClick={() => setActiveModalAlert(activeAlert)}
            className="min-h-[40px] px-3 flex items-center text-xs font-semibold text-emerald-800 hover:text-emerald-950 shrink-0 rounded-full bg-emerald-100/80 active:bg-emerald-200/80 touch-manipulation active:scale-95 transition-all"
          >
            Bulletin
          </button>
        </div>

        {activeModalAlert && (
          <AlertDetailModal alert={activeModalAlert} onClose={() => setActiveModalAlert(null)} />
        )}
      </section>
    );
  }

  const isSevere = activeAlert.severity === 'severe';
  const isWarning = activeAlert.severity === 'warning';

  return (
    <section className="w-full max-w-2xl mx-auto px-4 my-2">
      <div
        className={`rounded-3xl p-4 border transition-all shadow-xs ${
          isSevere
            ? 'bg-rose-50/90 border-rose-200 text-rose-950'
            : isWarning
            ? 'bg-amber-50/90 border-amber-200 text-amber-950'
            : 'bg-sky-50/90 border-sky-200 text-sky-950'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                isSevere
                  ? 'bg-rose-100 text-rose-700'
                  : isWarning
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-sky-100 text-sky-700'
              }`}
            >
              {isSevere ? (
                <ShieldAlert className="w-5 h-5" />
              ) : isWarning ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isSevere
                      ? 'bg-rose-600 text-white'
                      : isWarning
                      ? 'bg-amber-600 text-white'
                      : 'bg-sky-600 text-white'
                  }`}
                >
                  {activeAlert.isOfficialWarning ? `${activeAlert.issuedBy} Official` : activeAlert.issuedBy} {activeAlert.colorCode} Alert
                </span>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {activeAlert.issuedAt}
                </span>
              </div>

              <h4 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
                {activeAlert.headline}
              </h4>

              <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                {activeAlert.description}
              </p>

              {/* Actionable Points */}
              {activeAlert.actionableAdvice && activeAlert.actionableAdvice.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {activeAlert.actionableAdvice.slice(0, 2).map((advice, i) => (
                    <li key={i} className="text-xs text-slate-800 flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>{advice}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <button
            id="alerts-expand-modal-btn"
            onClick={() => setActiveModalAlert(activeAlert)}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-black/5 active:bg-black/10 text-slate-500 hover:text-slate-900 shrink-0 transition-all touch-manipulation active:scale-95"
            title="Read full bulletin & safety contacts"
            aria-label="Read full bulletin and emergency contacts"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {activeModalAlert && (
        <AlertDetailModal alert={activeModalAlert} onClose={() => setActiveModalAlert(null)} />
      )}
    </section>
  );
};

export const AlertDetailModal: React.FC<{
  alert: WeatherAlert;
  onClose: () => void;
}> = ({ alert, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[88vh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200 overscroll-contain">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                alert.colorCode === 'Red'
                  ? 'bg-rose-600 text-white'
                  : alert.colorCode === 'Orange'
                  ? 'bg-amber-600 text-white'
                  : alert.colorCode === 'Yellow'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {alert.isOfficialWarning ? `${alert.issuedBy} Official Bulletin` : `${alert.issuedBy} Advisory`}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-2">
              {alert.title}
            </h3>
            <p className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {alert.region}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Valid: {alert.validUntil}
              </span>
            </p>
          </div>

          <button
            id="alert-modal-close-x"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors shrink-0 touch-manipulation active:scale-95"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-sm text-slate-700">
          <div>
            <h5 className="font-semibold text-slate-900 mb-1">
              {alert.isOfficialWarning ? 'Official Meteorological Summary' : 'Meteorological Summary'}
            </h5>
            <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
          </div>

          <div>
            <h5 className="font-semibold text-slate-900 mb-2">Recommended Precautions & Actions</h5>
            <div className="space-y-2">
              {alert.actionableAdvice.map((act, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-slate-800">{act}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <h5 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-sky-600" />
              Emergency Helpline Numbers (24x7 India)
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {EMERGENCY_HELPLINES.slice(0, 4).map((h, i) => (
                <a
                  key={i}
                  href={`tel:${h.number.replace(/\D/g, '')}`}
                  className="p-3 rounded-xl bg-slate-50 active:bg-sky-50 border border-slate-100 hover:border-sky-200 transition-all flex items-center justify-between touch-manipulation group"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 block truncate">{h.name}</span>
                    <span className="text-sky-700 font-mono font-bold block mt-0.5">{h.number}</span>
                  </div>
                  <Phone className="w-4 h-4 text-slate-400 group-hover:text-sky-600 shrink-0 ml-2" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            id="alert-modal-close-btn"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:bg-slate-950 transition-all touch-manipulation active:scale-95"
          >
            Close Bulletin
          </button>
        </div>
      </div>
    </div>
  );
};
