import { formatShortDate } from '../formatDate';

const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

describe('formatShortDate', () => {
  it('formate le jour, la date et le mois en majuscules', () => {
    expect(formatShortDate(new Date(2026, 9, 5), days, months)).toBe('LUN, 5 OCT');
    expect(formatShortDate(new Date(2026, 7, 16), days, months)).toBe('DIM, 16 AOÛT');
  });
});
