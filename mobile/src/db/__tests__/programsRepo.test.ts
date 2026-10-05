/** @jest-environment node */
import example from '@/data/program.example.json';
import { programs } from '../schema';
import {
  createProgram, getActiveProgram, getProgram, listPrograms,
  ProgramValidationError, setActiveProgram, softDeleteProgram,
} from '../repos/programsRepo';
import { getSetting } from '../repos/settingsRepo';
import { createTestCtx } from '../testing/createTestCtx';

describe('programsRepo', () => {
  it('crée et relit un programme validé', () => {
    const ctx = createTestCtx();
    const created = createProgram(ctx, example, 'example');
    expect(created.definition.meta.label).toBe('PROGRAMME SALLE');
    expect(getProgram(ctx, created.id)).toEqual(created);
  });

  it('refuse un programme invalide sans rien écrire', () => {
    const ctx = createTestCtx();
    expect(() => createProgram(ctx, { meta: {} }, 'manual')).toThrow(ProgramValidationError);
    expect(listPrograms(ctx)).toEqual([]);
  });

  it('liste par date de création et exclut les supprimés', () => {
    const ctx = createTestCtx();
    const a = createProgram(ctx, example, 'example');
    ctx.advance(1000);
    const b = createProgram(ctx, example, 'import');
    expect(listPrograms(ctx).map((p) => p.id)).toEqual([a.id, b.id]);
    softDeleteProgram(ctx, a.id);
    expect(listPrograms(ctx).map((p) => p.id)).toEqual([b.id]);
    expect(getProgram(ctx, a.id)).toBeNull();
  });

  it('suppression logique : met à jour deleted_at et updated_at', () => {
    const ctx = createTestCtx();
    const a = createProgram(ctx, example, 'example');
    ctx.advance(5000);
    softDeleteProgram(ctx, a.id);
    const row = ctx.sqlite.prepare('SELECT deleted_at, updated_at FROM programs WHERE id = ?').get(a.id) as { deleted_at: string; updated_at: string };
    expect(row.deleted_at).toBe(ctx.now());
    expect(row.updated_at).toBe(ctx.now());
  });

  it('ignore une ligne corrompue au lieu de planter', () => {
    const ctx = createTestCtx();
    const now = ctx.now();
    ctx.db.insert(programs).values({ id: 'bad', createdAt: now, updatedAt: now, definition: '{oups', source: 'manual' }).run();
    ctx.db.insert(programs).values({ id: 'invalid', createdAt: now, updatedAt: now, definition: '{"meta":{}}', source: 'manual' }).run();
    const ok = createProgram(ctx, example, 'example');
    expect(listPrograms(ctx).map((p) => p.id)).toEqual([ok.id]);
    expect(getProgram(ctx, 'bad')).toBeNull();
  });

  describe('programme actif', () => {
    it('retourne null sans programme', () => {
      expect(getActiveProgram(createTestCtx())).toBeNull();
    });

    it('retourne le programme désigné', () => {
      const ctx = createTestCtx();
      createProgram(ctx, example, 'example');
      const b = createProgram(ctx, example, 'import');
      setActiveProgram(ctx, b.id);
      expect(getActiveProgram(ctx)?.id).toBe(b.id);
    });

    it('retombe sur le premier programme si le programme actif a été supprimé, et le mémorise', () => {
      const ctx = createTestCtx();
      const a = createProgram(ctx, example, 'example');
      ctx.advance(1000);
      const b = createProgram(ctx, example, 'import');
      setActiveProgram(ctx, b.id);
      softDeleteProgram(ctx, b.id);
      expect(getActiveProgram(ctx)?.id).toBe(a.id);
      expect(getSetting(ctx, 'activeProgramId')).toBe(a.id);
    });

    it("efface le réglage s'il ne reste aucun programme", () => {
      const ctx = createTestCtx();
      const a = createProgram(ctx, example, 'example');
      setActiveProgram(ctx, a.id);
      softDeleteProgram(ctx, a.id);
      expect(getActiveProgram(ctx)).toBeNull();
      expect(getSetting(ctx, 'activeProgramId')).toBeUndefined();
    });
  });
});
