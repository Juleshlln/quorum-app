'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Menu,
  LogOut,
  User,
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
    <header className="h-16 flex items-center justify-between px-6 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-40">
      {/* Mobile menu button */}
      <button className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors">
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile logo */}
      <Link href="/dashboard" className="lg:hidden flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-cyan-400 to-violet-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xs">Q</span>
        </div>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User Menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.05] transition-colors"
        >
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-violet-500/20 border border-white/[0.1] rounded-xl flex items-center justify-center">
            <span className="text-sm font-medium bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {initials}
            </span>
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-white">{displayName}</p>
            <p className="text-xs text-zinc-500">{user?.email}</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-xl shadow-black/50 overflow-hidden">
            <div className="p-3 border-b border-white/[0.06]">
              <p className="text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-zinc-500">{user?.email}</p>
            </div>
            <div className="p-2">
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                <Settings className="w-4 h-4" />
                Paramètres
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
