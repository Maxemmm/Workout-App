// ============================================================
// Pilote du minuteur — une itération : avertissement à 10 s, fin.
// Son et haptique seulement si la fin est observée en direct.
// ============================================================
import type { RepoCtx } from '@/db/types';
import { FLASH_MS, shouldAlert, timerPhase } from '@/domain/timer';
import { haptics } from '@/platform/haptics';
import { sound } from '@/platform/sound';
import { useTimerStore } from '@/state/timerStore';
import { completeWorkTimer } from './actions';

export type DriverMemo = { warnedEndAt: number | null; handledEndAt: number | null };

export function newDriverMemo(): DriverMemo {
  return { warnedEndAt: null, handledEndAt: null };
}

/** Retourne true si des données ont été écrites (l'appelant fait bumpData) */
export function driveTimer(ctx: RepoCtx, nowMs: number, memo: DriverMemo): boolean {
  const store = useTimerStore.getState();
  const timer = store.timer;
  if (!timer) return false;
  const phase = timerPhase(timer, nowMs);

  if (phase === 'critical' && memo.warnedEndAt !== timer.endAt) {
    memo.warnedEndAt = timer.endAt;
    haptics.warning();
  }
  if (phase !== 'done' || memo.handledEndAt === timer.endAt) return false;
  memo.handledEndAt = timer.endAt;

  const alert = shouldAlert(timer, nowMs);
  if (alert) {
    haptics.success();
    sound.playRestDone();
  }
  if (timer.mode === 'work') {
    completeWorkTimer(ctx, timer, nowMs, alert);
    return true;
  }
  store.finish(ctx, alert ? nowMs + FLASH_MS : null);
  return false;
}
