// ============================================================
// Séances réalisées (workouts) et séries (set_entries)
// Un workout par (programme, séance, date locale), créé au premier cercle coché.
// ============================================================
import { and, asc, desc, eq, exists, isNull, lt } from 'drizzle-orm';
import { setEntries, workouts } from '../schema';
import { inTransaction } from '../transaction';
import type { RepoCtx } from '../types';

export type WorkoutRow = typeof workouts.$inferSelect;
export type SetEntryRow = typeof setEntries.$inferSelect;
export type WorkoutKey = { programId: string; sessionKey: string; date: string };
export type SetPatch = { done?: boolean; weight?: number | null; reps?: number | null; performedName?: string | null };

export function findWorkout(ctx: RepoCtx, key: WorkoutKey): WorkoutRow | null {
  return ctx.db.select().from(workouts).where(and(
    eq(workouts.programId, key.programId),
    eq(workouts.sessionKey, key.sessionKey),
    eq(workouts.date, key.date),
    isNull(workouts.deletedAt),
  )).get() ?? null;
}

export function getWorkout(ctx: RepoCtx, id: string): WorkoutRow | null {
  return ctx.db.select().from(workouts).where(and(eq(workouts.id, id), isNull(workouts.deletedAt))).get() ?? null;
}

export function ensureWorkout(ctx: RepoCtx, key: WorkoutKey): WorkoutRow {
  const existing = findWorkout(ctx, key);
  if (existing) return existing;
  const now = ctx.now();
  const row: WorkoutRow = {
    id: ctx.newId(), createdAt: now, updatedAt: now, deletedAt: null, userId: null,
    programId: key.programId, sessionKey: key.sessionKey, date: key.date,
    status: 'in_progress', startedAt: now, completedAt: null, healthSyncedAt: null,
  };
  ctx.db.insert(workouts).values(row).run();
  return row;
}

export function listEntries(ctx: RepoCtx, workoutId: string): SetEntryRow[] {
  return ctx.db.select().from(setEntries)
    .where(and(eq(setEntries.workoutId, workoutId), isNull(setEntries.deletedAt)))
    .orderBy(asc(setEntries.exerciseId), asc(setEntries.setIndex))
    .all();
}

/** Crée ou met à jour la série ; seuls les champs fournis changent */
export function upsertSet(ctx: RepoCtx, workoutId: string, exerciseId: string, setIndex: number, patch: SetPatch): void {
  const now = ctx.now();
  const fields: Partial<SetEntryRow> = { updatedAt: now };
  if (patch.done !== undefined) {
    fields.done = patch.done;
    fields.doneAt = patch.done ? now : null;
  }
  if (patch.weight !== undefined) fields.weight = patch.weight;
  if (patch.reps !== undefined) fields.reps = patch.reps;
  if (patch.performedName !== undefined) fields.performedName = patch.performedName;

  const existing = ctx.db.select({ id: setEntries.id }).from(setEntries).where(and(
    eq(setEntries.workoutId, workoutId),
    eq(setEntries.exerciseId, exerciseId),
    eq(setEntries.setIndex, setIndex),
    isNull(setEntries.deletedAt),
  )).get();

  if (existing) {
    ctx.db.update(setEntries).set(fields).where(eq(setEntries.id, existing.id)).run();
    return;
  }
  ctx.db.insert(setEntries).values({
    id: ctx.newId(), createdAt: now, workoutId, exerciseId, setIndex,
    done: false, doneAt: null, weight: null, reps: null, performedName: null,
    ...fields, updatedAt: now,
  }).run();
}

export function clearExerciseSets(ctx: RepoCtx, workoutId: string, exerciseId: string): void {
  const now = ctx.now();
  ctx.db.update(setEntries).set({ deletedAt: now, updatedAt: now }).where(and(
    eq(setEntries.workoutId, workoutId),
    eq(setEntries.exerciseId, exerciseId),
    isNull(setEntries.deletedAt),
  )).run();
}

export function completeWorkout(ctx: RepoCtx, id: string): void {
  const now = ctx.now();
  ctx.db.update(workouts).set({ status: 'completed', completedAt: now, updatedAt: now }).where(eq(workouts.id, id)).run();
}

export function reopenWorkout(ctx: RepoCtx, id: string): void {
  ctx.db.update(workouts).set({ status: 'in_progress', completedAt: null, updatedAt: ctx.now() }).where(eq(workouts.id, id)).run();
}

/** Réinitialisation du jour : suppression logique de la séance et de ses séries */
export function resetWorkout(ctx: RepoCtx, id: string): void {
  inTransaction(ctx, (tx) => {
    const now = tx.now();
    tx.db.update(setEntries).set({ deletedAt: now, updatedAt: now })
      .where(and(eq(setEntries.workoutId, id), isNull(setEntries.deletedAt))).run();
    tx.db.update(workouts).set({ deletedAt: now, updatedAt: now }).where(eq(workouts.id, id)).run();
  });
}

/** Séance restée en cours un jour précédent (passage de minuit) — avec au moins une série cochée */
export function findStaleInProgress(ctx: RepoCtx, today: string): WorkoutRow | null {
  const hasDoneSet = exists(
    ctx.db.select({ id: setEntries.id }).from(setEntries).where(and(
      eq(setEntries.workoutId, workouts.id),
      eq(setEntries.done, true),
      isNull(setEntries.deletedAt),
    )),
  );
  return ctx.db.select().from(workouts).where(and(
    eq(workouts.status, 'in_progress'),
    lt(workouts.date, today),
    isNull(workouts.deletedAt),
    hasDoneSet,
  )).orderBy(desc(workouts.date)).get() ?? null;
}
