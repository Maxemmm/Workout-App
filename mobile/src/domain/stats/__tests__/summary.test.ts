import { history, hs, hw } from '../../__fixtures__/statsHistory';
import { currentStreak, lastSession, weekVolume } from '../summary';
import type { ActivePlan } from '../types';

// 2026-10-07 = mercredi ; planning lundi / mercredi / vendredi
const MWF: ActivePlan = { trainDays: [1, 3, 5], units: 'kg', since: '2026-01-01' };
const done = (date: string) => hw(date, [hs('p', 100, 5)]);

describe('série en cours (planning)', () => {
  it('séances prévues consécutives faites ; aujourd\'hui pas encore fait ne casse rien', () => {
    const h = history(['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05'].map(done), MWF);
    expect(currentStreak(h, '2026-10-07')).toBe(4);
  });

  it('un jour prévu manqué depuis la dernière séance → 0', () => {
    expect(currentStreak(history(['2026-09-30', '2026-10-02'].map(done), MWF), '2026-10-07')).toBe(0);
  });

  it('un trou plus ancien coupe la série', () => {
    const h = history(['2026-09-28', '2026-10-02', '2026-10-05', '2026-10-07'].map(done), MWF);
    expect(currentStreak(h, '2026-10-07')).toBe(3);
  });

  it('séance un jour non prévu : ignorée pour la série', () => {
    expect(currentStreak(history(['2026-10-05', '2026-10-06'].map(done), MWF), '2026-10-07')).toBe(1);
  });

  it('Review Focus 2 : deux séances le même jour comptent pour un jour', () => {
    expect(currentStreak(history([done('2026-10-05'), done('2026-10-05')], MWF), '2026-10-07')).toBe(1);
  });
});

describe('série en cours (sans planning)', () => {
  it('jours calendaires consécutifs depuis aujourd\'hui, ou hier', () => {
    expect(currentStreak(history(['2026-10-05', '2026-10-06', '2026-10-07'].map(done)), '2026-10-07')).toBe(3);
    expect(currentStreak(history(['2026-10-05', '2026-10-06'].map(done)), '2026-10-07')).toBe(2);
    expect(currentStreak(history(['2026-10-05'].map(done)), '2026-10-07')).toBe(0);
    expect(currentStreak(history([]), '2026-10-07')).toBe(0);
  });
});

describe('volume de la semaine', () => {
  it('lundi → aujourd\'hui vs même plage la semaine précédente ; écart arrondi', () => {
    const h = history([
      hw('2026-09-28', [hs('p', 100, 10)]), // lun. précédent
      hw('2026-10-01', [hs('p', 100, 10)]), // jeu. précédent : hors plage (lun→mer)
      hw('2026-10-05', [hs('p', 100, 11)]),
      hw('2026-10-07', [hs('p', 50, 2)]),
    ], MWF);
    expect(weekVolume(h, '2026-10-07')).toEqual({ current: 1200, previous: 1000, deltaPct: 20 });
  });

  it('semaine précédente vide → pas d\'écart', () => {
    expect(weekVolume(history([hw('2026-10-06', [hs('p', 10, 10)])]), '2026-10-07')).toEqual({ current: 100, previous: 0, deltaPct: null });
  });

  it('Review Focus 1 : volumes en lbs convertis dans l\'unité active', () => {
    const h = history([hw('2026-10-06', [hs('p', 100, 10)], { units: 'lbs' })], MWF);
    expect(weekVolume(h, '2026-10-07').current).toBeCloseTo(453.59, 1);
  });
});

describe('dernière séance', () => {
  it('Review Focus 2 : la plus récemment terminée ; séries, durée, nouveaux records', () => {
    const h = history([
      hw('2026-10-01', [hs('p', 100, 5)]),
      hw('2026-10-05', [hs('p', 90, 5)], { completedAt: '2026-10-05T09:00:00.000Z', startedAt: '2026-10-05T08:00:00.000Z' }),
      hw('2026-10-05', [hs('p', 110, 5), hs('q', 20, 5)], { sessionName: 'PM', startedAt: '2026-10-05T17:00:00.000Z', completedAt: '2026-10-05T17:45:00.000Z' }),
    ]);
    expect(lastSession(h)).toMatchObject({ date: '2026-10-05', sessionName: 'PM', sets: 2, durationMin: 45, newRecords: 1 });
  });

  it('durée incohérente masquée ; aucune séance → null', () => {
    const odd = history([hw('2026-10-05', [], { startedAt: '2026-10-05T10:00:00.000Z', completedAt: '2026-10-05T17:00:00.000Z' })]);
    expect(lastSession(odd)?.durationMin).toBeNull();
    expect(lastSession(history([]))).toBeNull();
  });
});
