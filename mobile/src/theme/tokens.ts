// ============================================================
// Design tokens — valeurs exactes de la PWA (index.html §1 / §1b)
// ============================================================
import type { ColorScheme } from '@/domain/prefs';

export interface Palette {
  bg: string; bgCard: string; bgCardSoft: string; bgElevated: string;
  text: string; textDim: string; textFaint: string;
  gold: string; goldDim: string; rust: string; blue: string;
  greenDone: string; redTimer: string; redDanger: string;
  border: string; borderActive: string;
  goldFill: string; rustFill: string; blueFill: string;
  /** Texte posé sur gold (boutons principaux, sélections) */
  onGold: string;
  /** Texte posé sur greenDone (carte complète, récapitulatif, fin de repos) */
  onDone: string;
}

export const palettes: Record<ColorScheme, Palette> = {
  dark: {
    bg: '#0a0a0a', bgCard: '#161616', bgCardSoft: '#1e1e1e', bgElevated: '#222222',
    text: '#f5f5f5', textDim: '#8a8a8a', textFaint: '#444444',
    gold: '#d4a23c', goldDim: '#8a6520', rust: '#c4561f', blue: '#5b9bd5',
    greenDone: '#2e7d4f', redTimer: '#d23a3a', redDanger: '#a02020',
    border: '#2a2a2a', borderActive: '#d4a23c',
    goldFill: '#d4a23c', rustFill: '#c4561f', blueFill: '#5b9bd5',
    onGold: '#0a0a0a', onDone: '#ffffff',
  },
  light: {
    bg: '#f4f1ec', bgCard: '#ffffff', bgCardSoft: '#ede9e2', bgElevated: '#e5e0d8',
    text: '#1c1a17', textDim: '#6b6560', textFaint: '#b5aea5',
    gold: '#9a6b08', goldDim: '#c9a852', rust: '#b54518', blue: '#2e6fa8',
    greenDone: '#2f7a48', redTimer: '#c02828', redDanger: '#a01818',
    border: '#ddd8d0', borderActive: '#a07010',
    goldFill: '#d4920c', rustFill: '#c84018', blueFill: '#4a88c8',
    onGold: '#ffffff', onDone: '#ffffff',
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 20, xl: 28, xxl: 40 } as const;
export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;
export const duration = { fast: 150, normal: 250, slow: 300 } as const;
/** Noms de police tels qu'enregistrés par useFonts (app/_layout.tsx) */
export const fonts = {
  display: 'BarlowCondensed_800ExtraBold',
  ui: 'DMSans_400Regular',
  uiMedium: 'DMSans_500Medium',
  uiBold: 'DMSans_700Bold',
} as const;
/** Cible tactile minimale (pt) */
export const TOUCH_MIN = 44;
