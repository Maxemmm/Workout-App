// ============================================================
// Résumé des stats — série en cours, volume de la semaine, dernière séance
// ============================================================
import { addDays, dayDiff, mondayOf, weekdayOfDay } from './dates';
import { displayUnits, workoutVolume } from './exerciseSeries';
import { recordsSetBy } from './records';
import type { StatsHistory } from './types';

const MAX_DURATION_MIN = 6 * 60;

const doneDays = (h: StatsHistory) => new Set(h.workouts.map((w) => w.date));

export function currentStreak(h: StatsHistory, today: string): number {
  const days = doneDays(h);
  if (days.size === 0) return 0;
  const train = h.active?.trainDays ?? [];

  if (train.length === 0) {
    // Sans planning : jours calendaires consécutifs depuis aujourd'hui (ou hier)
    let cursor = days.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (days.has(cursor)) {
      n += 1;
      cursor = addDays(cursor, -1);
    }
    return n;
  }

  const isTrain = (d: string) => train.includes(weekdayOfDay(d));
  const anchor = [...days].filter((d) => d <= today && isTrain(d)).sort().pop();
  if (!anchor) return 0;
  // Un jour prévu manqué entre la dernière séance et aujourd'hui (exclu) casse la série
  for (let d = addDays(anchor, 1); d < today; d = addDays(d, 1)) {
    if (isTrain(d) && !days.has(d)) return 0;
  }
  let n = 0;
  let cursor = anchor;
  while (days.has(cursor)) {
    n += 1;
    let prev = addDays(cursor, -1);
    while (!isTrain(prev)) prev = addDays(prev, -1);
    cursor = prev;
  }
  return n;
}

export type WeekVolume = { current: number; previous: number; deltaPct: number | null };

export function weekVolume(h: StatsHistory, today: string): WeekVolume {
  const to = displayUnits(h);
  const monday = mondayOf(today);
  const span = dayDiff(monday, today);
  const prevMonday = addDays(monday, -7);
  const prevEnd = addDays(prevMonday, span);
  let current = 0;
  let previous = 0;
  for (const w of h.workouts) {
    if (w.date >= monday && w.date <= today) current += workoutVolume(w, to);
    else if (w.date >= prevMonday && w.date <= prevEnd) previous += workoutVolume(w, to);
  }
  return { current, previous, deltaPct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null };
}

export type LastSession = { workoutId: string; date: string; sessionName: string; sets: number; durationMin: number | null; newRecords: number };

export function lastSession(h: StatsHistory): LastSession | null {
  const last = h.workouts[h.workouts.length - 1];
  if (!last) return null;
  const minutes = last.completedAt ? Math.round((Date.parse(last.completedAt) - Date.parse(last.startedAt)) / 60_000) : NaN;
  return {
    workoutId: last.id,
    date: last.date,
    sessionName: last.sessionName,
    sets: last.sets.length,
    durationMin: Number.isFinite(minutes) && minutes > 0 && minutes <= MAX_DURATION_MIN ? minutes : null,
    newRecords: recordsSetBy(h, last.id).length,
  };
}
