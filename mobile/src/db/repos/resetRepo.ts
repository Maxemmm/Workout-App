// ============================================================
// Zone de danger de Profil — chaque action en UNE transaction.
// Suppressions logiques (deletedAt) pour les tables synchronisables.
// ============================================================
import { isNull, notInArray } from 'drizzle-orm';
import { exerciseWeights, programs, sessionLayouts, setEntries, settings, workouts } from '../schema';
import { inTransaction } from '../transaction';
import type { RepoCtx } from '../types';
import { deleteSetting, type SettingKey } from './settingsRepo';

/** Réglages conservés par « Réinitialiser l'application » */
export const KEPT_ON_RESET: readonly SettingKey[] = ['lang', 'theme'];

function retireHistory(tx: RepoCtx, now: string) {
  const retire = { deletedAt: now, updatedAt: now };
  tx.db.update(setEntries).set(retire).where(isNull(setEntries.deletedAt)).run();
  tx.db.update(workouts).set(retire).where(isNull(workouts.deletedAt)).run();
}

/** Séances et séries (y compris en cours) + minuteur ; le reste est conservé */
export function deleteHistory(ctx: RepoCtx): void {
  inTransaction(ctx, (tx) => {
    retireHistory(tx, tx.now());
    deleteSetting(tx, 'activeRest');
  });
}

/** Tout, sauf la langue et le thème */
export function resetAll(ctx: RepoCtx): void {
  inTransaction(ctx, (tx) => {
    const now = tx.now();
    const retire = { deletedAt: now, updatedAt: now };
    retireHistory(tx, now);
    tx.db.update(exerciseWeights).set(retire).where(isNull(exerciseWeights.deletedAt)).run();
    tx.db.update(sessionLayouts).set(retire).where(isNull(sessionLayouts.deletedAt)).run();
    tx.db.update(programs).set(retire).where(isNull(programs.deletedAt)).run();
    tx.db.delete(settings).where(notInArray(settings.key, [...KEPT_ON_RESET])).run();
  });
}
