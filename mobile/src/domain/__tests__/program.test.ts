import example from '@/data/program.example.json';
import { alternativeName, parseProgram } from '../program';
import { makeExercise, makeProgramInput, makeSession, sevenDayLbsInput } from '../__fixtures__/builders';

describe('parseProgram', () => {
  it('accepte le programme exemple de la PWA', () => {
    const r = parseProgram(example);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.program.sessions)).toHaveLength(3);
    expect(r.program.meta.units).toBe('kg');
    expect(r.program.schedule['1']).toBe('full-body');
  });

  it('accepte un programme 7 jours en lbs', () => {
    const r = parseProgram(sevenDayLbsInput());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.program.meta.units).toBe('lbs');
  });

  it('normalise les types lâches produits par une IA ou un import', () => {
    const input = makeProgramInput({ '1': 'a' }, {
      a: makeSession('A', [makeExercise('x', 3, { sets: '4', scheme: 45, restSec: '60' })], { tips: null, warmup: null }),
    });
    const r = parseProgram(input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ex = r.program.sessions.a.exercises[0];
    expect(ex.sets).toBe(4);
    expect(ex.scheme).toBe('45');
    expect(ex.restSec).toBe(60);
    expect(r.program.sessions.a.tips).toEqual([]);
    expect(r.program.sessions.a.warmup).toEqual([]);
  });

  it('applique les valeurs par défaut de meta', () => {
    const r = parseProgram({ meta: {}, sessions: { a: makeSession('A') }, schedule: {} });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.program.meta).toMatchObject({ units: 'kg', restDefaultSec: 90, label: '' });
  });

  it('conserve les champs inconnus (ex. id PWA du programme)', () => {
    const r = parseProgram({ ...makeProgramInput({}, { a: makeSession('A') }), id: 'prog-123' });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.program as Record<string, unknown>).id).toBe('prog-123');
  });

  it('accepte un planning vide et des jours à null (repos)', () => {
    expect(parseProgram(makeProgramInput({}, { a: makeSession('A') })).ok).toBe(true);
    expect(parseProgram(makeProgramInput({ '2': null }, { a: makeSession('A') })).ok).toBe(true);
  });

  it('rejette un programme sans meta', () => {
    const r = parseProgram({ sessions: { a: makeSession('A') }, schedule: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('meta');
  });

  it('rejette des sessions vides', () => {
    const r = parseProgram(makeProgramInput({}, {}));
    expect(r.ok).toBe(false);
  });

  it('rejette un jour de planning hors 0-6', () => {
    const r = parseProgram(makeProgramInput({ '7': 'a' }, { a: makeSession('A') }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('0-6');
  });

  it('rejette un planning qui référence une séance inconnue', () => {
    const r = parseProgram(makeProgramInput({ '1': 'absente' }, { a: makeSession('A') }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('absente');
  });

  it('rejette sets < 1 et un exercice sans id', () => {
    expect(parseProgram(makeProgramInput({}, { a: makeSession('A', [makeExercise('x', 0)]) })).ok).toBe(false);
    expect(parseProgram(makeProgramInput({}, { a: makeSession('A', [makeExercise('', 3)]) })).ok).toBe(false);
  });

  it('rejette un type de séance inconnu', () => {
    expect(parseProgram(makeProgramInput({}, { a: makeSession('A', [], { type: 'yoga' }) })).ok).toBe(false);
  });

  it("rejette un id d'exercice dupliqué dans une même séance, l'accepte entre deux séances", () => {
    const dupInSession = makeProgramInput({}, { a: makeSession('A', [makeExercise('x'), makeExercise('x')]) });
    expect(parseProgram(dupInSession).ok).toBe(false);
    const shared = makeProgramInput({}, { a: makeSession('A', [makeExercise('x')]), b: makeSession('B', [makeExercise('x')]) });
    expect(parseProgram(shared).ok).toBe(true);
  });
  it("accepte les alternatives objets écrites par l'éditeur PWA et restSec 0", () => {
    const pwaExercise = makeExercise('presse', 4, {
      scheme: null,
      restSec: 0,
      alternatives: [
        'Presse inclinée',
        { name: 'Hack squat', sets: 3, scheme: '3×10', load: null, restSec: 0, timed: false },
      ],
    });
    const r = parseProgram(makeProgramInput({}, { a: makeSession('A', [pwaExercise]) }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ex = r.program.sessions.a.exercises[0];
    expect(ex.restSec).toBe(0);
    expect(ex.scheme).toBe('');
    expect(ex.alternatives.map(alternativeName)).toEqual(['Presse inclinée', 'Hack squat']);
  });

  it('rejette une alternative objet sans nom', () => {
    const bad = makeExercise('x', 3, { alternatives: [{ sets: 3 }] });
    expect(parseProgram(makeProgramInput({}, { a: makeSession('A', [bad]) })).ok).toBe(false);
  });
});
