// Records personnels : charge max par exercice (première atteinte), badge « Nouveau » < 7 jours
import { dayDiff } from './dates';
import { displayUnits, exerciseStats, setKey, trackedExercises, workoutLoad } from './exerciseSeries';
import type { StatsHistory } from './types';

export const NEW_RECORD_DAYS = 7;

export type PersonalRecord = { key: string; name: string; weight: number; date: string; oneRm: number | null; isNew: boolean };

export function personalRecords(h: StatsHistory, today: string): PersonalRecord[] {
  const to = displayUnits(h);
  const out: PersonalRecord[] = [];
  for (const ex of trackedExercises(h)) {
    const { record, best } = exerciseStats(h, ex.key, null);
    if (!record) continue;
    const firstDate = h.workouts.find((w) => workoutLoad(w, ex.key, to) !== null)?.date;
    const age = dayDiff(record.date, today);
    const isNew = record.date !== firstDate && age >= 0 && age < NEW_RECORD_DAYS;
    out.push({ key: ex.key, name: ex.name, weight: record.value, date: record.date, oneRm: best?.oneRm ?? null, isNew });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/** Exercices pour lesquels cette séance dépasse strictement toutes les séances antérieures */
export function recordsSetBy(h: StatsHistory, workoutId: string): string[] {
  const to = displayUnits(h);
  const index = h.workouts.findIndex((w) => w.id === workoutId);
  if (index < 0) return [];
  const current = h.workouts[index];
  const keys = [...new Set(current.sets.map(setKey))];
  return keys.filter((key) => {
    const load = workoutLoad(current, key, to);
    if (load === null) return false;
    const previous = h.workouts.slice(0, index).map((w) => workoutLoad(w, key, to)).filter((x): x is number => x !== null);
    return previous.length > 0 && load > Math.max(...previous);
  });
}
