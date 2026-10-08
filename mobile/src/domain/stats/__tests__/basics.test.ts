import { addDays, dayDiff, mondayOf, weekdayOfDay } from '../dates';
import { bestSet, estimateOneRm } from '../oneRm';
import { isStatsPeriod, periodStart } from '../period';
import { roundLoad, toUnit } from '../units';

describe('dates', () => {
  it('addDays traverse les mois et le changement d\'heure', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });
  it('dayDiff, jour de semaine, lundi', () => {
    expect(dayDiff('2026-10-01', '2026-10-07')).toBe(6);
    expect(weekdayOfDay('2026-10-07')).toBe(3); // mercredi
    expect(mondayOf('2026-10-07')).toBe('2026-10-05');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05'); // dimanche → lundi précédent
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
  });
});

describe('units', () => {
  it('Review Focus 1 : conversion kg ↔ lbs, même unité inchangée', () => {
    expect(toUnit(100, 'lbs', 'kg')).toBeCloseTo(45.359237);
    expect(toUnit(45.359237, 'kg', 'lbs')).toBeCloseTo(100);
    expect(toUnit(80, 'kg', 'kg')).toBe(80);
  });
  it('arrondi des charges au 0,5', () => {
    expect(roundLoad(45.36)).toBe(45.5);
    expect(roundLoad(45.2)).toBe(45);
  });
});

describe('1RM', () => {
  it('Epley de 1 à 12 reps ; au-delà, poids nul ou reps absentes → null', () => {
    expect(estimateOneRm(100, 1)).toBe(100);
    expect(estimateOneRm(100, 12)).toBeCloseTo(140);
    expect(estimateOneRm(100, 13)).toBeNull();
    expect(estimateOneRm(0, 5)).toBeNull();
    expect(estimateOneRm(100, null)).toBeNull();
    expect(estimateOneRm(null, 5)).toBeNull();
  });
  it('meilleure série = plus haut 1RM ; égalité → la plus récente', () => {
    expect(bestSet([
      { weight: 100, reps: 8, date: '2026-06-01' },
      { weight: 110, reps: 3, date: '2026-06-02' },
      { weight: 120, reps: 15, date: '2026-06-03' },
    ])).toEqual({ weight: 100, reps: 8, oneRm: 100 * (1 + 8 / 30), date: '2026-06-01' });
    expect(bestSet([{ weight: 100, reps: 5, date: '2026-06-01' }, { weight: 100, reps: 5, date: '2026-06-08' }])?.date).toBe('2026-06-08');
    expect(bestSet([{ weight: null, reps: 10, date: '2026-06-01' }])).toBeNull();
  });
});

describe('période', () => {
  it('bornes incluses ; all → null ; garde de type', () => {
    expect(periodStart('4w', '2026-10-07')).toBe('2026-09-10');
    expect(periodStart('3m', '2026-10-07')).toBe('2026-07-09');
    expect(periodStart('1y', '2026-10-07')).toBe('2025-10-08');
    expect(periodStart('all', '2026-10-07')).toBeNull();
    expect(isStatsPeriod('3m')).toBe(true);
    expect(isStatsPeriod('6m')).toBe(false);
  });
});
