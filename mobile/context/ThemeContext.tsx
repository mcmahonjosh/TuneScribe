import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_THEME_ID,
  ThemeId,
  themes,
  type AppTheme,
} from '@/constants/theme';
import { loadThemeId, saveThemeId } from '@/storage/themePreferences';

interface ThemeContextValue {
  theme: AppTheme;
  themeId: ThemeId;
  toggleTheme: () => void;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  useEffect(() => {
    void loadThemeId().then((stored) => {
      if (stored) {
        setThemeIdState(stored);
      }
    });
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    void saveThemeId(id);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeId(themeId === 'violet' ? 'amber' : 'violet');
  }, [setThemeId, themeId]);

  const value = useMemo(
    () => ({
      theme: themes[themeId],
      themeId,
      toggleTheme,
      setThemeId,
    }),
    [themeId, toggleTheme, setThemeId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
