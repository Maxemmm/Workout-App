// ============================================================
// Traduction — dictionnaires fr/en repris de la PWA
// Langue manquante → fr ; clé inconnue → la clé elle-même.
// ============================================================
import type { Lang } from '@/domain/prefs';
import en from './locales/en.json';
import fr from './locales/fr.json';

type Dict = typeof fr;
export type StringKey = { [K in keyof Dict]: Dict[K] extends string ? K : never }[keyof Dict];
export type ListKey = { [K in keyof Dict]: Dict[K] extends readonly string[] ? K : never }[keyof Dict];

const DICTS: Record<Lang, Record<string, unknown>> = { fr, en };

export function translate(lang: Lang, key: StringKey, ...args: (string | number)[]): string {
  const raw = DICTS[lang][key] ?? DICTS.fr[key];
  if (typeof raw !== 'string') return key;
  let i = 0;
  return raw.replace(/%s/g, () => (i < args.length ? String(args[i++]) : '%s'));
}

export function translateList(lang: Lang, key: ListKey): string[] {
  const raw = DICTS[lang][key] ?? DICTS.fr[key];
  return Array.isArray(raw) ? raw.map(String) : [];
}
