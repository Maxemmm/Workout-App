/** @jest-environment node */
import example from '@/data/program.example.json';
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { attendanceCalendar } from '@/domain/stats/attendance';
import { exerciseStats, trackedExercises } from '@/domain/stats/exerciseSeries';
import { personalRecords } from '@/domain/stats/records';
import { currentStreak, lastSession } from '@/domain/stats/summary';
import { replaceAll } from '../repos/importRepo';
import { createProgram, setActiveProgram, softDeleteProgram } from '../repos/programsRepo';
import { readHistory } from '../repos/statsRepo';
import { completeWorkout, ensureWorkout, upsertSet } from '../repos/workoutsRepo';
import { createTestCtx } from '../testing/createTestCtx';

describe('statsRepo.readHistory', () => {
  it('séances terminées seulement, séries faites seulement, triées', () => {
    const ctx = createTestCtx('2026-10-01T08:00:00.000Z');
    const p = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, p.id);
    const a = ensureWorkout(ctx, { programId: p.id, sessionKey: 'full-body', date: '2026-10-05' });
    upsertSet(ctx, a.id, 'presse-cuisses', 0, { done: true, weight: 100, reps: 8 });
    upsertSet(ctx, a.id, 'presse-cuisses', 1, { done: false, weight: 100 });
    completeWorkout(ctx, a.id);
    const b = ensureWorkout(ctx, { programId: p.id, sessionKey: 'full-body', date: '2026-10-07' }); // en cours
    upsertSet(ctx, b.id, 'presse-cuisses', 0, { done: true, weight: 110, reps: 8 });

    const h = readHistory(ctx);
    expect(h.workouts.map((w) => w.date)).toEqual(['2026-10-05']);
    expect(h.workouts[0]).toMatchObject({ sessionName: 'FULL BODY', units: 'kg', sets: [{ exerciseId: 'presse-cuisses', performedName: null, weight: 100, reps: 8 }] });
    expect(h.exerciseNames['presse-cuisses']).toBe('Presse à cuisses');
    expect(h.active).toEqual({ trainDays: [1, 3, 5], units: 'kg', since: '2026-10-01' });
  });

  it('Review Focus 5 : historique d\'un programme supprimé conservé, noms compris', () => {
    const ctx = createTestCtx();
    const gone = createProgram(ctx, example, 'example');
    const w = ensureWorkout(ctx, { programId: gone.id, sessionKey: 'full-body', date: '2026-10-05' });
    upsertSet(ctx, w.id, 'presse-cuisses', 0, { done: true, weight: 100, reps: 8 });
    completeWorkout(ctx, w.id);
    softDeleteProgram(ctx, gone.id);
    const h = readHistory(ctx);
    expect(h.workouts).toHaveLength(1);
    expect(h.workouts[0].sessionName).toBe('FULL BODY');
    expect(h.exerciseNames['presse-cuisses']).toBe('Presse à cuisses');
    expect(h.active).toBeNull();
  });

  it('base vide', () => {
    expect(readHistory(createTestCtx())).toEqual({ workouts: [], exerciseNames: {}, active: null });
  });
});

describe('stats sur la vraie sauvegarde (anonymisée)', () => {
  const TODAY = '2026-10-07';
  function restored() {
    const r = parseLegacyBackup(backup as Record<string, unknown>, TODAY);
    if (!r.ok) throw new Error('fixture invalide');
    const ctx = createTestCtx();
    replaceAll(ctx, r.bundle);
    return readHistory(ctx);
  }

  it('7 séances terminées, 21 exercices suivis, dernière séance du 24 juillet sans nouveau record', () => {
    const h = restored();
    expect(h.workouts).toHaveLength(7);
    expect(trackedExercises(h)).toHaveLength(21);
    expect(lastSession(h)).toMatchObject({ date: '2026-07-24', sessionName: 'BAS DU CORPS', newRecords: 0 });
    expect(currentStreak(h, TODAY)).toBe(0);
  });

  it('records : presse 110 kg atteint le 12 juin, tirage vertical 40 kg le 1er juillet ; aucun « nouveau »', () => {
    const h = restored();
    expect(exerciseStats(h, 'presse-cuisses-vend', null).record).toEqual({ value: 110, date: '2026-06-12' });
    expect(exerciseStats(h, 'tirage-vertical', null).record).toEqual({ value: 40, date: '2026-07-01' });
    expect(personalRecords(h, TODAY).some((r) => r.isNew)).toBe(false);
  });

  it('calendrier : la séance du 24 juillet est dans la première semaine affichée', () => {
    const cal = attendanceCalendar(restored(), TODAY);
    expect(cal[0].find((d) => d.date === '2026-07-24')?.state).toBe('done');
  });
});
