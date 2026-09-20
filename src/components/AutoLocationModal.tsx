import React from 'react';
import {
  Navigation2,
  RefreshCw,
  Clock,
  Compass,
  CheckCircle2,
  AlertCircle,
  X,
  Radio,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { AutoLocationState, autoLocationManager } from '../services/autoLocationManager';
import { LocationInfo } from '../types';

interface AutoLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AutoLocationState;
  currentLocation: LocationInfo;
  onManualReload: () => void;
  onToggleAuto: (enabled: boolean) => void;
  onSelectInterval: (minutes: number) => void;
}

export const AutoLocationModal: React.FC<AutoLocationModalProps> = ({
  isOpen,
  onClose,
  state,
  currentLocation,
  onManualReload,
  onToggleAuto,
  onSelectInterval,
}) => {
  if (!isOpen) return null;

  const lat = state.lastFix?.lat ?? (currentLocation as any).latitude ?? currentLocation.lat;
  const lon = state.lastFix?.lon ?? (currentLocation as any).longitude ?? currentLocation.lon;
  const accuracy = state.lastFix?.accuracy ? Math.round(state.lastFix.accuracy) : null;
  const relativeSync = autoLocationManager.getLastSyncRelativeString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-xs">
              <Navigation2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                Live GPS & Auto-Reload
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Continuous hyperlocal microclimate tracking
              </p>
            </div>
          </div>
          <button
            id="close-auto-location-modal-btn"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition-colors active:scale-95"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {/* Status Capsule */}
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${
              state.status === 'acquiring'
                ? 'bg-sky-50/80 border-sky-200 text-sky-900'
                : state.status === 'permission_denied'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : state.isEnabled
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {state.status === 'acquiring' ? (
                <RefreshCw className="w-4 h-4 text-sky-600 animate-spin" />
              ) : state.status === 'permission_denied' ? (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              ) : state.isEnabled ? (
                <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
              ) : (
                <Clock className="w-4 h-4 text-slate-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs">
                  {state.status === 'acquiring'
                    ? 'Acquiring Precise GPS Lock...'
                    : state.status === 'permission_denied'
                    ? 'Location Permission Denied'
                    : state.isEnabled
                    ? 'Live Auto-Tracking Active'
                    : 'Auto-Reload Paused'}
                </span>
                <span className="text-[10px] font-medium opacity-80">
                  {state.isAcquiring ? 'Updating...' : `Synced ${relativeSync}`}
                </span>
              </div>
              <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                {state.status === 'permission_denied'
                  ? 'Browser location access was declined. Enable GPS in browser settings to auto-track your location.'
                  : state.isEnabled
                  ? `The app automatically refreshes your exact location every ${state.intervalMinutes} min and when you move > 300m.`
                  : 'Enable auto-reload to keep your weather locked to your exact real-time coordinates.'}
              </p>
            </div>
          </div>

          {/* Current Exact Coordinates Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Compass className="w-3.5 h-3.5 text-sky-600" />
                Current Exact Position
              </span>
              {accuracy !== null && (
                <span className="text-[10px] text-emerald-700 font-medium bg-emerald-100/70 px-2 py-0.5 rounded-full">
                  ± {accuracy}m accuracy
                </span>
              )}
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {currentLocation.name}
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  {currentLocation.displayName || `${currentLocation.state}, India`}
                </p>
              </div>
              <div className="text-right font-mono text-[11px] text-slate-600 shrink-0 ml-2">
                <div>{lat.toFixed(4)}° N</div>
                <div>{lon.toFixed(4)}° E</div>
              </div>
            </div>
          </div>

          {/* Controls: Toggle & Interval */}
          <div className="space-y-3 pt-1">
            {/* Auto-Reload Switch */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="min-w-0 pr-2">
                <span className="font-semibold text-slate-900 block text-xs">
                  Auto-Reload Location Time-by-Time
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Keep exact coordinates updated automatically
                </span>
              </div>
              <button
                id="toggle-auto-location-switch"
                role="switch"
                aria-checked={state.isEnabled}
                onClick={() => onToggleAuto(!state.isEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  state.isEnabled ? 'bg-sky-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    state.isEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Interval Selector (Only active if enabled) */}
            {state.isEnabled && (
              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-slate-700 font-semibold text-xs">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-sky-600" />
                    Reload Frequency
                  </span>
                  <span className="text-sky-700 font-bold">
                    Every {state.intervalMinutes} min
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[1, 3, 5, 10].map((mins) => (
                    <button
                      key={mins}
                      id={`interval-btn-${mins}m`}
                      onClick={() => onSelectInterval(mins)}
                      className={`py-1.5 px-2 rounded-xl font-semibold text-xs transition-all text-center ${
                        state.intervalMinutes === mins
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Button: Reload Now */}
          <button
            id="modal-reload-exact-gps-btn"
            onClick={onManualReload}
            disabled={state.isAcquiring}
            className="w-full min-h-[46px] rounded-2xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 disabled:opacity-70 touch-manipulation"
          >
            <RefreshCw className={`w-4 h-4 ${state.isAcquiring ? 'animate-spin' : ''}`} />
            <span>{state.isAcquiring ? 'Locating Precise GPS...' : 'Reload Exact Location Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
