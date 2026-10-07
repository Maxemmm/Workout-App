// ============================================================
// Historique — « La dernière fois » pour un exercice et une variante
// ============================================================
import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { setEntries, workouts } from '../schema';
import type { RepoCtx } from '../types';

export type LastPerformance = { date: string; sets: number; reps: number | null; maxWeight: number | null };

export function lastPerformance(ctx: RepoCtx, exerciseId: string, performedName: string | null, beforeDate: string): LastPerformance | null {
  const sameVariant = performedName === null ? isNull(setEntries.performedName) : eq(setEntries.performedName, performedName);
  const doneOfExercise = and(
    eq(setEntries.exerciseId, exerciseId), sameVariant,
    eq(setEntries.done, true), isNull(setEntries.deletedAt),
  );

  const last = ctx.db.select({ id: workouts.id, date: workouts.date })
    .from(workouts)
    .innerJoin(setEntries, eq(setEntries.workoutId, workouts.id))
    .where(and(doneOfExercise, eq(workouts.status, 'completed'), lt(workouts.date, beforeDate), isNull(workouts.deletedAt)))
    .orderBy(desc(workouts.date), desc(workouts.completedAt))
    .get();
  if (!last) return null;

  const sets = ctx.db.select().from(setEntries).where(and(doneOfExercise, eq(setEntries.workoutId, last.id))).all();
  const max = (values: (number | null)[]) => {
    const nums = values.filter((v): v is number => v !== null);
    return nums.length > 0 ? Math.max(...nums) : null;
  };
  return { date: last.date, sets: sets.length, reps: max(sets.map((s) => s.reps)), maxWeight: max(sets.map((s) => s.weight)) };
}
