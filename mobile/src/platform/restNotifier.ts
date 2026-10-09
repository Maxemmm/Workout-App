// ============================================================
// Notification locale de fin de minuteur (expo-notifications).
// Une seule planifiée à la fois (identifiant fixe) ; pas de bannière app ouverte ;
// boutons « +15 s » (repos) et « Valider la série » (série chronométrée).
// ============================================================
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import type { NoticeAction, NoticeKind, NoticeTarget, NotifierPermission, ScheduledNotice } from './types';

export const REST_NOTICE_ID = 'rest-end';

// App au premier plan : le son et l'haptique de l'app suffisent
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

function toAction(r: Notifications.NotificationResponse | null): NoticeAction | null {
  if (!r) return null;
  const data = (r.notification.request.content.data ?? {}) as Partial<NoticeTarget> & { kind?: NoticeKind };
  if (typeof data.workoutId !== 'string' || typeof data.exerciseId !== 'string' || typeof data.setIndex !== 'number') return null;
  const kind: NoticeKind = data.kind === 'work' ? 'work' : 'rest';
  const action = r.actionIdentifier === 'plus15' ? 'plus15' : r.actionIdentifier === 'validate' ? 'validate' : 'open';
  return {
    id: `${r.notification.request.identifier}:${r.notification.date}:${r.actionIdentifier}`,
    action,
    kind,
    target: { workoutId: data.workoutId, exerciseId: data.exerciseId, setIndex: data.setIndex },
    // iOS fournit la date de livraison en secondes
    deliveredAt: r.notification.date * 1000,
  };
}

export const restNotifier = {
  async permission(): Promise<NotifierPermission> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  },
  async requestPermission(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },
  async schedule(n: ScheduledNotice): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      identifier: REST_NOTICE_ID,
      content: { title: n.title, body: n.body, sound: true, categoryIdentifier: n.kind, data: { kind: n.kind, ...n.target } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(n.endAt) },
    });
  },
  async cancel(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(REST_NOTICE_ID);
    // Notification déjà affichée retirée : un vieux « Repos terminé » ne reste pas actionnable
    await Notifications.dismissNotificationAsync(REST_NOTICE_ID);
  },
  /** Libellés des boutons dans la langue de l'app */
  async configure(labels: { plus15: string; validate: string }): Promise<void> {
    await Notifications.setNotificationCategoryAsync('rest', [{ identifier: 'plus15', buttonTitle: labels.plus15, options: { opensAppToForeground: false } }]);
    await Notifications.setNotificationCategoryAsync('work', [{ identifier: 'validate', buttonTitle: labels.validate, options: { opensAppToForeground: false } }]);
  },
  onAction(cb: (a: NoticeAction) => void): () => void {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const a = toAction(r);
      if (a) cb(a);
    });
    return () => sub.remove();
  },
  /** Réponse reçue pendant que l'app était fermée (appliquée au lancement) */
  async lastAction(): Promise<NoticeAction | null> {
    return toAction(await Notifications.getLastNotificationResponseAsync());
  },
  async openSettings(): Promise<void> {
    await Linking.openSettings();
  },
};
