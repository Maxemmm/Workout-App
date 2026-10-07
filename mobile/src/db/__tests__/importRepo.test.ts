/** @jest-environment node */
import { and, eq, isNull } from 'drizzle-orm';
import example from '@/data/program.example.json';
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { getAllWeights } from '../repos/weightsRepo';
import { importProgram, replaceAll } from '../repos/importRepo';
import { createProgram, getActiveProgram, listPrograms, setActiveProgram } from '../repos/programsRepo';
import { getSetting, setSetting } from '../repos/settingsRepo';
import { ensureWorkout, upsertSet } from '../repos/workoutsRepo';
import { setEntries, workouts } from '../schema';
import { createTestCtx } from '../testing/createTestCtx';

function bundle() {
  const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
  if (!r.ok) throw new Error('fixture invalide');
  return r.bundle;
}
const live = (ctx: ReturnType<typeof createTestCtx>) => ({
  workouts: ctx.db.select().from(workouts).where(isNull(workouts.deletedAt)).all(),
  sets: ctx.db.select().from(setEntries).where(isNull(setEntries.deletedAt)).all(),
});

describe('importRepo.replaceAll', () => {
  it('applique defaultUnits de la sauvegarde', () => {
    const ctx = createTestCtx();
    replaceAll(ctx, { ...bundle(), settings: { defaultUnits: 'lbs' } });
    expect(getSetting(ctx, 'defaultUnits')).toBe('lbs');
  });

  it('remplace toutes les données ; références remappées ; actif et réglages appliqués', () => {
    const ctx = createTestCtx();
    const old = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, old.id);
    const w = ensureWorkout(ctx, { programId: old.id, sessionKey: 'full-body', date: '2026-10-06' });
    upsertSet(ctx, w.id, 'presse-cuisses', 0, { done: true });
    setSetting(ctx, 'activeRest', { mode: 'rest', startedAt: 0, endAt: 1, workoutId: w.id, exerciseId: 'x', setIndex: 0, pending: null });

    const { activeProgramId } = replaceAll(ctx, bundle());

    expect(listPrograms(ctx).map((p) => p.definition.meta.label)).toEqual(['PROGRAMME A', 'PROGRAMME B']);
    expect(getActiveProgram(ctx)?.id).toBe(activeProgramId);
    expect(getActiveProgram(ctx)?.definition.meta.label).toBe('PROGRAMME A');
    const { workouts: ws, sets } = live(ctx);
    expect(ws).toHaveLength(8);
    expect(ws.every((x) => x.programId !== old.id && !x.programId.startsWith('prog-'))).toBe(true);
    expect(sets).toHaveLength(115);
    expect(Object.keys(getAllWeights(ctx))).toHaveLength(10);
    expect(getSetting(ctx, 'theme')).toBe('light');
    expect(getSetting(ctx, 'aiEnabled')).toBe(false);
    expect(getSetting(ctx, 'onboarded')).toBe(true);
    expect(getSetting(ctx, 'activeRest')).toBeUndefined();
  });

  it('Review Focus 2 : restaurer deux fois ne crée aucun doublon', () => {
    const ctx = createTestCtx();
    replaceAll(ctx, bundle());
    ctx.advance(1000);
    replaceAll(ctx, bundle());
    expect(listPrograms(ctx)).toHaveLength(2);
    expect(live(ctx).workouts).toHaveLength(8);
    expect(live(ctx).sets).toHaveLength(115);
  });

  it('Review Focus 5 : une erreur en cours de restauration laisse les données intactes', () => {
    const ctx = createTestCtx();
    const old = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, old.id);
    const b = bundle();
    const broken = { ...b, programs: [...b.programs, { sourceId: 'bad', source: 'import' as const, definition: { meta: {} } as never }] };
    expect(() => replaceAll(ctx, broken)).toThrow();
    expect(listPrograms(ctx).map((p) => p.id)).toEqual([old.id]);
    expect(getActiveProgram(ctx)?.id).toBe(old.id);
  });

  it('séance entamée importée : statut abandonnée à sa date', () => {
    const ctx = createTestCtx();
    replaceAll(ctx, bundle());
    const w = ctx.db.select().from(workouts).where(and(eq(workouts.date, '2026-06-15'), isNull(workouts.deletedAt))).all();
    expect(w.map((x) => [x.sessionKey, x.status])).toEqual([['bas-du-corps', 'abandoned']]);
  });
});

describe('importRepo.importProgram', () => {
  it("Review Focus 3 : programme seul (id PWA, libellé existant) ajouté et activé, rien d'autre touché", () => {
    const ctx = createTestCtx();
    const existing = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, existing.id);
    const w = ensureWorkout(ctx, { programId: existing.id, sessionKey: 'full-body', date: '2026-10-06' });
    const imported = importProgram(ctx, { ...example, id: 'prog-123' });
    expect(imported.source).toBe('import');
    expect(imported.definition).not.toHaveProperty('id');
    expect(listPrograms(ctx)).toHaveLength(2);
    expect(getActiveProgram(ctx)?.id).toBe(imported.id);
    expect(getSetting(ctx, 'onboarded')).toBe(true);
    expect(live(ctx).workouts.map((x) => x.id)).toEqual([w.id]);
  });
});
