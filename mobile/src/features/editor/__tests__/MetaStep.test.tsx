import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { newDraft } from '@/domain/draft';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { MetaStep } from '../MetaStep';

const nav = () => ({ goToStep: jest.fn(), openSession: jest.fn(), closeSession: jest.fn(), finish: jest.fn() });

describe('MetaStep', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('nom, unité, repos par défaut, règles → brouillon ; Suivant → étape 2', async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, newDraft()); });
    const n = nav();
    await renderWithProviders(<MetaStep nav={n} />, { ctx });
    expect(screen.getByText('Étape 1 / 3')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('meta-label'), 'MON PROGRAMME');
    await fireEvent.press(screen.getByRole('button', { name: 'LBS' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Augmenter Repos par défaut (sec)' }));
    await fireEvent.press(screen.getByTestId('rules-add'));
    await fireEvent.changeText(screen.getByTestId('rules-0'), 'Technique avant tout');
    expect(useDraftStore.getState().draft?.program).toMatchObject({
      meta: { label: 'MON PROGRAMME', units: 'lbs', restDefaultSec: 105 },
      rules: ['Technique avant tout'],
    });
    await fireEvent.press(screen.getByRole('button', { name: 'SUIVANT' }));
    expect(n.goToStep).toHaveBeenCalledWith(2);
  });

  it("sans brouillon : sortie de l'éditeur", async () => {
    const n = nav();
    await renderWithProviders(<MetaStep nav={n} />, { ctx: createTestCtx() });
    expect(n.finish).toHaveBeenCalled();
  });

  it("Enregistrer un brouillon vide affiche les erreurs ; un tap ramène à l'étape", async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, newDraft()); });
    const n = nav();
    await renderWithProviders(<MetaStep nav={n} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await fireEvent.press(screen.getByText('Au moins une séance est requise.'));
    expect(n.goToStep).toHaveBeenCalledWith(2);
  });
});
