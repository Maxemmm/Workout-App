// Écran allumé pendant la séance (expo-keep-awake gère aussi le web via Wake Lock)
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { KeepAwake } from './types';

const TAG = 'today-session';

export const keepAwake: KeepAwake = {
  activate: () => { activateKeepAwakeAsync(TAG).catch(() => {}); },
  deactivate: () => {
    try {
      deactivateKeepAwake(TAG);
    } catch { /* déjà inactif */ }
  },
};
