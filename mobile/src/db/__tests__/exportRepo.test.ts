/** @jest-environment node */
import { eq, isNull } from 'drizzle-orm';
import example from '@/data/program.example.json';
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { parseNativeBackup, toNativeBackup } from '@/domain/nativeBackup';
import { readBundle } from '../repos/exportRepo';
import { replaceAll } from '../repos/importRepo';
import { lastPerformance } from '../repos/historyRepo';
import { createProgram, getActiveProgram, listPrograms, setActiveProgram, softDeleteProgram } from '../repos/programsRepo';
import { getSetting, setSetting } from '../repos/settingsRepo';
import { completeWorkout, ensureWorkout, upsertSet } from '../repos/workoutsRepo';
import { programs, setEntries, workouts } from '../schema';
import { createTestCtx } from '../testing/createTestCtx';

function restored() {
  const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
  if (!r.ok) throw new Error('fixture invalide');
  const ctx = createTestCtx();
  replaceAll(ctx, r.bundle);
  return { ctx, original: r.bundle };
}

describe('exportRepo.readBundle', () => {
  it('aller-retour sur la vraie sauvegarde : restaurer → exporter → réimporter dans une base vide', () => {
    const { ctx, original } = restored();
    setSetting(ctx, 'defaultUnits', 'lbs');
    const json = JSON.parse(JSON.stringify(toNativeBackup(readBundle(ctx), '2026-10-07T20:00:00.000Z')));
    const back = parseNativeBackup(json);
    if (!back.ok) throw new Error('export illisible');
    expect(back.bundle.report).toMatchObject({ programs: 2, workouts: 8, sets: 115, weights: 10, layouts: original.report.layouts, ignored: [] });

    const fresh = createTestCtx();
    replaceAll(fresh, back.bundle);
    expect(getActiveProgram(fresh)?.definition.meta.label).toBe(getActiveProgram(ctx)?.definition.meta.label);
    expect(fresh.db.select().from(workouts).where(isNull(workouts.deletedAt)).all()).toHaveLength(8);
    expect(fresh.db.select().from(setEntries).where(isNull(setEntries.deletedAt)).all()).toHaveLength(115);
    expect(getSetting(fresh, 'theme')).toBe('light');
    expect(getSetting(fresh, 'defaultUnits')).toBe('lbs');
  });

  it('programme supprimé : son historique est exporté et restauré, le programme reste masqué', () => {
    const ctx = createTestCtx();
    const keep = createProgram(ctx, example, 'example');
    const gone = createProgram(ctx, { ...example, meta: { ...example.meta, label: 'GONE' } }, 'manual');
    const unused = createProgram(ctx, { ...example, meta: { ...example.meta, label: 'UNUSED' } }, 'manual');
    setActiveProgram(ctx, gone.id);
    const w = ensureWorkout(ctx, { programId: gone.id, sessionKey: 'full-body', date: '2026-10-06' });
    upsertSet(ctx, w.id, 'presse-cuisses', 0, { done: true, weight: 100 });
    completeWorkout(ctx, w.id);
    softDeleteProgram(ctx, gone.id);
    softDeleteProgram(ctx, unused.id);

    const b = readBundle(ctx);
    expect(b.programs.map((p) => [p.sourceId, p.deleted === true])).toEqual([[keep.id, false], [gone.id, true]]);
    expect(b.activeProgramRef).toBe(keep.id);
    expect(b.report.programs).toBe(1);

    const back = parseNativeBackup(JSON.parse(JSON.stringify(toNativeBackup(b, 'x'))));
    if (!back.ok) throw new Error('export illisible');
    const fresh = createTestCtx();
    replaceAll(fresh, back.bundle);
    expect(listPrograms(fresh).map((p) => p.definition.meta.label)).toEqual([example.meta.label]);
    expect(getActiveProgram(fresh)?.definition.meta.label).toBe(example.meta.label);
    expect(fresh.db.select().from(workouts).where(isNull(workouts.deletedAt)).all()).toHaveLength(1);
    expect(lastPerformance(fresh, 'presse-cuisses', null, '2026-10-07')?.maxWeight).toBe(100);
  });

  it('sauvegarde native dont tous les programmes sont supprimés → refusée', () => {
    const ctx = createTestCtx();
    const gone = createProgram(ctx, example, 'example');
    ensureWorkout(ctx, { programId: gone.id, sessionKey: 'full-body', date: '2026-10-06' });
    softDeleteProgram(ctx, gone.id);
    const json = JSON.parse(JSON.stringify(toNativeBackup(readBundle(ctx), 'x')));
    expect(parseNativeBackup(json)).toEqual({ ok: false, error: 'no_valid_program' });
  });

  it('Review Focus 2 : programme stocké illisible → exclu, ses séances aussi, pas d\'exception', () => {
    const ctx = createTestCtx();
    const ok = createProgram(ctx, example, 'example');
    const broken = createProgram(ctx, example, 'manual');
    setActiveProgram(ctx, ok.id);
    ensureWorkout(ctx, { programId: broken.id, sessionKey: 'full-body', date: '2026-10-06' });
    ctx.db.update(programs).set({ definition: '{pas du json' }).where(eq(programs.id, broken.id)).run();
    const b = readBundle(ctx);
    expect(b.programs.map((p) => p.sourceId)).toEqual([ok.id]);
    expect(b.workouts).toEqual([]);
  });

  it('base vide : aucun programme, actif null, réglages vides', () => {
    expect(readBundle(createTestCtx())).toMatchObject({ programs: [], activeProgramRef: null, workouts: [], sets: [], settings: {} });
  });
});
