import { 
  FolderKanban, 
  Play, 
  TrendingUp, 
  CheckCircle 
} from 'lucide-react';

interface StatsOverviewProps {
  totalProjects: number;
  totalRuns: number;
  avgScore: number | null;
  successRate: number;
}

export function StatsOverview({ 
  totalProjects, 
  totalRuns, 
  avgScore, 
  successRate 
}: StatsOverviewProps) {
  const stats = [
    {
      label: 'Projets',
      value: totalProjects.toString(),
      icon: FolderKanban,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
    },
    {
      label: 'Analyses',
      value: totalRuns.toString(),
      icon: Play,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
    },
    {
      label: 'Score moyen',
      value: avgScore !== null ? `${avgScore}%` : '—',
      icon: TrendingUp,
      color: 'text-lime-400',
      bgColor: 'bg-lime-400/10',
    },
    {
      label: 'Taux de succès',
      value: `${successRate}%`,
      icon: CheckCircle,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="p-4 rounded-xl border border-white/10 bg-zinc-900/20"
        >
          <div className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center mb-3`}>
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <p className="text-2xl font-semibold text-white">{stat.value}</p>
          <p className="text-sm text-zinc-500">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
