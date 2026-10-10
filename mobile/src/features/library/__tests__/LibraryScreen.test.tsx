import { act, fireEvent, screen } from '@testing-library/react-native';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { LibraryScreen } from '../LibraryScreen';

async function setup(prepare?: (ctx: ReturnType<typeof createTestCtx>) => void) {
  const ctx = createTestCtx();
  prepare?.(ctx);
  const props = { onOpen: jest.fn(), onNewCustom: jest.fn() };
  await renderWithProviders(<LibraryScreen {...props} />, { ctx });
  return { ctx, props };
}

describe('LibraryScreen', () => {
  beforeEach(async () => { await act(async () => { usePrefs.setState(PREFS_INITIAL); }); });

  it('recherche → résultats ; vide → message', async () => {
    await setup();
    await fireEvent.changeText(screen.getByTestId('lib-search'), 'zzzz introuvable');
    expect(screen.getByText('Aucun exercice ne correspond')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('lib-search'), 'developpe couche');
    expect(screen.getAllByTestId(/^lib-row-/).length).toBeGreaterThan(0);
  });

  it('ouvrir une fiche ; favori basculé depuis la ligne', async () => {
    const { ctx, props } = await setup();
    await fireEvent.changeText(screen.getByTestId('lib-search'), 'developpe couche');
    const row = screen.getAllByTestId(/^lib-row-/)[0];
    const id = row.props.testID.replace('lib-row-', '');
    await fireEvent.press(row);
    expect(props.onOpen).toHaveBeenCalledWith(id);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Ajouter aux favoris' })[0]);
    expect(getSetting(ctx, 'favoriteExercises')).toEqual([id]);
    await fireEvent.press(screen.getByRole('button', { name: 'Favoris' }));
    expect(screen.getAllByTestId(/^lib-row-/)).toHaveLength(1);
  });

  it('mon matériel renseigné → filtre actif par défaut', async () => {
    await setup((ctx) => setSetting(ctx, 'myEquipment', ['bodyweight']));
    expect(screen.getByRole('button', { name: 'Mon matériel' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('filtre muscle via la feuille de choix', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Muscle' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Mollets' }));
    expect(screen.getByRole('button', { name: 'Mollets' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('nouvel exercice personnalisé', async () => {
    const { props } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Nouvel exercice' }));
    expect(props.onNewCustom).toHaveBeenCalled();
  });
});
