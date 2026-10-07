import { fireEvent, screen } from '@testing-library/react-native';
import { effectiveExercise } from '@/domain/exerciseView';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '@/domain/__fixtures__/builders';
import { renderWithProviders } from '@/test/renderWithProviders';
import { SetEditSheet } from '../SetEditSheet';
import { SwapSheet } from '../SwapSheet';

describe('SetEditSheet', () => {
  it('pré-remplit, accepte la virgule, enregistre', async () => {
    const onSave = jest.fn();
    await renderWithProviders(<SetEditSheet visible setIndex={1} units="kg" initialWeight={100} initialReps={8} onSave={onSave} onClose={jest.fn()} />);
    expect(screen.getByText('Série 2')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('set-edit-weight'), '102,5');
    await fireEvent.changeText(screen.getByTestId('set-edit-reps'), '6');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledWith({ weight: 102.5, reps: 6 });
  });

  it('champs vides → null', async () => {
    const onSave = jest.fn();
    await renderWithProviders(<SetEditSheet visible setIndex={0} units="kg" initialWeight={null} initialReps={null} onSave={onSave} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledWith({ weight: null, reps: null });
  });
});

describe('SwapSheet', () => {
  const ex = parseOrThrow(makeProgramInput({}, {
    s: makeSession('S', [makeExercise('presse', 3, { name: 'Presse', alternatives: ['Squat', { name: 'Fentes', sets: 3 }] })]),
  })).sessions.s.exercises[0];

  it("liste l'original et les alternatives ; choisir l'original renvoie null", async () => {
    const onSelect = jest.fn();
    await renderWithProviders(<SwapSheet visible exercise={effectiveExercise(ex, 'Squat')} onSelect={onSelect} onClose={jest.fn()} />);
    expect(screen.getByText('Fentes')).toBeTruthy();
    await fireEvent.press(screen.getByText('Fentes'));
    expect(onSelect).toHaveBeenLastCalledWith('Fentes');
    await fireEvent.press(screen.getByText('Presse'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
