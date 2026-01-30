'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Settings,
  HelpCircle,
} from 'lucide-react';

const navigation = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard 
  },
  { 
    name: 'Projets', 
    href: '/projects', 
    icon: FolderKanban 
  },
  { 
    name: 'Paramètres', 
    href: '/settings', 
    icon: Settings 
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:border-r lg:border-white/5 lg:bg-black lg:min-h-[calc(100vh-3.5rem)]">
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-900/50 text-white border border-white/5'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-lime-400' : ''}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Help section */}
      <div className="p-3 border-t border-white/5">
        <Link
          href="/help"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900/30 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          Aide & Support
        </Link>
      </div>
    </aside>
  );
}
