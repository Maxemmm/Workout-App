import { parseLegacyBackup } from '../legacyImport';
import { parseNativeBackup, toNativeBackup } from '../nativeBackup';
import backup from '../__fixtures__/pwa-backup.json';

describe('format natif workout-native v1', () => {
  const legacy = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
  if (!legacy.ok) throw new Error('fixture invalide');

  it('aller-retour bundle → JSON → bundle sans perte', () => {
    const json = JSON.parse(JSON.stringify(toNativeBackup(legacy.bundle, '2026-10-07T20:00:00.000Z')));
    expect(json).toMatchObject({ _format: 'workout-native', _version: 1, exportedAt: '2026-10-07T20:00:00.000Z' });
    const back = parseNativeBackup(json);
    if (!back.ok) throw new Error('attendu ok');
    const { report: r1, ...a } = legacy.bundle;
    const { report: r2, ...b } = back.bundle;
    expect(b).toEqual(a);
    expect(r2).toMatchObject({ programs: r1.programs, workouts: r1.workouts, sets: r1.sets, weights: r1.weights, ignored: [] });
  });

  it('refuse un autre format ou une autre version', () => {
    expect(parseNativeBackup({ _format: 'autre' })).toEqual({ ok: false, error: 'invalid' });
    expect(parseNativeBackup({ _format: 'workout-native', _version: 2 })).toEqual({ ok: false, error: 'invalid' });
  });

  it("écarte les éléments invalides et les séances d'un programme inconnu", () => {
    const json = toNativeBackup(legacy.bundle, 'x') as unknown as Record<string, unknown[]>;
    (json.programs as unknown[]).push({ id: 'bad', source: 'import', definition: { meta: {} } });
    (json.workouts as unknown[]).push({ id: 'w-ghost', programId: 'ghost', sessionKey: 's', date: '2026-01-01', status: 'completed', startedAt: 'x', completedAt: 'x' });
    const r = parseNativeBackup(json);
    if (!r.ok) throw new Error('attendu ok');
    expect(r.bundle.programs).toHaveLength(2);
    expect(r.bundle.report.ignored).toEqual(expect.arrayContaining([
      { key: 'programs[2]', reason: 'invalid_program' },
      { key: 'workouts[8]', reason: 'unknown_program' },
    ]));
  });

  it('séance avec une date invalide → invalid_value', () => {
    const json = toNativeBackup(legacy.bundle, 'x') as unknown as Record<string, unknown[]>;
    const programId = (json.programs[0] as { id: string }).id;
    (json.workouts as unknown[]).push({ id: 'w-bad', programId, sessionKey: 's', date: 'hier', status: 'completed', startedAt: 'x', completedAt: 'x' });
    const r = parseNativeBackup(json);
    if (!r.ok) throw new Error('attendu ok');
    expect(r.bundle.workouts.map((w) => w.ref)).not.toContain('w-bad');
    expect(r.bundle.report.ignored).toContainEqual({ key: 'workouts[8]', reason: 'invalid_value' });
  });

  it('sans programme valide → refus', () => {
    expect(parseNativeBackup({ _format: 'workout-native', _version: 1, programs: [], workouts: [], setEntries: [], weights: [], layouts: [], settings: {} }))
      .toEqual({ ok: false, error: 'no_valid_program' });
  });
});
