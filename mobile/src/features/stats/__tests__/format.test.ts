import { formatDay, formatLoad, formatNumber } from '../format';

describe('formatage stats', () => {
  it('nombres entiers avec séparateur de milliers', () => {
    expect(formatNumber(12450.4, 'en')).toBe('12,450');
    expect(formatNumber(12450.4, 'fr').replace(/\s/g, ' ')).toBe('12 450');
  });
  it('charges au 0,5, virgule en français, sans décimale inutile', () => {
    expect(formatLoad(45.36, 'fr')).toBe('45,5');
    expect(formatLoad(45.36, 'en')).toBe('45.5');
    expect(formatLoad(110, 'fr')).toBe('110');
  });
  it('jour court', () => {
    const days = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
    const months = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];
    expect(formatDay('2026-07-24', days, months)).toBe('VEN, 24 JUIL');
  });
});
