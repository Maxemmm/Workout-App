import { act, fireEvent, screen } from '@testing-library/react-native';
import { replaceAll } from '@/db/repos/importRepo';
import { getSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { StatsScreen } from '../StatsScreen';

function restoredCtx() {
  const ctx = createTestCtx();
  const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
  if (!r.ok) throw new Error('fixture invalide');
  replaceAll(ctx, r.bundle);
  return ctx;
}

describe('StatsScreen', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 7, 10)); // mercredi 7 oct. 2026
    await act(async () => { usePrefs.setState(PREFS_INITIAL); });
  });
  afterEach(() => jest.useRealTimers());

  it('sans séance terminée : message d\'accueil seulement', async () => {
    await renderWithProviders(<StatsScreen />, { ctx: createTestCtx() });
    expect(screen.getByText('Termine ta première séance pour voir tes stats')).toBeTruthy();
    expect(screen.queryByText('Records'.toUpperCase())).toBeNull();
  });

  it('vraie sauvegarde : résumé, dernière séance, records', async () => {
    await renderWithProviders(<StatsScreen />, { ctx: restoredCtx() });
    expect(screen.getByText('BAS DU CORPS')).toBeTruthy();
    expect(screen.getByText('RECORDS')).toBeTruthy();
    expect(screen.getAllByText('Presse à cuisses').length).toBeGreaterThan(0);
  });

  it('période « Tout » mémorisée ; exercice choisi ; 3 points ; bascule 1RM', async () => {
    const ctx = restoredCtx();
    await renderWithProviders(<StatsScreen />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'Tout' }));
    expect(getSetting(ctx, 'statsPeriod')).toBe('all');
    await fireEvent.press(screen.getByRole('button', { name: 'Tirage vertical' }));
    expect(screen.getAllByTestId(/^chart-(point|record)$/)).toHaveLength(3);
    // Record de charge de l'exercice + ligne de la liste des records
    expect(screen.getAllByText('40 kg').length).toBeGreaterThanOrEqual(2);
    await fireEvent.press(screen.getByRole('button', { name: '1RM estimé' }));
    expect(screen.getAllByTestId(/^chart-(point|record)$/)).toHaveLength(3);
  });

  it('période courte : exercice sans point dans la période → message, pas de courbe', async () => {
    await renderWithProviders(<StatsScreen />, { ctx: restoredCtx() });
    await fireEvent.press(screen.getByRole('button', { name: '4 sem.' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tirage vertical' }));
    expect(screen.queryAllByTestId(/^chart-(point|record)$/)).toHaveLength(0);
  });

  it('Review Focus 3 : exercice au poids du corps → message dédié', async () => {
    await renderWithProviders(<StatsScreen />, { ctx: restoredCtx() });
    await fireEvent.press(screen.getByRole('button', { name: 'Tout' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Gainage' }));
    expect(screen.getByText(/Aucune charge enregistrée/)).toBeTruthy();
  });
});

describe('StatsScreen — jour courant et focus', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('Revue : le jour courant suit minuit, onglet resté monté', async () => {
    jest.setSystemTime(new Date(2026, 9, 11, 23, 59, 30)); // dimanche soir
    await renderWithProviders(<StatsScreen />, { ctx: restoredCtx() });
    expect(screen.getByTestId('cal-2026-10-11').props.accessibilityLabel).toBe('2026-10-11 today');
    await act(async () => { jest.advanceTimersByTime(31_000); });
    expect(screen.getByTestId('cal-2026-10-12').props.accessibilityLabel).toBe('2026-10-12 today');
  });

  it('Revue : onglet sans focus → aucune lecture de l\'historique, même après un changement de données', async () => {
    jest.setSystemTime(new Date(2026, 9, 7, 10));
    const ctx = restoredCtx();
    const read = jest.spyOn(require('@/db/repos/statsRepo'), 'readHistory');
    await renderWithProviders(<StatsScreen focused={false} />, { ctx });
    await act(async () => { usePrefs.getState().bumpData(); });
    expect(read).not.toHaveBeenCalled();
    expect(screen.queryByText('STATS')).toBeNull();
  });
});
