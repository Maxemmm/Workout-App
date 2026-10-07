import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { startTimer } from '@/domain/timer';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { RestBar } from '../RestBar';

describe('RestBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-05T10:00:00.000Z'));
    useTimerStore.setState(TIMER_INITIAL);
  });
  afterEach(() => jest.useRealTimers());

  it('masquée sans minuteur ; affiche temps restant, ±15 s, Passer', async () => {
    const ctx = createTestCtx();
    const onPressBar = jest.fn();
    await renderWithProviders(<RestBar exerciseName={() => 'Presse'} onPressBar={onPressBar} />, { ctx });
    expect(screen.queryByTestId('rest-bar')).toBeNull();

    await act(async () => {
      useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs: Date.now(), durationSec: 90, workoutId: 'w', exerciseId: 'x', setIndex: 0 }));
    });
    expect(screen.getByText('Presse')).toBeTruthy();
    expect(screen.getByText('1:30')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '+15 s' }));
    expect(screen.getByText('1:45')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(5_000); });
    expect(screen.getByText('1:40')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('rest-bar'));
    expect(onPressBar).toHaveBeenCalledWith('x');

    await fireEvent.press(screen.getByRole('button', { name: 'Passer' }));
    expect(useTimerStore.getState().timer).toBeNull();
  });
});
