// Le vrai adaptateur (mocké ailleurs) : identifiant fixe, déclencheur à date, catégories, réponses
jest.unmock('@/platform/restNotifier');

const listeners: ((r: unknown) => void)[] = [];
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('rest-end')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  dismissNotificationAsync: jest.fn(() => Promise.resolve()),
  addNotificationResponseReceivedListener: jest.fn((cb: (r: unknown) => void) => { listeners.push(cb); return { remove: jest.fn() }; }),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));

import * as Notifications from 'expo-notifications';
import { REST_NOTICE_ID, restNotifier } from '../restNotifier';

// Gestionnaire installé à l'import du module : capturé avant les clearAllMocks des tests
const handler = jest.mocked(Notifications.setNotificationHandler).mock.calls[0]?.[0];

const target = { workoutId: 'w', exerciseId: 'presse', setIndex: 1 };
const response = (actionIdentifier: string, kind = 'rest') => ({
  actionIdentifier,
  notification: { request: { identifier: REST_NOTICE_ID, content: { data: { kind, ...target } } }, date: 1234 },
});

describe('restNotifier (natif)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pas de bannière ni de son quand l\'app est au premier plan', async () => {
    expect(handler).toBeDefined();
    await expect(handler!.handleNotification({} as never)).resolves.toMatchObject({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false });
  });

  it('planifie avec l\'identifiant fixe, à la date de fin, avec la catégorie du type', async () => {
    await restNotifier.schedule({ endAt: 1_800_000_000_000, title: 'Repos terminé', body: 'Presse', kind: 'rest', target });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: REST_NOTICE_ID,
      content: { title: 'Repos terminé', body: 'Presse', sound: true, categoryIdentifier: 'rest', data: { kind: 'rest', ...target } },
      trigger: { type: 'date', date: new Date(1_800_000_000_000) },
    });
  });

  it('annule par l\'identifiant fixe', async () => {
    await restNotifier.cancel();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REST_NOTICE_ID);
    // La notification déjà affichée est retirée : plus actionnable après coup
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(REST_NOTICE_ID);
  });

  it('état de l\'autorisation', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ status: 'denied' } as never);
    await expect(restNotifier.permission()).resolves.toBe('denied');
  });

  it('libellés des boutons : catégories rest (+15 s) et work (Valider la série)', async () => {
    await restNotifier.configure({ plus15: '+15 s', validate: 'Valider la série' });
    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith('rest', [{ identifier: 'plus15', buttonTitle: '+15 s', options: { opensAppToForeground: false } }]);
    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith('work', [{ identifier: 'validate', buttonTitle: 'Valider la série', options: { opensAppToForeground: false } }]);
  });

  it('réponses : bouton → action ; toucher la notification → open ; id unique', async () => {
    const got: unknown[] = [];
    const off = restNotifier.onAction((a) => got.push(a));
    listeners.forEach((l) => l(response('plus15')));
    listeners.forEach((l) => l(response('expo.modules.notifications.actions.DEFAULT', 'work')));
    expect(got).toEqual([
      { id: 'rest-end:1234:plus15', action: 'plus15', kind: 'rest', target, deliveredAt: 1_234_000 },
      { id: 'rest-end:1234:expo.modules.notifications.actions.DEFAULT', action: 'open', kind: 'work', target, deliveredAt: 1_234_000 },
    ]);
    off();
  });

  it('dernière réponse au lancement', async () => {
    jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValueOnce(response('validate', 'work') as never);
    await expect(restNotifier.lastAction()).resolves.toMatchObject({ action: 'validate', kind: 'work', target });
  });
});
