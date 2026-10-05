import {
  isExerciseComplete, isRestCritical, orderExercises, remainingSec,
  restDurationSec, restEndAt, sessionProgress, totalSets,
} from '../progress';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '../__fixtures__/builders';

const program = parseOrThrow(makeProgramInput({ '1': 'a' }, {
  a: makeSession('A', [makeExercise('x', 4), makeExercise('y', 3, { restSec: null })], {
    bonus: { title: 'BONUS', exercises: [makeExercise('z', 2)] },
  }),
}, { restDefaultSec: 75 }));
const session = program.sessions.a;
const [x, y] = session.exercises;

describe('totalSets / sessionProgress', () => {
  it('somme les séries des exercices principaux, bonus exclus', () => {
    expect(totalSets(session)).toBe(7);
  });

  it('compte les séries cochées et les exercices complets', () => {
    const p = sessionProgress(session, { x: [true, true, true, true], y: [true, false, false] });
    expect(p).toEqual({ done: 5, total: 7, ratio: 5 / 7, completeIds: ['x'] });
  });

  it('ignore les cases au-delà du nombre de séries et les ids inconnus', () => {
    const p = sessionProgress(session, { x: [true, true, true, true, true, true], inconnu: [true] });
    expect(p.done).toBe(4);
  });

  it('ratio = 0 pour une séance sans exercice', () => {
    const rest = parseOrThrow(makeProgramInput({}, { r: makeSession('R', [], { type: 'rest' }) })).sessions.r;
    expect(sessionProgress(rest, {})).toEqual({ done: 0, total: 0, ratio: 0, completeIds: [] });
  });

  it('isExerciseComplete', () => {
    expect(isExerciseComplete(y, { y: [true, true, true] })).toBe(true);
    expect(isExerciseComplete(y, { y: [true, true] })).toBe(false);
    expect(isExerciseComplete(y, {})).toBe(false);
  });
});

describe('orderExercises', () => {
  it("applique l'ordre mémorisé, ajoute les nouveaux exercices à la fin, ignore les ids disparus", () => {
    const exercises = parseOrThrow(makeProgramInput({}, {
      a: makeSession('A', [makeExercise('a'), makeExercise('b'), makeExercise('c')]),
    })).sessions.a.exercises;
    expect(orderExercises(exercises, ['c', 'disparu', 'a']).map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });

  it("garde l'ordre du programme sans layout", () => {
    expect(orderExercises(session.exercises, null).map((e) => e.id)).toEqual(['x', 'y']);
  });
});

describe('minuteur de repos', () => {
  it("utilise restSec de l'exercice, sinon meta.restDefaultSec", () => {
    expect(restDurationSec(x, program.meta)).toBe(90);
    expect(restDurationSec(y, program.meta)).toBe(75);
  });

  it("calcule l'heure de fin et le temps restant arrondi au supérieur, jamais négatif", () => {
    const end = restEndAt(1_000_000, 90);
    expect(end).toBe(1_090_000);
    expect(remainingSec(end, 1_000_001)).toBe(90);
    expect(remainingSec(end, 1_089_500)).toBe(1);
    expect(remainingSec(end, 2_000_000)).toBe(0);
  });

  it('passe en critique sous 10 s, pas à 0', () => {
    expect(isRestCritical(11)).toBe(false);
    expect(isRestCritical(10)).toBe(true);
    expect(isRestCritical(1)).toBe(true);
    expect(isRestCritical(0)).toBe(false);
  });
});
