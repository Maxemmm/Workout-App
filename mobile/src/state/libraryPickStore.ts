// Sélection d'un exercice de la bibliothèque depuis l'éditeur (route /editor/library ↔ écran de séance)
import { create } from 'zustand';
import type { ExerciseInput, ExerciseSection } from '@/domain/draft';

export type PickRequest = { sessionKey: string; section: ExerciseSection; form: ExerciseInput | null; exerciseId: string | null };
/** Entrée choisie ; null = « Exercice libre » ; 'cancel' = sélecteur annulé (formulaire en cours rendu tel quel) */
export type PickResult = { libraryId: string; name: string } | null | 'cancel';

interface State {
  request: PickRequest | null;
  /** undefined = pas encore de réponse */
  result: PickResult | undefined;
  start(req: PickRequest): void;
  resolve(r: PickResult): void;
  consume(): { request: PickRequest; result: PickResult } | null;
  cancel(): void;
}

export const LIBRARY_PICK_INITIAL = { request: null, result: undefined };

export const useLibraryPickStore = create<State>((set, get) => ({
  ...LIBRARY_PICK_INITIAL,
  start: (request) => set({ request, result: undefined }),
  resolve: (result) => set({ result }),
  consume: () => {
    const { request, result } = get();
    if (!request || result === undefined) return null;
    set(LIBRARY_PICK_INITIAL);
    return { request, result };
  },
  cancel: () => set(LIBRARY_PICK_INITIAL),
}));
