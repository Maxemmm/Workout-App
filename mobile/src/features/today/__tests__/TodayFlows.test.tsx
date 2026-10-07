import { act, fireEvent, screen } from '@testing-library/react-native';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { listEntries } from '@/db/repos/workoutsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession, sevenDayLbsInput } from '@/domain/__fixtures__/builders';
import { confirm } from '@/platform/confirm';
import { keepAwake } from '@/platform/keepAwake';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TodayScreen } from '../TodayScreen';

// Lundi 5 octobre 2026, 10 h locale
const MONDAY = new Date(2026, 9, 5, 10, 0, 0);

const input = makeProgramInput({ '1': 'fb' }, {
  fb: makeSession('FULL BODY', [
    makeExercise('presse', 2, { name: 'Presse', scheme: '2×8', load: '100 kg', restSec: 90, alternatives: ['Squat'] }),
    makeExercise('gainage', 1, { name: 'Gainage', scheme: '1×45 sec', restSec: 60 }),
  ], { warmup: ['Vélo 5 min'], cardio: { label: 'Marche', detail: '15 min' }, bonus: { title: 'BONUS', exercises: [makeExercise('abdos', 1, { name: 'Abdos' })] } }),
}, { restDefaultSec: 90 });

async function setup(programInput: unknown = input) {
  const ctx = createTestCtx();
  const p = createProgram(ctx, programInput, 'manual');
  setActiveProgram(ctx, p.id);
  await renderWithProviders(<TodayScreen />, { ctx });
  return ctx;
}

describe('Today — parcours', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useTimerStore.setState(TIMER_INITIAL); });
  });
  afterEach(() => jest.useRealTimers());

  it('séance du jour : blocs, compteur (bonus exclu), échauffement, cardio, bonus', async () => {
    await setup();
    expect(screen.getAllByText('FULL BODY').length).toBeGreaterThan(0);
    expect(screen.getByText('0 / 3')).toBeTruthy();
    expect(screen.getByText('· Vélo 5 min')).toBeTruthy();
    expect(screen.getByText('Marche')).toBeTruthy();
    expect(screen.getByText('Abdos')).toBeTruthy();
  });

  it('cocher → repos démarré, compteur, carte verte ; Terminer → récapitulatif → Rouvrir', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.getByTestId('rest-bar')).toBeTruthy();
    expect(keepAwake.activate).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('set-presse-1'));
    expect(screen.getByTestId('card-presse-complete')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'TERMINER LA SÉANCE' }));
    expect(confirm).toHaveBeenCalled(); // séries restantes (gainage) → confirmation
    expect(screen.getByTestId('completed-summary')).toBeTruthy();
    expect(screen.queryByTestId('rest-bar')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Rouvrir la séance' }));
    expect(screen.queryByTestId('completed-summary')).toBeNull();
  });

  it("chrono d'effort : la série est cochée à la fin, puis repos", async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('set-gainage-0'));
    expect(screen.getByText('0 / 3')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(45_300); });
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', exerciseId: 'gainage' });
  });

  it('poids tapé puis série cochée sans quitter le champ : la série prend le poids tapé', async () => {
    const ctx = await setup();
    await fireEvent.changeText(screen.getByTestId('weight-presse'), '105');
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    const workoutId = useTimerStore.getState().timer!.workoutId;
    expect(listEntries(ctx, workoutId)[0]).toMatchObject({ exerciseId: 'presse', weight: 105 });
  });

  it('échange persisté (vue relue)', async () => {
    await setup();
    await fireEvent.press(screen.getAllByLabelText("Changer d'exercice")[0]);
    await fireEvent.press(screen.getByText('Squat'));
    expect(screen.getByText('remplace Presse')).toBeTruthy();
  });

  it('jour non planifié → écran repos', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('day-2'));
    expect(screen.getByTestId('rest-day')).toBeTruthy();
  });

  it('passage de minuit app ouverte : nouveau jour affiché, séance de la veille à reprendre et complétée sur le même workout', async () => {
    jest.setSystemTime(new Date(2026, 9, 5, 23, 50, 0));
    await setup();
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    expect(screen.getByText('1 / 3')).toBeTruthy();

    // 00:05 le mardi — l'écran est resté monté
    await act(async () => { jest.advanceTimersByTime(15 * 60_000); });
    expect(screen.getByTestId('rest-day')).toBeTruthy();
    expect(screen.getByText(/non terminée/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Reprendre' }));
    await fireEvent.press(screen.getByTestId('set-presse-1'));
    expect(screen.getByText('2 / 3')).toBeTruthy();
    expect(screen.getByTestId('card-presse-complete')).toBeTruthy();
  });

  it('extensibilité : 7 jours en lbs, sans changement de code', async () => {
    await setup(sevenDayLbsInput());
    expect(screen.getAllByText('SÉANCE 1').length).toBeGreaterThan(0);
    expect(screen.getByText('0 / 4')).toBeTruthy();
    expect(screen.getAllByText('lbs').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('day-6'));
    expect(screen.getAllByText('SÉANCE 6').length).toBeGreaterThan(0);
  });
});
