// ============================================================
// Pilote des notifications de fin de minuteur (sans affichage, monté à la racine) :
// planifie à chaque démarrage / ajustement, annule à l'arrêt ; applique les actions.
// ============================================================
import { useEffect } from 'react';
import { useRepoCtx } from '@/db/DbContext';
import { getProgram } from '@/db/repos/programsRepo';
import { getWorkout } from '@/db/repos/workoutsRepo';
import type { RepoCtx } from '@/db/types';
import { restNotice } from '@/domain/restNotice';
import type { TimerState } from '@/domain/timer';
import { useDbQuery } from '@/features/common/useDbQuery';
import { cardWeight, loadTodayView } from '@/features/today/todayView';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { restNotifier } from '@/platform/restNotifier';
import type { NoticeAction, ScheduledNotice } from '@/platform/types';
import { useTimerStore } from '@/state/timerStore';
import { applyAction } from './applyAction';
import { formatNotice } from './formatNotice';
import { alertsEnabled } from './permissionFlow';

type T = (key: StringKey, ...args: (string | number)[]) => string;

/** Notification d'un minuteur : texte calculé depuis la séance (texte minimal si elle est introuvable) */
export function composeNotice(ctx: RepoCtx, timer: TimerState, t: T): ScheduledNotice {
  const target = { workoutId: timer.workoutId, exerciseId: timer.exerciseId, setIndex: timer.setIndex };
  const fallback = { endAt: timer.endAt, title: timer.mode === 'work' ? t('notif_work_title') : t('notif_rest_title'), body: '', kind: timer.mode, target };
  const workout = getWorkout(ctx, timer.workoutId);
  const program = workout ? getProgram(ctx, workout.programId) : null;
  if (!workout || !program) return fallback;
  const view = loadTodayView(ctx, program, workout.sessionKey, workout.date);
  const content = restNotice({
    mode: timer.mode, exerciseId: timer.exerciseId, setIndex: timer.setIndex,
    exercises: view.exercises, bonus: view.bonus, track: view.track, weightOf: (ex) => cardWeight(view, ex),
  });
  return { ...fallback, ...formatNotice(content, t, program.definition.meta.units) };
}

/** Génération de la dernière demande : une demande dépassée (lecture d'autorisation lente) n'écrit plus rien */
let generation = 0;

/** Planifie ou annule (erreurs ignorées : le minuteur au premier plan fonctionne toujours) */
async function sync(ctx: RepoCtx, timer: TimerState | null, enabled: boolean, t: T): Promise<void> {
  const gen = ++generation;
  try {
    const wanted = timer !== null && enabled && timer.endAt > Date.now() && (await restNotifier.permission()) === 'granted';
    if (gen !== generation) return;
    if (!wanted || !timer) {
      await restNotifier.cancel();
      return;
    }
    await restNotifier.schedule(composeNotice(ctx, timer, t));
  } catch {
    // ignoré
  }
}

export function RestNotificationDriver() {
  const ctx = useRepoCtx();
  const { t } = useI18n();
  const timer = useTimerStore((s) => s.timer);
  const enabled = useDbQuery(alertsEnabled);

  // Libellés des boutons dans la langue de l'app
  useEffect(() => {
    restNotifier.configure({ plus15: t('notif_action_plus15'), validate: t('notif_action_validate') }).catch(() => {});
  }, [t]);

  useEffect(() => {
    void sync(ctx, timer, enabled, t);
  }, [ctx, timer, enabled, t]);

  // Actions des notifications : en temps réel, et celle reçue pendant que l'app était fermée.
  // Après une action, on replanifie tout de suite (l'app peut être en arrière-plan : pas de rendu React).
  useEffect(() => {
    const handle = (a: NoticeAction) => {
      if (applyAction(ctx, a, Date.now())) void sync(ctx, useTimerStore.getState().timer, alertsEnabled(ctx), t);
    };
    const off = restNotifier.onAction(handle);
    restNotifier.lastAction().then((a) => { if (a) handle(a); }).catch(() => {});
    return off;
  }, [ctx, t]);

  return null;
}
