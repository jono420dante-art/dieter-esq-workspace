import { createContext, useContext, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

const ACCENTS = ['purple', 'blue', 'green', 'orange', 'pink', 'cyan'];

export function ThemeProvider({ children }) {
  const [accent, setAccent] = useState('purple');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const cycleAccent = useCallback(() => {
    setAccent((prev) => {
      const idx = ACCENTS.indexOf(prev);
      return ACCENTS[(idx + 1) % ACCENTS.length];
    });
  }, []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((p) => !p), []);

  return (
    <ThemeContext.Provider value={{ accent, setAccent, cycleAccent, ACCENTS, sidebarCollapsed, toggleSidebar }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
