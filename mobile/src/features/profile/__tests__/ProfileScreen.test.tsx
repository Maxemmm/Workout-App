import { act, fireEvent, screen } from '@testing-library/react-native';
import { isNull } from 'drizzle-orm';
import example from '@/data/program.example.json';
import { createProgram, listPrograms, setActiveProgram } from '@/db/repos/programsRepo';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { ensureWorkout, upsertSet } from '@/db/repos/workoutsRepo';
import { workouts } from '@/db/schema';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { localDateKey } from '@/domain/schedule';
import { needsOnboarding } from '@/features/onboarding/needsOnboarding';
import { confirm } from '@/platform/confirm';
import { shareJsonFile } from '@/platform/shareJsonFile';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { TOAST_INITIAL, useToastStore } from '@/state/toastStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ProfileScreen } from '../ProfileScreen';

async function setup(opts: { program?: boolean } = { program: true }) {
  const ctx = createTestCtx();
  if (opts.program) {
    const p = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, p.id);
    const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 'full-body', date: '2026-10-06' });
    upsertSet(ctx, w.id, 'presse-cuisses', 0, { done: true });
  }
  setSetting(ctx, 'onboarded', true);
  const props = { onManagePrograms: jest.fn(), onOpenEditor: jest.fn(), onImport: jest.fn() };
  await renderWithProviders(<ProfileScreen {...props} />, { ctx });
  return { ctx, props };
}
const liveWorkouts = (ctx: ReturnType<typeof createTestCtx>) => ctx.db.select().from(workouts).where(isNull(workouts.deletedAt)).all();

describe('ProfileScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => {
      usePrefs.setState(PREFS_INITIAL);
      useDraftStore.setState(DRAFT_INITIAL);
      useTimerStore.setState(TIMER_INITIAL);
      useToastStore.setState(TOAST_INITIAL);
    });
  });

  it('exporter : partage du fichier du jour, date mémorisée, rappel mis à jour', async () => {
    const { ctx } = await setup();
    expect(screen.getByText('Jamais sauvegardé')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Exporter mes données' }));
    const [name, text] = jest.mocked(shareJsonFile).mock.calls[0];
    expect(name).toBe(`workout-backup-${localDateKey(new Date())}.json`);
    expect(JSON.parse(text)).toMatchObject({ _format: 'workout-native', _version: 1 });
    expect(JSON.parse(text).workouts).toHaveLength(1);
    expect(getSetting(ctx, 'lastExportAt')).toEqual(expect.any(String));
    expect(screen.getByText("Dernière sauvegarde : aujourd'hui")).toBeTruthy();
    expect(useToastStore.getState().message).toBe('Sauvegarde exportée ✓');
  });

  it('export annulé → rien enregistré ; export en erreur → toast, rien enregistré', async () => {
    const { ctx } = await setup();
    jest.mocked(shareJsonFile).mockResolvedValueOnce('cancelled');
    await fireEvent.press(screen.getByRole('button', { name: 'Exporter mes données' }));
    expect(getSetting(ctx, 'lastExportAt')).toBeUndefined();
    jest.mocked(shareJsonFile).mockRejectedValueOnce(new Error('sharing_unavailable'));
    await fireEvent.press(screen.getByRole('button', { name: 'Exporter mes données' }));
    expect(getSetting(ctx, 'lastExportAt')).toBeUndefined();
    expect(useToastStore.getState().message).toBe('Export impossible');
  });

  it('Review Focus 1 : double tap sur Exporter → un seul partage', async () => {
    await setup();
    let release: (v: 'shared') => void = () => {};
    jest.mocked(shareJsonFile).mockImplementationOnce(() => new Promise((r) => { release = r; }));
    const btn = screen.getByRole('button', { name: 'Exporter mes données' });
    await fireEvent.press(btn);
    await fireEvent.press(btn);
    await act(async () => { release('shared'); });
    expect(shareJsonFile).toHaveBeenCalledTimes(1);
  });

  it('rappel en alerte après 15 jours', async () => {
    const ctx = createTestCtx();
    const old = new Date();
    old.setDate(old.getDate() - 15);
    setSetting(ctx, 'lastExportAt', old.toISOString());
    await renderWithProviders(<ProfileScreen onManagePrograms={jest.fn()} onOpenEditor={jest.fn()} onImport={jest.fn()} />, { ctx });
    expect(screen.getByText('Dernière sauvegarde : il y a 15 jours')).toBeTruthy();
  });

  it('supprimer l\'historique : confirmation refusée → rien ; acceptée → séances effacées, programme gardé', async () => {
    const { ctx } = await setup();
    jest.mocked(confirm).mockResolvedValueOnce(false);
    await fireEvent.press(screen.getByRole('button', { name: "Supprimer l'historique" }));
    expect(liveWorkouts(ctx)).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: "Supprimer l'historique" }));
    expect(liveWorkouts(ctx)).toHaveLength(0);
    expect(listPrograms(ctx)).toHaveLength(1);
    expect(useToastStore.getState().message).toBe('Historique supprimé');
  });

  it('Review Focus 4 : supprimer l\'historique arrête le minuteur en cours', async () => {
    await setup();
    await act(async () => {
      useTimerStore.setState({ ...TIMER_INITIAL, timer: { mode: 'rest', startedAt: 0, endAt: Date.now() + 60_000, workoutId: 'w', exerciseId: 'x', setIndex: 0, pending: null } });
    });
    await fireEvent.press(screen.getByRole('button', { name: "Supprimer l'historique" }));
    expect(useTimerStore.getState().timer).toBeNull();
  });

  it('réinitialiser : tout est vidé, langue gardée, onboarding requis', async () => {
    const { ctx } = await setup();
    setSetting(ctx, 'lang', 'fr');
    await fireEvent.press(screen.getByRole('button', { name: "Réinitialiser l'application" }));
    expect(listPrograms(ctx)).toEqual([]);
    expect(getSetting(ctx, 'lang')).toBe('fr');
    expect(needsOnboarding(ctx)).toBe(true);
  });

  it('carte programme : Gérer → onManagePrograms ; Importer → onImport ; version affichée', async () => {
    const { props } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Gérer mes programmes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Importer' }));
    expect(props.onManagePrograms).toHaveBeenCalled();
    expect(props.onImport).toHaveBeenCalled();
    expect(screen.getByText('Version 1.0.0')).toBeTruthy();
  });

  it('sans programme : Créer prépare un brouillon dans l\'unité par défaut puis ouvre l\'éditeur', async () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'defaultUnits', 'lbs');
    const onOpenEditor = jest.fn();
    await renderWithProviders(<ProfileScreen onManagePrograms={jest.fn()} onOpenEditor={onOpenEditor} onImport={jest.fn()} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER MON PROGRAMME' }));
    expect(useDraftStore.getState().draft?.program.meta.units).toBe('lbs');
    expect(onOpenEditor).toHaveBeenCalled();
  });
});
