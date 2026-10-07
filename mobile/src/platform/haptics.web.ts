// Web : vibration si le navigateur la supporte (motifs de la PWA)
import type { Haptics } from './types';

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch { /* navigateur sans vibration */ }
}

export const haptics: Haptics = {
  light: () => vibrate(15),
  success: () => vibrate([280, 90, 280, 90, 280]),
  warning: () => vibrate(120),
};
