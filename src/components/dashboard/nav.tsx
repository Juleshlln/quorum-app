'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QuorumLogo } from '@/components/logo';
import { 
  LayoutDashboard, 
  Settings,
  Sparkles,
  Sliders,
  ListChecks,
  Globe,
  FlaskConical,
  Users
} from 'lucide-react';

const navItems = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/prompts', label: 'Monitoring', icon: ListChecks },
  { href: '/sources', label: 'Sources', icon: Globe },
  { href: '/concurrents', label: 'Concurrents', icon: Users },
  { href: '/analyses', label: 'Analyses', icon: FlaskConical },
  { href: '/brand', label: 'Brand settings', icon: Sliders },
  { href: '/settings', label: 'Paramètres', icon: Settings },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <aside className="quorum-shell-panel hidden w-[280px] flex-shrink-0 flex-col border-r backdrop-blur-2xl lg:flex">
      {/* Logo */}
      <div className="flex h-20 items-center px-6" style={{ borderBottom: '1px solid var(--quorum-shell-border)' }}>
        <Link href="/overview" className="flex flex-col gap-2">
          <QuorumLogo adaptive className="h-9 w-[176px]" priority />
          <span className="pl-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] quorum-shell-subtle">
            AI visibility OS
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 px-4 py-6">
        <div className="px-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] quorum-shell-subtle">Workspace</p>
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`quorum-nav-item group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium ${
                isActive ? 'quorum-nav-item-active' : ''
              }`}
            >
              <item.icon className="quorum-nav-icon h-5 w-5" />
              <span className="tracking-[-0.01em]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Upgrade card */}
      <div className="p-4">
        <div className="quorum-panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="quorum-text-muted h-4 w-4" />
            <span className="text-sm font-medium quorum-text-primary">Passer à Pro</span>
          </div>
          <p className="mb-5 text-xs leading-relaxed quorum-text-muted">
            Débloquez les analyses illimitées et tous les modèles IA
          </p>
          <Link 
            href="/settings" 
            className="quorum-btn-primary w-full"
          >
            Upgrade
          </Link>
        </div>
      </div>
    </aside>
  );
}
