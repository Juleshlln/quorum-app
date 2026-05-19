export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'quorum-theme';
export const DEFAULT_THEME: Theme = 'dark';

export function sanitizeTheme(value: string | null | undefined): Theme {
  return value === 'light' ? 'light' : DEFAULT_THEME;
}

export const themeInitScript = `(() => {
  try {
    const storedTheme = window.localStorage.getItem('${THEME_STORAGE_KEY}');
    const theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : '${DEFAULT_THEME}';
    document.documentElement.dataset.theme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = '${DEFAULT_THEME}';
  }
})();`;
