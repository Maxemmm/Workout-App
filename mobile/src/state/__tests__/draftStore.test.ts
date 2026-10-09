/** @jest-environment node */
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { settings } from '@/db/schema';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { newDraft, setMeta } from '@/domain/draft';
import { DRAFT_INITIAL, useDraftStore } from '../draftStore';

describe('draftStore', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('start / apply persistent dans settings.programDraft ; discard efface', () => {
    const ctx = createTestCtx();
    useDraftStore.getState().start(ctx, newDraft());
    useDraftStore.getState().apply(ctx, (d) => setMeta(d, { label: 'P' }));
    expect(useDraftStore.getState().draft?.program.meta.label).toBe('P');
    expect(getSetting(ctx, 'programDraft')?.program.meta.label).toBe('P');
    useDraftStore.getState().discard(ctx);
    expect(useDraftStore.getState().draft).toBeNull();
    expect(getSetting(ctx, 'programDraft')).toBeUndefined();
  });

  it('apply sans brouillon : sans effet', () => {
    const ctx = createTestCtx();
    useDraftStore.getState().apply(ctx, (d) => setMeta(d, { label: 'P' }));
    expect(useDraftStore.getState().draft).toBeNull();
  });

  it('hydrate relit un brouillon ; un brouillon corrompu est effacé et signalé', () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'programDraft', setMeta(newDraft(), { label: 'X' }));
    useDraftStore.getState().hydrate(ctx);
    expect(useDraftStore.getState()).toMatchObject({ draft: { program: { meta: { label: 'X' } } }, lost: false });

    ctx.db.update(settings).set({ value: '{"sourceProgramId":null,"program":{"sessions":[]}}' }).run();
    useDraftStore.getState().hydrate(ctx);
    expect(useDraftStore.getState()).toMatchObject({ draft: null, lost: true });
    expect(getSetting(ctx, 'programDraft')).toBeUndefined();
    useDraftStore.getState().ackLost();
    expect(useDraftStore.getState().lost).toBe(false);
  });
});

describe('draftStore — brouillon modifié ou non', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('ouvrir l\'éditeur ne crée pas de brouillon visible : non modifié, non enregistré (et remplace un ancien)', () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'programDraft', setMeta(newDraft(), { label: 'ANCIEN' }));
    useDraftStore.getState().start(ctx, newDraft());
    expect(useDraftStore.getState().dirty).toBe(false);
    expect(getSetting(ctx, 'programDraft')).toBeUndefined();
  });

  it('une vraie modification le rend « modifié » et l\'enregistre ; une opération sans effet non', () => {
    const ctx = createTestCtx();
    useDraftStore.getState().start(ctx, newDraft());
    useDraftStore.getState().apply(ctx, (d) => setMeta(d, { units: 'kg' })); // déjà kg
    expect(useDraftStore.getState().dirty).toBe(false);
    expect(getSetting(ctx, 'programDraft')).toBeUndefined();
    useDraftStore.getState().apply(ctx, (d) => setMeta(d, { label: 'P' }));
    expect(useDraftStore.getState().dirty).toBe(true);
    expect(getSetting(ctx, 'programDraft')?.program.meta.label).toBe('P');
  });

  it('un brouillon relu au démarrage est « modifié » (il n\'est enregistré qu\'après une modification)', () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'programDraft', setMeta(newDraft(), { label: 'X' }));
    useDraftStore.getState().hydrate(ctx);
    expect(useDraftStore.getState().dirty).toBe(true);
    useDraftStore.getState().discard(ctx);
    expect(useDraftStore.getState().dirty).toBe(false);
  });
});
