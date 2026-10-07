import { act, screen } from '@testing-library/react-native';
import { replaceAll } from '@/db/repos/importRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { TodayScreen } from '@/features/today/TodayScreen';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { renderWithProviders } from '@/test/renderWithProviders';

describe('restauration de la vraie sauvegarde → Today', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 7, 10)); // mercredi 7 oct. 2026
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useTimerStore.setState(TIMER_INITIAL); });
  });
  afterEach(() => jest.useRealTimers());

  it('séance du mercredi du programme importé + « Dernière fois » alimenté par l\'historique', async () => {
    const ctx = createTestCtx();
    const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
    if (!r.ok) throw new Error('fixture invalide');
    replaceAll(ctx, r.bundle);
    await renderWithProviders(<TodayScreen />, { ctx });
    expect(screen.getAllByText('HAUT DU CORPS').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Dernière fois/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/non terminée/)).toBeNull();
  });
});
