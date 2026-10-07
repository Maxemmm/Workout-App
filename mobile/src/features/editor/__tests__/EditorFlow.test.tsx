import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import example from '@/data/program.example.json';
import { createProgram, getActiveProgram, getProgram, listPrograms, setActiveProgram } from '@/db/repos/programsRepo';
import { setWeight } from '@/db/repos/weightsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import type { RepoCtx } from '@/db/types';
import { confirm } from '@/platform/confirm';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TodayScreen } from '@/features/today/TodayScreen';
import { cardWeight, loadTodayView } from '@/features/today/todayView';
import { MetaStep } from '../MetaStep';
import type { EditorNav, EditorStep } from '../nav';
import { prepareEditor } from '../openEditor';
import { ScheduleStep } from '../ScheduleStep';
import { SessionsStep } from '../SessionsStep';
import { SessionStep } from '../SessionStep';

/** Pile de l'éditeur simulée : même enchaînement que les routes Expo Router */
function EditorHarness({ initial, onFinish }: { initial: EditorStep; onFinish(): void }) {
  const [route, setRoute] = useState<{ step: EditorStep } | { session: string }>({ step: initial });
  const [nav] = useState<EditorNav>(() => ({
    goToStep: (step) => setRoute({ step }),
    openSession: (key) => setRoute({ session: key }),
    closeSession: () => setRoute({ step: 2 }),
    finish: onFinish,
  }));
  if ('session' in route) return <SessionStep nav={nav} sessionKey={route.session} />;
  if (route.step === 1) return <MetaStep nav={nav} />;
  if (route.step === 2) return <SessionsStep nav={nav} />;
  return <ScheduleStep nav={nav} />;
}

async function openEditor(ctx: RepoCtx, target: Parameters<typeof prepareEditor>[1], initial: EditorStep = 1) {
  await act(async () => { await prepareEditor(ctx, target, async () => true); });
  const onFinish = jest.fn();
  await renderWithProviders(<EditorHarness initial={initial} onFinish={onFinish} />, { ctx });
  return onFinish;
}

async function addSessionWithExercise(name: string, exercise: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'CRÉER UNE SÉANCE' }));
  await fireEvent.changeText(screen.getByTestId('sess-name'), name);
  await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UN EXERCICE' }));
  await fireEvent.changeText(screen.getByTestId('exo-name'), exercise);
  await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
  await fireEvent.press(screen.getByRole('button', { name: 'TERMINER LA SÉANCE' }));
}

async function planDay(weekday: number, sessionName: string) {
  await fireEvent.press(screen.getByTestId(`day-row-${weekday}`));
  await fireEvent.press(screen.getByRole('button', { name: sessionName }));
}

