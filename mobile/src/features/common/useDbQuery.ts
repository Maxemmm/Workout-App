// ============================================================
// Lecture synchrone de la base, relue à chaque changement de données.
// La version des données (dataVersion) est passée en ARGUMENT de la lecture :
// le React Compiler la voit donc comme une vraie dépendance (pas de useMemo +
// eslint-disable, que le compilateur contournerait en supprimant la dépendance).
// ============================================================
import { useRepoCtx } from '@/db/DbContext';
import type { RepoCtx } from '@/db/types';
import { usePrefs } from '@/state/prefsStore';

/** Exécute la requête pour une version de données donnée (la version ne sert que de clé de rafraîchissement). */
function readAtVersion<T>(query: (ctx: RepoCtx) => T, ctx: RepoCtx, _version: number): T {
  return query(ctx);
}

/** `query` doit être stable (fonction de module) et ne dépendre que de `ctx`. */
export function useDbQuery<T>(query: (ctx: RepoCtx) => T): T {
  const ctx = useRepoCtx();
  const dataVersion = usePrefs((s) => s.dataVersion);
  return readAtVersion(query, ctx, dataVersion);
}
