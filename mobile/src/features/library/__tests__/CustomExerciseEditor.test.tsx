import { act, fireEvent, screen } from '@testing-library/react-native';
import { createCustomExercise, getCustomExercise, listCustomExercises } from '@/db/repos/customExercisesRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { CustomExerciseEditor } from '../CustomExerciseEditor';

describe('CustomExerciseEditor', () => {
  beforeEach(async () => { await act(async () => { usePrefs.setState(PREFS_INITIAL); }); });

  it('création : nom + muscle + matériel requis ; secondaires ; étapes', async () => {
    const ctx = createTestCtx();
    const onDone = jest.fn();
    await renderWithProviders(<CustomExerciseEditor onDone={onDone} onCancel={jest.fn()} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(listCustomExercises(ctx)).toEqual([]);
    await fireEvent.changeText(screen.getByTestId('custom-name'), 'Presse 45°');
    await fireEvent.press(screen.getByRole('button', { name: 'Muscle principal' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Quadriceps' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Matériel' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Machine' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Fessiers' }));
    await fireEvent.press(screen.getByTestId('custom-steps-add'));
    await fireEvent.changeText(screen.getByTestId('custom-steps-0'), 'Pousser');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    const [c] = listCustomExercises(ctx);
    expect(c).toMatchObject({ name: 'Presse 45°', primary: 'quads', secondary: ['glutes'], equipment: 'machine', steps: ['Pousser'] });
    expect(onDone).toHaveBeenCalledWith(c.id);
  });

  it('modification : champs préremplis, enregistrés', async () => {
    const ctx = createTestCtx();
    const c = createCustomExercise(ctx, { name: 'A', primary: 'chest', secondary: [], equipment: 'dumbbell', steps: null });
    await renderWithProviders(<CustomExerciseEditor customId={c.id} onDone={jest.fn()} onCancel={jest.fn()} />, { ctx });
    expect(screen.getByTestId('custom-name').props.value).toBe('A');
    await fireEvent.changeText(screen.getByTestId('custom-name'), 'B');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(getCustomExercise(ctx, c.id)?.name).toBe('B');
  });
});
