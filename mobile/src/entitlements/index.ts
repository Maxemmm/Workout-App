// ============================================================
// Droits d'accès (spec §2.3) — v1 : tout débloqué.
// Le sous-projet 3 branchera le paywall ici sans toucher aux écrans.
// ============================================================
export interface Entitlements {
  canUseAI: boolean;
  maxPrograms: number;
  canUseHealthSync: boolean;
}

const V1: Entitlements = { canUseAI: true, maxPrograms: Infinity, canUseHealthSync: true };

export function useEntitlements(): Entitlements {
  return V1;
}
