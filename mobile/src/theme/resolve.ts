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

/** Luminance relative (WCAG) d'une couleur #rrggbb */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs #rrggbb (1 à 21) */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Texte le plus lisible (presque noir ou blanc) sur un fond donné */
export function readableOn(background: string): string {
  return contrastRatio('#0a0a0a', background) >= contrastRatio('#ffffff', background) ? '#0a0a0a' : '#ffffff';
}
