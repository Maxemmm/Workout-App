// 1RM estimé (Epley) et meilleure série
export const ONE_RM_MAX_REPS = 12;

export function estimateOneRm(weight: number | null, reps: number | null): number | null {
  if (weight === null || !(weight > 0) || reps === null || reps < 1 || reps > ONE_RM_MAX_REPS) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export type BestSet = { weight: number; reps: number; oneRm: number; date: string };

/** Série au plus haut 1RM estimé ; égalité → la plus récente (date, puis ordre d'entrée) */
export function bestSet(sets: { weight: number | null; reps: number | null; date: string }[]): BestSet | null {
  let best: BestSet | null = null;
  for (const s of sets) {
    const oneRm = estimateOneRm(s.weight, s.reps);
    if (oneRm === null) continue;
    if (!best || oneRm > best.oneRm || (oneRm === best.oneRm && s.date >= best.date)) {
      best = { weight: s.weight as number, reps: s.reps as number, oneRm, date: s.date };
    }
  }
  return best;
}
