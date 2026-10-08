// ============================================================
// Assiduité — calendrier des dernières semaines (lundi → dimanche) et taux faites / prévues.
// Les jours prévus viennent du planning du programme actif, à partir de sa création.
// ============================================================
import { addDays, mondayOf, weekdayOfDay } from './dates';
import type { StatsHistory } from './types';

export type DayState = 'done' | 'missed' | 'rest' | 'today' | 'future';
export type CalendarDay = { date: string; state: DayState };

export const CALENDAR_WEEKS = 12;

function plannedDay(h: StatsHistory) {
  const active = h.active;
  return (d: string) => active !== null && d >= active.since && active.trainDays.includes(weekdayOfDay(d));
}

export function attendanceCalendar(h: StatsHistory, today: string, weeks = CALENDAR_WEEKS): CalendarDay[][] {
  const days = new Set(h.workouts.map((w) => w.date));
  const planned = plannedDay(h);
  const start = addDays(mondayOf(today), -7 * (weeks - 1));
  const rows: CalendarDay[][] = [];
  for (let r = 0; r < weeks; r += 1) {
    const row: CalendarDay[] = [];
    for (let c = 0; c < 7; c += 1) {
      const date = addDays(start, r * 7 + c);
      let state: DayState;
      if (date > today) state = 'future';
      else if (days.has(date)) state = 'done';
      else if (date === today) state = 'today';
      else state = planned(date) ? 'missed' : 'rest';
      row.push({ date, state });
    }
    rows.push(row);
  }
  return rows;
}

export type AttendanceRate = { kind: 'rate'; done: number; planned: number } | { kind: 'count'; sessions: number };

export function attendanceRate(h: StatsHistory, today: string, since: string | null): AttendanceRate {
  const active = h.active;
  if (!active || active.trainDays.length === 0) {
    return { kind: 'count', sessions: h.workouts.filter((w) => (since === null || w.date >= since) && w.date <= today).length };
  }
  const days = new Set(h.workouts.map((w) => w.date));
  const planned = plannedDay(h);
  const start = since === null || since < active.since ? active.since : since;
  let done = 0;
  let total = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (!planned(d)) continue;
    if (d === today && !days.has(d)) continue;
    total += 1;
    if (days.has(d)) done += 1;
  }
  return { kind: 'rate', done, planned: total };
}
