/** @jest-environment node */
import example from '@/data/program.example.json';
import { createProgram } from '@/db/repos/programsRepo';
import { setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { setMeta } from '@/domain/draft';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { prepareEditor } from '../openEditor';

describe('prepareEditor', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('nouveau programme : brouillon vide', async () => {
    const ctx = createTestCtx();
    expect(await prepareEditor(ctx, { kind: 'new' }, jest.fn())).toBe(true);
    expect(useDraftStore.getState().draft?.sourceProgramId).toBeNull();
  });

  it('modifier : copie du programme ; même cible → reprise sans confirmation', async () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    const ask = jest.fn();
    await prepareEditor(ctx, { kind: 'edit', programId: p.id }, ask);
    useDraftStore.getState().apply(ctx, (d) => setMeta(d, { label: 'EN COURS' }));
    expect(await prepareEditor(ctx, { kind: 'edit', programId: p.id }, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
    expect(useDraftStore.getState().draft?.program.meta.label).toBe('EN COURS');
  });

  it('autre cible : confirmation ; refus → brouillon conservé', async () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    await prepareEditor(ctx, { kind: 'new' }, jest.fn());
    useDraftStore.getState().apply(ctx, (d) => setMeta(d, { label: 'NEUF' }));
    expect(await prepareEditor(ctx, { kind: 'edit', programId: p.id }, async () => false)).toBe(false);
    expect(useDraftStore.getState().draft?.program.meta.label).toBe('NEUF');
    expect(await prepareEditor(ctx, { kind: 'edit', programId: p.id }, async () => true)).toBe(true);
    expect(useDraftStore.getState().draft?.sourceProgramId).toBe(p.id);
  });

  it('nouveau programme : unité du réglage defaultUnits (kg par défaut)', async () => {
    const ctx = createTestCtx();
    await prepareEditor(ctx, { kind: 'new' }, jest.fn());
    expect(useDraftStore.getState().draft?.program.meta.units).toBe('kg');
    useDraftStore.setState(DRAFT_INITIAL);
    setSetting(ctx, 'defaultUnits', 'lbs');
    await prepareEditor(ctx, { kind: 'new' }, jest.fn());
    expect(useDraftStore.getState().draft?.program.meta.units).toBe('lbs');
  });

  it('programme introuvable → false', async () => {
    expect(await prepareEditor(createTestCtx(), { kind: 'edit', programId: 'nope' }, jest.fn())).toBe(false);
  });
});
