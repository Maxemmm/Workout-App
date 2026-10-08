// Jour local courant (AAAA-MM-JJ) qui suit minuit app ouverte et le retour au premier plan :
// les onglets restent montés, un simple `new Date()` au rendu resterait figé sur la veille.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDateKey } from '@/domain/schedule';

/** Délai jusqu'au prochain minuit local (+1 s de marge) */
export function msUntilNextDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next.getTime() - now.getTime();
}

export function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() => localDateKey(new Date()));
  useEffect(() => {
    const refresh = () => {
      const key = localDateKey(new Date());
      if (key !== todayKey) setTodayKey(key);
    };
    const id = setTimeout(refresh, msUntilNextDay(new Date()));
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { clearTimeout(id); sub.remove(); };
  }, [todayKey]);
  return todayKey;
}