describe('Éditeur — parcours complets', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useDraftStore.setState(DRAFT_INITIAL); });
  });

  it("créer un programme de 2 séances, planifier, enregistrer → actif ; Today l'affiche le lundi", async () => {
    const ctx = createTestCtx();
    const onFinish = await openEditor(ctx, { kind: 'new' });
    await fireEvent.changeText(screen.getByTestId('meta-label'), 'MON PLAN');
    await fireEvent.press(screen.getByRole('button', { name: 'SUIVANT' }));
    await addSessionWithExercise('HAUT', 'Développé couché');
    await addSessionWithExercise('BAS', 'Squat');
    await fireEvent.press(screen.getByRole('button', { name: 'CONFIGURER LE PLANNING' }));
    await planDay(1, 'HAUT');
    await planDay(4, 'BAS');
    await fireEvent.press(screen.getByRole('button', { name: 'ENREGISTRER LE PROGRAMME' }));
    expect(onFinish).toHaveBeenCalled();

    const active = getActiveProgram(ctx)!;
    expect(active.definition.meta.label).toBe('MON PLAN');
    expect(Object.values(active.definition.sessions).map((s) => s.name)).toEqual(['HAUT', 'BAS']);

    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 5, 10));
    await renderWithProviders(<TodayScreen />, { ctx });
    expect(screen.getAllByText('HAUT').length).toBeGreaterThan(0);
    expect(screen.getByText('Développé couché')).toBeTruthy();
    jest.useRealTimers();
  });

  it('Review Focus 5 : renommer un exercice garde son id et son poids mémorisé', async () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, p.id);
    setWeight(ctx, 'presse-cuisses', 140, 'kg');
    await openEditor(ctx, { kind: 'edit', programId: p.id }, 2);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Modifier la séance' })[0]);
    await fireEvent.press(screen.getByRole('button', { name: "Modifier l'exercice Presse à cuisses" }));
    await fireEvent.changeText(screen.getByTestId('exo-name'), 'Presse inclinée');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    const saved = getProgram(ctx, p.id)!;
    const sessionKey = Object.keys(saved.definition.sessions)[0];
    const ex = saved.definition.sessions[sessionKey].exercises.find((e) => e.id === 'presse-cuisses');
    expect(ex?.name).toBe('Presse inclinée');
    const view = loadTodayView(ctx, saved, sessionKey, '2026-10-05');
    expect(cardWeight(view, view.exercises.find((e) => e.id === 'presse-cuisses')!)).toBe(140);
  });

  it("erreur de validation depuis l'étape 3 → la feuille d'erreurs ramène à l'étape 1", async () => {
    const ctx = createTestCtx();
    await openEditor(ctx, { kind: 'new' }, 3);
    await fireEvent.press(screen.getByRole('button', { name: 'ENREGISTRER LE PROGRAMME' }));
    await fireEvent.press(screen.getByText('Le nom du programme est requis.'));
    expect(screen.getByTestId('meta-label')).toBeTruthy();
    expect(listPrograms(ctx)).toEqual([]);
  });

  it('Annuler (confirmé) : base inchangée, brouillon effacé', async () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    const onFinish = await openEditor(ctx, { kind: 'edit', programId: p.id });
    await fireEvent.changeText(screen.getByTestId('meta-label'), 'NE PAS GARDER');
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    expect(confirm).toHaveBeenCalled();
    expect(getProgram(ctx, p.id)?.definition.meta.label).toBe('PROGRAMME SALLE');
    expect(useDraftStore.getState().draft).toBeNull();
    expect(onFinish).toHaveBeenCalled();
  });

  it('reprise du brouillon après relecture du store (app relancée)', async () => {
    const ctx = createTestCtx();
    await openEditor(ctx, { kind: 'new' });
    await fireEvent.changeText(screen.getByTestId('meta-label'), 'EN COURS');
    await act(async () => { useDraftStore.setState(DRAFT_INITIAL); useDraftStore.getState().hydrate(ctx); });
    expect(useDraftStore.getState().draft?.program.meta.label).toBe('EN COURS');
  });

  it("extensibilité : 7 jours en lbs créés via l'éditeur, affichés par Today sans changement de code", async () => {
    const ctx = createTestCtx();
    await openEditor(ctx, { kind: 'new' });
    await fireEvent.changeText(screen.getByTestId('meta-label'), 'SEPT JOURS');
    await fireEvent.press(screen.getByRole('button', { name: 'LBS' }));
    await fireEvent.press(screen.getByRole('button', { name: 'SUIVANT' }));
    for (let d = 0; d < 7; d++) await addSessionWithExercise(`JOUR ${d}`, `Exo ${d}`);
    await fireEvent.press(screen.getByRole('button', { name: 'CONFIGURER LE PLANNING' }));
    for (let d = 0; d < 7; d++) await planDay(d, `JOUR ${d}`);
    await fireEvent.press(screen.getByRole('button', { name: 'ENREGISTRER LE PROGRAMME' }));

    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 10, 10)); // samedi
    await renderWithProviders(<TodayScreen />, { ctx });
    expect(screen.getAllByText('JOUR 6').length).toBeGreaterThan(0);
    expect(screen.getAllByText('lbs').length).toBeGreaterThan(0);
    jest.useRealTimers();
  });
});
