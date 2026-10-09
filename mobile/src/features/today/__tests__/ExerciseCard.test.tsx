import { fireEvent, screen } from '@testing-library/react-native';
import { effectiveExercise } from '@/domain/exerciseView';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '@/domain/__fixtures__/builders';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ExerciseCard } from '../ExerciseCard';

const program = parseOrThrow(makeProgramInput({ '1': 's' }, {
  s: makeSession('S', [makeExercise('presse', 3, { name: 'Presse', scheme: '3×8', load: '100 à 120 kg', cue: 'Dos plaqué', alternatives: ['Squat'] })]),
}));
const base = program.sessions.s.exercises[0];

function renderCard(over: Partial<Parameters<typeof ExerciseCard>[0]> = {}) {
  const props = {
    exercise: effectiveExercise(base, null), units: 'kg' as const, accent: 'gold', done: [true, false, false],
    weight: 100, restSec: 90, last: { date: '2026-09-28', sets: 3, reps: 8, maxWeight: 95 }, locked: false, pendingSet: null,
    onPressSet: jest.fn(), onLongPressSet: jest.fn(), onChangeWeight: jest.fn(), onSwap: jest.fn(), onPressRest: jest.fn(),
    ...over,
  };
  return renderWithProviders(<ExerciseCard {...props} />).then(() => ({ props }));
}

describe('ExerciseCard', () => {
  it('affiche nom, schéma, consigne, dernière fois, repos', async () => {
    await renderCard();
    expect(screen.getByText('Presse')).toBeTruthy();
    expect(screen.getByText('3 × 8')).toBeTruthy();
    expect(screen.getByText('Dos plaqué')).toBeTruthy();
    expect(screen.getByText('Dernière fois : 3 × 8 · 95 kg')).toBeTruthy();
    expect(screen.getByText('REPOS 90S')).toBeTruthy();
  });

  it('tap et appui long sur un cercle', async () => {
    const { props } = await renderCard();
    await fireEvent.press(screen.getByTestId('set-presse-1'));
    expect(props.onPressSet).toHaveBeenCalledWith(1);
    await fireEvent(screen.getByTestId('set-presse-2'), 'longPress');
    expect(props.onLongPressSet).toHaveBeenCalledWith(2);
  });

  it('cercles désactivés quand la séance est terminée (appui long toujours possible)', async () => {
    const { props } = await renderCard({ locked: true });
    await fireEvent.press(screen.getByTestId('set-presse-1'));
    expect(props.onPressSet).not.toHaveBeenCalled();
  });

  it('carte complète (fond vert) : tous les textes passent en couleur lisible sur le vert', async () => {
    const { StyleSheet } = require('react-native') as typeof import('react-native');
    const { palettes } = require('@/theme/tokens') as typeof import('@/theme/tokens');
    await renderCard({ done: [true, true, true] });
    const onDone = palettes.dark.onDone;
    for (const text of ['Presse', 'Dos plaqué', 'Dernière fois : 3 × 8 · 95 kg', '100 à 120 kg', 'REPOS 90S', 'kg']) {
      expect(StyleSheet.flatten(screen.getByText(text).props.style).color).toBe(onDone);
    }
  });

  it('carte complète marquée', async () => {
    await renderCard({ done: [true, true, true] });
    expect(screen.getByTestId('card-presse-complete')).toBeTruthy();
  });

  it('stepper : +/− par pas de 2,5 kg, saisie libre avec virgule, vide = effacé', async () => {
    const { props } = await renderCard();
    await fireEvent.press(screen.getByLabelText('+ 2.5 kg'));
    expect(props.onChangeWeight).toHaveBeenLastCalledWith(102.5);
    await fireEvent.press(screen.getByLabelText('− 2.5 kg'));
    expect(props.onChangeWeight).toHaveBeenLastCalledWith(97.5);
    const input = screen.getByTestId('weight-presse');
    await fireEvent.changeText(input, '102,5');
    await fireEvent(input, 'blur');
    expect(props.onChangeWeight).toHaveBeenLastCalledWith(102.5);
    await fireEvent.changeText(input, '');
    await fireEvent(input, 'blur');
    expect(props.onChangeWeight).toHaveBeenLastCalledWith(null);
  });

  it('échange : bouton présent si alternatives, libellé « remplace » si échangé', async () => {
    const { props } = await renderCard({ exercise: effectiveExercise(base, 'Squat') });
    expect(screen.getByText('Squat')).toBeTruthy();
    expect(screen.getByText('remplace Presse')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Changer d'exercice"));
    expect(props.onSwap).toHaveBeenCalled();
  });
});
