import { addExercise, addSession, newDraft, setMeta, setSchedule, updateSession, type ExerciseInput } from '../draft';
import { validateDraft } from '../programRules';

const seq = (v: string) => () => v;
const exo = (name: string): ExerciseInput =>
  ({ name, scheme: '3×10', sets: 3, timed: false, load: null, restSec: 90, cue: null, alternatives: [] }) as ExerciseInput;

function validDraft() {
  const { draft, key } = addSession(setMeta(newDraft(), { label: 'PROG' }), 'lift', seq('aaaa'));
  return { draft: setSchedule(updateSession(draft, key, { name: 'FULL' }), 1, key), key };
}

describe('validateDraft', () => {
  it('brouillon vide : nom, séance et planning manquants, avec leur étape', () => {
    const r = validateDraft(newDraft());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => [e.step, e.code])).toEqual([[1, 'name_required'], [2, 'no_session'], [3, 'no_schedule']]);
  });

  it('séance sans nom → étape 4 avec sa clé', () => {
    const { draft, key } = validDraft();
    const r = validateDraft(updateSession(draft, key, { name: '  ' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual([{ step: 4, code: 'session_name_required', sessionKey: key }]);
  });

  it('brouillon valide → programme normalisé', () => {
    const { draft, key } = validDraft();
    const r = validateDraft(addExercise(draft, key, 'main', exo('Squat'), seq('bbbb')).draft);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.program.sessions[key].exercises[0]).toMatchObject({ id: 'squat-bbbb', name: 'Squat' });
  });

  it('erreur de schéma dans un exercice → étape 4 de la séance concernée', () => {
    const { draft, key } = validDraft();
    const withBad = addExercise(draft, key, 'main', exo('   '), seq('cccc')).draft;
    const r = validateDraft(withBad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({ step: 4, code: 'schema', sessionKey: key });
      expect(r.errors[0].detail).toContain('exercises');
    }
  });
});
