import { parseLegacyBackup } from '../legacyImport';
import backup from '../__fixtures__/pwa-backup.json';

const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');

describe('sauvegarde PWA réelle (anonymisée) du 7 oct. 2026', () => {
  if (!r.ok) throw new Error('la fixture doit être importable');
  const b = r.bundle;

  it('2 programmes ; programme actif = PROGRAMME A', () => {
    expect(b.programs.map((p) => p.definition.meta.label)).toEqual(['PROGRAMME A', 'PROGRAMME B']);
    expect(b.activeProgramRef).toBe('prog-1780651900282');
  });

  it('7 séances terminées (114 séries) + 1 séance abandonnée (15 juin, bas du corps, 1 série)', () => {
    expect(b.workouts.filter((w) => w.status === 'completed')).toHaveLength(7);
    expect(b.workouts.filter((w) => w.status === 'abandoned').map((w) => [w.date, w.sessionKey])).toEqual([['2026-06-15', 'bas-du-corps']]);
    expect(b.workouts.filter((w) => w.status === 'in_progress')).toHaveLength(0);
    expect(b.sets).toHaveLength(115);
    expect(b.sets.filter((s) => s.workoutRef === 'track:2026-06-15:bas-du-corps').map((s) => s.exerciseId)).toEqual(['gainage-vend']);
  });

  it('10 poids importés sur 11 (1 vide)', () => {
    expect(b.weights).toHaveLength(10);
    expect(b.report.ignored).toContainEqual({ key: 'weight:gainage-vend', reason: 'invalid_value' });
  });

  it('entrées track ignorées : 4 sans série cochée, 2 séances introuvables', () => {
    const reasons = b.report.ignored.filter((i) => i.key.startsWith('track:')).map((i) => i.reason).sort();
    expect(reasons).toEqual(['no_checked_set', 'no_checked_set', 'no_checked_set', 'no_checked_set', 'unknown_session', 'unknown_session']);
  });

  it('réglages et clé inconnue', () => {
    expect(b.settings).toEqual({ theme: 'light', aiEnabled: false });
    expect(b.report.ignored).toContainEqual({ key: 'logWeightRepair_v2', reason: 'unknown_key' });
    expect(b.report).toMatchObject({ programs: 2, workouts: 8, sets: 115, weights: 10, layouts: 0 });
    expect(b.report.ignored).toHaveLength(8);
  });
});
