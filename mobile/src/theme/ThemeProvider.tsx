// Contexte de thème — palette résolue selon la préférence et le système
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { DEFAULT_THEME, type ColorScheme, type ThemePref } from '@/domain/prefs';
import { resolveScheme } from './resolve';
import { duration, fonts, palettes, radius, spacing, type Palette } from './tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  fonts: typeof fonts;
  duration: typeof duration;
}

export function buildTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: palettes[scheme], spacing, radius, fonts, duration };
}

const ThemeContext = createContext<Theme>(buildTheme(resolveScheme(DEFAULT_THEME, null)));

export function ThemeProvider({ pref, children }: { pref: ThemePref; children: ReactNode }) {
  const system = useColorScheme();
  const scheme = resolveScheme(pref, system);
  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
