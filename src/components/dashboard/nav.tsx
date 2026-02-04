'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Settings,
  Sparkles,
  Sliders,
  ListChecks,
  Globe,
  FlaskConical
} from 'lucide-react';

const navItems = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/prompts', label: 'Monitoring', icon: ListChecks },
  { href: '/sources', label: 'Sources', icon: Globe },
  { href: '/analyses', label: 'Analyses', icon: FlaskConical },
  { href: '/brand', label: 'Brand settings', icon: Sliders },
  { href: '/settings', label: 'Paramètres', icon: Settings },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 border-r border-white/[0.06] bg-[#0a0a0f]/50 backdrop-blur-xl hidden lg:flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
        <Link href="/overview" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-cyan-400 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <span className="font-semibold text-lg text-white tracking-tight">Quorum</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-violet-500/10 text-white border border-blue-500/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : ''}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade card */}
      <div className="p-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-violet-500/10 border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-medium text-white">Passer à Pro</span>
          </div>
          <p className="text-xs text-zinc-400 mb-4">
            Débloquez les analyses illimitées et tous les modèles IA
          </p>
          <Link 
            href="/settings" 
            className="block text-center text-sm font-medium py-2 rounded-lg bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 text-white hover:opacity-90 transition-all"
          >
            Upgrade
          </Link>
        </div>
      </div>
    </aside>
  );
}
