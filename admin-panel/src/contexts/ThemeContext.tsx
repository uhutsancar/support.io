import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type ThemeName = 'light' | 'dark';

/** The active theme and the switches that change it. */
export interface ThemeContextValue {
  theme: ThemeName;
  toggleTheme(): void;
  setLightTheme(): void;
  setDarkTheme(): void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeName>(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' ? 'dark' : 'light';
  });
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };
  const setLightTheme = () => setTheme('light');
  const setDarkTheme = () => setTheme('dark');
  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme, 
      setLightTheme, 
      setDarkTheme,
      isDark: theme === 'dark' 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
