/** @jest-environment node */
import { createProgram, type StoredProgram } from '@/db/repos/programsRepo';
import { getAllWeights, setWeight } from '@/db/repos/weightsRepo';
import { completeWorkout, ensureWorkout, getWorkout, listEntries, upsertSet } from '@/db/repos/workoutsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { haptics } from '@/platform/haptics';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import {
  changeWeight, completeWorkTimer, finishToday, moveExercise, pressSet, reopenToday,
  resetToday, saveSetValues, swapExercise, type TodayEnv,
} from '../actions';
import { cardWeight, loadTodayView } from '../todayView';

const T0 = Date.parse('2026-10-05T10:00:00.000Z');
const input = makeProgramInput({ '1': 'fb' }, {
  fb: makeSession('FULL', [
    makeExercise('presse', 2, { load: '100 à 120 kg', restSec: 120, scheme: '2×8', alternatives: [{ name: 'Fentes', sets: 3, scheme: '3×12', load: '10 kg' }] }),
    makeExercise('gainage', 2, { scheme: '2×45 sec', restSec: 60, load: null }),
    makeExercise('curl', 1, { restSec: 0 }),
  ]),
});

function setup() {
  const ctx = createTestCtx('2026-10-05T10:00:00.000Z');
  const program: StoredProgram = createProgram(ctx, input, 'manual');
  const env = (nowMs = T0): TodayEnv => ({ ctx, nowMs, program, sessionKey: 'fb', date: '2026-10-05' });
  const view = () => loadTodayView(ctx, program, 'fb', '2026-10-05');
  const ex = (id: string) => [...view().exercises, ...view().bonus].find((e) => e.id === id)!;
  return { ctx, program, env, view, ex };
}

