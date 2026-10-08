import { history, hs, hw } from '../../__fixtures__/statsHistory';
import { attendanceCalendar, attendanceRate } from '../attendance';
import type { ActivePlan } from '../types';

const TODAY = '2026-10-07'; // mercredi
const MWF: ActivePlan = { trainDays: [1, 3, 5], units: 'kg', since: '2026-09-01' };
const done = (date: string) => hw(date, [hs('p', 100, 5)]);
const stateOf = (cal: ReturnType<typeof attendanceCalendar>, date: string) => cal.flat().find((d) => d.date === date)?.state;

describe('calendrier', () => {
  it('12 semaines lundi → dimanche, la dernière contient aujourd\'hui', () => {
    const cal = attendanceCalendar(history([], MWF), TODAY);
    expect(cal).toHaveLength(12);
    expect(cal.every((w) => w.length === 7)).toBe(true);
    expect(cal[11][0].date).toBe('2026-10-05');
    expect(cal[0][0].date).toBe('2026-07-20');
  });

  it('fait, manqué, repos, aujourd\'hui, futur', () => {
    const cal = attendanceCalendar(history(['2026-09-30', '2026-10-06'].map(done), MWF), TODAY);
    expect(stateOf(cal, '2026-09-30')).toBe('done');
    expect(stateOf(cal, '2026-10-06')).toBe('done'); // jour non prévu mais fait
    expect(stateOf(cal, '2026-10-02')).toBe('missed');
    expect(stateOf(cal, '2026-10-05')).toBe('missed');
    expect(stateOf(cal, '2026-10-04')).toBe('rest');
    expect(stateOf(cal, TODAY)).toBe('today');
    expect(stateOf(cal, '2026-10-08')).toBe('future');
  });

  it('Review Focus 4 : aucun jour manqué avant la création du programme actif', () => {
    const cal = attendanceCalendar(history([done('2026-07-22')], MWF), TODAY);
    expect(stateOf(cal, '2026-07-22')).toBe('done');
    expect(stateOf(cal, '2026-08-31')).toBe('rest'); // lundi avant since
    expect(stateOf(cal, '2026-09-02')).toBe('missed'); // mercredi après since
  });

  it('Review Focus 2 : deux séances le même jour → un seul jour fait', () => {
    const cal = attendanceCalendar(history([done('2026-10-05'), done('2026-10-05')], MWF), TODAY);
    expect(cal.flat().filter((d) => d.state === 'done')).toHaveLength(1);
  });

  it('sans programme actif : jamais de manqué', () => {
    const cal = attendanceCalendar(history([done('2026-10-05')]), TODAY);
    expect(cal.flat().some((d) => d.state === 'missed')).toBe(false);
  });
});

describe('taux', () => {
  it('jours prévus depuis since (et la création du programme) ; aujourd\'hui compté seulement s\'il est fait', () => {
    const h = history(['2026-09-28', '2026-09-30', '2026-10-05'].map(done), MWF);
    // depuis le 2026-09-28 : lun 28 ✓, mer 30 ✓, ven 2 ✗, lun 5 ✓, mer 7 (aujourd'hui, pas fait → non compté)
    expect(attendanceRate(h, TODAY, '2026-09-28')).toEqual({ kind: 'rate', done: 3, planned: 4 });
    const withToday = history(['2026-09-28', '2026-09-30', '2026-10-05', TODAY].map(done), MWF);
    expect(attendanceRate(withToday, TODAY, '2026-09-28')).toEqual({ kind: 'rate', done: 4, planned: 5 });
  });

  it('période « tout » : à partir de la création du programme', () => {
    const h = history([done('2026-08-03'), done('2026-09-02')], MWF);
    const r = attendanceRate(h, TODAY, null);
    expect(r.kind === 'rate' && r.done).toBe(1);
  });

  it('sans planning : nombre de séances de la période', () => {
    const h = history(['2026-09-01', '2026-10-01', '2026-10-01'].map(done));
    expect(attendanceRate(h, TODAY, '2026-09-10')).toEqual({ kind: 'count', sessions: 2 });
  });
});
