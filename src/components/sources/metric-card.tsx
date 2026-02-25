'use client';

import { type LucideIcon } from 'lucide-react';
import { InfoTip } from './info-tip';

type MetricCardProps = {
  label: string;
  value: string | number;
  suffix?: string;
  description?: string;
  tooltip?: string;
  icon: LucideIcon;
  color: 'emerald' | 'red' | 'zinc' | 'violet' | 'blue' | 'cyan';
};

const colorMap = {
  emerald: {
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    valueBorder: 'border-emerald-500/20',
  },
  red: {
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-400',
    valueBorder: 'border-red-500/20',
  },
  zinc: {
    iconBg: 'bg-zinc-500/10',
    iconColor: 'text-zinc-400',
    valueBorder: 'border-zinc-500/20',
  },
  violet: {
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
    valueBorder: 'border-violet-500/20',
  },
  blue: {
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    valueBorder: 'border-blue-500/20',
  },
  cyan: {
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
    valueBorder: 'border-cyan-500/20',
  },
};

export function MetricCard({ label, value, suffix, description, tooltip, icon: Icon, color }: MetricCardProps) {
  const c = colorMap[color];

  return (
    <div className="group rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 transition-all duration-200 hover:border-white/[0.12] hover:bg-zinc-900/50">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium inline-flex items-center gap-1">
          {label}
          {tooltip && <InfoTip text={tooltip} />}
        </p>
        <div className={`w-8 h-8 rounded-xl ${c.iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.iconColor}`} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-white tabular-nums">{value}</span>
        {suffix && <span className="text-sm text-zinc-500">{suffix}</span>}
      </div>
      {description && (
        <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{description}</p>
      )}
    </div>
  );
}