describe('actions Today', () => {
  beforeEach(() => { useTimerStore.setState(TIMER_INITIAL); jest.clearAllMocks(); });

  it("consulter n'écrit rien ; cocher crée la séance, enregistre poids/reps et lance le repos", () => {
    const { ctx, env, view, ex } = setup();
    expect(view().workout).toBeNull();
    pressSet(env(), view(), ex('presse'), 0);
    const v = view();
    expect(v.workout?.status).toBe('in_progress');
    expect(v.entries[0]).toMatchObject({ exerciseId: 'presse', setIndex: 0, done: true, weight: 100, reps: 8, performedName: null });
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', exerciseId: 'presse', setIndex: 0, endAt: T0 + 120_000 });
    expect(haptics.light).toHaveBeenCalledTimes(1);
    expect(listEntries(ctx, v.workout!.id)).toHaveLength(1);
  });

  it("dernière série de l'exercice : haptique success", () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    pressSet(env(), view(), ex('presse'), 1);
    expect(haptics.success).toHaveBeenCalledTimes(1);
  });

  it('décocher la série du repos en cours arrête le repos', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    pressSet(env(), view(), ex('presse'), 0);
    expect(view().track.presse ?? []).toEqual([]);
    expect(useTimerStore.getState().timer).toBeNull();
  });

  it('repos de 0 s : aucun minuteur', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('curl'), 0);
    expect(useTimerStore.getState().timer).toBeNull();
  });

  it('date null : la séance est datée du jour local de nowMs', () => {
    const { ctx, program, env, ex } = setup();
    const v = loadTodayView(ctx, program, 'fb', '2026-10-05');
    pressSet({ ...env(), date: null }, v, ex('presse'), 0);
    expect(useTimerStore.getState().timer).not.toBeNull();
    const created = getWorkout(ctx, useTimerStore.getState().timer!.workoutId);
    expect(created?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("chronométré : tap → chrono d'effort, second tap → annulation sans cocher", () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('gainage'), 0);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'work', exerciseId: 'gainage', setIndex: 0, endAt: T0 + 45_000 });
    expect(view().track.gainage ?? []).toEqual([]);
    pressSet(env(), view(), ex('gainage'), 0);
    expect(useTimerStore.getState().timer).toBeNull();
    expect(view().track.gainage ?? []).toEqual([]);
  });

  it("fin du chrono d'effort : série cochée puis repos (ou pas de repos si retour tardif)", () => {
    const { ctx, env, view, ex } = setup();
    pressSet(env(), view(), ex('gainage'), 0);
    completeWorkTimer(ctx, useTimerStore.getState().timer!, T0 + 45_000, true);
    expect(view().track.gainage).toEqual([true]);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', exerciseId: 'gainage', endAt: T0 + 45_000 + 60_000 });

    pressSet(env(T0 + 200_000), view(), ex('gainage'), 1);
    completeWorkTimer(ctx, useTimerStore.getState().timer!, T0 + 900_000, false);
    expect(view().track.gainage).toEqual([true, true]);
    expect(useTimerStore.getState().timer).toBeNull();
  });

  it("Review Focus 4 : tap sur un autre exercice pendant un chrono d'effort → chrono abandonné", () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('gainage'), 0);
    pressSet(env(), view(), ex('presse'), 0);
    expect(view().track.gainage ?? []).toEqual([]);
    expect(view().track.presse).toEqual([true]);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', exerciseId: 'presse' });
  });

  it("poids de carte : s'applique aux séries suivantes, les séries cochées gardent le leur", () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    changeWeight(env(), ex('presse'), 105);
    pressSet(env(), view(), ex('presse'), 1);
    expect(view().entries.map((e) => e.weight)).toEqual([100, 105]);
    expect(cardWeight(view(), ex('presse'))).toBe(105);
  });

  it('Review Focus 2 : poids mémorisé dans une autre unité ignoré', () => {
    const { ctx, view, ex } = setup();
    setWeight(ctx, 'presse', 250, 'lbs');
    expect(cardWeight(view(), ex('presse'))).toBe(100);
  });

  it('saisie par série : corrige une série cochée, coche une série non cochée', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    saveSetValues(env(), view(), ex('presse'), 0, { weight: 110, reps: 6 });
    saveSetValues(env(), view(), ex('presse'), 1, { weight: 90, reps: 10 });
    expect(view().entries.map((e) => [e.setIndex, e.done, e.weight, e.reps])).toEqual([[0, true, 110, 6], [1, true, 90, 10]]);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', setIndex: 1 });
  });

  it("échange : poids par variante, séries de l'exercice remises à zéro", () => {
    const { ctx, env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    swapExercise(env(), view(), ex('presse'), 'Fentes');
    const fentes = ex('presse');
    expect(fentes).toMatchObject({ name: 'Fentes', sets: 3, performedName: 'Fentes' });
    expect(view().track.presse ?? []).toEqual([]);
    expect(cardWeight(view(), fentes)).toBe(10);
    changeWeight(env(), fentes, 12);
    expect(getAllWeights(ctx)).toEqual({ 'presse::Fentes': { weight: 12, unit: 'kg' } });
    pressSet(env(), view(), fentes, 0);
    expect(view().entries[0]).toMatchObject({ performedName: 'Fentes', weight: 12, reps: 12 });
    swapExercise(env(), view(), ex('presse'), null);
    expect(cardWeight(view(), ex('presse'))).toBe(100);
  });

  it('réordonnancement persisté', () => {
    const { env, view } = setup();
    moveExercise(env(), view(), 2, 0);
    expect(view().exercises.map((e) => e.id)).toEqual(['curl', 'presse', 'gainage']);
  });

  it('terminer / rouvrir / réinitialiser', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    finishToday(env(T0 + 60_000), view());
    expect(view().workout).toMatchObject({ status: 'completed' });
    expect(useTimerStore.getState().timer).toBeNull();

    pressSet(env(), view(), ex('presse'), 1);
    expect(view().track.presse).toEqual([true]);

    reopenToday(env(), view());
    expect(view().workout?.status).toBe('in_progress');

    resetToday(env(), view());
    expect(view().workout).toBeNull();
    expect(cardWeight(view(), ex('presse'))).toBe(100);
  });

  it('« la dernière fois » vient de la séance terminée précédente', () => {
    const { ctx, program, ex } = setup();
    const old = ensureWorkout(ctx, { programId: program.id, sessionKey: 'fb', date: '2026-09-28' });
    upsertSet(ctx, old.id, 'presse', 0, { done: true, weight: 95, reps: 8 });
    completeWorkout(ctx, old.id);
    const v = loadTodayView(ctx, program, 'fb', '2026-10-05');
    expect(v.last.presse).toEqual({ date: '2026-09-28', sets: 1, reps: 8, maxWeight: 95 });
    expect(v.last['presse::Fentes'] ?? null).toBeNull();
    expect(ex('presse').id).toBe('presse');
  });
});
