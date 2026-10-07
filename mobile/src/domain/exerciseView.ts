// ============================================================
// Exercice effectif — l'exercice du programme après échange éventuel
// vers une alternative, et séance effective (ordre + échanges).
// L'id reste celui du programme (stats), le nom réalisé est mémorisé.
// ============================================================
import { alternativeName, type Alternative, type Exercise, type Session } from './program';
import { orderExercises } from './progress';

export type SessionLayout = { order: string[]; swaps: Record<string, string> };
export const EMPTY_LAYOUT: SessionLayout = { order: [], swaps: {} };

export type EffectiveExercise = Exercise & {
  /** Nom de l'alternative réalisée ; null pour l'original */
  performedName: string | null;
  /** Nom de l'exercice du programme (affiché « remplace X ») */
  originalName: string;
};

export type EffectiveSession = { exercises: EffectiveExercise[]; bonus: EffectiveExercise[] };

export function findAlternative(ex: Exercise, name: string): Alternative | undefined {
  return ex.alternatives.find((a) => alternativeName(a) === name);
}

export function effectiveExercise(ex: Exercise, swapName?: string | null): EffectiveExercise {
  const alt = swapName ? findAlternative(ex, swapName) : undefined;
  if (!alt) return { ...ex, performedName: null, originalName: ex.name };
  const name = alternativeName(alt);
  const base: EffectiveExercise = { ...ex, name, cue: null, performedName: name, originalName: ex.name };
  if (typeof alt === 'string') return base;
  return {
    ...base,
    sets: alt.sets ?? ex.sets,
    scheme: alt.scheme !== '' ? alt.scheme : ex.scheme,
    load: alt.load ?? ex.load,
    restSec: alt.restSec ?? ex.restSec,
    timed: alt.timed ?? ex.timed,
  };
}

/** Clé de mémorisation du poids : un poids par variante */
export function weightKey(exerciseId: string, performedName: string | null): string {
  return performedName ? `${exerciseId}::${performedName}` : exerciseId;
}

export function effectiveSession(session: Session, layout: SessionLayout): EffectiveSession {
  const swap = (ex: Exercise) => effectiveExercise(ex, layout.swaps[ex.id] ?? null);
  return {
    exercises: orderExercises(session.exercises, layout.order).map(swap),
    bonus: (session.bonus?.exercises ?? []).map(swap),
  };
}
