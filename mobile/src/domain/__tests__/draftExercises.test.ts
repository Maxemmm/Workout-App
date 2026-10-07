import {
  addExercise, deleteExercise, draftFromProgram, duplicateExercise, moveExercise,
  sectionExercises, setBonusTitle, updateExercise, type ExerciseInput,
} from '../draft';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '../__fixtures__/builders';

const seq = (...values: string[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

const input = (name: string, extra: Partial<ExerciseInput> = {}): ExerciseInput =>
  ({ name, scheme: '3×10', sets: 3, timed: false, load: null, restSec: 90, cue: null, alternatives: [], ...extra }) as ExerciseInput;

function base() {
  const program = parseOrThrow(makeProgramInput({ '1': 's' }, {
    s: makeSession('S', [makeExercise('dc', 3, { name: 'Développé couché' }), makeExercise('curl', 3)]),
  }));
  return draftFromProgram('p', program);
}

describe('brouillon — exercices', () => {
  it('ajout : id lisible, unique dans tout le programme', () => {
    const { draft, id } = addExercise(base(), 's', 'main', input('Développé couché'), seq('k3f9'));
    expect(id).toBe('developpe-couche-k3f9');
    expect(sectionExercises(draft.program.sessions.s, 'main').map((e) => e.id)).toEqual(['dc', 'curl', id]);
  });

  it("Review Focus 5 : modifier (renommer) garde l'id", () => {
    const d = updateExercise(base(), 's', 'main', 'dc', input('Développé incliné', { sets: 4 }));
    expect(d.program.sessions.s.exercises[0]).toMatchObject({ id: 'dc', name: 'Développé incliné', sets: 4 });
  });

  it("modifier conserve les champs inconnus de l'exercice", () => {
    const program = parseOrThrow(makeProgramInput({}, { s: makeSession('S', [makeExercise('dc', 3, { custom: 'x' })]) }));
    const d = updateExercise(draftFromProgram('p', program), 's', 'main', 'dc', input('DC'));
    expect((d.program.sessions.s.exercises[0] as Record<string, unknown>).custom).toBe('x');
  });

  it("supprimer, dupliquer (nouvel id après l'original), déplacer", () => {
    const dup = duplicateExercise(base(), 's', 'main', 'dc', seq('zzzz'));
    expect(dup.id).toBe('developpe-couche-zzzz');
    expect(dup.draft.program.sessions.s.exercises.map((e) => e.id)).toEqual(['dc', dup.id, 'curl']);
    expect(dup.draft.program.sessions.s.exercises[1].name).toBe('Développé couché');
    const moved = moveExercise(dup.draft, 's', 'main', 2, 0);
    expect(moved.program.sessions.s.exercises.map((e) => e.id)).toEqual(['curl', 'dc', dup.id]);
    expect(deleteExercise(moved, 's', 'main', 'dc').program.sessions.s.exercises.map((e) => e.id)).toEqual(['curl', dup.id]);
  });

  it('bonus : ajout crée la section, titre optionnel, vidée → null', () => {
    const { draft, id } = addExercise(base(), 's', 'bonus', input('Abdos'), seq('bbbb'));
    expect(draft.program.sessions.s.bonus).toMatchObject({ title: null, exercises: [{ id, name: 'Abdos' }] });
    const titled = setBonusTitle(draft, 's', 'FINISHER');
    expect(titled.program.sessions.s.bonus?.title).toBe('FINISHER');
    expect(deleteExercise(draft, 's', 'bonus', id).program.sessions.s.bonus).toBeNull();
    expect(deleteExercise(titled, 's', 'bonus', id).program.sessions.s.bonus).toEqual({ title: 'FINISHER', exercises: [] });
  });

  it('un id de bonus ne peut pas reprendre un id principal', () => {
    const { id } = addExercise(base(), 's', 'bonus', input('Développé couché'), seq('k3f9'));
    expect(id).not.toBe('dc');
  });
});
