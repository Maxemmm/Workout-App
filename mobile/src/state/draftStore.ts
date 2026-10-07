// ============================================================
// Brouillon de l'éditeur (Zustand) — recopié dans settings.programDraft
// à chaque modification : il survit à l'arrêt de l'app.
// ============================================================
import { create } from 'zustand';
import { deleteSetting, getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { restoreDraft, type Draft } from '@/domain/draft';

interface DraftState {
  draft: Draft | null;
  /** Un brouillon illisible a été effacé au démarrage (message à afficher une fois) */
  lost: boolean;
  hydrate(ctx: RepoCtx): void;
  start(ctx: RepoCtx, draft: Draft): void;
  apply(ctx: RepoCtx, op: (d: Draft) => Draft): void;
  discard(ctx: RepoCtx): void;
  ackLost(): void;
}

export const DRAFT_INITIAL = { draft: null, lost: false };

export const useDraftStore = create<DraftState>((set, get) => ({
  ...DRAFT_INITIAL,
  hydrate: (ctx) => {
    const raw = getSetting(ctx, 'programDraft');
    if (raw === undefined) {
      set({ draft: null });
      return;
    }
    const draft = restoreDraft(raw);
    if (!draft) {
      deleteSetting(ctx, 'programDraft');
      set({ draft: null, lost: true });
      return;
    }
    set({ draft });
  },
  start: (ctx, draft) => {
    setSetting(ctx, 'programDraft', draft);
    set({ draft });
  },
  apply: (ctx, op) => {
    const current = get().draft;
    if (!current) return;
    const draft = op(current);
    setSetting(ctx, 'programDraft', draft);
    set({ draft });
  },
  discard: (ctx) => {
    deleteSetting(ctx, 'programDraft');
    set({ draft: null });
  },
  ackLost: () => set({ lost: false }),
}));
