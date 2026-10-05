// ============================================================
// Préférences utilisateur — valeurs autorisées et gardes de type
// ============================================================
export type Lang = 'fr' | 'en';
export const LANGS: readonly Lang[] = ['fr', 'en'];
export const DEFAULT_LANG: Lang = 'fr';

export type ColorScheme = 'dark' | 'light';
export type ThemePref = 'system' | ColorScheme;
export const THEME_PREFS: readonly ThemePref[] = ['dark', 'light', 'system'];
/** Identité de l'app : sombre par défaut, comme la PWA */
export const DEFAULT_THEME: ThemePref = 'dark';

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

export function isThemePref(v: unknown): v is ThemePref {
  return typeof v === 'string' && (THEME_PREFS as readonly string[]).includes(v);
}
