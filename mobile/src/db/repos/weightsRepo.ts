// ============================================================
// Dernier poids saisi par clé de poids (id ou id::alternative)
// ============================================================
import { and, eq, isNull } from 'drizzle-orm';
import type { Units } from '@/domain/program';
import { exerciseWeights } from '../schema';
import type { RepoCtx } from '../types';

export type StoredWeight = { weight: number; unit: Units };

export function getAllWeights(ctx: RepoCtx): Record<string, StoredWeight> {
  const rows = ctx.db.select().from(exerciseWeights).where(isNull(exerciseWeights.deletedAt)).all();
  return Object.fromEntries(rows.map((r) => [r.exerciseId, { weight: r.weight, unit: r.unit }]));
}

/** null (ou ≤ 0) efface le poids mémorisé */
export function setWeight(ctx: RepoCtx, key: string, weight: number | null, unit: Units): void {
  const now = ctx.now();
  const existing = ctx.db.select({ id: exerciseWeights.id }).from(exerciseWeights)
    .where(and(eq(exerciseWeights.exerciseId, key), isNull(exerciseWeights.deletedAt))).get();
  if (weight === null || !(weight > 0)) {
    if (existing) ctx.db.update(exerciseWeights).set({ deletedAt: now, updatedAt: now }).where(eq(exerciseWeights.id, existing.id)).run();
    return;
  }
  if (existing) {
    ctx.db.update(exerciseWeights).set({ weight, unit, updatedAt: now }).where(eq(exerciseWeights.id, existing.id)).run();
    return;
  }
  ctx.db.insert(exerciseWeights).values({ id: ctx.newId(), createdAt: now, updatedAt: now, exerciseId: key, weight, unit }).run();
}
