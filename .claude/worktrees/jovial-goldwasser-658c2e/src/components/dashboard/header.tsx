'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { QuorumLogo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import {
  Menu,
  LogOut,
  ChevronDown,
  Settings
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  user: {
    email?: string;
    user_metadata?: {
      full_name?: string;
    };
  } | null;
}

const DASHBOARD_SECTIONS = [
  { href: '/overview', label: 'Overview' },
  { href: '/prompts', label: 'Monitoring' },
  { href: '/sources', label: 'Sources' },
  { href: '/concurrents', label: 'Concurrents' },
  { href: '/analyses', label: 'Analyses' },
  { href: '/brand', label: 'Brand settings' },
  { href: '/settings', label: 'Paramètres' },
  { href: '/projects', label: 'Projects' },
] as const;

function getActiveSection(pathname: string) {
  return DASHBOARD_SECTIONS.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    ?.label ?? 'Workspace';
}

export function DashboardHeader({ user }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const activeSection = getActiveSection(pathname);

  return (
    <header
      className="quorum-shell-panel-strong sticky top-0 z-40 flex h-20 items-center gap-4 border-b px-4 backdrop-blur-2xl md:px-6 xl:px-8"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-5">
        {/* Mobile menu button */}
        <button className="quorum-shell-action rounded-2xl border border-transparent p-2.5 lg:hidden">
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile logo */}
        <Link href="/overview" className="flex items-center lg:hidden">
          <QuorumLogo adaptive className="h-7 w-auto" priority />
        </Link>

        {/* Left: context block */}
        <div className="hidden min-w-0 items-center gap-4 lg:flex">
          <div
            className="flex h-10 items-center rounded-full border px-4"
            style={{
              borderColor: 'var(--quorum-shell-border)',
              background: 'rgba(255,255,255,0.02)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] quorum-shell-subtle">
              {activeSection}
            </span>
          </div>

          <div
            className="h-9"
            style={{ width: '1px', background: 'var(--quorum-shell-border)' }}
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: '#6ee7b7', boxShadow: '0 0 10px rgba(110,231,183,0.45)' }}
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.24em] quorum-shell-subtle">
                Control Room
              </span>
            </div>
            <p className="mt-1 truncate text-[14px] leading-none quorum-shell-muted">
              Suivi de votre visibilité dans les réponses IA
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle className="theme-toggle--header" />

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              'quorum-shell-action flex h-12 items-center gap-3 rounded-[22px] border px-2 pr-3',
              menuOpen && 'bg-[var(--quorum-shell-hover)] quorum-shell-text'
            )}
            style={{
              borderColor: menuOpen ? 'var(--quorum-shell-border)' : 'rgba(255,255,255,0.05)',
              background: menuOpen ? 'var(--quorum-shell-hover)' : 'rgba(255,255,255,0.02)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[14px]"
              style={{
                border: '1px solid var(--quorum-shell-border)',
                background: 'var(--quorum-shell-hover)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              <span className="text-xs font-semibold quorum-shell-text">
                {initials}
              </span>
            </div>
            <div className="hidden min-w-0 text-left md:block">
              <p className="truncate text-[13px] font-semibold leading-none quorum-shell-text">
                {displayName}
              </p>
              <p className="mt-1 truncate text-[11px] leading-none quorum-shell-subtle">
                Compte Quorum
              </p>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 quorum-shell-subtle transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="quorum-shell-panel-strong absolute right-0 mt-2.5 w-60 overflow-hidden rounded-[22px] backdrop-blur-2xl">
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--quorum-shell-border)' }}>
                <p className="text-sm font-medium quorum-shell-text">{displayName}</p>
                <p className="text-xs quorum-shell-subtle">{user?.email}</p>
              </div>
              <div className="p-1.5">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="quorum-shell-action flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm"
                >
                  <Settings className="w-4 h-4" />
                  Paramètres
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <LogOut className="w-4 h-4" />
                  Déconnexion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
