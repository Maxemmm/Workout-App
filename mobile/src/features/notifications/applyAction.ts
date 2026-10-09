// Actions des notifications de minuteur : « +15 s » (fin de repos), « Valider la série » (fin de série chronométrée).
// Chaque réponse n'est appliquée qu'une fois (temps réel et « dernière réponse » au lancement peuvent se recouper).
import type { RepoCtx } from '@/db/types';
import { startTimer } from '@/domain/timer';
import { completeWorkTimer } from '@/features/today/actions';
import type { NoticeAction } from '@/platform/types';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';

const EXTRA_REST_SEC = 15;
/** Au-delà, l'action est périmée (notification touchée longtemps après, ou traitée à la réouverture) */
export const ACTION_MAX_AGE_MS = 60_000;
const applied = new Set<string>();

export function resetAppliedActions(): void {
  applied.clear();
}

export function applyAction(ctx: RepoCtx, a: NoticeAction, nowMs: number): boolean {
  if (a.action === 'open' || applied.has(a.id) || nowMs - a.deliveredAt > ACTION_MAX_AGE_MS) return false;
  const timer = useTimerStore.getState().timer;
  const same = timer !== null && timer.workoutId === a.target.workoutId && timer.exerciseId === a.target.exerciseId && timer.setIndex === a.target.setIndex;

  if (a.action === 'plus15') {
    // Le repos est fini (plus de minuteur) ou c'est toujours le même
    if (timer !== null && !same) return false;
    applied.add(a.id);
    useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs, durationSec: EXTRA_REST_SEC, ...a.target }));
    usePrefs.getState().bumpData();
    return true;
  }
  // validate : seulement si la série chronométrée visée est toujours en cours
  if (!timer || !same || timer.mode !== 'work') return false;
  applied.add(a.id);
  completeWorkTimer(ctx, timer, nowMs, true);
  usePrefs.getState().bumpData();
  return true;
}
