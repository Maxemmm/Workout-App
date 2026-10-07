/** @jest-environment node */
import example from '@/data/program.example.json';
import { lastPerformance } from '../repos/historyRepo';
import { createProgram } from '../repos/programsRepo';
import { completeWorkout, ensureWorkout, upsertSet } from '../repos/workoutsRepo';
import { createTestCtx } from '../testing/createTestCtx';

function setup() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, example, 'example');
  const workoutOn = (date: string, complete = true) => {
    const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 'full-body', date });
    if (complete) completeWorkout(ctx, w.id);
    return w;
  };
  return { ctx, workoutOn };
}

describe('lastPerformance', () => {
  it('séance terminée la plus récente avant la date, séries cochées seulement', () => {
    const { ctx, workoutOn } = setup();
    const a = workoutOn('2026-09-28');
    upsertSet(ctx, a.id, 'presse', 0, { done: true, weight: 90, reps: 8 });
    const b = workoutOn('2026-10-01');
    upsertSet(ctx, b.id, 'presse', 0, { done: true, weight: 100, reps: 8 });
    upsertSet(ctx, b.id, 'presse', 1, { done: true, weight: 105, reps: 6 });
    upsertSet(ctx, b.id, 'presse', 2, { done: false, weight: 200, reps: 8 });
    expect(lastPerformance(ctx, 'presse', null, '2026-10-05')).toEqual({ date: '2026-10-01', sets: 2, reps: 8, maxWeight: 105 });
  });

  it("exclut aujourd'hui, les séances en cours et les autres variantes", () => {
    const { ctx, workoutOn } = setup();
    const today = workoutOn('2026-10-05');
    upsertSet(ctx, today.id, 'presse', 0, { done: true, weight: 120, reps: 8 });
    const open = workoutOn('2026-10-04', false);
    upsertSet(ctx, open.id, 'presse', 0, { done: true, weight: 110, reps: 8 });
    const alt = workoutOn('2026-10-03');
    upsertSet(ctx, alt.id, 'presse', 0, { done: true, weight: 12, reps: 12, performedName: 'Fentes' });
    expect(lastPerformance(ctx, 'presse', null, '2026-10-05')).toBeNull();
    expect(lastPerformance(ctx, 'presse', 'Fentes', '2026-10-05')).toEqual({ date: '2026-10-03', sets: 1, reps: 12, maxWeight: 12 });
  });

  it('sans poids ni reps : null dans les champs', () => {
    const { ctx, workoutOn } = setup();
    const w = workoutOn('2026-10-01');
    upsertSet(ctx, w.id, 'gainage', 0, { done: true });
    expect(lastPerformance(ctx, 'gainage', null, '2026-10-05')).toEqual({ date: '2026-10-01', sets: 1, reps: null, maxWeight: null });
  });
});
