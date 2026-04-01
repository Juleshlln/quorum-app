'use client';

import { Moon, SunMedium } from 'lucide-react';
import { useTheme } from '@/components/theme/theme-provider';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { mounted, theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Activer le mode sombre' : 'Activer le mode clair'}
      aria-pressed={isLight}
      title={isLight ? 'Passer en mode sombre' : 'Passer en mode clair'}
      className={cn('theme-toggle', !mounted && 'pointer-events-none', className)}
    >
      {mounted ? (
        <>
          <SunMedium
            className={cn(
              'theme-toggle__icon',
              isLight ? 'theme-toggle__icon--active' : 'theme-toggle__icon--inactive'
            )}
            strokeWidth={2}
          />
          <Moon
            className={cn(
              'theme-toggle__icon',
              isLight ? 'theme-toggle__icon--inactive' : 'theme-toggle__icon--active'
            )}
            strokeWidth={2}
          />
        </>
      ) : (
        <span aria-hidden="true" className="theme-toggle__placeholder" />
      )}
    </button>
  );
}
