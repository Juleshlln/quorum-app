'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

interface HeaderProps {
  user: {
    email?: string;
    user_metadata?: {
      full_name?: string;
    };
  } | null;
}

export function DashboardHeader({ user }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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

  return (
    <header className="quorum-shell-panel-strong sticky top-0 z-40 flex h-20 items-center justify-between border-b px-4 backdrop-blur-2xl md:px-6">
      {/* Mobile menu button */}
      <button className="quorum-shell-action rounded-xl border border-transparent p-2 lg:hidden">
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile logo */}
      <Link href="/overview" className="flex items-center lg:hidden">
        <QuorumLogo adaptive className="h-7 w-[132px]" priority />
      </Link>

      <div className="hidden flex-1 lg:block">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] quorum-shell-subtle">Control Room</p>
        <p className="mt-1 text-sm quorum-shell-muted">Suivi quotidien de votre visibilité dans les réponses IA.</p>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="quorum-shell-action flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{
                border: '1px solid var(--quorum-shell-border)',
                background: 'var(--quorum-shell-hover)',
              }}
            >
              <span className="text-sm font-semibold quorum-shell-text">
                {initials}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium quorum-shell-text">{displayName}</p>
              <p className="text-xs quorum-shell-subtle">{user?.email}</p>
            </div>
            <ChevronDown className={`h-4 w-4 quorum-shell-subtle transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="quorum-shell-panel-strong absolute right-0 mt-2 w-60 overflow-hidden rounded-3xl backdrop-blur-2xl">
              <div className="p-4" style={{ borderBottom: '1px solid var(--quorum-shell-border)' }}>
                <p className="text-sm font-medium quorum-shell-text">{displayName}</p>
                <p className="text-xs quorum-shell-subtle">{user?.email}</p>
              </div>
              <div className="p-2">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="quorum-shell-action flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sm"
                >
                  <Settings className="w-4 h-4" />
                  Paramètres
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-red-300 transition-colors hover:bg-red-500/10"
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
