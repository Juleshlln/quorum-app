"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Calendar, Info } from "lucide-react";

type DataPoint = {
  date: string;
  fullDate: string;
  score: number;
  runId?: string;
};

interface ScoreEvolutionChartProps {
  data: DataPoint[];
  height?: number;
}

export function ScoreEvolutionChart({ data, height = 200 }: ScoreEvolutionChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = data.length > 0 ? data : [];
  const hasData = chartData.length > 0;

  // Calculs de tendance
  const lastScore = chartData[chartData.length - 1]?.score ?? 0;
  const previousScore = chartData[chartData.length - 2]?.score ?? lastScore;
  const firstScore = chartData[0]?.score ?? lastScore;
  
  const shortTrend = lastScore - previousScore;
  const longTrend = lastScore - firstScore;
  
  // Moyenne
  const avgScore = chartData.length > 0 
    ? Math.round(chartData.reduce((sum, d) => sum + d.score, 0) / chartData.length) 
    : 0;
  
  // Min / Max
  const scores = chartData.map((d) => d.score);
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 100;

  // Y-axis (échelle dynamique avec padding)
  const yMin = Math.max(0, minScore - 10);
  const yMax = Math.min(100, maxScore + 10);
  const yRange = yMax - yMin || 1;

  const scaleY = (score: number) => {
    return ((score - yMin) / yRange) * 100;
  };

  // Générer les labels Y
  const yLabels = [yMax, Math.round(yMin + yRange * 0.66), Math.round(yMin + yRange * 0.33), yMin];

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center mb-4">
          <TrendingUp className="w-7 h-7 text-cyan-400" />
        </div>
        <p className="text-zinc-400 text-sm mb-1">Aucune donnée disponible</p>
        <p className="text-zinc-500 text-xs">Lancez une analyse pour voir l&apos;évolution</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header avec métriques clés */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Score actuel + tendance */}
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Score actuel</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                {lastScore}%
              </span>
              {shortTrend !== 0 && (
                <span
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                    shortTrend > 0
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/15 text-red-400 border border-red-500/20"
                  }`}
                >
                  {shortTrend > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {shortTrend > 0 ? "+" : ""}{shortTrend} pts
                </span>
              )}
              {shortTrend === 0 && chartData.length > 1 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-zinc-500/15 text-zinc-400 border border-zinc-500/20">
                  <Minus className="w-3.5 h-3.5" />
                  Stable
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mini stats */}
        <div className="flex gap-6">
          <div className="text-right">
            <p className="text-xs text-zinc-500 mb-0.5">Moyenne</p>
            <p className="text-lg font-semibold text-white">{avgScore}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 mb-0.5">Min</p>
            <p className="text-lg font-semibold text-zinc-400">{minScore}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 mb-0.5">Max</p>
            <p className="text-lg font-semibold text-cyan-400">{maxScore}%</p>
          </div>
        </div>
      </div>

      {/* Tendance longue période */}
      {chartData.length >= 3 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/50 border border-white/[0.06]">
          <Info className="w-4 h-4 text-zinc-500" />
          <p className="text-xs text-zinc-400">
            <span className="text-zinc-300 font-medium">Tendance globale :</span>{" "}
            {longTrend > 0 ? (
              <span className="text-emerald-400">+{longTrend} points depuis la 1ère analyse</span>
            ) : longTrend < 0 ? (
              <span className="text-red-400">{longTrend} points depuis la 1ère analyse</span>
            ) : (
              <span className="text-zinc-400">Score stable depuis la 1ère analyse</span>
            )}
          </p>
        </div>
      )}

      {/* Chart */}
      <div className="relative" style={{ height }}>
        {/* Y-axis */}
        <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between items-end pr-2">
          {yLabels.map((label, i) => (
            <span key={i} className="text-[11px] text-zinc-500 tabular-nums">
              {label}%
            </span>
          ))}
        </div>

        {/* Chart area */}
        <div className="ml-12 h-full flex flex-col">
          {/* Grid + bars */}
          <div className="relative flex-1 border-l border-b border-zinc-800/80">
            {/* Horizontal grid lines */}
            {yLabels.map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-zinc-800/50 border-dashed"
                style={{ top: `${(i / (yLabels.length - 1)) * 100}%` }}
              />
            ))}

            {/* Average line */}
            <div
              className="absolute left-0 right-0 border-t-2 border-cyan-500/30 z-10"
              style={{ top: `${100 - scaleY(avgScore)}%` }}
            >
              <span className="absolute -top-3 right-0 text-[10px] text-cyan-400/70 bg-zinc-900 px-1 rounded">
                Moy.
              </span>
            </div>

            {/* Bars */}
            <div className="absolute inset-0 flex items-end gap-1.5 p-1">
              {chartData.map((point, i) => {
                const barHeight = scaleY(point.score);
                const isHovered = hoveredIndex === i;
                const isLast = i === chartData.length - 1;
                const isBelowAvg = point.score < avgScore;

                return (
                  <div
                    key={i}
                    className="relative flex-1 flex flex-col items-center justify-end group cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-full mb-3 z-20 min-w-[120px]">
                        <div className="relative px-3 py-2.5 rounded-xl bg-zinc-800 border border-white/[0.1] shadow-2xl">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${isLast ? 'bg-cyan-400' : 'bg-blue-400'}`} />
                            <span className="text-lg font-bold text-white">{point.score}%</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <Calendar className="w-3 h-3" />
                            {point.fullDate}
                          </div>
                          {i > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-white/[0.06]">
                              <span className={`text-xs ${
                                point.score > chartData[i-1].score 
                                  ? 'text-emerald-400' 
                                  : point.score < chartData[i-1].score 
                                    ? 'text-red-400' 
                                    : 'text-zinc-400'
                              }`}>
                                {point.score > chartData[i-1].score && '+'}
                                {point.score - chartData[i-1].score} pts vs précédent
                              </span>
                            </div>
                          )}
                          {/* Arrow */}
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-800 border-r border-b border-white/[0.1] rotate-45" />
                        </div>
                      </div>
                    )}

                    {/* Bar */}
                    <div
                      className={`w-full rounded-t-lg transition-all duration-200 ${
                        isLast
                          ? "bg-gradient-to-t from-blue-600 via-cyan-500 to-cyan-400 shadow-lg shadow-cyan-500/20"
                          : isBelowAvg
                            ? "bg-gradient-to-t from-blue-600/40 to-blue-400/40"
                            : "bg-gradient-to-t from-blue-600/60 via-cyan-500/60 to-cyan-400/60"
                      } ${isHovered ? "opacity-100 brightness-110" : "opacity-90 hover:opacity-100"}`}
                      style={{
                        height: `${Math.max(8, barHeight)}%`,
                        minHeight: '8px',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex gap-1.5 pt-2 px-1">
            {chartData.map((point, i) => (
              <div
                key={i}
                className={`flex-1 text-center text-[10px] truncate transition-colors ${
                  hoveredIndex === i ? "text-white font-medium" : "text-zinc-500"
                }`}
              >
                {point.date}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gradient-to-t from-blue-600 via-cyan-500 to-cyan-400" />
            <span>Dernière analyse</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gradient-to-t from-blue-600/60 to-cyan-400/60" />
            <span>Précédentes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-cyan-500/50" />
            <span>Moyenne</span>
          </div>
        </div>
        <span className="text-xs text-zinc-600">
          {chartData.length} analyse{chartData.length > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
