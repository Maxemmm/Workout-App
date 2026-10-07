// Navigation de l'éditeur — fournie par les routes (Expo Router) ou par les tests
export type EditorStep = 1 | 2 | 3;

export interface EditorNav {
  goToStep(step: EditorStep): void;
  openSession(key: string): void;
  closeSession(): void;
  /** Sortie de l'éditeur (après enregistrement ou annulation) → Plan */
  finish(): void;
}
