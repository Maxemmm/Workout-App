// ============================================================
// Base SQLite de l'app (expo-sqlite) — instance unique
// ============================================================
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { getRandomBytes } from 'expo-crypto';
import { openDatabaseSync } from 'expo-sqlite';
import { createIdGenerator } from './ids';
import * as schema from './schema';
import type { RepoCtx } from './types';

const expoDb = openDatabaseSync('workout.db');
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });

export const appCtx: RepoCtx = {
  db,
  newId: createIdGenerator(getRandomBytes),
  now: () => new Date().toISOString(),
};

/** Copie brute de toutes les tables en JSON — secours si une migration échoue */
export function dumpRawTables(): string {
  const tables = expoDb.getAllSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const dump: Record<string, unknown[]> = {};
  for (const { name } of tables) dump[name] = expoDb.getAllSync(`SELECT * FROM "${name}"`);
  return JSON.stringify(dump, null, 2);
}
