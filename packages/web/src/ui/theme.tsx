import { useEffect, useState } from 'react';

/**
 * Theme — light is the default, dark is a sibling palette. The choice is
 * persisted and applied as a `data-theme` attribute on the document root, which
 * the OKLCH token system keys off.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'cloud-hermes:theme';

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return {
    theme,
    toggle: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')),
  };
}

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      className="rounded-md border border-border px-2 py-1 text-[11px] uppercase tracking-wider text-text-subtle transition-colors duration-150 hover:border-border-strong"
    >
      {theme === 'light' ? 'dark' : 'light'}
    </button>
  );
}
