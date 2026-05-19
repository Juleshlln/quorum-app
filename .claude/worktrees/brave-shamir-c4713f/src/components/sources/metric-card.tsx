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
    iconColor: 'text-emerald-300',
  },
  red: {
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-300',
  },
  zinc: {
    iconBg: 'quorum-surface',
    iconColor: 'quorum-text-muted',
  },
  violet: {
    iconBg: 'quorum-surface',
    iconColor: 'quorum-text-muted',
  },
  blue: {
    iconBg: 'quorum-surface',
    iconColor: 'quorum-text-muted',
  },
  cyan: {
    iconBg: 'quorum-surface',
    iconColor: 'quorum-text-muted',
  },
};

export function MetricCard({ label, value, suffix, description, tooltip, icon: Icon, color }: MetricCardProps) {
  const c = colorMap[color];

  return (
    <div className="quorum-panel p-5 transition-all duration-200 hover:quorum-border-strong">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-[0.22em] quorum-text-subtle inline-flex items-center gap-1">
          {label}
          {tooltip && <InfoTip text={tooltip} />}
        </p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${c.iconBg}`}>
          <Icon className={`w-4 h-4 ${c.iconColor}`} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-[-0.04em] quorum-text-primary tabular-nums">{value}</span>
        {suffix && <span className="text-sm quorum-text-subtle">{suffix}</span>}
      </div>
      {description && (
        <p className="mt-2 text-xs leading-relaxed quorum-text-muted">{description}</p>
      )}
    </div>
  );
}
