// ============================================================
// Exercices personnalisés de la bibliothèque — suppression logique ; id exposé : custom:<id>
// ============================================================
import { and, asc, eq, isNull } from 'drizzle-orm';
import { isEquipmentKey, type EquipmentKey } from '@/domain/library/equipment';
import { isMuscleKey, type MuscleKey } from '@/domain/library/muscles';
import { customExercises } from '../schema';
import type { RepoCtx } from '../types';

export type CustomExercise = { id: string; name: string; primary: MuscleKey; secondary: MuscleKey[]; equipment: EquipmentKey; steps: string[] | null };
export type CustomExerciseInput = Omit<CustomExercise, 'id'>;
type Row = typeof customExercises.$inferSelect;

function parseList(text: string | null): unknown[] | null {
  if (text === null) return null;
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function toCustom(r: Row): CustomExercise | null {
  if (!isMuscleKey(r.primary) || !isEquipmentKey(r.equipment)) return null;
  const secondary = (parseList(r.secondary) ?? []).filter(isMuscleKey);
  const steps = parseList(r.steps)?.filter((s): s is string => typeof s === 'string') ?? null;
  return { id: r.id, name: r.name, primary: r.primary, secondary, equipment: r.equipment, steps };
}

function validate(input: CustomExerciseInput): CustomExerciseInput {
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error('nom d\'exercice invalide');
  if (!isMuscleKey(input.primary) || !input.secondary.every(isMuscleKey)) throw new Error('muscle inconnu');
  if (!isEquipmentKey(input.equipment)) throw new Error('matériel inconnu');
  const steps = input.steps?.map((s) => s.trim()).filter(Boolean) ?? null;
  return { ...input, name, secondary: [...new Set(input.secondary)].filter((m) => m !== input.primary), steps: steps && steps.length ? steps : null };
}

const values = (v: CustomExerciseInput) => ({
  name: v.name, primary: v.primary, secondary: JSON.stringify(v.secondary), equipment: v.equipment, steps: v.steps ? JSON.stringify(v.steps) : null,
});

export function listCustomExercises(ctx: RepoCtx): CustomExercise[] {
  return ctx.db.select().from(customExercises).where(isNull(customExercises.deletedAt)).orderBy(asc(customExercises.name)).all()
    .map(toCustom).filter((c): c is CustomExercise => c !== null);
}

export function getCustomExercise(ctx: RepoCtx, id: string): CustomExercise | null {
  const r = ctx.db.select().from(customExercises).where(and(eq(customExercises.id, id), isNull(customExercises.deletedAt))).get();
  return r ? toCustom(r) : null;
}

export function createCustomExercise(ctx: RepoCtx, input: CustomExerciseInput): CustomExercise {
  const v = validate(input);
  const now = ctx.now();
  const id = ctx.newId();
  ctx.db.insert(customExercises).values({ id, createdAt: now, updatedAt: now, ...values(v) }).run();
  return { id, ...v };
}

/** Insertion ou mise à jour à id donné (restauration : ids conservés, même si une ligne supprimée existe) */
export function upsertCustomExercise(ctx: RepoCtx, id: string, input: CustomExerciseInput): void {
  const v = validate(input);
  const now = ctx.now();
  const existing = ctx.db.select({ id: customExercises.id }).from(customExercises).where(eq(customExercises.id, id)).get();
  if (existing) ctx.db.update(customExercises).set({ ...values(v), updatedAt: now, deletedAt: null }).where(eq(customExercises.id, id)).run();
  else ctx.db.insert(customExercises).values({ id, createdAt: now, updatedAt: now, ...values(v) }).run();
}

export function updateCustomExercise(ctx: RepoCtx, id: string, input: CustomExerciseInput): void {
  const v = validate(input);
  ctx.db.update(customExercises).set({ ...values(v), updatedAt: ctx.now() }).where(eq(customExercises.id, id)).run();
}

export function deleteCustomExercise(ctx: RepoCtx, id: string): void {
  const now = ctx.now();
  ctx.db.update(customExercises).set({ deletedAt: now, updatedAt: now }).where(eq(customExercises.id, id)).run();
}
