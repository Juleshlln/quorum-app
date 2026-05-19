'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { QuorumLogo } from '@/components/logo';
import {
  LayoutDashboard,
  Settings,
  Sparkles,
  Sliders,
  ListChecks,
  Globe,
  FlaskConical,
  Users,
  Building2,
  BarChart3,
  Radar,
  Package,
  Layers3,
  ChevronDown,
  Plus,
  Loader2,
  Check,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { href: '/prompts', label: 'Radar IA', icon: ListChecks },
  { href: '/offers', label: 'Offres suivies', icon: Layers3 },
  { href: '/product-visibility', label: 'Visibilité produit', icon: Package },
  { href: '/sources', label: 'Sources', icon: Globe },
  { href: '/business-impact', label: 'Impact business', icon: BarChart3 },
  { href: '/competitive-intelligence', label: 'Veille concurrentielle', icon: Radar },
  { href: '/advisor', label: 'Actions recommandées', icon: Sparkles },
  { href: '/concurrents', label: 'Concurrents', icon: Users },
  { href: '/analyses', label: 'Analyses', icon: FlaskConical },
  { href: '/brand', label: 'Marque', icon: Sliders },
  { href: '/settings', label: 'Paramètres', icon: Settings },
];

type DashboardProject = {
  id: string;
  name: string;
  website: string | null;
};

function getProjectMeta(project: DashboardProject | null, count: number) {
  if (!project) {
    return count > 1 ? `${count} marques connectées` : 'Aucune marque active';
  }

  if (project.website) {
    const website = project.website.startsWith('http') ? project.website : `https://${project.website}`;

    try {
      return new URL(website).hostname.replace(/^www\./, '');
    } catch {
      return count > 1 ? `${count} marques connectées` : 'Marque active';
    }
  }

  return count > 1 ? `${count} marques connectées` : 'Marque active';
}

export function DashboardNav({
  projects,
  activeProjectId,
}: {
  projects: DashboardProject[];
  activeProjectId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const switcherRef = useRef<HTMLDivElement>(null);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switchingProjectId, setSwitchingProjectId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || projects[0] || null,
    [projects, activeProjectId]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setIsProjectMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsProjectMenuOpen(false);
    setSwitchError(null);
  }, [pathname]);

  const projectMeta = getProjectMeta(activeProject, projects.length);

  const handleProjectSwitch = async (projectId: string) => {
    if (projectId === activeProjectId) {
      setIsProjectMenuOpen(false);
      return;
    }

    setSwitchError(null);
    setSwitchingProjectId(projectId);

    try {
      const response = await fetch('/api/projects/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Impossible de changer de marque active.');
      }

      const nextPath = navItems.find(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
      )?.href ?? '/overview';

      setIsProjectMenuOpen(false);

      startTransition(() => {
        router.push(nextPath);
        router.refresh();
      });
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Impossible de changer de marque active.');
    } finally {
      setSwitchingProjectId(null);
    }
  };

  return (
    <aside className="quorum-shell-panel hidden w-[280px] flex-shrink-0 flex-col border-r backdrop-blur-2xl lg:flex">
      {/* Logo */}
      <div className="flex h-20 items-center px-6" style={{ borderBottom: '1px solid var(--quorum-shell-border)' }}>
        <Link href="/overview" className="flex items-center">
          <QuorumLogo adaptive className="h-8 w-auto" priority />
        </Link>
      </div>

      <div className="px-4 py-5" style={{ borderBottom: '1px solid var(--quorum-shell-border)' }}>
        <div className="px-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] quorum-shell-subtle">Marques</p>
        </div>

        <div className="relative mt-3" ref={switcherRef}>
          <button
            type="button"
            onClick={() => setIsProjectMenuOpen((open) => !open)}
            className={cn(
              'quorum-shell-action flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left',
              isProjectMenuOpen && 'border-[color:var(--quorum-shell-border)] bg-[var(--quorum-shell-hover)] quorum-shell-text'
            )}
            style={{
              borderColor: 'var(--quorum-shell-border)',
              background: 'rgba(255,255,255,0.02)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{
                border: '1px solid var(--quorum-shell-border)',
                background: 'var(--quorum-shell-hover)',
              }}
            >
              <Building2 className="h-4 w-4 quorum-shell-text" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold quorum-shell-text">
                {activeProject?.name || 'Ajouter une marque'}
              </p>
              <p className="mt-1 truncate text-xs quorum-shell-subtle">
                {projectMeta}
              </p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 quorum-shell-subtle transition-transform',
                isProjectMenuOpen && 'rotate-180'
              )}
            />
          </button>

          {isProjectMenuOpen && (
            <div
              className="quorum-shell-panel-strong mt-2 overflow-hidden rounded-[24px] border p-2"
              style={{ borderColor: 'var(--quorum-shell-border)' }}
            >
              <div className="space-y-1">
                {projects.map((project) => {
                  const isActiveProject = project.id === activeProjectId;
                  const isSwitching = switchingProjectId === project.id;

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => handleProjectSwitch(project.id)}
                      disabled={isActiveProject || isSwitching || isPending}
                      className={cn(
                        'quorum-shell-action flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left',
                        isActiveProject && 'border-[color:var(--quorum-shell-border)] bg-[var(--quorum-shell-hover)] quorum-shell-text'
                      )}
                    >
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{
                          border: '1px solid var(--quorum-shell-border)',
                          background: isActiveProject ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        {isSwitching ? (
                          <Loader2 className="h-4 w-4 animate-spin quorum-shell-text" />
                        ) : isActiveProject ? (
                          <Check className="h-4 w-4 quorum-shell-text" />
                        ) : (
                          <Building2 className="h-4 w-4 quorum-shell-subtle" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium quorum-shell-text">{project.name}</p>
                        <p className="mt-1 truncate text-[11px] quorum-shell-subtle">
                          {isActiveProject ? 'Marque active' : getProjectMeta(project, projects.length)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {switchError && (
                <p className="px-3 pb-2 pt-3 text-xs text-red-300">
                  {switchError}
                </p>
              )}

              <div className="px-1 pb-1 pt-2">
                <Link
                  href="/projects/new"
                  className="quorum-shell-action flex w-full items-center gap-3 rounded-2xl border border-dashed px-3 py-3 text-sm"
                  style={{ borderColor: 'var(--quorum-shell-border)' }}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      border: '1px solid var(--quorum-shell-border)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Plus className="h-4 w-4 quorum-shell-text" />
                  </div>
                  <div>
                    <p className="text-sm font-medium quorum-shell-text">Ajouter une marque</p>
                    <p className="mt-1 text-[11px] quorum-shell-subtle">Créer un nouveau workspace à monitorer</p>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
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
