// Couleur par défaut d'une séance : or → rouille → bleu (reboucle), gris pour le repos (règle PWA)
import type { SessionType } from './program';

export type AccentKey = 'gold' | 'rust' | 'blue' | 'gray';
export const ACCENT_KEYS: readonly AccentKey[] = ['gold', 'rust', 'blue', 'gray'];
const CYCLE: readonly AccentKey[] = ['gold', 'rust', 'blue'];

export function defaultAccent(type: SessionType, others: readonly { type: SessionType }[]): AccentKey {
  if (type === 'rest') return 'gray';
  const count = others.filter((s) => s.type !== 'rest').length;
  return CYCLE[count % CYCLE.length];
}
