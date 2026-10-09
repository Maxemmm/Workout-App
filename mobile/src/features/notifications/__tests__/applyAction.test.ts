/** @jest-environment node */
import { createProgram } from '@/db/repos/programsRepo';
import { ensureWorkout, listEntries } from '@/db/repos/workoutsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { startTimer } from '@/domain/timer';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { applyAction, resetAppliedActions } from '../applyAction';

const NOW = 1_800_000_000_000;

function setup() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, makeProgramInput({ '1': 'fb' }, { fb: makeSession('FB', [makeExercise('gainage', 3, { name: 'Gainage' })]) }), 'manual');
  const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 'fb', date: '2026-10-05' });
  const target = { workoutId: w.id, exerciseId: 'gainage', setIndex: 1 };
  return { ctx, w, target };
}

describe('applyAction', () => {
  beforeEach(() => { useTimerStore.setState(TIMER_INITIAL); resetAppliedActions(); });

  it('+15 s après la fin du repos : nouveau repos de 15 s sur la même série', () => {
    const { ctx, target } = setup();
    expect(applyAction(ctx, { id: 'a', action: 'plus15', kind: 'rest', target, deliveredAt: NOW }, NOW)).toBe(true);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', endAt: NOW + 15_000, ...target });
  });

  it('Valider la série (fin de série chronométrée) : série enregistrée, repos suivant', () => {
    const { ctx, w, target } = setup();
    useTimerStore.getState().start(ctx, startTimer({
      mode: 'work', nowMs: NOW - 45_000, durationSec: 45, ...target,
      pending: { weight: null, reps: null, performedName: null, restSec: 60 },
    }));
    expect(applyAction(ctx, { id: 'b', action: 'validate', kind: 'work', target, deliveredAt: NOW }, NOW)).toBe(true);
    expect(listEntries(ctx, w.id).find((e) => e.setIndex === 1)?.done).toBe(true);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest' });
  });

  it('action périmée (le minuteur a changé) : ignorée', () => {
    const { ctx, target } = setup();
    useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs: NOW, durationSec: 90, ...target, setIndex: 2 }));
    expect(applyAction(ctx, { id: 'c', action: 'plus15', kind: 'rest', target, deliveredAt: NOW }, NOW)).toBe(false);
    expect(applyAction(ctx, { id: 'd', action: 'validate', kind: 'work', target, deliveredAt: NOW }, NOW)).toBe(false);
  });

  it('Review Focus 1 : même réponse reçue deux fois → appliquée une seule fois', () => {
    const { ctx, target } = setup();
    expect(applyAction(ctx, { id: 'same', action: 'plus15', kind: 'rest', target, deliveredAt: NOW }, NOW)).toBe(true);
    useTimerStore.getState().clear(ctx);
    expect(applyAction(ctx, { id: 'same', action: 'plus15', kind: 'rest', target, deliveredAt: NOW }, NOW + 1000)).toBe(false);
    expect(useTimerStore.getState().timer).toBeNull();
  });

  it('notification simplement ouverte : rien à appliquer', () => {
    const { ctx, target } = setup();
    expect(applyAction(ctx, { id: 'e', action: 'open', kind: 'rest', target, deliveredAt: NOW }, NOW)).toBe(false);
  });

  it('action ancienne (notification touchée longtemps après, ou traitée à la réouverture) : ignorée', () => {
    const { ctx, target } = setup();
    expect(applyAction(ctx, { id: 'old', action: 'plus15', kind: 'rest', target, deliveredAt: NOW - 20 * 60_000 }, NOW)).toBe(false);
    expect(useTimerStore.getState().timer).toBeNull();
  });
});
