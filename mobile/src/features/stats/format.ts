// Formatage des stats selon la langue
import type { Lang } from '@/domain/prefs';
import { parseDay } from '@/domain/stats/dates';
import { roundLoad } from '@/domain/stats/units';
import { formatShortDate } from '@/features/today/formatDate';

const locale = (lang: Lang) => (lang === 'fr' ? 'fr-FR' : 'en-US');

export function formatNumber(n: number, lang: Lang): string {
  return Math.round(n).toLocaleString(locale(lang), { maximumFractionDigits: 0 });
}

export function formatLoad(n: number, lang: Lang): string {
  const v = roundLoad(n);
  const text = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return lang === 'fr' ? text.replace('.', ',') : text;
}

export function formatDay(key: string, daysShort: string[], monthsShort: string[]): string {
  return formatShortDate(parseDay(key), daysShort, monthsShort);
}
