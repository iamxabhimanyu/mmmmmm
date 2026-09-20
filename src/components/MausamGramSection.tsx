import React, { useState } from 'react';
import { Users, ThumbsUp, Plus, MapPin, CheckCircle, Clock, X, Send } from 'lucide-react';
import { CitizenReport } from '../types';
import { INITIAL_CITIZEN_REPORTS } from '../data/constants';
import { WeatherIcon } from './WeatherIcon';

export const MausamGramSection: React.FC<{ currentCity: string; currentTemp?: number }> = ({
  currentCity,
  currentTemp,
}) => {
  const [reports, setReports] = useState<CitizenReport[]>(INITIAL_CITIZEN_REPORTS);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(`${currentCity}, Local Area`);
  const [userTemp, setUserTemp] = useState<string>(
    typeof currentTemp === 'number' ? `${Math.round(currentTemp)}` : '28'
  );
  const [conditionText, setConditionText] = useState('Clear Sky');
  const [notes, setNotes] = useState('');
  const [tag, setTag] = useState<'Clear Sky' | 'Rainfall' | 'Waterlogging' | 'Hailstorm' | 'Fog'>('Clear Sky');

  const handleUpvote = (id: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, upvotes: r.upvotes + 1 } : r))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;

    const parsedTemp = parseFloat(userTemp);
    const repTemp = !isNaN(parsedTemp)
      ? Math.round(parsedTemp)
      : typeof currentTemp === 'number'
      ? Math.round(currentTemp)
      : 28;

    const newRep: CitizenReport = {
      id: `rep-${Date.now()}`,
      location: userLocation,
      state: 'India',
      condition: conditionText,
      conditionKey: tag === 'Rainfall' || tag === 'Waterlogging' ? 'rain' : tag === 'Fog' ? 'fog' : 'clear',
      temp: repTemp,
      timeAgo: 'Just now',
      reporterName: 'You (Citizen)',
      verified: false,
      upvotes: 1,
      notes,
      tag,
    };

    setReports([newRep, ...reports]);
    setNotes('');
    setIsSubmitOpen(false);
  };

  return (
    <section className="w-full max-w-2xl mx-auto px-4 my-2">
      <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
        {/* Header */}
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-100 text-purple-800 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                MausamGram (Citizen Weather)
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Hyperlocal ground truth observations from citizens
              </p>
            </div>
          </div>

          <button
            id="mausamgram-report-btn"
            onClick={() => setIsSubmitOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:bg-slate-950 transition-all shadow-xs self-start xs:self-auto shrink-0 touch-manipulation active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Report Weather</span>
          </button>
        </div>

        {/* Reports Feed */}
        <div className="space-y-2.5">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col gap-2 min-w-0"
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <WeatherIcon conditionKey={rep.conditionKey} isDay={true} className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate">{rep.location}</span>
                      {rep.verified && (
                        <CheckCircle className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                      <Clock className="w-2.5 h-2.5 shrink-0" /> {rep.timeAgo} by {rep.reporterName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      rep.tag === 'Waterlogging'
                        ? 'bg-rose-100 text-rose-800'
                        : rep.tag === 'Rainfall'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {rep.tag}
                  </span>
                  <span className="text-xs font-bold text-slate-800">{rep.temp}°C</span>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed pl-1 sm:pl-6">{rep.notes}</p>

              <div className="flex items-center justify-between pt-1 pl-1 sm:pl-6 text-[11px] text-slate-500">
                <span className="text-[10px] text-slate-400 font-medium truncate max-w-[140px]">
                  {rep.condition}
                </span>
                <button
                  id={`mausamgram-upvote-${rep.id}`}
                  onClick={() => handleUpvote(rep.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 transition-all text-[11px] font-semibold shrink-0 touch-manipulation active:scale-95"
                >
                  <ThumbsUp className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Helpful ({rep.upvotes})</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit Observation Modal */}
      {isSubmitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[88vh] overflow-y-auto p-4 sm:p-5 shadow-2xl border border-slate-200 overscroll-contain">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">
                Share Weather Observation (MausamGram)
              </h4>
              <button
                id="mausamgram-modal-close"
                onClick={() => setIsSubmitOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors touch-manipulation active:scale-95 shrink-0"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Location Area
                </label>
                <input
                  type="text"
                  value={userLocation}
                  onChange={(e) => setUserLocation(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[44px] rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Estimated / Observed Temperature (°C)
                </label>
                <input
                  type="number"
                  value={userTemp}
                  onChange={(e) => setUserTemp(e.target.value)}
                  placeholder="e.g. 28"
                  className="w-full px-3 py-2.5 min-h-[44px] rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Tag Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['Clear Sky', 'Rainfall', 'Waterlogging', 'Hailstorm', 'Fog'] as const).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => {
                        setTag(t);
                        setConditionText(t === 'Waterlogging' ? 'Heavy Rain with Waterlogging' : t);
                      }}
                      className={`text-xs px-3 py-1.5 min-h-[36px] rounded-full font-medium transition-colors touch-manipulation active:scale-95 ${
                        tag === t ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Observation / Road Situation
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Sudden thunderstorm started 10 minutes ago, knee-deep water near bus station..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-normal focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitOpen(false)}
                  className="px-4 py-2 min-h-[44px] rounded-full text-xs font-medium text-slate-500 hover:bg-slate-100 active:bg-slate-200 touch-manipulation active:scale-95"
                >
                  Cancel
                </button>
                <button
                  id="mausamgram-submit-btn"
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 min-h-[44px] rounded-full bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 active:bg-sky-800 transition-all touch-manipulation active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Observation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
