import { act, fireEvent, screen } from '@testing-library/react-native';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { getSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { TodayScreen } from '@/features/today/TodayScreen';
import { restNotifier } from '@/platform/restNotifier';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { renderWithProviders } from '@/test/renderWithProviders';

const MONDAY = new Date(2026, 9, 5, 10, 0, 0);

async function setup() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, makeProgramInput({ '1': 'fb' }, { fb: makeSession('FB', [makeExercise('presse', 3, { name: 'Presse', restSec: 90 })]) }), 'manual');
  setActiveProgram(ctx, p.id);
  await renderWithProviders(<TodayScreen />, { ctx });
  return ctx;
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('feuille d\'autorisation des alertes', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
    jest.clearAllMocks();
    jest.mocked(restNotifier.permission).mockResolvedValue('undetermined');
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useTimerStore.setState(TIMER_INITIAL); });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(restNotifier.permission).mockResolvedValue('granted');
  });

  it('première série cochée → feuille ; Activer → demande système, réglage activé', async () => {
    const ctx = await setup();
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    await flush();
    expect(screen.getByText('Être prévenu à la fin du repos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Activer' }));
    await flush();
    expect(restNotifier.requestPermission).toHaveBeenCalled();
    expect(getSetting(ctx, 'restAlerts')).toBe(true);
    expect(screen.queryByText('Être prévenu à la fin du repos')).toBeNull();
  });

  it('Plus tard → réglage désactivé, plus jamais redemandé', async () => {
    const ctx = await setup();
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Plus tard' }));
    await flush();
    expect(getSetting(ctx, 'restAlerts')).toBe(false);
    await fireEvent.press(screen.getByTestId('set-presse-1'));
    await flush();
    expect(screen.queryByText('Être prévenu à la fin du repos')).toBeNull();
  });

  it('Review Focus 5 : notifications indisponibles (web) → jamais de feuille', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('unavailable');
    await setup();
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    await flush();
    expect(screen.queryByText('Être prévenu à la fin du repos')).toBeNull();
  });

  it('autorisation déjà accordée → pas de feuille', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('granted');
    await setup();
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    await flush();
    expect(screen.queryByText('Être prévenu à la fin du repos')).toBeNull();
  });
});
