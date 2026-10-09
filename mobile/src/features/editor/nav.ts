// Navigation de l'éditeur — fournie par les routes (Expo Router) ou par les tests
export type EditorStep = 1 | 2 | 3;

export interface EditorNav {
  /** from : étape affichée. Avancer empile (retour possible), reculer revient à l'écran ouvert */
  goToStep(step: EditorStep, from?: EditorStep): void;
  openSession(key: string): void;
  closeSession(): void;
  /** Sortie de l'éditeur (après enregistrement ou annulation) → Plan */
  finish(): void;
}
