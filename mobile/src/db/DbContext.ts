// Contexte RepoCtx — volontairement sans import natif (utilisable dans les tests)
import { createContext, useContext } from 'react';
import type { RepoCtx } from './types';

export const DbContext = createContext<RepoCtx | null>(null);

/** Pour les tests : fournit un RepoCtx arbitraire (base en mémoire) */
export const DbTestProvider = DbContext.Provider;

export function useRepoCtx(): RepoCtx {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useRepoCtx doit être utilisé sous <DbProvider>');
  return ctx;
}
