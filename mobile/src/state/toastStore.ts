// Message bref en bas d'écran (confirmation, erreur d'écriture)
import { create } from 'zustand';

interface ToastState {
  message: string | null;
  /** Incrémenté à chaque message : relance le délai d'affichage */
  seq: number;
  show(message: string): void;
  hide(): void;
}

export const TOAST_INITIAL = { message: null, seq: 0 };

export const useToastStore = create<ToastState>((set) => ({
  ...TOAST_INITIAL,
  show: (message) => set((s) => ({ message, seq: s.seq + 1 })),
  hide: () => set({ message: null }),
}));
