import { fireEvent, screen } from '@testing-library/react-native';
import type { Exercise } from '@/domain/program';
import { renderWithProviders } from '@/test/renderWithProviders';
import { blankExercise, ExerciseSheet } from '../ExerciseSheet';

describe('ExerciseSheet', () => {
  it('nouvel exercice : nom requis, steppers, chronométré, alternatives', async () => {
    const onSave = jest.fn();
    await renderWithProviders(<ExerciseSheet visible isNew initial={blankExercise(90)} units="kg" onSave={onSave} onClose={jest.fn()} />);
    expect(screen.getByText('Nouvel exercice')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('exo-name'), '  Gainage ');
    await fireEvent.press(screen.getByRole('button', { name: 'Augmenter Séries' }));
    await fireEvent(screen.getByTestId('exo-timed'), 'valueChange', true);
    expect(screen.getByPlaceholderText('EX: 45')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('exo-scheme'), '45');
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuer Repos (sec)' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une alternative' }));
    await fireEvent.changeText(screen.getByTestId('alt-name-0'), 'Planche latérale');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Gainage', sets: 4, timed: true, scheme: '45', restSec: 75, load: null, cue: null, alternatives: ['Planche latérale'],
    }));
  });

  it('exercice existant : champs inconnus conservés, alternative détaillée → objet', async () => {
    const onSave = jest.fn();
    const initial = { id: 'dc', name: 'DC', scheme: '4×8', sets: 4, load: '60 kg', restSec: 120, cue: null, alternatives: [], custom: 1 } as Exercise;
    await renderWithProviders(<ExerciseSheet visible isNew={false} initial={initial} units="kg" onSave={onSave} onClose={jest.fn()} />);
    expect(screen.getByText("Modifier l'exercice")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une alternative' }));
    await fireEvent.changeText(screen.getByTestId('alt-name-0'), 'DC haltères');
    await fireEvent.press(screen.getByRole('button', { name: 'Détails 1' }));
    await fireEvent.changeText(screen.getByTestId('alt-load-0'), '24 kg');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    const saved = onSave.mock.calls[0][0];
    expect(saved).toMatchObject({ name: 'DC', load: '60 kg', custom: 1 });
    expect(saved.id).toBeUndefined();
    expect(saved.alternatives).toEqual([{ name: 'DC haltères', load: '24 kg' }]);
  });
});
