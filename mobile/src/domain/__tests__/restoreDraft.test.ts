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
