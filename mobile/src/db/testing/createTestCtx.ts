// ============================================================
// Base de test — better-sqlite3 en mémoire + mêmes migrations que l'app.
// À n'importer que depuis les tests (environnement node).
// ============================================================
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { createIdGenerator } from '../ids';
import * as schema from '../schema';
import type { RepoCtx } from '../types';

export function createTestCtx(startIso = '2026-01-01T00:00:00.000Z') {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../drizzle') });

  let t = Date.parse(startIso);
  const ctx: RepoCtx & { sqlite: Database.Database; advance(ms: number): void } = {
    sqlite,
    db,
    newId: createIdGenerator((n) => new Uint8Array(randomBytes(n)), () => t),
    now: () => new Date(t).toISOString(),
    advance: (ms) => { t += ms; },
  };
  return ctx;
}
