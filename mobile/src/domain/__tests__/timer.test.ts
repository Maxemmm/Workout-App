import {
  ADJUST_STEP_SEC, adjustTimer, isTimerState, reviveOnStartup, shouldAlert,
  startTimer, timerPhase, timerProgress,
} from '../timer';

const T0 = 1_000_000;
const rest = startTimer({ mode: 'rest', nowMs: T0, durationSec: 90, workoutId: 'w', exerciseId: 'x', setIndex: 0 });
const work = startTimer({
  mode: 'work', nowMs: T0, durationSec: 45, workoutId: 'w', exerciseId: 'g', setIndex: 1,
  pending: { weight: null, reps: null, performedName: null, restSec: 60 },
});

describe('timer', () => {
  it('startTimer fixe startedAt / endAt', () => {
    expect(rest).toMatchObject({ mode: 'rest', startedAt: T0, endAt: T0 + 90_000, pending: null });
    expect(work.pending?.restSec).toBe(60);
  });

  it('phases : running, critical sous 10 s, done à 0', () => {
    expect(timerPhase(rest, T0 + 1_000)).toBe('running');
    expect(timerPhase(rest, T0 + 80_500)).toBe('critical');
    expect(timerPhase(rest, T0 + 90_000)).toBe('done');
  });

  it('adjustTimer ±15 s sans descendre sous maintenant', () => {
    expect(adjustTimer(rest, ADJUST_STEP_SEC, T0).endAt).toBe(T0 + 105_000);
    expect(adjustTimer(rest, -ADJUST_STEP_SEC, T0).endAt).toBe(T0 + 75_000);
    expect(adjustTimer(rest, -ADJUST_STEP_SEC, T0 + 85_000).endAt).toBe(T0 + 85_000);
  });

  it('timerProgress = fraction écoulée, bornée', () => {
    expect(timerProgress(rest, T0 + 45_000)).toBeCloseTo(0.5);
    expect(timerProgress(rest, T0 + 999_000)).toBe(1);
    expect(timerProgress(rest, T0 - 5)).toBe(0);
  });

  it('shouldAlert seulement juste après la fin (premier plan)', () => {
    expect(shouldAlert(rest, T0 + 90_200)).toBe(true);
    expect(shouldAlert(rest, T0 + 90_000 + 60_000)).toBe(false);
  });

  it('isTimerState rejette les formes invalides', () => {
    expect(isTimerState(rest)).toBe(true);
    expect(isTimerState({ ...rest, mode: 'pause' })).toBe(false);
    expect(isTimerState({ workoutId: 'w', exerciseId: 'x', endAt: 5 })).toBe(false);
    expect(isTimerState(null)).toBe(false);
  });

  it('reviveOnStartup : repos expiré purgé, effort expiré conservé, invalide → null', () => {
    expect(reviveOnStartup(rest, T0 + 10_000)).toEqual(rest);
    expect(reviveOnStartup(rest, T0 + 500_000)).toBeNull();
    expect(reviveOnStartup(work, T0 + 500_000)).toEqual(work);
    expect(reviveOnStartup({ endAt: 'x' }, T0)).toBeNull();
  });
});
