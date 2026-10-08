// Jours locaux « AAAA-MM-JJ » : arithmétique sans fuseau (midi local, puis clé locale)
import { localDateKey, type Weekday } from '../schedule';

export function parseDay(key: string): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)), 12);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return localDateKey(d);
}

const dayNumber = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000;

/** Nombre de jours de `from` à `to` (positif si `to` est après) */
export function dayDiff(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

export function weekdayOfDay(key: string): Weekday {
  return parseDay(key).getDay() as Weekday;
}

/** Lundi de la semaine (lundi → dimanche) contenant ce jour */
export function mondayOf(key: string): string {
  return addDays(key, -((weekdayOfDay(key) + 6) % 7));
}
