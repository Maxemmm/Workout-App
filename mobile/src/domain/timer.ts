// ============================================================
// Minuteur unique — repos (rest) ou effort d'une série chronométrée (work).
// Défini par une heure de fin : le JS est suspendu en arrière-plan.
// ============================================================
import { isRestCritical, remainingSec } from './progress';

export type TimerMode = 'rest' | 'work';

/** Série à cocher à la fin d'un chrono d'effort, et repos à enchaîner */
export type PendingSet = { weight: number | null; reps: number | null; performedName: string | null; restSec: number };

export type TimerState = {
  mode: TimerMode;
  startedAt: number;
  endAt: number;
  workoutId: string;
  exerciseId: string;
  setIndex: number;
  pending: PendingSet | null;
};

export type TimerPhase = 'running' | 'critical' | 'done';

/** Au-delà de ce délai après la fin, on considère que l'app était en arrière-plan : pas de son */
export const ALERT_GRACE_MS = 1500;
export const ADJUST_STEP_SEC = 15;
/** Durée du flash « terminé » sur la barre */
export const FLASH_MS = 1500;

export function startTimer(p: {
  mode: TimerMode; nowMs: number; durationSec: number;
  workoutId: string; exerciseId: string; setIndex: number; pending?: PendingSet | null;
}): TimerState {
  return {
    mode: p.mode, startedAt: p.nowMs, endAt: p.nowMs + p.durationSec * 1000,
    workoutId: p.workoutId, exerciseId: p.exerciseId, setIndex: p.setIndex, pending: p.pending ?? null,
  };
}

export function adjustTimer(s: TimerState, deltaSec: number, nowMs: number): TimerState {
  return { ...s, endAt: Math.max(nowMs, s.endAt + deltaSec * 1000) };
}

export function timerPhase(s: TimerState, nowMs: number): TimerPhase {
  const remaining = remainingSec(s.endAt, nowMs);
  if (remaining === 0) return 'done';
  return isRestCritical(remaining) ? 'critical' : 'running';
}

export function timerProgress(s: TimerState, nowMs: number): number {
  const total = s.endAt - s.startedAt;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - s.startedAt) / total));
}

export function shouldAlert(s: TimerState, nowMs: number): boolean {
  return nowMs - s.endAt <= ALERT_GRACE_MS;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function isTimerState(v: unknown): v is TimerState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (s.mode === 'rest' || s.mode === 'work')
    && num(s.startedAt) && num(s.endAt) && num(s.setIndex)
    && str(s.workoutId) && str(s.exerciseId)
    && (s.pending === null || (typeof s.pending === 'object' && s.pending !== null && num((s.pending as Record<string, unknown>).restSec)));
}

/** Relecture au démarrage : repos expiré purgé ; effort expiré gardé (sa série sera cochée en silence) */
export function reviveOnStartup(v: unknown, nowMs: number): TimerState | null {
  if (!isTimerState(v)) return null;
  if (v.mode === 'rest' && v.endAt <= nowMs) return null;
  return v;
}
