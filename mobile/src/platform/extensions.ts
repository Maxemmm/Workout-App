// ============================================================
// Points d'extension des jalons suivants — vides en M2.
// M6 : notification de fin de repos ; M7 : Live Activity ; M8 : Santé.
// ============================================================
import type { TimerState } from '@/domain/timer';

export const timerExtensions = {
  started(_timer: TimerState): void {},
  stopped(): void {},
};

export const workoutExtensions = {
  completed(_workoutId: string): void {},
};
