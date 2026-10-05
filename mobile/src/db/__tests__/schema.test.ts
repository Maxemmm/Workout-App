/** @jest-environment node */
import { createTestCtx } from '../testing/createTestCtx';
import { programs, workouts } from '../schema';

const NOW = '2026-01-01T00:00:00.000Z';
const base = (id: string) => ({ id, createdAt: NOW, updatedAt: NOW });

describe('migrations', () => {
  it('créent toutes les tables', () => {
    const { sqlite } = createTestCtx();
    const names = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => (r as { name: string }).name);
    expect(names).toEqual(expect.arrayContaining(['programs', 'workouts', 'set_entries', 'exercise_weights', 'session_layouts', 'settings']));
  });

  it('interdisent deux séances actives identiques le même jour, mais pas après suppression logique', () => {
    const { db } = createTestCtx();
    db.insert(programs).values({ ...base('p1'), definition: '{}', source: 'example' }).run();
    const w = { programId: 'p1', sessionKey: 'a', date: '2026-01-05', status: 'in_progress' as const, startedAt: NOW };
    db.insert(workouts).values({ ...base('w1'), ...w }).run();
    expect(() => db.insert(workouts).values({ ...base('w2'), ...w }).run()).toThrow(/UNIQUE/);
    db.update(workouts).set({ deletedAt: NOW }).run();
    expect(() => db.insert(workouts).values({ ...base('w3'), ...w }).run()).not.toThrow();
  });

  it('applique les clés étrangères', () => {
    const { db } = createTestCtx();
    expect(() =>
      db.insert(workouts).values({ ...base('w1'), programId: 'absent', sessionKey: 'a', date: '2026-01-05', status: 'in_progress', startedAt: NOW }).run(),
    ).toThrow(/FOREIGN KEY/);
  });
});
