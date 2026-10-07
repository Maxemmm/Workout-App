// ============================================================
// Import — restauration complète (remplacement) en UNE transaction,
// ou ajout d'un programme seul. Les ids du paquet ne servent qu'au remappage.
// ============================================================
import { isNull } from 'drizzle-orm';
import type { ImportBundle } from '@/domain/importBundle';
import { exerciseWeights, programs, sessionLayouts, setEntries, workouts } from '../schema';
import { inTransaction } from '../transaction';
import type { RepoCtx } from '../types';
import { createProgram, setActiveProgram, type StoredProgram } from './programsRepo';
import { deleteSetting, setSetting } from './settingsRepo';
import { setWeight } from './weightsRepo';

export function replaceAll(ctx: RepoCtx, bundle: ImportBundle): { activeProgramId: string } {
  return inTransaction(ctx, (tx) => {
    const now = tx.now();
    const retire = { deletedAt: now, updatedAt: now };
    tx.db.update(setEntries).set(retire).where(isNull(setEntries.deletedAt)).run();
    tx.db.update(workouts).set(retire).where(isNull(workouts.deletedAt)).run();
    tx.db.update(exerciseWeights).set(retire).where(isNull(exerciseWeights.deletedAt)).run();
    tx.db.update(sessionLayouts).set(retire).where(isNull(sessionLayouts.deletedAt)).run();
    tx.db.update(programs).set(retire).where(isNull(programs.deletedAt)).run();

    // Dates de création décalées d'1 ms : la liste (triée par created_at) garde l'ordre de la sauvegarde
    const programIds = new Map<string, string>();
    bundle.programs.forEach((p, i) => {
      const at = new Date(Date.parse(now) + i).toISOString();
      programIds.set(p.sourceId, createProgram({ ...tx, now: () => at }, p.definition, p.source).id);
    });

    const workoutIds = new Map<string, string>();
    for (const w of bundle.workouts) {
      const programId = programIds.get(w.programRef);
      if (!programId) continue;
      const id = tx.newId();
      tx.db.insert(workouts).values({
        id, createdAt: now, updatedAt: now, programId, sessionKey: w.sessionKey, date: w.date,
        status: w.status, startedAt: w.startedAt, completedAt: w.completedAt,
      }).run();
      workoutIds.set(w.ref, id);
    }

    for (const s of bundle.sets) {
      const workoutId = workoutIds.get(s.workoutRef);
      if (!workoutId) continue;
      tx.db.insert(setEntries).values({
        id: tx.newId(), createdAt: now, updatedAt: now, workoutId, exerciseId: s.exerciseId, setIndex: s.setIndex,
        done: s.done, weight: s.weight, reps: s.reps, performedName: s.performedName, doneAt: s.doneAt,
      }).run();
    }

    for (const w of bundle.weights) setWeight(tx, w.key, w.weight, w.unit);

    for (const l of bundle.layouts) {
      const programId = programIds.get(l.programRef);
      if (!programId) continue;
      tx.db.insert(sessionLayouts).values({
        id: tx.newId(), createdAt: now, updatedAt: now, programId, sessionKey: l.sessionKey,
        exerciseOrder: JSON.stringify(l.order), swaps: JSON.stringify(l.swaps),
      }).run();
    }

    const s = bundle.settings;
    if (s.lang) setSetting(tx, 'lang', s.lang);
    if (s.theme) setSetting(tx, 'theme', s.theme);
    if (s.aiEnabled !== undefined) setSetting(tx, 'aiEnabled', s.aiEnabled);
    if (s.keepAwake !== undefined) setSetting(tx, 'keepAwake', s.keepAwake);
    if (s.defaultUnits) setSetting(tx, 'defaultUnits', s.defaultUnits);
    setSetting(tx, 'onboarded', true);
    deleteSetting(tx, 'programDraft');
    deleteSetting(tx, 'activeRest');

    const activeProgramId = (bundle.activeProgramRef && programIds.get(bundle.activeProgramRef)) || [...programIds.values()][0];
    setActiveProgram(tx, activeProgramId);
    return { activeProgramId };
  });
}

/** Programme seul : ajouté (source import), activé ; l'id d'origine éventuel est retiré */
export function importProgram(ctx: RepoCtx, input: unknown): StoredProgram {
  const { id: _origin, ...definition } = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const created = createProgram(ctx, definition, 'import');
  setActiveProgram(ctx, created.id);
  setSetting(ctx, 'onboarded', true);
  return created;
}
