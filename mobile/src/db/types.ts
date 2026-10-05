// Types partagés par les repositories : base Drizzle synchrone + horloge et ids injectés
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- type de résultat différent entre expo-sqlite et better-sqlite3
export type AppDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export interface RepoCtx {
  db: AppDb;
  newId: () => string;
  /** Horodatage ISO 8601 UTC */
  now: () => string;
}
