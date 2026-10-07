/** @jest-environment node */
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { startTimer } from '@/domain/timer';
import { TIMER_INITIAL, useTimerStore } from '../timerStore';

const T0 = 5_000_000;
const rest = startTimer({ mode: 'rest', nowMs: T0, durationSec: 90, workoutId: 'w', exerciseId: 'x', setIndex: 0 });

describe('timerStore', () => {
  beforeEach(() => useTimerStore.setState(TIMER_INITIAL));

  it("start persiste dans settings.activeRest, clear l'efface", () => {
    const ctx = createTestCtx();
    useTimerStore.getState().start(ctx, rest);
    expect(getSetting(ctx, 'activeRest')).toEqual(rest);
    useTimerStore.getState().clear(ctx);
    expect(useTimerStore.getState().timer).toBeNull();
    expect(getSetting(ctx, 'activeRest')).toBeUndefined();
  });

  it('adjust décale la fin et persiste', () => {
    const ctx = createTestCtx();
    useTimerStore.getState().start(ctx, rest);
    useTimerStore.getState().adjust(ctx, 15, T0);
    expect(useTimerStore.getState().timer?.endAt).toBe(T0 + 105_000);
    expect(getSetting(ctx, 'activeRest')?.endAt).toBe(T0 + 105_000);
  });

  it('finish efface le minuteur et garde un flash optionnel', () => {
    const ctx = createTestCtx();
    useTimerStore.getState().start(ctx, rest);
    useTimerStore.getState().finish(ctx, T0 + 1500);
    expect(useTimerStore.getState()).toMatchObject({ timer: null, flash: { exerciseId: 'x', until: T0 + 1500 } });
  });

  it('hydrate relit un minuteur valide et purge un repos expiré', () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'activeRest', rest);
    useTimerStore.getState().hydrate(ctx, T0 + 1000);
    expect(useTimerStore.getState().timer).toEqual(rest);
    useTimerStore.getState().hydrate(ctx, T0 + 999_000);
    expect(useTimerStore.getState().timer).toBeNull();
    expect(getSetting(ctx, 'activeRest')).toBeUndefined();
  });
});
