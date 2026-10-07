/** @jest-environment node */
import { createProgram } from '@/db/repos/programsRepo';
import { ensureWorkout, listEntries } from '@/db/repos/workoutsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { startTimer } from '@/domain/timer';
import { haptics } from '@/platform/haptics';
import { sound } from '@/platform/sound';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { driveTimer, newDriverMemo } from '../driveTimer';

const T0 = 10_000_000;

function setup() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, makeProgramInput({ '1': 's' }, { s: makeSession('S', [makeExercise('x', 3)]) }), 'manual');
  const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 's', date: '2026-10-05' });
  return { ctx, w };
}

describe('driveTimer', () => {
  beforeEach(() => { useTimerStore.setState(TIMER_INITIAL); jest.clearAllMocks(); });

  it('avertit une seule fois sous 10 s', () => {
    const { ctx, w } = setup();
    useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs: T0, durationSec: 30, workoutId: w.id, exerciseId: 'x', setIndex: 0 }));
    const memo = newDriverMemo();
    driveTimer(ctx, T0 + 5_000, memo);
    driveTimer(ctx, T0 + 21_000, memo);
    driveTimer(ctx, T0 + 22_000, memo);
    expect(haptics.warning).toHaveBeenCalledTimes(1);
  });

  it('fin de repos au premier plan : son + success + flash', () => {
    const { ctx, w } = setup();
    useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs: T0, durationSec: 30, workoutId: w.id, exerciseId: 'x', setIndex: 0 }));
    driveTimer(ctx, T0 + 30_100, newDriverMemo());
    expect(sound.playRestDone).toHaveBeenCalledTimes(1);
    expect(haptics.success).toHaveBeenCalledTimes(1);
    expect(useTimerStore.getState()).toMatchObject({ timer: null, flash: { exerciseId: 'x', until: T0 + 30_100 + 1500 } });
  });

  it('retour tardif (arrière-plan) : terminé sans son ni flash', () => {
    const { ctx, w } = setup();
    useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs: T0, durationSec: 30, workoutId: w.id, exerciseId: 'x', setIndex: 0 }));
    driveTimer(ctx, T0 + 300_000, newDriverMemo());
    expect(sound.playRestDone).not.toHaveBeenCalled();
    expect(useTimerStore.getState()).toMatchObject({ timer: null, flash: null });
  });

  it("Review Focus 3 : chrono d'effort expiré au retour → série cochée en silence, pas de repos", () => {
    const { ctx, w } = setup();
    useTimerStore.getState().start(ctx, startTimer({
      mode: 'work', nowMs: T0, durationSec: 45, workoutId: w.id, exerciseId: 'x', setIndex: 2,
      pending: { weight: null, reps: null, performedName: null, restSec: 60 },
    }));
    const changed = driveTimer(ctx, T0 + 600_000, newDriverMemo());
    expect(changed).toBe(true);
    expect(listEntries(ctx, w.id)).toMatchObject([{ exerciseId: 'x', setIndex: 2, done: true }]);
    expect(useTimerStore.getState().timer).toBeNull();
    expect(sound.playRestDone).not.toHaveBeenCalled();
  });

  it("chrono d'effort au premier plan : série cochée, son, repos enchaîné ; une seule fois", () => {
    const { ctx, w } = setup();
    useTimerStore.getState().start(ctx, startTimer({
      mode: 'work', nowMs: T0, durationSec: 45, workoutId: w.id, exerciseId: 'x', setIndex: 0,
      pending: { weight: null, reps: null, performedName: null, restSec: 60 },
    }));
    const memo = newDriverMemo();
    expect(driveTimer(ctx, T0 + 45_050, memo)).toBe(true);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', endAt: T0 + 45_050 + 60_000 });
    expect(driveTimer(ctx, T0 + 45_300, memo)).toBe(false);
    expect(sound.playRestDone).toHaveBeenCalledTimes(1);
  });
});
