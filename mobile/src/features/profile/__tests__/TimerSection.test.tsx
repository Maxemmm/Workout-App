import { act, fireEvent, screen } from '@testing-library/react-native';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { restNotifier } from '@/platform/restNotifier';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TimerSection } from '../TimerSection';

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('TimerSection', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); });
  });
  afterEach(() => jest.mocked(restNotifier.permission).mockResolvedValue('granted'));

  it('activé + autorisé : « Son, vibration et notifications »', async () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'restAlerts', true);
    await renderWithProviders(<TimerSection />, { ctx });
    await flush();
    expect(screen.getByText('Son, vibration et notifications')).toBeTruthy();
    expect(screen.getByTestId('alerts-switch').props.value).toBe(true);
  });

  it('Review Focus 4 : activé mais refusé dans iOS → message + bouton Réglages', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('denied');
    const ctx = createTestCtx();
    setSetting(ctx, 'restAlerts', true);
    await renderWithProviders(<TimerSection />, { ctx });
    await flush();
    expect(screen.getByText('Refusées — autoriser dans Réglages du téléphone')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir les Réglages' }));
    expect(restNotifier.openSettings).toHaveBeenCalled();
  });

  it('activer alors que jamais demandé → demande système ; désactiver → réglage false', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('undetermined');
    const ctx = createTestCtx();
    await renderWithProviders(<TimerSection />, { ctx });
    await flush();
    await fireEvent(screen.getByTestId('alerts-switch'), 'valueChange', true);
    await flush();
    expect(restNotifier.requestPermission).toHaveBeenCalled();
    expect(getSetting(ctx, 'restAlerts')).toBe(true);
    await fireEvent(screen.getByTestId('alerts-switch'), 'valueChange', false);
    await flush();
    expect(getSetting(ctx, 'restAlerts')).toBe(false);
  });

  it('web (indisponible) : section absente', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('unavailable');
    await renderWithProviders(<TimerSection />, { ctx: createTestCtx() });
    await flush();
    expect(screen.queryByText('MINUTEUR')).toBeNull();
  });
});
