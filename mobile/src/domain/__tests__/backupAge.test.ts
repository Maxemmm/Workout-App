import { backupAge } from '../backupAge';

const TODAY = '2026-10-07';
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe('backupAge', () => {
  it('jamais exporté ou valeur illisible → never', () => {
    expect(backupAge(undefined, TODAY)).toEqual({ kind: 'never' });
    expect(backupAge('pas une date', TODAY)).toEqual({ kind: 'never' });
  });

  it('jours calendaires locaux : aujourd\'hui, hier (même tard le soir)', () => {
    expect(backupAge(at(2026, 10, 7, 0), TODAY)).toEqual({ kind: 'recent', days: 0 });
    expect(backupAge(at(2026, 10, 6, 23), TODAY)).toEqual({ kind: 'recent', days: 1 });
  });

  it('14 jours → recent ; 15 jours → stale', () => {
    expect(backupAge(at(2026, 9, 23), TODAY)).toEqual({ kind: 'recent', days: 14 });
    expect(backupAge(at(2026, 9, 22), TODAY)).toEqual({ kind: 'stale', days: 15 });
  });

  it('date future (horloge changée) → 0 jour', () => {
    expect(backupAge(at(2026, 10, 9), TODAY)).toEqual({ kind: 'recent', days: 0 });
  });
});
