// ============================================================
// Capacités natives — une interface par capacité (spec §5.2).
// Implémentation par plateforme via les extensions de fichier.
// ============================================================
export interface Haptics {
  light(): void;
  success(): void;
  warning(): void;
}

export interface KeepAwake {
  activate(): void;
  deactivate(): void;
}

export interface Sound {
  /** Deux bips de fin de minuteur */
  playRestDone(): void;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

export type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

/** Résultat du choix d'un fichier JSON à importer */
export type PickedFile = { kind: 'ok'; text: string } | { kind: 'cancel' } | { kind: 'too_large' } | { kind: 'error' };

/** Issue d'un partage de fichier. iOS/Android ne signalent pas l'annulation : 'shared' dès que la feuille se ferme sans erreur */
export type ShareResult = 'shared' | 'cancelled';
