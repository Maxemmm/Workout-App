// Son de fin de minuteur — se mêle à la musique, coupé par le mode silencieux iOS
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { Sound } from './types';

let player: AudioPlayer | null = null;

function getPlayer(): AudioPlayer {
  if (!player) {
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    player = createAudioPlayer(require('../../assets/sounds/rest-done.wav'));
  }
  return player;
}

export const sound: Sound = {
  playRestDone: () => {
    try {
      const p = getPlayer();
      p.seekTo(0).catch(() => {});
      p.play();
    } catch { /* audio indisponible */ }
  },
};
