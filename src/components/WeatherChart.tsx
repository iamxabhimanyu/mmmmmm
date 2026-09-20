import React, { useState } from 'react';
import { HourlyForecastItem } from '../types';
import { Droplets, Thermometer, Wind } from 'lucide-react';

interface WeatherChartProps {
  hourly: HourlyForecastItem[];
  temperatureUnit?: 'C' | 'F';
}

export const WeatherChart: React.FC<WeatherChartProps> = ({
  hourly,
  temperatureUnit = 'C',
}) => {
  const [activeTab, setActiveTab] = useState<'temp' | 'rain'>('temp');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const displayTemp = (celsius: number) => {
    if (temperatureUnit === 'F') return Math.round((celsius * 9) / 5 + 32);
    return Math.round(celsius);
  };

  const slice = hourly.slice(0, 16);
  if (slice.length < 2) return null;

  const validItems = slice.filter(
    (h) => typeof h.temperature === 'number' && Number.isFinite(h.temperature)
  );
  if (validItems.length < 2) return null;

  const temps = validItems.map((h) => displayTemp(h.temperature));
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const tempRange = Math.max(maxTemp - minTemp, 4);

  // SVG dimensions
  const width = 600;
  const height = 140;
  const paddingX = 30;
  const paddingTop = 25;
  const paddingBottom = 30;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate points
  const points = validItems.map((item, idx) => {
    const x = paddingX + (idx / (validItems.length - 1)) * (width - paddingX * 2);
    const tempVal = displayTemp(item.temperature);
    // Invert Y so highest temp is at top
    const y = paddingTop + chartHeight - ((tempVal - minTemp) / tempRange) * chartHeight;
    return { x, y, item, tempVal };
  });

  // Smooth SVG Bezier Path
  const makeBezierPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const linePath = makeBezierPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - 10} L ${points[0].x} ${height - 10} Z`;

  const activePoint = hoverIndex !== null ? points[hoverIndex] : points[0];

  return (
    <section className="w-full max-w-2xl mx-auto px-4 my-2">
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs">
        {/* Header & View Switcher */}
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-3 px-1">
          <div className="flex flex-wrap items-center gap-1.5 xs:gap-2">
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Weather Trends</h3>
            {activePoint && (
              <span className="text-[11px] xs:text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900/5 text-slate-700">
                {activePoint.item.dayLabel && activePoint.item.dayLabel !== 'Today' ? `${activePoint.item.dayLabel} ` : ''}{activePoint.item.time}: {activePoint.tempVal}°{temperatureUnit} ({activePoint.item.precipitationProb}% Rain)
              </span>
            )}
          </div>

          {/* Minimal Rounded Pill Controls */}
          <div className="flex items-center p-0.5 rounded-full bg-slate-100 border border-black/[0.04] self-start xs:self-auto shrink-0">
            <button
              id="chart-tab-temp"
              onClick={() => setActiveTab('temp')}
              className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-full transition-all touch-manipulation active:scale-95 ${
                activeTab === 'temp' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Temperature
            </button>
            <button
              id="chart-tab-rain"
              onClick={() => setActiveTab('rain')}
              className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-full transition-all touch-manipulation active:scale-95 ${
                activeTab === 'rain' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Rain %
            </button>
          </div>
        </div>

        {/* Minimal SVG Chart */}
        <div className="relative w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible cursor-crosshair"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Subtle horizontal baseline */}
            <line
              x1={paddingX}
              y1={height - 15}
              x2={width - paddingX}
              y2={height - 15}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
              strokeWidth="1"
            />

            {activeTab === 'temp' ? (
              <>
                {/* Gradient area fill */}
                <path d={areaPath} fill="url(#tempGradient)" />
                {/* Smooth temperature line */}
                <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />

                {/* Point nodes & touch hitboxes */}
                {points.map((pt, idx) => (
                  <g key={idx} onMouseEnter={() => setHoverIndex(idx)} onTouchStart={() => setHoverIndex(idx)}>
                    {/* Value label on alternating/spaced nodes */}
                    {(idx % 2 === 0 || idx === points.length - 1) && (
                      <text
                        x={pt.x}
                        y={pt.y - 10}
                        textAnchor="middle"
                        className="text-[11px] font-semibold fill-slate-700 select-none"
                      >
                        {pt.tempVal}°
                      </text>
                    )}

                    {/* Time text along bottom */}
                    <text
                      x={pt.x}
                      y={height - 2}
                      textAnchor="middle"
                      className={`text-[10px] select-none ${
                        hoverIndex === idx ? 'fill-slate-900 font-semibold' : 'fill-slate-400 font-medium'
                      }`}
                    >
                      {pt.item.time}
                    </text>

                    {/* Dot on line */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hoverIndex === idx ? 4.5 : 2.5}
                      className={hoverIndex === idx ? 'fill-amber-500 stroke-white stroke-2' : 'fill-amber-400'}
                    />

                    {/* Invisible expanded hit area for touch/hover */}
                    <rect
                      x={pt.x - width / (slice.length * 2)}
                      y={0}
                      width={width / slice.length}
                      height={height}
                      fill="transparent"
                      className="cursor-pointer"
                    />
                  </g>
                ))}
              </>
            ) : (
              <>
                {/* Rain probability bars */}
                {points.map((pt, idx) => {
                  const prob =
                    typeof pt.item.precipitationProb === 'number' &&
                    Number.isFinite(pt.item.precipitationProb)
                      ? Math.max(0, Math.min(100, pt.item.precipitationProb))
                      : 0;
                  const barHeight = Math.max((prob / 100) * (chartHeight + 10), prob > 0 ? 4 : 0);
                  const barY = height - 20 - barHeight;
                  const barWidth = 14;

                  return (
                    <g key={idx} onMouseEnter={() => setHoverIndex(idx)} onTouchStart={() => setHoverIndex(idx)}>
                      {/* Bar */}
                      <rect
                        x={pt.x - barWidth / 2}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        rx="4"
                        className={hoverIndex === idx ? 'fill-sky-600' : 'fill-sky-400/80'}
                      />

                      {/* Prob text */}
                      {prob > 0 && (
                        <text
                          x={pt.x}
                          y={barY - 5}
                          textAnchor="middle"
                          className="text-[10px] font-semibold fill-sky-700 select-none"
                        >
                          {prob}%
                        </text>
                      )}

                      {/* Time text along bottom */}
                      <text
                        x={pt.x}
                        y={height - 2}
                        textAnchor="middle"
                        className={`text-[10px] select-none ${
                          hoverIndex === idx ? 'fill-slate-900 font-semibold' : 'fill-slate-400 font-medium'
                        }`}
                      >
                        {pt.item.time}
                      </text>

                      {/* Invisible touch hitbox */}
                      <rect
                        x={pt.x - width / (slice.length * 2)}
                        y={0}
                        width={width / slice.length}
                        height={height}
                        fill="transparent"
                        className="cursor-pointer"
                      />
                    </g>
                  );
                })}
              </>
            )}
          </svg>
        </div>
      </div>
    </section>
  );
};
