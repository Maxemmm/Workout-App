/** @jest-environment node */
import example from '@/data/program.example.json';
import { createProgram } from '../repos/programsRepo';
import {
  clearExerciseSets, completeWorkout, ensureWorkout, findStaleInProgress, findWorkout,
  getWorkout, listEntries, reopenWorkout, resetWorkout, upsertSet,
} from '../repos/workoutsRepo';
import { createTestCtx } from '../testing/createTestCtx';
import { inTransaction } from '../transaction';

function setup() {
  const ctx = createTestCtx('2026-10-05T10:00:00.000Z');
  const program = createProgram(ctx, example, 'example');
  const key = { programId: program.id, sessionKey: 'full-body', date: '2026-10-05' };
  return { ctx, key };
}

describe('workoutsRepo', () => {
  it('ensureWorkout crée paresseusement puis réutilise', () => {
    const { ctx, key } = setup();
    expect(findWorkout(ctx, key)).toBeNull();
    const w = ensureWorkout(ctx, key);
    expect(w).toMatchObject({ status: 'in_progress', startedAt: '2026-10-05T10:00:00.000Z', completedAt: null });
    expect(ensureWorkout(ctx, key).id).toBe(w.id);
  });

  it('upsertSet coche, décoche et conserve poids / reps', () => {
    const { ctx, key } = setup();
    const w = ensureWorkout(ctx, key);
    upsertSet(ctx, w.id, 'presse', 0, { done: true, weight: 100, reps: 8, performedName: null });
    ctx.advance(1000);
    upsertSet(ctx, w.id, 'presse', 0, { done: false });
    const [e] = listEntries(ctx, w.id);
    expect(e).toMatchObject({ exerciseId: 'presse', setIndex: 0, done: false, weight: 100, reps: 8, doneAt: null });
    upsertSet(ctx, w.id, 'presse', 0, { weight: 105 });
    expect(listEntries(ctx, w.id)).toHaveLength(1);
    expect(listEntries(ctx, w.id)[0].weight).toBe(105);
  });

  it('terminer / rouvrir', () => {
    const { ctx, key } = setup();
    const w = ensureWorkout(ctx, key);
    ctx.advance(60_000);
    completeWorkout(ctx, w.id);
    expect(getWorkout(ctx, w.id)).toMatchObject({ status: 'completed', completedAt: '2026-10-05T10:01:00.000Z' });
    reopenWorkout(ctx, w.id);
    expect(getWorkout(ctx, w.id)).toMatchObject({ status: 'in_progress', completedAt: null });
  });

  it('resetWorkout supprime logiquement séance et séries, puis une nouvelle séance est possible', () => {
    const { ctx, key } = setup();
    const w = ensureWorkout(ctx, key);
    upsertSet(ctx, w.id, 'presse', 0, { done: true });
    resetWorkout(ctx, w.id);
    expect(findWorkout(ctx, key)).toBeNull();
    expect(listEntries(ctx, w.id)).toEqual([]);
    expect(ensureWorkout(ctx, key).id).not.toBe(w.id);
  });

  it("clearExerciseSets ne touche que l'exercice visé", () => {
    const { ctx, key } = setup();
    const w = ensureWorkout(ctx, key);
    upsertSet(ctx, w.id, 'presse', 0, { done: true });
    upsertSet(ctx, w.id, 'curl', 0, { done: true });
    clearExerciseSets(ctx, w.id, 'presse');
    expect(listEntries(ctx, w.id).map((e) => e.exerciseId)).toEqual(['curl']);
    upsertSet(ctx, w.id, 'presse', 0, { done: true });
    expect(listEntries(ctx, w.id)).toHaveLength(2);
  });

  it('findStaleInProgress ignore une séance de la veille sans aucune série cochée', () => {
    const { ctx, key } = setup();
    const empty = ensureWorkout(ctx, { ...key, date: '2026-10-03' });
    expect(findStaleInProgress(ctx, '2026-10-05')).toBeNull();
    upsertSet(ctx, empty.id, 'presse', 0, { done: true });
    upsertSet(ctx, empty.id, 'presse', 0, { done: false });
    expect(findStaleInProgress(ctx, '2026-10-05')).toBeNull();
  });

  it("findStaleInProgress : séance en cours d'un jour précédent seulement", () => {
    const { ctx, key } = setup();
    const old = ensureWorkout(ctx, { ...key, date: '2026-10-03' });
    upsertSet(ctx, old.id, 'presse', 0, { done: true });
    ensureWorkout(ctx, key);
    expect(findStaleInProgress(ctx, '2026-10-05')?.id).toBe(old.id);
    completeWorkout(ctx, old.id);
    expect(findStaleInProgress(ctx, '2026-10-05')).toBeNull();
  });

  it("inTransaction annule tout en cas d'erreur", () => {
    const { ctx, key } = setup();
    const w = ensureWorkout(ctx, key);
    expect(() => inTransaction(ctx, (tx) => {
      upsertSet(tx, w.id, 'presse', 0, { done: true });
      throw new Error('boom');
    })).toThrow('boom');
    expect(listEntries(ctx, w.id)).toEqual([]);
  });
});
