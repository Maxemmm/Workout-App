import { effectiveExercise } from '../exerciseView';
import { restNotice } from '../restNotice';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '../__fixtures__/builders';

const program = parseOrThrow(makeProgramInput({ '1': 's' }, {
  s: makeSession('S', [
    makeExercise('presse', 4, { name: 'Presse' }),
    makeExercise('dc', 3, { name: 'DC', alternatives: ['Développé haltères'] }),
    makeExercise('gainage', 3, { name: 'Gainage' }),
  ]),
}));
const [presse, dc, gainage] = program.sessions.s.exercises.map((e) => effectiveExercise(e, null));
const weights: Record<string, number> = { presse: 100 };
const weightOf = (ex: { id: string }) => weights[ex.id] ?? null;
const base = { exercises: [presse, dc, gainage], weightOf };

describe('restNotice', () => {
  it('fin de repos, séries restantes : même exercice, prochaine série non cochée, poids', () => {
    const n = restNotice({ ...base, mode: 'rest', exerciseId: 'presse', setIndex: 1, track: { presse: [true, true, false, false] } });
    expect(n).toEqual({ kind: 'rest', line: { type: 'same', name: 'Presse', set: 3, total: 4, weight: 100 } });
  });

  it('exercice terminé : exercice suivant non complet (ordre affiché), sans poids connu', () => {
    const n = restNotice({ ...base, mode: 'rest', exerciseId: 'presse', setIndex: 3, track: { presse: [true, true, true, true], dc: [true, false, false] } });
    expect(n.line).toEqual({ type: 'next', name: 'DC', set: 2, total: 3, weight: null });
  });

  it('suivant : on repart du début si les exercices après sont complets', () => {
    const n = restNotice({ ...base, mode: 'rest', exerciseId: 'gainage', setIndex: 2, track: { presse: [true, true, true, true], dc: [false, false, false], gainage: [true, true, true] } });
    expect(n.line).toMatchObject({ type: 'next', name: 'DC', set: 1 });
  });

  it('toutes les séries faites', () => {
    const n = restNotice({ ...base, mode: 'rest', exerciseId: 'gainage', setIndex: 2, track: { presse: [true, true, true, true], dc: [true, true, true], gainage: [true, true, true] } });
    expect(n.line).toEqual({ type: 'done' });
  });

  it('alternative choisie : son nom', () => {
    const alt = effectiveExercise(program.sessions.s.exercises[1], 'Développé haltères');
    const n = restNotice({ exercises: [presse, alt, gainage], weightOf, mode: 'rest', exerciseId: 'dc', setIndex: 0, track: { dc: [true, false, false] } });
    expect(n.line).toMatchObject({ type: 'same', name: 'Développé haltères', set: 2 });
  });

  it('fin d\'une série chronométrée : la série en cours', () => {
    const n = restNotice({ ...base, mode: 'work', exerciseId: 'gainage', setIndex: 1, track: { gainage: [true, false, false] } });
    expect(n).toEqual({ kind: 'work', line: { type: 'same', name: 'Gainage', set: 2, total: 3, weight: null } });
  });

  it('exercice introuvable (programme modifié) : tout fait plutôt qu\'une erreur', () => {
    expect(restNotice({ ...base, mode: 'rest', exerciseId: 'nope', setIndex: 0, track: {} }).line.type).toBe('next');
  });
});
