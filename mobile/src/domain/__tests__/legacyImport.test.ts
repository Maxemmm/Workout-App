import { parseLegacyBackup } from '../legacyImport';
import { makeExercise, makeProgramInput, makeSession } from '../__fixtures__/builders';

const prog = (id: string, label = 'P') => ({
  id,
  ...makeProgramInput({ '1': 'fb' }, {
    fb: makeSession('FULL', [makeExercise('presse', 2, { scheme: '2×8' }), makeExercise('gainage', 2, { scheme: '2×45 sec' })]),
  }, { label }),
});
const log = (o: Record<string, unknown>) => JSON.stringify({
  sessionKey: 'fb', programId: 'prog-1', date: '2026-06-01', finishedAt: '2026-06-01T10:00:00.000Z',
  exercises: [{ id: 'presse', sets: 2, weight: '100' }], ...o,
});
const TODAY = '2026-10-07';

describe('parseLegacyBackup — cas construits', () => {
  it('séance terminée : séries cochées, poids du log, reps du schéma, ids remappables', () => {
    const r = parseLegacyBackup({ programs: JSON.stringify([prog('prog-1')]), activeProgram: 'prog-1', 'log:2026-06-01': log({}) }, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bundle.activeProgramRef).toBe('prog-1');
    expect(r.bundle.programs[0].definition).not.toHaveProperty('id');
    expect(r.bundle.workouts).toEqual([{ ref: 'log:2026-06-01:fb', programRef: 'prog-1', sessionKey: 'fb', date: '2026-06-01', status: 'completed', startedAt: '2026-06-01T10:00:00.000Z', completedAt: '2026-06-01T10:00:00.000Z' }]);
    expect(r.bundle.sets.map((s) => [s.exerciseId, s.setIndex, s.done, s.weight, s.reps])).toEqual([['presse', 0, true, 100, 8], ['presse', 1, true, 100, 8]]);
  });

  it('Review Focus 1 : ancienne clé `program`, log sans programId, track en tableau', () => {
    const r = parseLegacyBackup({
      program: JSON.stringify(prog('old')),
      'log:2026-06-01': log({ programId: undefined }),
      'track:2026-06-02:fb': JSON.stringify([[true, false], [false, false]]),
    }, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bundle.workouts.map((w) => [w.date, w.status, w.programRef])).toEqual([['2026-06-01', 'completed', 'old'], ['2026-06-02', 'abandoned', 'old']]);
    expect(r.bundle.sets.filter((s) => s.workoutRef === 'track:2026-06-02:fb').map((s) => [s.exerciseId, s.setIndex])).toEqual([['presse', 0]]);
  });

  it("séance entamée aujourd'hui → en cours ; poids mémorisé repris", () => {
    const r = parseLegacyBackup({
      programs: JSON.stringify([prog('prog-1')]), activeProgram: 'prog-1', 'weight:presse': '102,5',
      [`track:${TODAY}:fb`]: JSON.stringify({ v: 2, presse: [true, true] }),
    }, TODAY);
    if (!r.ok) throw new Error('attendu ok');
    expect(r.bundle.workouts[0]).toMatchObject({ status: 'in_progress', date: TODAY });
    expect(r.bundle.sets.map((s) => s.weight)).toEqual([102.5, 102.5]);
    expect(r.bundle.weights).toEqual([{ key: 'presse', weight: 102.5, unit: 'kg' }]);
  });

  it('ignorés : programme invalide, doublon, séance inconnue, aucune série, poids vide, clé inconnue', () => {
    const r = parseLegacyBackup({
      programs: JSON.stringify([prog('prog-1'), { id: 'bad', meta: {} }]), activeProgram: 'prog-1',
      'log:2026-06-01': log({}),
      'log:2026-06-01b': log({}),
      'track:2026-06-03:ghost': JSON.stringify({ v: 2, x: [true] }),
      'track:2026-06-04:fb': JSON.stringify({ v: 2, presse: [false, false] }),
      'weight:gainage': '',
      logWeightRepair_v2: '1',
      'program-draft': '{}',
      _exportedAt: '2026-10-07T00:00:00Z',
    }, TODAY);
    if (!r.ok) throw new Error('attendu ok');
    expect(r.bundle.report.ignored).toEqual(expect.arrayContaining([
      { key: 'programs[1]', reason: 'invalid_program' },
      { key: 'log:2026-06-01b', reason: 'duplicate' },
      { key: 'track:2026-06-03:ghost', reason: 'unknown_session' },
      { key: 'track:2026-06-04:fb', reason: 'no_checked_set' },
      { key: 'weight:gainage', reason: 'invalid_value' },
      { key: 'logWeightRepair_v2', reason: 'unknown_key' },
    ]));
    expect(r.bundle.report.ignored.map((i) => i.key)).not.toContain('program-draft');
    expect(r.bundle.report.ignored.map((i) => i.key)).not.toContain('_exportedAt');
  });

  it("séance entamée le même jour qu'un log de la même séance → déjà enregistrée", () => {
    const r = parseLegacyBackup({
      programs: JSON.stringify([prog('prog-1')]), activeProgram: 'prog-1',
      'log:2026-06-01': log({}), 'track:2026-06-01:fb': JSON.stringify({ v: 2, presse: [true] }),
    }, TODAY);
    if (!r.ok) throw new Error('attendu ok');
    expect(r.bundle.report.ignored).toContainEqual({ key: 'track:2026-06-01:fb', reason: 'already_logged' });
  });

  it('réglages : thème, langue, IA, écran allumé', () => {
    const r = parseLegacyBackup({
      programs: JSON.stringify([prog('prog-1')]), lang: 'en', theme: 'light', aiEnabled: 'false', 'pref-timer-wakelock': 'true',
    }, TODAY);
    if (!r.ok) throw new Error('attendu ok');
    expect(r.bundle.settings).toEqual({ lang: 'en', theme: 'light', aiEnabled: false, keepAwake: true });
  });

  it('aucun programme valide → refus', () => {
    expect(parseLegacyBackup({ programs: JSON.stringify([{ meta: {} }]), 'weight:x': '10' }, TODAY)).toEqual({ ok: false, error: 'no_valid_program' });
  });
});
