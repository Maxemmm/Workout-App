// Jour courant qui suit minuit et le retour au premier plan (écrans d'onglets restés montés)
import { act, render, screen } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { useTodayKey } from '../useTodayKey';

function Probe() {
  return <Text>{useTodayKey()}</Text>;
}

describe('useTodayKey', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 11, 23, 59, 30)); // dimanche soir
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('bascule à minuit, app ouverte', async () => {
    await render(<Probe />);
    expect(screen.getByText('2026-10-11')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(31_000); });
    expect(screen.getByText('2026-10-12')).toBeTruthy();
  });

  it('bascule au retour au premier plan (minuit passé en arrière-plan)', async () => {
    let listener: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      listener = cb as (s: string) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    await render(<Probe />);
    jest.setSystemTime(new Date(2026, 9, 12, 8, 0, 0)); // l'horloge avance sans que le minuteur JS tourne
    await act(async () => { listener('active'); });
    expect(screen.getByText('2026-10-12')).toBeTruthy();
  });
});
