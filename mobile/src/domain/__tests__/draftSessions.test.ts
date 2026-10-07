import {
  addSession, deleteSession, draftFromProgram, duplicateSession, isScheduled, moveSession,
  newDraft, setMeta, setRules, setSchedule, setSessionAccent, updateSession,
} from '../draft';
import { WEEK_ORDER } from '../schedule';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '../__fixtures__/builders';

const seq = (...values: string[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

describe('brouillon — programme et séances', () => {
  it('nouveau brouillon vide', () => {
    expect(newDraft()).toEqual({
      sourceProgramId: null,
      program: { meta: { label: '', units: 'kg', restDefaultSec: 90 }, sessions: {}, schedule: {}, rules: [] },
      manualAccents: [],
    });
  });

  it('brouillon depuis un programme : copie profonde, couleurs existantes considérées comme choisies', () => {
    const program = parseOrThrow(makeProgramInput({ '1': 'a' }, { a: makeSession('A') }));
    const d = draftFromProgram('p1', program);
    d.program.sessions.a.name = 'MODIFIÉ';
    expect(program.sessions.a.name).toBe('A');
    expect(d).toMatchObject({ sourceProgramId: 'p1', manualAccents: ['a'] });
  });

  it('métadonnées et règles', () => {
    const d = setRules(setMeta(newDraft(), { label: 'PROG', units: 'lbs' }), ['r1']);
    expect(d.program.meta).toMatchObject({ label: 'PROG', units: 'lbs', restDefaultSec: 90 });
    expect(d.program.rules).toEqual(['r1']);
  });

  it('ajout de séances : id lisible, couleur par défaut en cycle', () => {
    const a = addSession(newDraft(), 'lift', seq('aaaa'));
    const b = addSession(a.draft, 'lift', seq('bbbb'));
    expect(a.key).toBe('lift-aaaa');
    expect(b.draft.program.sessions[a.key]).toMatchObject({ type: 'lift', name: '', accent: 'gold', exercises: [], warmup: [], tips: [] });
    expect(b.draft.program.sessions[b.key].accent).toBe('rust');
  });

  it('changement de type : couleur recalculée sauf si choisie à la main', () => {
    const { draft, key } = addSession(newDraft(), 'lift', seq('aaaa'));
    expect(updateSession(draft, key, { type: 'rest' }).program.sessions[key].accent).toBe('gray');
    const chosen = setSessionAccent(draft, key, 'blue');
    expect(updateSession(chosen, key, { type: 'rest' }).program.sessions[key].accent).toBe('blue');
    expect(chosen.manualAccents).toEqual([key]);
  });

  it('Review Focus 2 : supprimer une séance planifiée sur plusieurs jours la retire du planning', () => {
    let { draft, key } = addSession(newDraft(), 'lift', seq('aaaa'));
    const other = addSession(draft, 'lift', seq('bbbb'));
    draft = setSchedule(setSchedule(setSchedule(other.draft, 1, key), 3, key), 5, other.key);
    expect(isScheduled(draft, key)).toBe(true);
    draft = deleteSession(draft, key);
    expect(draft.program.sessions[key]).toBeUndefined();
    expect(draft.program.schedule).toEqual({ '5': other.key });
    expect(isScheduled(draft, other.key)).toBe(true);
  });

  it("dupliquer une séance : nouvelle clé, ids d'exercices conservés, insérée après l'originale", () => {
    const program = parseOrThrow(makeProgramInput({ '1': 'a' }, {
      a: makeSession('HAUT A', [makeExercise('dc', 3)]),
      z: makeSession('BAS'),
    }));
    const { draft, key } = duplicateSession(draftFromProgram('p', program), 'a', ' (copie)', seq('cccc'));
    expect(Object.keys(draft.program.sessions)).toEqual(['a', key, 'z']);
    expect(draft.program.sessions[key]).toMatchObject({ name: 'HAUT A (copie)' });
    expect(draft.program.sessions[key].exercises.map((e) => e.id)).toEqual(['dc']);
    expect(draft.program.schedule).toEqual({ '1': 'a' });
  });

  it("déplacer une séance change l'ordre des clés", () => {
    const program = parseOrThrow(makeProgramInput({}, { a: makeSession('A'), b: makeSession('B'), c: makeSession('C') }));
    expect(Object.keys(moveSession(draftFromProgram('p', program), 2, 0).program.sessions)).toEqual(['c', 'a', 'b']);
  });

  it('planning : affecter puis remettre en repos', () => {
    const { draft, key } = addSession(newDraft(), 'lift', seq('aaaa'));
    const planned = setSchedule(draft, 0, key);
    expect(planned.program.schedule).toEqual({ '0': key });
    expect(setSchedule(planned, 0, null).program.schedule).toEqual({});
  });

  it('les champs inconnus du programme sont conservés', () => {
    const program = parseOrThrow({ ...makeProgramInput({ '1': 'a' }, { a: makeSession('A', [], { custom: 42 }) }), extra: 'x' });
    const d = updateSession(draftFromProgram('p', program), 'a', { name: 'B' });
    expect((d.program as Record<string, unknown>).extra).toBe('x');
    expect((d.program.sessions.a as Record<string, unknown>).custom).toBe(42);
  });

  it("ordre d'affichage de la semaine : lundi → dimanche", () => {
    expect(WEEK_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});
