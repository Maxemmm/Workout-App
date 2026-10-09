// ============================================================
// Brouillon de l'éditeur (Zustand) — recopié dans settings.programDraft
// à chaque modification : il survit à l'arrêt de l'app.
// Ouvrir l'éditeur ne crée pas de brouillon « visible » : il n'est enregistré (et signalé
// par le bandeau de Plan, les confirmations d'abandon) qu'après une vraie modification.
// ============================================================
import { create } from 'zustand';
import { deleteSetting, getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { restoreDraft, type Draft } from '@/domain/draft';

interface DraftState {
  draft: Draft | null;
  /** Le brouillon a été modifié depuis l'ouverture de l'éditeur */
  dirty: boolean;
  /** Un brouillon illisible a été effacé au démarrage (message à afficher une fois) */
  lost: boolean;
  hydrate(ctx: RepoCtx): void;
  start(ctx: RepoCtx, draft: Draft): void;
  apply(ctx: RepoCtx, op: (d: Draft) => Draft): void;
  discard(ctx: RepoCtx): void;
  ackLost(): void;
}

export const DRAFT_INITIAL = { draft: null, dirty: false, lost: false };

export const useDraftStore = create<DraftState>((set, get) => ({
  ...DRAFT_INITIAL,
  hydrate: (ctx) => {
    const raw = getSetting(ctx, 'programDraft');
    if (raw === undefined) {
      set({ draft: null, dirty: false });
      return;
    }
    const draft = restoreDraft(raw);
    if (!draft) {
      deleteSetting(ctx, 'programDraft');
      set({ draft: null, dirty: false, lost: true });
      return;
    }
    // Seul un brouillon modifié est enregistré : celui qu'on relit l'est donc
    set({ draft, dirty: true });
  },
  start: (ctx, draft) => {
    // Pas encore modifié : rien à conserver (un ancien brouillon est remplacé)
    deleteSetting(ctx, 'programDraft');
    set({ draft, dirty: false });
  },
  apply: (ctx, op) => {
    const current = get().draft;
    if (!current) return;
    const draft = op(current);
    if (JSON.stringify(draft) === JSON.stringify(current)) return;
    setSetting(ctx, 'programDraft', draft);
    set({ draft, dirty: true });
  },
  discard: (ctx) => {
    deleteSetting(ctx, 'programDraft');
    set({ draft: null, dirty: false });
  },
  ackLost: () => set({ lost: false }),
}));
