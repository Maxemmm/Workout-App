/** @jest-environment node */
import { isNull } from 'drizzle-orm';
import example from '@/data/program.example.json';
import { newDraft } from '@/domain/draft';
import { needsOnboarding } from '@/features/onboarding/needsOnboarding';
import { setOrder } from '../repos/layoutsRepo';
import { createProgram, getActiveProgram, listPrograms, setActiveProgram } from '../repos/programsRepo';
import { deleteHistory, resetAll } from '../repos/resetRepo';
import { getSetting, setSetting } from '../repos/settingsRepo';
import { getAllWeights, setWeight } from '../repos/weightsRepo';
import { ensureWorkout, upsertSet } from '../repos/workoutsRepo';
import { sessionLayouts, setEntries, settings, workouts } from '../schema';
import { createTestCtx } from '../testing/createTestCtx';

function seeded() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, example, 'example');
  setActiveProgram(ctx, p.id);
  const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 'full-body', date: '2026-10-06' });
  upsertSet(ctx, w.id, 'presse-cuisses', 0, { done: true, weight: 100 });
  setWeight(ctx, 'presse-cuisses', 100, 'kg');
  setOrder(ctx, p.id, 'full-body', ['presse-cuisses']);
  setSetting(ctx, 'lang', 'en');
  setSetting(ctx, 'theme', 'light');
  setSetting(ctx, 'onboarded', true);
  setSetting(ctx, 'aiEnabled', true);
  setSetting(ctx, 'defaultUnits', 'lbs');
  setSetting(ctx, 'lastExportAt', '2026-10-01T10:00:00.000Z');
  setSetting(ctx, 'programDraft', newDraft());
  setSetting(ctx, 'activeRest', { mode: 'rest', startedAt: 0, endAt: 1, workoutId: w.id, exerciseId: 'presse-cuisses', setIndex: 0, pending: null });
  return { ctx, p };
}
const liveCount = (ctx: ReturnType<typeof createTestCtx>) => ({
  workouts: ctx.db.select().from(workouts).where(isNull(workouts.deletedAt)).all().length,
  sets: ctx.db.select().from(setEntries).where(isNull(setEntries.deletedAt)).all().length,
  layouts: ctx.db.select().from(sessionLayouts).where(isNull(sessionLayouts.deletedAt)).all().length,
});

describe('resetRepo.deleteHistory', () => {
  it('efface séances, séries et minuteur ; garde programmes, poids, organisation, brouillon, réglages', () => {
    const { ctx, p } = seeded();
    deleteHistory(ctx);
    expect(liveCount(ctx)).toEqual({ workouts: 0, sets: 0, layouts: 1 });
    expect(getActiveProgram(ctx)?.id).toBe(p.id);
    expect(getAllWeights(ctx)).toHaveProperty('presse-cuisses');
    expect(getSetting(ctx, 'activeRest')).toBeUndefined();
    expect(getSetting(ctx, 'programDraft')).toBeDefined();
    expect(getSetting(ctx, 'lastExportAt')).toBe('2026-10-01T10:00:00.000Z');
  });
});

describe('resetRepo.resetAll', () => {
  it('vide tout sauf langue et thème → onboarding requis', () => {
    const { ctx } = seeded();
    resetAll(ctx);
    expect(listPrograms(ctx)).toEqual([]);
    expect(liveCount(ctx)).toEqual({ workouts: 0, sets: 0, layouts: 0 });
    expect(getAllWeights(ctx)).toEqual({});
    expect(ctx.db.select({ key: settings.key }).from(settings).all().map((r) => r.key).sort()).toEqual(['lang', 'theme']);
    expect(getSetting(ctx, 'lang')).toBe('en');
    expect(needsOnboarding(ctx)).toBe(true);
  });

  it('Review Focus 3 : échec au milieu → rien n\'est effacé', () => {
    const { ctx } = seeded();
    ctx.sqlite.exec("CREATE TRIGGER boom BEFORE UPDATE ON programs BEGIN SELECT RAISE(ABORT, 'boom'); END");
    expect(() => resetAll(ctx)).toThrow();
    expect(liveCount(ctx)).toEqual({ workouts: 1, sets: 1, layouts: 1 });
    expect(listPrograms(ctx)).toHaveLength(1);
    expect(getSetting(ctx, 'onboarded')).toBe(true);
  });
});
