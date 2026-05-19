'use client';

import { Eye, Target, Heart, TrendingUp } from 'lucide-react';

interface MetricData {
  visibility: number | null;
  accuracy: number | null;
  sentiment: number | null;
  overall: number | null;
}

interface MetricsBreakdownProps {
  current: MetricData;
  previous?: MetricData;
}

export function MetricsBreakdown({ current, previous }: MetricsBreakdownProps) {
  const metrics = [
    {
      key: 'overall',
      label: 'Score Global',
      icon: TrendingUp,
      color: 'lime',
      value: current.overall,
      prevValue: previous?.overall,
    },
    {
      key: 'visibility',
      label: 'Visibilité',
      icon: Eye,
      color: 'blue',
      value: current.visibility,
      prevValue: previous?.visibility,
    },
    {
      key: 'accuracy',
      label: 'Position',
      icon: Target,
      color: 'purple',
      value: current.accuracy,
      prevValue: previous?.accuracy,
    },
    {
      key: 'sentiment',
      label: 'Sentiment',
      icon: Heart,
      color: 'pink',
      value: current.sentiment,
      prevValue: previous?.sentiment,
    },
  ];

  const colorClasses = {
    lime: {
      bar: 'bg-lime-400',
      text: 'text-lime-400',
      bg: 'bg-lime-400/10',
    },
    blue: {
      bar: 'bg-blue-400',
      text: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    purple: {
      bar: 'bg-purple-400',
      text: 'text-purple-400',
      bg: 'bg-purple-400/10',
    },
    pink: {
      bar: 'bg-pink-400',
      text: 'text-pink-400',
      bg: 'bg-pink-400/10',
    },
  };

  return (
    <div className="space-y-4">
      {metrics.map((metric) => {
        const colors = colorClasses[metric.color as keyof typeof colorClasses];
        const value = metric.value ?? 0;
        const diff = metric.prevValue !== undefined && metric.prevValue !== null
          ? value - metric.prevValue
          : null;

        return (
          <div key={metric.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <metric.icon className={`w-4 h-4 ${colors.text}`} />
                <span className="text-sm text-zinc-400">{metric.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${colors.text}`}>
                  {metric.value !== null ? `${metric.value}%` : '—'}
                </span>
                {diff !== null && diff !== 0 && (
                  <span className={`text-xs ${diff > 0 ? 'text-lime-400' : 'text-red-400'}`}>
                    {diff > 0 ? '+' : ''}{diff}
                  </span>
                )}
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 quorum-surface-strong rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
