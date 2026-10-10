import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { addSession, newDraft } from '@/domain/draft';
import { effectiveExercise } from '@/domain/exerciseView';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '@/domain/__fixtures__/builders';
import { ExerciseCard } from '@/features/today/ExerciseCard';
import { SessionStep } from '@/features/editor/SessionStep';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { LIBRARY_PICK_INITIAL, useLibraryPickStore } from '@/state/libraryPickStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ExercisePicker } from '../ExercisePicker';

const nav = () => ({ goToStep: jest.fn(), openSession: jest.fn(), closeSession: jest.fn(), finish: jest.fn(), openLibrary: jest.fn() });

describe('éditeur ↔ bibliothèque', () => {
  beforeEach(() => { useDraftStore.setState(DRAFT_INITIAL); useLibraryPickStore.setState(LIBRARY_PICK_INITIAL); });

  it('« Ajouter un exercice » ouvre le sélecteur ; le choix préremplit la feuille avec libraryId', async () => {
    const ctx = createTestCtx();
    const { draft, key } = addSession(newDraft(), 'lift', () => 'aaaa');
    await act(async () => { useDraftStore.getState().start(ctx, draft); });
    const n = nav();
    await renderWithProviders(<SessionStep nav={n} sessionKey={key} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UN EXERCICE' }));
    expect(n.openLibrary).toHaveBeenCalled();
    await act(async () => { useLibraryPickStore.getState().resolve({ libraryId: 'ds:0001', name: 'Relevé de buste 3/4' }); });
    expect(screen.getByTestId('exo-name').props.value).toBe('Relevé de buste 3/4');
    expect(screen.getByText('Lié à : Relevé de buste 3/4')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(useDraftStore.getState().draft!.program.sessions[key].exercises[0]).toMatchObject({ name: 'Relevé de buste 3/4', libraryId: 'ds:0001' });
  });

  it('« Exercice libre » : feuille vide, sans lien', async () => {
    const ctx = createTestCtx();
    const { draft, key } = addSession(newDraft(), 'lift', () => 'aaaa');
    await act(async () => { useDraftStore.getState().start(ctx, draft); });
    await renderWithProviders(<SessionStep nav={nav()} sessionKey={key} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UN EXERCICE' }));
    await act(async () => { useLibraryPickStore.getState().resolve(null); });
    expect(screen.getByTestId('exo-name').props.value).toBe('');
    expect(screen.queryByText(/^Lié à/)).toBeNull();
  });

  it('feuille d\'un exercice lié : Délier retire le lien', async () => {
    const ctx = createTestCtx();
    const base = addSession(newDraft(), 'lift', () => 'aaaa');
    await act(async () => { useDraftStore.getState().start(ctx, base.draft); });
    await act(async () => {
      const { addExercise } = require('@/domain/draft') as typeof import('@/domain/draft');
      useDraftStore.getState().apply(ctx, (d) => addExercise(d, base.key, 'main', { name: 'Crunch', sets: 3, scheme: '', alternatives: [], libraryId: 'ds:0001' } as never).draft);
    });
    await renderWithProviders(<SessionStep nav={nav()} sessionKey={base.key} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: /^Modifier l'exercice Crunch|^Modifier Crunch/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Délier' }));
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(useDraftStore.getState().draft!.program.sessions[base.key].exercises[0].libraryId).toBeUndefined();
  });

  it('« Changer » puis Annuler dans le sélecteur : la feuille revient avec la saisie en cours', async () => {
    const ctx = createTestCtx();
    const base = addSession(newDraft(), 'lift', () => 'aaaa');
    await act(async () => { useDraftStore.getState().start(ctx, base.draft); });
    await act(async () => {
      const { addExercise } = require('@/domain/draft') as typeof import('@/domain/draft');
      useDraftStore.getState().apply(ctx, (d) => addExercise(d, base.key, 'main', { name: 'Crunch', sets: 3, scheme: '', alternatives: [], libraryId: 'ds:0001' } as never).draft);
    });
    const n = nav();
    await renderWithProviders(<SessionStep nav={n} sessionKey={base.key} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: /^Modifier l'exercice Crunch/ }));
    await fireEvent.changeText(screen.getByTestId('exo-name'), 'Crunch lent');
    await fireEvent.press(screen.getByRole('button', { name: 'Changer' }));
    expect(n.openLibrary).toHaveBeenCalled();
    await act(async () => { useLibraryPickStore.getState().resolve('cancel'); });
    expect(screen.getByTestId('exo-name').props.value).toBe('Crunch lent');
    expect(screen.getByText('Lié à : Relevé de buste 3/4')).toBeTruthy();
  });

  it('« Ajouter » puis Annuler dans le sélecteur : aucune feuille', async () => {
    const ctx = createTestCtx();
    const { draft, key } = addSession(newDraft(), 'lift', () => 'aaaa');
    await act(async () => { useDraftStore.getState().start(ctx, draft); });
    await renderWithProviders(<SessionStep nav={nav()} sessionKey={key} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UN EXERCICE' }));
    await act(async () => { useLibraryPickStore.getState().resolve('cancel'); });
    expect(screen.queryByTestId('exo-name')).toBeNull();
  });

  it('sélecteur : recherche puis choix ; Exercice libre', async () => {
    const onPick = jest.fn();
    const onFree = jest.fn();
    await renderWithProviders(<ExercisePicker onPick={onPick} onFree={onFree} onCancel={jest.fn()} />, { ctx: createTestCtx() });
    await fireEvent.changeText(screen.getByTestId('lib-search'), 'developpe couche');
    await fireEvent.press(screen.getAllByTestId(/^lib-row-/)[0]);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: expect.stringMatching(/^(ds|wg):/) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Exercice libre' }));
    expect(onFree).toHaveBeenCalled();
  });

  it('Review Focus 3 : carte Today liée → vignette qui ouvre la fiche ; lien inconnu → pas de vignette', async () => {
    const program = parseOrThrow(makeProgramInput({ '1': 's' }, { s: makeSession('S', [makeExercise('a', 2, { name: 'A', libraryId: 'ds:0001' }), makeExercise('b', 2, { name: 'B', libraryId: 'custom:gone' })]) }));
    const onOpenExercise = jest.fn();
    const base = { units: 'kg' as const, accent: 'gold', done: [], weight: null, restSec: 90, last: null, locked: false, pendingSet: null,
      onPressSet: jest.fn(), onLongPressSet: jest.fn(), onChangeWeight: jest.fn(), onPressRest: jest.fn(), onOpenExercise };
    await renderWithProviders(<ExerciseCard {...base} exercise={effectiveExercise(program.sessions.s.exercises[0], null)} />, { ctx: createTestCtx() });
    await fireEvent.press(screen.getByRole('button', { name: 'Voir la fiche' }));
    expect(onOpenExercise).toHaveBeenCalledWith('ds:0001');
    await renderWithProviders(<ExerciseCard {...base} exercise={effectiveExercise(program.sessions.s.exercises[1], null)} />, { ctx: createTestCtx() });
    // le second rendu remplace le premier : la carte au lien inconnu n'a pas de vignette
    expect(screen.getByTestId('card-b')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: 'Voir la fiche' })).toHaveLength(0);
  });
});
