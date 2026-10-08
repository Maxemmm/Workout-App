// ============================================================
// Progression par exercice — exercices suivis, courbe, record, meilleure série, volume.
// Un exercice suivi = (exerciseId, performedName) ; valeurs dans l'unité d'affichage.
// ============================================================
import type { Units } from '../program';
import { weightKey } from '../exerciseView';
import { bestSet, estimateOneRm, type BestSet } from './oneRm';
import type { HistorySet, HistoryWorkout, StatsHistory } from './types';
import { toUnit } from './units';

export const displayUnits = (h: StatsHistory): Units => h.active?.units ?? 'kg';

export const setKey = (s: HistorySet) => weightKey(s.exerciseId, s.performedName);

export type TrackedExercise = { key: string; exerciseId: string; performedName: string | null; name: string; lastDate: string };

export function trackedExercises(h: StatsHistory): TrackedExercise[] {
  const map = new Map<string, TrackedExercise>();
  for (const w of h.workouts) {
    for (const s of w.sets) {
      const key = setKey(s);
      const name = s.performedName ?? h.exerciseNames[s.exerciseId] ?? s.exerciseId;
      const prev = map.get(key);
      if (!prev || w.date >= prev.lastDate) map.set(key, { key, exerciseId: s.exerciseId, performedName: s.performedName, name, lastDate: w.date });
    }
  }
  return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name));
}

/** Séries d'un exercice dans une séance, poids converti dans l'unité d'affichage */
function setsOf(w: HistoryWorkout, key: string, to: Units): { weight: number | null; reps: number | null }[] {
  return w.sets.filter((s) => setKey(s) === key).map((s) => ({ weight: s.weight === null ? null : toUnit(s.weight, w.units, to), reps: s.reps }));
}

/** Charge max d'une séance pour un exercice (null si aucun poids > 0) */
export function workoutLoad(w: HistoryWorkout, key: string, to: Units): number | null {
  const loads = setsOf(w, key, to).map((s) => s.weight).filter((x): x is number => x !== null && x > 0);
  return loads.length ? Math.max(...loads) : null;
}

export function workoutVolume(w: HistoryWorkout, to: Units): number {
  return w.sets.reduce((sum, s) => (s.weight !== null && s.weight > 0 && s.reps !== null && s.reps > 0 ? sum + toUnit(s.weight, w.units, to) * s.reps : sum), 0);
}

export type SeriesMetric = 'load' | 'oneRm';
export type SeriesPoint = { date: string; workoutId: string; value: number };

export function exerciseSeries(h: StatsHistory, key: string, metric: SeriesMetric, since: string | null): SeriesPoint[] {
  const to = displayUnits(h);
  const points: SeriesPoint[] = [];
  for (const w of h.workouts) {
    if (since !== null && w.date < since) continue;
    let value: number | null;
    if (metric === 'load') value = workoutLoad(w, key, to);
    else {
      const rms = setsOf(w, key, to).map((s) => estimateOneRm(s.weight, s.reps)).filter((x): x is number => x !== null);
      value = rms.length ? Math.max(...rms) : null;
    }
    if (value !== null) points.push({ date: w.date, workoutId: w.id, value });
  }
  return points;
}

export type ExerciseStats = { record: { value: number; date: string } | null; best: BestSet | null; volume: number };

export function exerciseStats(h: StatsHistory, key: string, since: string | null): ExerciseStats {
  const to = displayUnits(h);
  let record: ExerciseStats['record'] = null;
  const all: { weight: number | null; reps: number | null; date: string }[] = [];
  let volume = 0;
  for (const w of h.workouts) {
    const sets = setsOf(w, key, to);
    if (!sets.length) continue;
    const load = workoutLoad(w, key, to);
    if (load !== null && (!record || load > record.value)) record = { value: load, date: w.date };
    for (const s of sets) {
      all.push({ ...s, date: w.date });
      if ((since === null || w.date >= since) && s.weight !== null && s.weight > 0 && s.reps !== null && s.reps > 0) volume += s.weight * s.reps;
    }
  }
  return { record, best: bestSet(all), volume };
}
