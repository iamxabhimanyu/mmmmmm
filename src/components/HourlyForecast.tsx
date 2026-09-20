import React from 'react';
import { Droplets } from 'lucide-react';
import { HourlyForecastItem } from '../types';
import { WeatherIcon } from './WeatherIcon';

interface HourlyForecastProps {
  hourly: HourlyForecastItem[];
  selectedHourIndex: number;
  onSelectHour: (index: number) => void;
  temperatureUnit?: 'C' | 'F';
}

export const HourlyForecast: React.FC<HourlyForecastProps> = ({
  hourly,
  selectedHourIndex,
  onSelectHour,
  temperatureUnit = 'C',
}) => {
  const displayTemp = (celsius: number) => {
    if (typeof celsius !== 'number' || !Number.isFinite(celsius)) return '—';
    if (temperatureUnit === 'F') {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
  };

  if (!hourly || hourly.length === 0) {
    return (
      <section className="w-full max-w-2xl mx-auto px-4 my-2">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-black/[0.05] shadow-xs text-center">
          <p className="text-xs text-slate-500 font-medium">Hourly forecast data is currently unavailable.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-2xl mx-auto px-4 my-2">
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight flex items-center gap-2">
            <span>Hourly Forecast</span>
          </h3>
          <span className="text-xs text-slate-400 font-medium">Next 24 Hours</span>
        </div>

        {/* Horizontally Scrollable Timeline */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 px-0.5 no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x">
          {hourly.slice(0, 24).map((item, idx) => {
            const isSelected = selectedHourIndex === idx;
            const isFirst = idx === 0;

            return (
              <button
                key={item.timestamp || idx}
                id={`hourly-card-${idx}`}
                onClick={() => onSelectHour(idx)}
                className={`flex flex-col items-center justify-between min-w-[64px] sm:min-w-[72px] py-2.5 px-2 rounded-2xl transition-all duration-150 shrink-0 select-none touch-manipulation active:scale-95 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm scale-102 ring-2 ring-slate-900/10'
                    : isFirst
                    ? 'bg-sky-50 text-slate-900 border border-sky-200/80 hover:bg-sky-100/70'
                    : 'bg-transparent text-slate-700 hover:bg-slate-100/70'
                }`}
                aria-label={`Forecast for ${item.time}${item.dayLabel ? ` (${item.dayLabel})` : ''}: ${displayTemp(item.temperature)} degrees, ${item.conditionText}`}
              >
                {/* Time & Day Label */}
                <div className="flex flex-col items-center mb-1.5">
                  <span
                    className={`text-xs font-semibold tracking-tight ${
                      isSelected ? 'text-slate-100' : isFirst ? 'text-sky-800' : 'text-slate-700'
                    }`}
                  >
                    {item.time}
                  </span>
                  {item.dayLabel && (
                    <span
                      className={`text-[9px] font-medium leading-none mt-0.5 ${
                        isSelected ? 'text-slate-300' : isFirst ? 'text-sky-600' : 'text-slate-400'
                      }`}
                    >
                      {item.dayLabel}
                    </span>
                  )}
                </div>

                {/* Weather Icon */}
                <div className="my-1">
                  <WeatherIcon
                    conditionKey={item.conditionKey}
                    isDay={typeof item.isDay === 'boolean' ? item.isDay : (item.time.includes('AM') ? !item.time.startsWith('12') && !item.time.startsWith('1') && !item.time.startsWith('2') && !item.time.startsWith('3') && !item.time.startsWith('4') && !item.time.startsWith('5') : !item.time.startsWith('7') && !item.time.startsWith('8') && !item.time.startsWith('9') && !item.time.startsWith('10') && !item.time.startsWith('11'))}
                    className={`w-6 h-6 ${isSelected ? 'text-amber-300' : ''}`}
                  />
                </div>

                {/* Temperature */}
                <span className={`text-base font-semibold mt-1.5 tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                  {displayTemp(item.temperature)}°
                </span>

                {/* Rain Probability Pill if > 0% */}
                <div className="h-4 mt-1.5 flex items-center justify-center">
                  {typeof item.precipitationProb === 'number' && item.precipitationProb > 0 ? (
                    <span
                      className={`text-[10px] font-semibold flex items-center gap-0.5 ${
                        isSelected ? 'text-sky-300' : 'text-blue-600'
                      }`}
                    >
                      <Droplets className="w-2.5 h-2.5 shrink-0" />
                      {item.precipitationProb}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-transparent select-none">-</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
