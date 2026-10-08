import { history, hs, hw } from '../../__fixtures__/statsHistory';
import { exerciseSeries, exerciseStats, trackedExercises, workoutVolume } from '../exerciseSeries';
import { personalRecords, recordsSetBy } from '../records';

const names = { presse: 'Presse', dc: 'Développé couché' };

describe('exercices suivis', () => {
  it('alternative = exercice distinct ; tri par dernière utilisation ; noms', () => {
    const h = history([
      hw('2026-06-01', [hs('presse', 100, 8), hs('dc', 60, 8)]),
      hw('2026-06-03', [hs('dc', 20, 10, 'Développé haltères')]),
    ], null, names);
    expect(trackedExercises(h).map((e) => [e.key, e.name, e.lastDate])).toEqual([
      ['dc::Développé haltères', 'Développé haltères', '2026-06-03'],
      ['dc', 'Développé couché', '2026-06-01'],
      ['presse', 'Presse', '2026-06-01'],
    ]);
  });

  it('nom inconnu → id', () => {
    expect(trackedExercises(history([hw('2026-06-01', [hs('mystere', 10, 5)])]))[0].name).toBe('mystere');
  });
});

describe('courbe', () => {
  const h = history([
    hw('2026-06-01', [hs('presse', 100, 8), hs('presse', 105, 6)]),
    hw('2026-06-08', [hs('presse', null, 10)]),
    hw('2026-06-15', [hs('presse', 110, 13)]),
  ], null, names);

  it('un point par séance avec poids : charge max', () => {
    expect(exerciseSeries(h, 'presse', 'load', null).map((p) => [p.date, p.value])).toEqual([['2026-06-01', 105], ['2026-06-15', 110]]);
  });

  it('1RM : meilleur 1RM de la séance ; séance sans 1RM calculable → pas de point', () => {
    const pts = exerciseSeries(h, 'presse', 'oneRm', null);
    expect(pts.map((p) => p.date)).toEqual(['2026-06-01']);
    expect(pts[0].value).toBeCloseTo(100 * (1 + 8 / 30)); // 100×8 (126,7) bat 105×6 (126)
  });

  it('période : seulement les séances depuis since', () => {
    expect(exerciseSeries(h, 'presse', 'load', '2026-06-10').map((p) => p.date)).toEqual(['2026-06-15']);
  });

  it('Review Focus 1 : séances en lbs converties dans l\'unité active', () => {
    const mixed = history([
      hw('2026-06-01', [hs('presse', 100, 8)], { units: 'kg' }),
      hw('2026-06-08', [hs('presse', 220, 8)], { units: 'lbs' }),
    ], { trainDays: [], units: 'kg', since: '2026-01-01' });
    expect(exerciseSeries(mixed, 'presse', 'load', null)[1].value).toBeCloseTo(99.79, 1);
    expect(exerciseStats(mixed, 'presse', null).record).toEqual({ value: 100, date: '2026-06-01' });
  });
});

describe('chiffres d\'un exercice', () => {
  it('record = première atteinte du max ; meilleure série ; volume sur la période', () => {
    const h = history([
      hw('2026-06-01', [hs('presse', 100, 8)]),
      hw('2026-06-08', [hs('presse', 110, 5)]),
      hw('2026-06-15', [hs('presse', 110, 8), hs('presse', 90, 10)]),
    ]);
    const s = exerciseStats(h, 'presse', '2026-06-10');
    expect(s.record).toEqual({ value: 110, date: '2026-06-08' });
    expect(s.best).toMatchObject({ weight: 110, reps: 8, date: '2026-06-15' });
    expect(s.volume).toBe(110 * 8 + 90 * 10);
  });

  it('Review Focus 3 : exercice au poids du corps → pas de record ni de meilleure série, volume 0', () => {
    const h = history([hw('2026-06-01', [hs('gainage', null, 3), hs('gainage', null, 3)])]);
    expect(exerciseStats(h, 'gainage', null)).toEqual({ record: null, best: null, volume: 0 });
    expect(exerciseSeries(h, 'gainage', 'load', null)).toEqual([]);
  });

  it('volume d\'une séance : poids × reps, séries sans poids ou sans reps ignorées, conversion', () => {
    const w = hw('2026-06-01', [hs('a', 100, 10), hs('b', null, 10), hs('c', 50, null)], { units: 'lbs' });
    expect(workoutVolume(w, 'lbs')).toBe(1000);
    expect(workoutVolume(w, 'kg')).toBeCloseTo(453.59, 1);
  });
});

describe('records', () => {
  const TODAY = '2026-10-07';

  it('première séance jamais « nouveau » ; record battu il y a < 7 jours → nouveau', () => {
    const h = history([
      hw('2026-09-20', [hs('presse', 100, 8), hs('dc', 60, 8)]),
      hw('2026-10-01', [hs('presse', 105, 8)]),
      hw('2026-10-02', [hs('dc', 55, 8)]),
    ], null, names);
    const recs = personalRecords(h, TODAY);
    expect(recs.map((r) => [r.key, r.weight, r.date, r.isNew])).toEqual([
      ['presse', 105, '2026-10-01', true],
      ['dc', 60, '2026-09-20', false],
    ]);
  });

  it('badge : 6 jours → nouveau, 7 jours → non', () => {
    const at = (d: string) => personalRecords(history([hw('2026-09-01', [hs('p', 100, 5)]), hw(d, [hs('p', 101, 5)])]), TODAY)[0].isNew;
    expect(at('2026-10-01')).toBe(true);
    expect(at('2026-09-30')).toBe(false);
  });

  it('recordsSetBy : strictement au-dessus de toutes les séances antérieures ; égalité ou première séance → non', () => {
    const w1 = hw('2026-06-01', [hs('presse', 100, 8)]);
    const w2 = hw('2026-06-08', [hs('presse', 100, 8), hs('dc', 50, 8)]);
    const w3 = hw('2026-06-15', [hs('presse', 102.5, 8)]);
    const h = history([w1, w2, w3]);
    expect(recordsSetBy(h, w1.id)).toEqual([]);
    expect(recordsSetBy(h, w2.id)).toEqual([]);
    expect(recordsSetBy(h, w3.id)).toEqual(['presse']);
  });

  it('Review Focus 3 : exercice sans poids absent des records', () => {
    expect(personalRecords(history([hw('2026-06-01', [hs('gainage', null, 3)])]), TODAY)).toEqual([]);
  });
});
