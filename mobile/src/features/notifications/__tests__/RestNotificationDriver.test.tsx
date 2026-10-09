import { act } from '@testing-library/react-native';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { setSetting } from '@/db/repos/settingsRepo';
import { ensureWorkout, upsertSet } from '@/db/repos/workoutsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { startTimer } from '@/domain/timer';
import { restNotifier } from '@/platform/restNotifier';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { RestNotificationDriver } from '../RestNotificationDriver';

const NOW = new Date(2026, 9, 5, 10).getTime();

async function setup(opts: { alerts?: boolean } = { alerts: true }) {
  const ctx = createTestCtx();
  const p = createProgram(ctx, makeProgramInput({ '1': 'fb' }, {
    fb: makeSession('FB', [makeExercise('presse', 3, { name: 'Presse' }), makeExercise('gainage', 2, { name: 'Gainage' })]),
  }), 'manual');
  setActiveProgram(ctx, p.id);
  if (opts.alerts !== undefined) setSetting(ctx, 'restAlerts', opts.alerts);
  const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 'fb', date: '2026-10-05' });
  upsertSet(ctx, w.id, 'presse', 0, { done: true });
  await renderWithProviders(<RestNotificationDriver />, { ctx });
  const rest = (setIndex = 0, durationSec = 90) => startTimer({ mode: 'rest', nowMs: NOW, durationSec, workoutId: w.id, exerciseId: 'presse', setIndex });
  return { ctx, w, rest };
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('RestNotificationDriver — planification', () => {
  // Horloge figée : un minuteur dont la fin est passée n'est jamais planifié
  afterEach(() => jest.useRealTimers());
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useTimerStore.setState(TIMER_INITIAL); });
  });

  it('repos démarré → notification planifiée à l\'heure de fin avec la série suivante', async () => {
    const { ctx, rest, w } = await setup();
    await act(async () => { useTimerStore.getState().start(ctx, rest()); });
    await flush();
    expect(restNotifier.schedule).toHaveBeenLastCalledWith({
      endAt: NOW + 90_000, title: 'Repos terminé', body: 'Presse · série 2/3', kind: 'rest',
      target: { workoutId: w.id, exerciseId: 'presse', setIndex: 0 },
    });
  });

  it('Review Focus 3 : ajusté plusieurs fois → dernière heure de fin', async () => {
    const { ctx, rest } = await setup();
    await act(async () => {
      useTimerStore.getState().start(ctx, rest());
      useTimerStore.getState().adjust(ctx, 15, NOW);
      useTimerStore.getState().adjust(ctx, 15, NOW);
    });
    await flush();
    expect(jest.mocked(restNotifier.schedule).mock.calls.at(-1)?.[0].endAt).toBe(NOW + 120_000);
  });

  it('minuteur arrêté → notification annulée', async () => {
    const { ctx, rest } = await setup();
    await act(async () => { useTimerStore.getState().start(ctx, rest()); });
    await flush();
    await act(async () => { useTimerStore.getState().clear(ctx); });
    await flush();
    expect(restNotifier.cancel).toHaveBeenCalled();
  });

  it('réglage désactivé → rien de planifié', async () => {
    const { ctx, rest } = await setup({ alerts: false });
    await act(async () => { useTimerStore.getState().start(ctx, rest()); });
    await flush();
    expect(restNotifier.schedule).not.toHaveBeenCalled();
  });

  it('Review Focus 4 : autorisation retirée dans iOS → rien de planifié', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('denied');
    const { ctx, rest } = await setup();
    await act(async () => { useTimerStore.getState().start(ctx, rest()); });
    await flush();
    expect(restNotifier.schedule).not.toHaveBeenCalled();
    jest.mocked(restNotifier.permission).mockResolvedValue('granted');
  });

  it('Review Focus 2 : réglage désactivé alors qu\'une notification attend → annulée', async () => {
    const { ctx, rest } = await setup();
    await act(async () => { useTimerStore.getState().start(ctx, rest()); });
    await flush();
    jest.mocked(restNotifier.cancel).mockClear();
    await act(async () => { setSetting(ctx, 'restAlerts', false); usePrefs.getState().bumpData(); });
    await flush();
    expect(restNotifier.cancel).toHaveBeenCalled();
  });

  it('course : repos passé pendant la lecture de l\'autorisation → aucune notification planifiée', async () => {
    const { ctx, rest } = await setup();
    let release: (p: 'granted') => void = () => {};
    jest.mocked(restNotifier.permission).mockImplementationOnce(() => new Promise((r) => { release = r; }));
    await act(async () => { useTimerStore.getState().start(ctx, rest()); });
    await act(async () => { useTimerStore.getState().clear(ctx); });
    await flush();
    await act(async () => { release('granted'); });
    await flush();
    expect(restNotifier.schedule).not.toHaveBeenCalled();
  });

  it('libellés des boutons configurés dans la langue de l\'app', async () => {
    await setup();
    await flush();
    expect(restNotifier.configure).toHaveBeenCalledWith({ plus15: '+15 s', validate: 'Valider la série' });
  });
});

describe('RestNotificationDriver — actions', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useTimerStore.setState(TIMER_INITIAL); });
  });

  it('écoute les réponses et lit la dernière réponse au lancement', async () => {
    const { w } = await setup();
    expect(restNotifier.onAction).toHaveBeenCalled();
    expect(restNotifier.lastAction).toHaveBeenCalled();
    const cb = jest.mocked(restNotifier.onAction).mock.calls[0][0];
    await act(async () => { cb({ id: 'x', action: 'plus15', kind: 'rest', target: { workoutId: w.id, exerciseId: 'presse', setIndex: 0 }, deliveredAt: Date.now() }); });
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', exerciseId: 'presse' });
  });
});
