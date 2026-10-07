import { EMPTY_LAYOUT, effectiveExercise, effectiveSession, findAlternative, weightKey } from '../exerciseView';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '../__fixtures__/builders';

const program = parseOrThrow(makeProgramInput({ '1': 'a' }, {
  a: makeSession('A', [
    makeExercise('presse', 4, {
      name: 'Presse', scheme: '4×8', load: '100 kg', restSec: 120, cue: 'Dos plaqué',
      alternatives: ['Squat guidé', { name: 'Fentes', sets: 3, scheme: '3×12', load: '10 kg', restSec: 0 }],
    }),
    makeExercise('curl', 3),
    makeExercise('dips', 3),
  ], { bonus: { title: 'BONUS', exercises: [makeExercise('abdos', 2, { alternatives: ['Planche'] })] } }),
}));
const session = program.sessions.a;
const presse = session.exercises[0];

describe('effectiveExercise', () => {
  it('sans échange : exercice inchangé', () => {
    const e = effectiveExercise(presse, null);
    expect(e).toMatchObject({ id: 'presse', name: 'Presse', sets: 4, performedName: null, originalName: 'Presse', cue: 'Dos plaqué' });
  });

  it('alternative chaîne : seul le nom change, la consigne est retirée', () => {
    const e = effectiveExercise(presse, 'Squat guidé');
    expect(e).toMatchObject({ id: 'presse', name: 'Squat guidé', sets: 4, scheme: '4×8', load: '100 kg', restSec: 120, performedName: 'Squat guidé', originalName: 'Presse', cue: null });
  });

  it('alternative objet : surcharge sets/scheme/load/restSec (0 conservé)', () => {
    const e = effectiveExercise(presse, 'Fentes');
    expect(e).toMatchObject({ name: 'Fentes', sets: 3, scheme: '3×12', load: '10 kg', restSec: 0, performedName: 'Fentes' });
    expect(e.alternatives).toEqual(presse.alternatives);
  });

  it('alternative inconnue (supprimée du programme) : ignorée', () => {
    expect(effectiveExercise(presse, 'Disparue')).toMatchObject({ name: 'Presse', performedName: null });
  });

  it('findAlternative par nom', () => {
    expect(findAlternative(presse, 'Fentes')).toMatchObject({ name: 'Fentes' });
    expect(findAlternative(presse, 'Nope')).toBeUndefined();
  });
});

describe('weightKey', () => {
  it("id seul pour l'original, id::nom pour une alternative", () => {
    expect(weightKey('presse', null)).toBe('presse');
    expect(weightKey('presse', 'Fentes')).toBe('presse::Fentes');
  });
});

describe('effectiveSession', () => {
  it('sans layout : ordre du programme, bonus séparés', () => {
    const s = effectiveSession(session, EMPTY_LAYOUT);
    expect(s.exercises.map((e) => e.id)).toEqual(['presse', 'curl', 'dips']);
    expect(s.bonus.map((e) => e.id)).toEqual(['abdos']);
  });

  it('applique ordre et échanges ; ids inconnus ignorés, nouveaux exercices en fin', () => {
    const s = effectiveSession(session, { order: ['dips', 'fantome', 'presse'], swaps: { presse: 'Fentes', abdos: 'Planche', fantome: 'X' } });
    expect(s.exercises.map((e) => e.id)).toEqual(['dips', 'presse', 'curl']);
    expect(s.exercises[1].name).toBe('Fentes');
    expect(s.bonus[0].name).toBe('Planche');
  });
});
