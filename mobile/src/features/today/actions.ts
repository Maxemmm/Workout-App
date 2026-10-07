// ============================================================
// Actions de l'écran Today — écritures en base + minuteur + haptique.
// L'appelant enchaîne avec bumpData() (et un toast en cas d'erreur).
// ============================================================
import { setOrder, setSwap } from '@/db/repos/layoutsRepo';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { setWeight } from '@/db/repos/weightsRepo';
import {
  clearExerciseSets, completeWorkout, ensureWorkout, reopenWorkout, resetWorkout, upsertSet,
} from '@/db/repos/workoutsRepo';
import { inTransaction } from '@/db/transaction';
import type { RepoCtx } from '@/db/types';
import { weightKey, type EffectiveExercise } from '@/domain/exerciseView';
import { restDurationSec } from '@/domain/progress';
import { moveId } from '@/domain/reorder';
import { localDateKey } from '@/domain/schedule';
import { isTimed, schemeReps, workSeconds } from '@/domain/scheme';
import { FLASH_MS, startTimer, type TimerState } from '@/domain/timer';
import { workoutExtensions } from '@/platform/extensions';
import { haptics } from '@/platform/haptics';
import { useTimerStore } from '@/state/timerStore';
import { cardWeight, type TodayView } from './todayView';

export type TodayEnv = {
  ctx: RepoCtx;
  nowMs: number;
  program: StoredProgram;
  sessionKey: string;
  /** Date de la séance affichée ; null = jour local de nowMs (séance du jour) */
  date: string | null;
};

const timerState = () => useTimerStore.getState();

function workoutKey(env: TodayEnv) {
  return { programId: env.program.id, sessionKey: env.sessionKey, date: env.date ?? localDateKey(new Date(env.nowMs)) };
}

function doneCount(view: TodayView, exerciseId: string): number {
  return (view.track[exerciseId] ?? []).filter(Boolean).length;
}

/** Coche une série (crée la séance si besoin) et lance le repos */
function checkSet(env: TodayEnv, view: TodayView, ex: EffectiveExercise, setIndex: number, values: { weight: number | null; reps: number | null }): void {
  const workout = ensureWorkout(env.ctx, workoutKey(env));
  upsertSet(env.ctx, workout.id, ex.id, setIndex, { done: true, ...values, performedName: ex.performedName });
  if (doneCount(view, ex.id) + 1 >= ex.sets) haptics.success();
  else haptics.light();
  const rest = restDurationSec(ex, env.program.definition.meta);
  if (rest > 0) {
    timerState().start(env.ctx, startTimer({ mode: 'rest', nowMs: env.nowMs, durationSec: rest, workoutId: workout.id, exerciseId: ex.id, setIndex }));
  } else {
    timerState().clear(env.ctx);
  }
}

export function pressSet(env: TodayEnv, view: TodayView, ex: EffectiveExercise, setIndex: number): void {
  if (view.workout?.status === 'completed') return;
  const timer = timerState().timer;
  const isThisSet = timer?.exerciseId === ex.id && timer.setIndex === setIndex;

  // Second tap sur une série chronométrée en attente : annulation (tap accidentel)
  if (timer?.mode === 'work' && isThisSet) {
    timerState().clear(env.ctx);
    return;
  }

  if (view.track[ex.id]?.[setIndex]) {
    if (!view.workout) return;
    upsertSet(env.ctx, view.workout.id, ex.id, setIndex, { done: false });
    if (isThisSet) timerState().clear(env.ctx);
    return;
  }

  const values = { weight: cardWeight(view, ex), reps: schemeReps(ex) };
  const work = isTimed(ex) ? workSeconds(ex) : 0;
  if (work > 0) {
    const workout = ensureWorkout(env.ctx, workoutKey(env));
    timerState().start(env.ctx, startTimer({
      mode: 'work', nowMs: env.nowMs, durationSec: work, workoutId: workout.id, exerciseId: ex.id, setIndex,
      pending: { ...values, performedName: ex.performedName, restSec: restDurationSec(ex, env.program.definition.meta) },
    }));
    haptics.light();
    return;
  }
  checkSet(env, view, ex, setIndex, values);
}

/** Feuille de saisie : corrige une série cochée, ou coche une série non cochée avec ces valeurs */
export function saveSetValues(env: TodayEnv, view: TodayView, ex: EffectiveExercise, setIndex: number, values: { weight: number | null; reps: number | null }): void {
  if (view.workout && view.track[ex.id]?.[setIndex]) {
    upsertSet(env.ctx, view.workout.id, ex.id, setIndex, values);
    return;
  }
  if (view.workout?.status === 'completed') return;
  checkSet(env, view, ex, setIndex, values);
}

/** Fin d'un chrono d'effort : coche la série ; enchaîne le repos si demandé */
export function completeWorkTimer(ctx: RepoCtx, timer: TimerState, nowMs: number, startRest: boolean): void {
  const pending = timer.pending;
  upsertSet(ctx, timer.workoutId, timer.exerciseId, timer.setIndex, {
    done: true, weight: pending?.weight ?? null, reps: pending?.reps ?? null, performedName: pending?.performedName ?? null,
  });
  const rest = pending?.restSec ?? 0;
  if (startRest && rest > 0) {
    timerState().start(ctx, startTimer({ mode: 'rest', nowMs, durationSec: rest, workoutId: timer.workoutId, exerciseId: timer.exerciseId, setIndex: timer.setIndex }));
  } else {
    timerState().finish(ctx, startRest ? nowMs + FLASH_MS : null);
  }
}

export function changeWeight(env: TodayEnv, ex: EffectiveExercise, weight: number | null): void {
  setWeight(env.ctx, weightKey(ex.id, ex.performedName), weight, env.program.definition.meta.units);
}

export function hasCheckedSets(view: TodayView, exerciseId: string): boolean {
  return (view.track[exerciseId] ?? []).some(Boolean);
}

/** Échange (name = null : retour à l'original). L'appelant confirme si des séries sont cochées. */
export function swapExercise(env: TodayEnv, view: TodayView, ex: EffectiveExercise, name: string | null): void {
  inTransaction(env.ctx, (tx) => {
    if (view.workout) clearExerciseSets(tx, view.workout.id, ex.id);
    setSwap(tx, env.program.id, env.sessionKey, ex.id, name);
  });
  if (timerState().timer?.exerciseId === ex.id) timerState().clear(env.ctx);
}

export function moveExercise(env: TodayEnv, view: TodayView, from: number, to: number): void {
  setOrder(env.ctx, env.program.id, env.sessionKey, moveId(view.exercises.map((e) => e.id), from, to));
}

export function finishToday(env: TodayEnv, view: TodayView): void {
  if (!view.workout) return;
  completeWorkout(env.ctx, view.workout.id);
  if (timerState().timer?.workoutId === view.workout.id) timerState().clear(env.ctx);
  haptics.success();
  workoutExtensions.completed(view.workout.id);
}

export function reopenToday(env: TodayEnv, view: TodayView): void {
  if (view.workout) reopenWorkout(env.ctx, view.workout.id);
}

export function resetToday(env: TodayEnv, view: TodayView): void {
  if (!view.workout) return;
  if (timerState().timer?.workoutId === view.workout.id) timerState().clear(env.ctx);
  resetWorkout(env.ctx, view.workout.id);
}

/** Bandeau « séance d'hier » : la clôturer telle quelle */
export function finishStale(ctx: RepoCtx, workoutId: string): void {
  completeWorkout(ctx, workoutId);
  if (timerState().timer?.workoutId === workoutId) timerState().clear(ctx);
  workoutExtensions.completed(workoutId);
}
