'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ScorePoint {
  date: string;
  score: number;
  label?: string;
}

interface ScoreChartProps {
  data: ScorePoint[];
  height?: number;
}

export function ScoreChart({ data, height = 200 }: ScoreChartProps) {
  if (data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-zinc-500 text-sm"
        style={{ height }}
      >
        Aucune donnée disponible
      </div>
    );
  }

  const maxScore = 100;
  const minScore = 0;
  
  // Calculate trend
  const firstScore = data[0]?.score || 0;
  const lastScore = data[data.length - 1]?.score || 0;
  const trend = lastScore - firstScore;

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div 
        className="relative flex items-end gap-2 px-2"
        style={{ height }}
      >
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-zinc-500 -ml-1">
          <span>100</span>
          <span>50</span>
          <span>0</span>
        </div>

        {/* Bars */}
        <div className="flex-1 flex items-end gap-1 ml-6">
          {data.map((point, index) => {
            const heightPercent = ((point.score - minScore) / (maxScore - minScore)) * 100;
            const isLast = index === data.length - 1;
            
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center gap-1 group"
              >
                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white bg-zinc-800 px-2 py-1 rounded whitespace-nowrap">
                  {point.score}%
                </div>
                
                {/* Bar */}
                <div
                  className={`w-full rounded-t transition-all duration-300 ${
                    isLast 
                      ? point.score >= 70 
                        ? 'bg-lime-400' 
                        : point.score >= 50 
                        ? 'bg-yellow-400' 
                        : 'bg-red-400'
                      : 'bg-zinc-700 hover:bg-zinc-600'
                  }`}
                  style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex gap-1 ml-8 text-xs text-zinc-500">
        {data.map((point, index) => (
          <div key={index} className="flex-1 text-center truncate">
            {point.label || point.date}
          </div>
        ))}
      </div>

      {/* Trend indicator */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-sm text-zinc-400">Tendance</span>
        <div className={`flex items-center gap-1 text-sm font-medium ${
          trend > 0 ? 'text-lime-400' : trend < 0 ? 'text-red-400' : 'text-zinc-400'
        }`}>
          {trend > 0 ? (
            <TrendingUp className="w-4 h-4" />
          ) : trend < 0 ? (
            <TrendingDown className="w-4 h-4" />
          ) : (
            <Minus className="w-4 h-4" />
          )}
          {trend > 0 ? '+' : ''}{trend}%
        </div>
      </div>
    </div>
  );
}
