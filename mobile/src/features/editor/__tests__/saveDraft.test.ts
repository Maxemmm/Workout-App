/** @jest-environment node */
import example from '@/data/program.example.json';
import { createProgram, getActiveProgram, getProgram, listPrograms, setActiveProgram, softDeleteProgram } from '@/db/repos/programsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { addSession, draftFromProgram, newDraft, setMeta, setSchedule, updateSession } from '@/domain/draft';
import { saveDraft } from '../saveDraft';

function validNew() {
  const { draft, key } = addSession(setMeta(newDraft(), { label: 'NEUF' }), 'lift', () => 'aaaa');
  return setSchedule(updateSession(draft, key, { name: 'FULL' }), 1, key);
}

describe('saveDraft', () => {
  it("brouillon invalide : rien n'est écrit", () => {
    const ctx = createTestCtx();
    const r = saveDraft(ctx, newDraft());
    expect(r.ok).toBe(false);
    expect(listPrograms(ctx)).toEqual([]);
  });

  it('nouveau programme : créé (source manual) et activé', () => {
    const ctx = createTestCtx();
    const r = saveDraft(ctx, validNew());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(getProgram(ctx, r.programId)).toMatchObject({ source: 'manual', definition: { meta: { label: 'NEUF' } } });
      expect(getActiveProgram(ctx)?.id).toBe(r.programId);
    }
  });

  it('programme existant : mis à jour, programme actif inchangé', () => {
    const ctx = createTestCtx();
    const a = createProgram(ctx, example, 'example');
    const b = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, a.id);
    const r = saveDraft(ctx, setMeta(draftFromProgram(b.id, b.definition), { label: 'B2' }));
    expect(r).toEqual({ ok: true, programId: b.id });
    expect(getProgram(ctx, b.id)?.definition.meta.label).toBe('B2');
    expect(getActiveProgram(ctx)?.id).toBe(a.id);
  });

  it('Review Focus 3 : programme source supprimé entre-temps → enregistré comme nouveau et activé', () => {
    const ctx = createTestCtx();
    const a = createProgram(ctx, example, 'example');
    const draft = setMeta(draftFromProgram(a.id, a.definition), { label: 'SURVIVANT' });
    softDeleteProgram(ctx, a.id);
    const r = saveDraft(ctx, draft);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.programId).not.toBe(a.id);
      expect(getActiveProgram(ctx)?.definition.meta.label).toBe('SURVIVANT');
    }
  });
});
