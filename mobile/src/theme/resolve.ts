// Résolution du schéma de couleurs et des accents de séance (pilotés par les données)
import type { ColorScheme, ThemePref } from '@/domain/prefs';
import type { Palette } from './tokens';

export function resolveScheme(pref: ThemePref, system: string | null | undefined): ColorScheme {
  if (pref !== 'system') return pref;
  return system === 'light' || system === 'dark' ? system : 'dark';
}

/** Clé d'accent du programme → couleurs ; clé inconnue → gold */
export function accentColors(palette: Palette, accent: string | null | undefined): { text: string; fill: string } {
  switch (accent) {
    case 'rust': return { text: palette.rust, fill: palette.rustFill };
    case 'blue': return { text: palette.blue, fill: palette.blueFill };
    case 'gray': return { text: palette.textDim, fill: palette.textDim };
    default: return { text: palette.gold, fill: palette.goldFill };
  }
}
