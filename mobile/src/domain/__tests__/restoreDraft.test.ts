import { addSession, newDraft, restoreDraft } from '../draft';

describe('restoreDraft', () => {
  it('relit un brouillon valide (y compris JSON aller-retour)', () => {
    const d = addSession(newDraft(), 'lift', () => 'aaaa').draft;
    expect(restoreDraft(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it('manualAccents absent (ancien format) → []', () => {
    const { manualAccents: _m, ...old } = newDraft();
    expect(restoreDraft(old)?.manualAccents).toEqual([]);
  });

  it('Review Focus 1 : contenu de séance invalide (exercices, bonus, cardio, conseils) → null', () => {
    const base = addSession(newDraft(), 'lift', () => 'aaaa').draft;
    const withSession = (patch: Record<string, unknown>) =>
      ({ ...base, program: { ...base.program, sessions: { 'lift-aaaa': { ...base.program.sessions['lift-aaaa'], ...patch } } } });
    expect(restoreDraft(withSession({ exercises: [null] }))).toBeNull();
    expect(restoreDraft(withSession({ exercises: [{ id: 'x' }] }))).toBeNull();
    expect(restoreDraft(withSession({ bonus: { exercises: 'x' } }))).toBeNull();
    expect(restoreDraft(withSession({ cardio: 'x' }))).toBeNull();
    expect(restoreDraft(withSession({ tips: [null] }))).toBeNull();
    expect(restoreDraft(withSession({ warmup: [3] }))).toBeNull();
    const ok = withSession({ exercises: [{ id: 'x', name: 'X', sets: 3, scheme: '3×8', alternatives: [] }], bonus: null, cardio: { label: 'Marche' } });
    expect(restoreDraft(ok)).not.toBeNull();
  });

  it('Review Focus 1 : formes invalides → null', () => {
    expect(restoreDraft(null)).toBeNull();
    expect(restoreDraft('x')).toBeNull();
    expect(restoreDraft({ sourceProgramId: null })).toBeNull();
    expect(restoreDraft({ sourceProgramId: 3, program: newDraft().program })).toBeNull();
    expect(restoreDraft({ sourceProgramId: null, program: { ...newDraft().program, sessions: [] } })).toBeNull();
    expect(restoreDraft({ sourceProgramId: null, program: { ...newDraft().program, meta: { label: 1 } } })).toBeNull();
    expect(restoreDraft({ sourceProgramId: null, program: { ...newDraft().program, sessions: { a: { type: 'lift', name: 'A' } } } })).toBeNull();
  });
});
