import {
  isExerciseComplete, isRestCritical, orderExercises, remainingSec,
  restDurationSec, restEndAt, sessionProgress, sessionSummary, totalSets, trackFromEntries,
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

describe('trackFromEntries / sessionSummary', () => {
  const e = (exerciseId: string, setIndex: number, done: boolean, weight: number | null = null, reps: number | null = null) =>
    ({ exerciseId, setIndex, done, weight, reps });

  it('construit le suivi à partir des séries cochées seulement', () => {
    const track = trackFromEntries([e('x', 0, true), e('x', 2, true), e('x', 1, false), e('y', 0, true)]);
    expect(track).toEqual({ x: [true, false, true], y: [true] });
  });

  it('le suivi alimente sessionProgress', () => {
    const p = sessionProgress(session, trackFromEntries([e('x', 0, true), e('x', 1, true), e('x', 2, true), e('x', 3, true)]));
    expect(p.completeIds).toEqual(['x']);
  });

  it('récapitulatif : durée arrondie, séries faites, volume (poids × reps)', () => {
    const s = sessionSummary(
      [e('x', 0, true, 100, 8), e('x', 1, true, 102.5, 8), e('y', 0, true, null, 12), e('y', 1, false, 50, 10)],
      '2026-10-05T10:00:00.000Z', '2026-10-05T10:47:40.000Z',
    );
    expect(s).toEqual({ durationMin: 48, setsDone: 3, volume: 1620 });
  });

  it('séance non terminée : durée 0', () => {
    expect(sessionSummary([], '2026-10-05T10:00:00.000Z', null)).toEqual({ durationMin: 0, setsDone: 0, volume: 0 });
  });
});
