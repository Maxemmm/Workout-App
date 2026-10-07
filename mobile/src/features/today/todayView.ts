// ============================================================
// Vue de la séance affichée — tout ce que l'écran lit en base
// ============================================================
import { lastPerformance, type LastPerformance } from '@/db/repos/historyRepo';
import { getLayout } from '@/db/repos/layoutsRepo';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { getAllWeights } from '@/db/repos/weightsRepo';
import { findWorkout, listEntries, type SetEntryRow, type WorkoutRow } from '@/db/repos/workoutsRepo';
import type { RepoCtx } from '@/db/types';
import { effectiveSession, weightKey, type EffectiveExercise } from '@/domain/exerciseView';
import { trackFromEntries, type SetTrack } from '@/domain/progress';
import { suggestedWeight } from '@/domain/scheme';

export type TodayView = {
  workout: WorkoutRow | null;
  entries: SetEntryRow[];
  track: SetTrack;
  exercises: EffectiveExercise[];
  bonus: EffectiveExercise[];
  /** Poids mémorisés dans l'unité du programme, par clé de poids */
  weights: Record<string, number>;
  /** « La dernière fois », par clé de poids */
  last: Record<string, LastPerformance | null>;
};

export function loadTodayView(ctx: RepoCtx, program: StoredProgram, sessionKey: string, date: string): TodayView {
  const session = program.definition.sessions[sessionKey];
  const layout = getLayout(ctx, program.id, sessionKey);
  const { exercises, bonus } = session ? effectiveSession(session, layout) : { exercises: [], bonus: [] };
  const workout = findWorkout(ctx, { programId: program.id, sessionKey, date });
  const entries = workout ? listEntries(ctx, workout.id) : [];

  const units = program.definition.meta.units;
  const weights: Record<string, number> = {};
  for (const [key, stored] of Object.entries(getAllWeights(ctx))) {
    if (stored.unit === units) weights[key] = stored.weight;
  }

  const last: Record<string, LastPerformance | null> = {};
  for (const ex of [...exercises, ...bonus]) {
    last[weightKey(ex.id, ex.performedName)] = lastPerformance(ctx, ex.id, ex.performedName, date);
  }

  return { workout, entries, track: trackFromEntries(entries), exercises, bonus, weights, last };
}

/** Poids affiché sur la carte : mémorisé, sinon suggestion du programme */
export function cardWeight(view: TodayView, ex: EffectiveExercise): number | null {
  return view.weights[weightKey(ex.id, ex.performedName)] ?? suggestedWeight(ex.load);
}
