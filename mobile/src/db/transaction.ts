// Transaction synchrone : le RepoCtx transmis écrit dans la transaction
import type { AppDb, RepoCtx } from './types';

export function inTransaction<T>(ctx: RepoCtx, fn: (tx: RepoCtx) => T): T {
  return ctx.db.transaction((tx) => fn({ ...ctx, db: tx as unknown as AppDb }));
}
