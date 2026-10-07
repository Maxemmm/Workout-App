// ============================================================
// Minuteur unique (Zustand) — recopié dans settings.activeRest
// pour survivre à l'arrêt de l'app (spec §5.1).
// ============================================================
import { create } from 'zustand';
import { deleteSetting, getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { adjustTimer, reviveOnStartup, type TimerState } from '@/domain/timer';
import { timerExtensions } from '@/platform/extensions';

interface TimerData {
  timer: TimerState | null;
  /** Flash « terminé » affiché par la barre jusqu'à `until` */
  flash: { exerciseId: string; until: number } | null;
}

interface TimerActions {
  hydrate(ctx: RepoCtx, nowMs: number): void;
  start(ctx: RepoCtx, timer: TimerState): void;
  adjust(ctx: RepoCtx, deltaSec: number, nowMs: number): void;
  finish(ctx: RepoCtx, flashUntil: number | null): void;
  clear(ctx: RepoCtx): void;
}

export const TIMER_INITIAL: TimerData = { timer: null, flash: null };

export const useTimerStore = create<TimerData & TimerActions>((set, get) => ({
  ...TIMER_INITIAL,
  hydrate: (ctx, nowMs) => {
    const timer = reviveOnStartup(getSetting(ctx, 'activeRest'), nowMs);
    if (!timer) deleteSetting(ctx, 'activeRest');
    set({ timer, flash: null });
  },
  start: (ctx, timer) => {
    setSetting(ctx, 'activeRest', timer);
    set({ timer, flash: null });
    timerExtensions.started(timer);
  },
  adjust: (ctx, deltaSec, nowMs) => {
    const current = get().timer;
    if (!current) return;
    const timer = adjustTimer(current, deltaSec, nowMs);
    setSetting(ctx, 'activeRest', timer);
    set({ timer });
    timerExtensions.started(timer);
  },
  finish: (ctx, flashUntil) => {
    const current = get().timer;
    deleteSetting(ctx, 'activeRest');
    set({ timer: null, flash: current && flashUntil !== null ? { exerciseId: current.exerciseId, until: flashUntil } : null });
    timerExtensions.stopped();
  },
  clear: (ctx) => {
    deleteSetting(ctx, 'activeRest');
    set({ timer: null, flash: null });
    timerExtensions.stopped();
  },
}));
