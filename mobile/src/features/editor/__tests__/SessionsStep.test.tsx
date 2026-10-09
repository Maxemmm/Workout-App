import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { draftFromProgram, newDraft } from '@/domain/draft';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '@/domain/__fixtures__/builders';
import { confirm } from '@/platform/confirm';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { SessionsStep } from '../SessionsStep';

const nav = () => ({ goToStep: jest.fn(), openSession: jest.fn(), closeSession: jest.fn(), finish: jest.fn() });
const program = parseOrThrow(makeProgramInput({ '1': 'a' }, {
  a: makeSession('HAUT', [makeExercise('dc', 3), makeExercise('row', 3)]),
  b: makeSession('BAS', [], { type: 'cardio' }),
}));

describe('SessionsStep', () => {
  beforeEach(() => { jest.clearAllMocks(); useDraftStore.setState(DRAFT_INITIAL); });

  it("liste vide puis création → ouvre l'éditeur de séance", async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, newDraft()); });
    const n = nav();
    await renderWithProviders(<SessionsStep nav={n} />, { ctx });
    expect(screen.getByText('Aucune séance — créez-en une ci-dessous.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER UNE SÉANCE' }));
    const keys = Object.keys(useDraftStore.getState().draft!.program.sessions);
    expect(keys).toHaveLength(1);
    expect(n.openSession).toHaveBeenCalledWith(keys[0]);
  });

  it("cartes : nom, type et nombre d'exercices ; modifier, dupliquer, supprimer (confirmé, planning nettoyé)", async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, draftFromProgram('p', program)); });
    const n = nav();
    await renderWithProviders(<SessionsStep nav={n} />, { ctx });
    expect(screen.getByText('HAUT')).toBeTruthy();
    expect(screen.getByText('Muscu · 2 exercices')).toBeTruthy();
    expect(screen.getByText('Cardio · 0 exercice')).toBeTruthy();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Modifier la séance' })[0]);
    expect(n.openSession).toHaveBeenCalledWith('a');

    await fireEvent.press(screen.getAllByRole('button', { name: 'Dupliquer' })[0]);
    expect(screen.getByText('HAUT (copie)')).toBeTruthy();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Supprimer' })[0]);
    expect(confirm).toHaveBeenCalled();
    expect(useDraftStore.getState().draft!.program.sessions.a).toBeUndefined();
    expect(useDraftStore.getState().draft!.program.schedule).toEqual({});

    await fireEvent.press(screen.getByRole('button', { name: 'CONFIGURER LE PLANNING' }));
    expect(n.goToStep).toHaveBeenCalledWith(3, 2);
  });

  it("réordonner (action d'accessibilité)", async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, draftFromProgram('p', program)); });
    await renderWithProviders(<SessionsStep nav={nav()} />, { ctx });
    await fireEvent(screen.getByTestId('reorder-b'), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    expect(Object.keys(useDraftStore.getState().draft!.program.sessions)).toEqual(['b', 'a']);
  });
});
