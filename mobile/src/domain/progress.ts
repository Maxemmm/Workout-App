// ============================================================
// Progression d'une séance + calculs du minuteur de repos
// Le minuteur repose sur une heure de fin (endAt) et non sur un
// décompte : le JS est suspendu quand l'app passe en arrière-plan.
// ============================================================
import type { Exercise, Program, Session } from './program';

/** id d'exercice → séries cochées */
export type SetTrack = Record<string, boolean[]>;

export type SessionProgress = { done: number; total: number; ratio: number; completeIds: string[] };

const CRITICAL_REST_SEC = 10;

/* ── Ordre des exercices ─────────────────────────────── */
export function orderExercises(exercises: Exercise[], order?: readonly string[] | null): Exercise[] {
  if (!order || order.length === 0) return exercises;
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const ordered = order.map((id) => byId.get(id)).filter((e): e is Exercise => e !== undefined);
  const placed = new Set(ordered.map((e) => e.id));
  return [...ordered, ...exercises.filter((e) => !placed.has(e.id))];
}

/* ── Séries ──────────────────────────────────────────── */
function doneCount(exercise: Exercise, track: SetTrack): number {
  return (track[exercise.id] ?? []).slice(0, exercise.sets).filter(Boolean).length;
}

export function totalSets(session: Session): number {
  return session.exercises.reduce((sum, e) => sum + e.sets, 0);
}

export function isExerciseComplete(exercise: Exercise, track: SetTrack): boolean {
  return doneCount(exercise, track) === exercise.sets;
}

export function sessionProgress(session: Session, track: SetTrack): SessionProgress {
  const total = totalSets(session);
  const done = session.exercises.reduce((sum, e) => sum + doneCount(e, track), 0);
  return {
    done,
    total,
    ratio: total === 0 ? 0 : done / total,
    completeIds: session.exercises.filter((e) => isExerciseComplete(e, track)).map((e) => e.id),
  };
}

/* ── Minuteur ────────────────────────────────────────── */
export function restDurationSec(exercise: Exercise, meta: Program['meta']): number {
  return exercise.restSec ?? meta.restDefaultSec;
}

export function restEndAt(nowMs: number, durationSec: number): number {
  return nowMs + durationSec * 1000;
}

export function remainingSec(endAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endAtMs - nowMs) / 1000));
}

export function isRestCritical(remaining: number): boolean {
  return remaining > 0 && remaining <= CRITICAL_REST_SEC;
}
