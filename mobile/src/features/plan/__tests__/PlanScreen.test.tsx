import { act, fireEvent, screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { createProgram, getActiveProgram, listPrograms, setActiveProgram } from '@/db/repos/programsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { newDraft, setMeta } from '@/domain/draft';
import { confirm } from '@/platform/confirm';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TOAST_INITIAL, useToastStore } from '@/state/toastStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { PlanScreen } from '../PlanScreen';

async function setup() {
  const ctx = createTestCtx();
  const a = createProgram(ctx, example, 'example');
  ctx.advance(1000); // ordre de création déterministe (la liste est triée par created_at)
  const b = createProgram(ctx, { ...example, meta: { ...example.meta, label: 'PROG B' } }, 'manual');
  ctx.advance(1000);
  setActiveProgram(ctx, a.id);
  const onOpenEditor = jest.fn();
  await renderWithProviders(<PlanScreen onOpenEditor={onOpenEditor} />, { ctx });
  return { ctx, a, b, onOpenEditor };
}

describe('PlanScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useDraftStore.setState(DRAFT_INITIAL); useToastStore.setState(TOAST_INITIAL); });
  });

  it("semaine du programme actif par défaut ; « Ajouter une séance » ouvre l'éditeur à l'étape 2", async () => {
    const { a, onOpenEditor } = await setup();
    expect(screen.getByTestId('week-1')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UNE SÉANCE' }));
    expect(onOpenEditor).toHaveBeenCalledWith(2);
    expect(useDraftStore.getState().draft?.sourceProgramId).toBe(a.id);
  });

  it('Mes programmes : activer, dupliquer, supprimer (confirmé)', async () => {
    const { ctx, b } = await setup();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mes programmes' }));
    await fireEvent.press(screen.getByTestId(`program-${b.id}`));
    expect(getActiveProgram(ctx)?.id).toBe(b.id);
    expect(useToastStore.getState().message).toBe('Programme activé ✓');

    await fireEvent.press(screen.getAllByRole('button', { name: 'Dupliquer' })[0]);
    expect(screen.getByText('PROGRAMME SALLE (copie)')).toBeTruthy();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Supprimer' })[0]);
    expect(confirm).toHaveBeenCalled();
    expect(listPrograms(ctx).map((p) => p.definition.meta.label)).toEqual(['PROG B', 'PROGRAMME SALLE (copie)']);
  });

  it('suppression refusée : rien ne change', async () => {
    const { ctx } = await setup();
    jest.mocked(confirm).mockResolvedValueOnce(false);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mes programmes' }));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Supprimer' })[0]);
    expect(listPrograms(ctx)).toHaveLength(2);
  });

  it("bannière de brouillon : reprendre ouvre l'étape 1, abandonner l'efface", async () => {
    const { ctx, onOpenEditor } = await setup();
    await act(async () => { useDraftStore.getState().start(ctx, setMeta(newDraft(), { label: 'BROUILLON' })); });
    expect(screen.getByText('Brouillon en cours : BROUILLON')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reprendre' }));
    expect(onOpenEditor).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Abandonner' }));
    expect(useDraftStore.getState().draft).toBeNull();
  });

  it('brouillon illisible signalé une fois', async () => {
    await act(async () => { useDraftStore.setState({ draft: null, lost: true }); });
    await setup();
    expect(useToastStore.getState().message).toBe('Brouillon illisible : il a été supprimé.');
    expect(useDraftStore.getState().lost).toBe(false);
  });
});
