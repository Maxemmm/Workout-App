// ============================================================
// Planning — associe un jour de la semaine à une séance
// Indices alignés sur Date.getDay() : 0 = dimanche … 6 = samedi.
// Jour absent ou null => repos implicite. Aucun jour en dur.
// ============================================================
import type { Program, Session } from './program';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export type DayPlan =
  | { kind: 'session'; weekday: Weekday; sessionKey: string; session: Session }
  | { kind: 'implicit-rest'; weekday: Weekday };

export type WeekStripDay = { weekday: Weekday; isToday: boolean; plan: DayPlan };

export function resolveDay(program: Program, weekday: Weekday): DayPlan {
  const key = program.schedule[String(weekday)];
  // hasOwn : une clé héritée ("toString") ne doit jamais être prise pour une séance
  const session = key != null && Object.hasOwn(program.sessions, key) ? program.sessions[key] : undefined;
  if (key == null || !session) return { kind: 'implicit-rest', weekday };
  return { kind: 'session', weekday, sessionKey: key, session };
}

export function weekdayOf(date: Date): Weekday {
  return date.getDay() as Weekday;
}

export function weekStrip(program: Program, today: Date): WeekStripDay[] {
  const current = weekdayOf(today);
  return WEEKDAYS.map((weekday) => ({ weekday, isToday: weekday === current, plan: resolveDay(program, weekday) }));
}

/** Jour local au format YYYY-MM-DD (jamais toISOString, qui est en UTC) */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
