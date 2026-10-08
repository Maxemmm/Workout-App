// Constructeurs d'historique pour les tests de stats
import type { ActivePlan, HistorySet, HistoryWorkout, StatsHistory } from '../stats/types';

let seq = 0;

export const hs = (exerciseId: string, weight: number | null, reps: number | null, performedName: string | null = null): HistorySet =>
  ({ exerciseId, performedName, weight, reps });

export function hw(date: string, sets: HistorySet[], o: Partial<HistoryWorkout> = {}): HistoryWorkout {
  seq += 1;
  return {
    id: `w${String(seq).padStart(4, '0')}`, date, sessionKey: 's', sessionName: 'SÉANCE', units: 'kg',
    startedAt: `${date}T10:00:00.000Z`, completedAt: `${date}T11:00:00.000Z`, sets, ...o,
  };
}

export function history(workouts: HistoryWorkout[], active: ActivePlan | null = null, names: Record<string, string> = {}): StatsHistory {
  const sorted = [...workouts].sort((a, b) =>
    a.date.localeCompare(b.date) || (a.completedAt ?? '').localeCompare(b.completedAt ?? '') || a.id.localeCompare(b.id));
  return { workouts: sorted, exerciseNames: names, active };
}
