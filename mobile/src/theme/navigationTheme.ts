// Thème React Navigation construit sur la palette de l'app : le fond des conteneurs de pile
// (visible pendant les transitions, le glissement retour et l'ouverture des modales) est celui de l'app.
import { DarkTheme, DefaultTheme } from 'expo-router';
import type { ColorScheme } from '@/domain/prefs';
import type { Palette } from './tokens';

export function navigationTheme(p: Palette, scheme: ColorScheme) {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: p.gold,
      background: p.bg,
      card: p.bgCard,
      text: p.text,
      border: p.border,
      notification: p.rust,
    },
  };
}
