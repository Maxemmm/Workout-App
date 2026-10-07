// Fait avancer le minuteur (≈ 4 fois/s) sans re-rendre l'écran ; recalcul au retour au premier plan
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';
import { driveTimer, newDriverMemo } from './driveTimer';

const TICK_MS = 250;

export function TimerDriver() {
  const ctx = useRepoCtx();
  const active = useTimerStore((s) => s.timer !== null);
  const memo = useRef(newDriverMemo());

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (driveTimer(ctx, Date.now(), memo.current)) usePrefs.getState().bumpData();
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') tick(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [active, ctx]);

  return null;
}
