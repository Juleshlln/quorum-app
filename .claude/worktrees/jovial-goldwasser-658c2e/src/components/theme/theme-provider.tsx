'use client';

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_THEME,
  sanitizeTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '@/components/theme/theme';

type ThemeContextValue = {
  mounted: boolean;
  setTheme: (nextTheme: Theme) => void;
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function getDocumentTheme(): Theme {
  if (typeof document === 'undefined') {
    return DEFAULT_THEME;
  }

  return sanitizeTheme(document.documentElement.dataset.theme);
}

function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME;
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
  } catch (error) {
    return getDocumentTheme();
  }

  return getDocumentTheme();
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = resolveInitialTheme();
    applyTheme(initialTheme);
    setThemeState(initialTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    applyTheme(theme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      // Ignore storage failures and keep the in-memory theme active.
    }
  }, [mounted, theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      const nextTheme = sanitizeTheme(event.newValue);
      applyTheme(nextTheme);
      startTransition(() => setThemeState(nextTheme));
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setTheme = (nextTheme: Theme) => {
    startTransition(() => setThemeState(nextTheme));
  };

  const toggleTheme = () => {
    startTransition(() => {
      setThemeState((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
    });
  };

  const value = useMemo(
    () => ({
      mounted,
      setTheme,
      theme,
      toggleTheme,
    }),
    [mounted, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }

  return context;
}
