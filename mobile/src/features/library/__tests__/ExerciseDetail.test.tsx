import { act, fireEvent, screen } from '@testing-library/react-native';
import { createCustomExercise, listCustomExercises } from '@/db/repos/customExercisesRepo';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { getSetting } from '@/db/repos/settingsRepo';
import { completeWorkout, ensureWorkout, upsertSet } from '@/db/repos/workoutsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { confirm } from '@/platform/confirm';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ExerciseDetail } from '../ExerciseDetail';

const props = () => ({ onBack: jest.fn(), onEdit: jest.fn(), onOpenStats: jest.fn() });

describe('ExerciseDetail', () => {
  beforeEach(async () => { jest.clearAllMocks(); await act(async () => { usePrefs.setState(PREFS_INITIAL); }); });

  it('fiche du catalogue : nom, muscles, matériel, étapes ; favori', async () => {
    const ctx = createTestCtx();
    const p = props();
    await renderWithProviders(<ExerciseDetail id="ds:0001" {...p} />, { ctx });
    expect(screen.getByText('Muscle principal'.toUpperCase())).toBeTruthy();
    expect(screen.getByText('Instructions'.toUpperCase())).toBeTruthy();
    expect(screen.getAllByTestId(/^step-/).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter aux favoris' }));
    expect(getSetting(ctx, 'favoriteExercises')).toEqual(['ds:0001']);
  });

  it('historique lié : record et dernière fois ; lien vers Stats', async () => {
    const ctx = createTestCtx();
    const prog = createProgram(ctx, makeProgramInput({ 1: 's' }, { s: makeSession('S', [makeExercise('dc', 2, { libraryId: 'ds:0001' })]) }), 'manual');
    setActiveProgram(ctx, prog.id);
    const w = ensureWorkout(ctx, { programId: prog.id, sessionKey: 's', date: '2026-10-05' });
    upsertSet(ctx, w.id, 'dc', 0, { done: true, weight: 80, reps: 8 });
    completeWorkout(ctx, w.id);
    const p = props();
    await renderWithProviders(<ExerciseDetail id="ds:0001" {...p} />, { ctx });
    expect(screen.getByText('Ton historique'.toUpperCase())).toBeTruthy();
    expect(screen.getByText(/^Record : 80 kg/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Voir dans Stats' }));
    expect(p.onOpenStats).toHaveBeenCalledWith('dc');
  });

  it('personnalisé : Modifier, Supprimer (confirmé)', async () => {
    const ctx = createTestCtx();
    const c = createCustomExercise(ctx, { name: 'Mon exo', primary: 'quads', secondary: [], equipment: 'machine', steps: null });
    const p = props();
    await renderWithProviders(<ExerciseDetail id={`custom:${c.id}`} {...p} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'Modifier' }));
    expect(p.onEdit).toHaveBeenCalledWith(c.id);
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));
    expect(confirm).toHaveBeenCalled();
    expect(listCustomExercises(ctx)).toEqual([]);
    expect(p.onBack).toHaveBeenCalled();
  });

  it('Review Focus 3 : id inconnu (personnalisé supprimé) → « Exercice introuvable »', async () => {
    await renderWithProviders(<ExerciseDetail id="custom:nope" {...props()} />, { ctx: createTestCtx() });
    expect(screen.getByText('Exercice introuvable')).toBeTruthy();
  });
});
