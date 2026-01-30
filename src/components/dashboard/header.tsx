'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { 
  Menu, 
  X, 
  ChevronDown, 
  LogOut, 
  Settings, 
  User as UserIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';

interface DashboardHeaderProps {
  user: User;
  profile: Profile | null;
}

export function DashboardHeader({ user, profile }: DashboardHeaderProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'Utilisateur';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-black/80 backdrop-blur-md">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo and mobile menu */}
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            <Link href="/dashboard" className="flex items-center gap-2 text-white font-medium tracking-tight">
              <div className="w-5 h-5 bg-white/10 rounded-sm flex items-center justify-center text-xs text-white">Q</div>
              QUORUM
            </Link>
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-900 transition-colors"
            >
              <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">{initials}</span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-white">{displayName}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-zinc-500 hidden sm:block" />
            </button>

            {/* Dropdown menu */}
            {isUserMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl py-1 z-20">
                  <div className="px-4 py-3 border-b border-zinc-800">
                    <p className="text-sm font-medium text-white">{displayName}</p>
                    <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                  </div>
                  
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <UserIcon className="w-4 h-4" />
                    Mon profil
                  </Link>
                  
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4" />
                    Paramètres
                  </Link>
                  
                  <hr className="my-1 border-zinc-800" />
                  
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 w-full transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      {isMenuOpen && (
        <div className="lg:hidden border-t border-zinc-800 bg-zinc-950">
          <nav className="px-4 py-4 space-y-1">
            <MobileNavLink href="/dashboard" onClick={() => setIsMenuOpen(false)}>
              Dashboard
            </MobileNavLink>
            <MobileNavLink href="/projects" onClick={() => setIsMenuOpen(false)}>
              Projets
            </MobileNavLink>
            <MobileNavLink href="/settings" onClick={() => setIsMenuOpen(false)}>
              Paramètres
            </MobileNavLink>
          </nav>
        </div>
      )}
    </header>
  );
}

function MobileNavLink({ 
  href, 
  children, 
  onClick 
}: { 
  href: string; 
  children: React.ReactNode; 
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 font-medium transition-colors"
    >
      {children}
    </Link>
  );
}
