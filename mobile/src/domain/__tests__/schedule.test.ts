import example from '@/data/program.example.json';
import { localDateKey, resolveDay, weekdayOf, WEEKDAYS, weekStrip } from '../schedule';
import { makeProgramInput, makeSession, parseOrThrow, sevenDayLbsInput } from '../__fixtures__/builders';

const program = parseOrThrow(example);

describe('resolveDay', () => {
  it('retourne la séance planifiée', () => {
    const plan = resolveDay(program, 1);
    expect(plan.kind).toBe('session');
    if (plan.kind === 'session') {
      expect(plan.sessionKey).toBe('full-body');
      expect(plan.session.name).toBe('FULL BODY');
    }
  });

  it('retourne un repos implicite pour un jour absent du planning', () => {
    expect(resolveDay(program, 2)).toEqual({ kind: 'implicit-rest', weekday: 2 });
  });

  it('retourne un repos implicite pour un jour à null', () => {
    const p = parseOrThrow(makeProgramInput({ '4': null }, { a: makeSession('A') }));
    expect(resolveDay(p, 4).kind).toBe('implicit-rest');
  });

  it("affiche un 4e jour ajouté au planning sans changer le code (critère d'extensibilité)", () => {
    const input = structuredClone(example) as { schedule: Record<string, string> };
    input.schedule['6'] = 'full-body';
    const plan = resolveDay(parseOrThrow(input), 6);
    expect(plan.kind).toBe('session');
  });

  it('gère un programme de 7 jours', () => {
    const p = parseOrThrow(sevenDayLbsInput());
    for (const d of WEEKDAYS) expect(resolveDay(p, d).kind).toBe('session');
  });
});

describe('weekStrip', () => {
  it('retourne 7 jours, dimanche → samedi, avec un seul jour courant', () => {
    const monday = new Date(2026, 9, 5, 9, 0); // lundi 5 octobre 2026, heure locale
    const strip = weekStrip(program, monday);
    expect(strip.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(strip.filter((d) => d.isToday).map((d) => d.weekday)).toEqual([1]);
    expect(strip[1].plan.kind).toBe('session');
    expect(strip[2].plan.kind).toBe('implicit-rest');
  });
});

describe('dates locales', () => {
  it('weekdayOf suit Date.getDay()', () => {
    expect(weekdayOf(new Date(2026, 9, 4))).toBe(0); // dimanche
  });

  it('localDateKey utilise le jour local, même tard le soir', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });
});
