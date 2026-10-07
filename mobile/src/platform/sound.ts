// Son de fin de minuteur — se mêle à la musique, coupé par le mode silencieux iOS
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { Sound } from './types';

let player: AudioPlayer | null = null;
let modeReady: Promise<void> | null = null;

/** Mode audio appliqué une seule fois, et toujours avant de jouer (sinon le 1er bip peut couper la musique) */
function ensureAudioMode(): Promise<void> {
  modeReady ??= setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  return modeReady;
}

function getPlayer(): AudioPlayer {
  player ??= createAudioPlayer(require('../../assets/sounds/rest-done.wav'));
  return player;
}

export const sound: Sound = {
  playRestDone: () => {
    ensureAudioMode()
      .then(() => {
        const p = getPlayer();
        p.seekTo(0).catch(() => {});
        p.play();
      })
      .catch(() => { /* audio indisponible */ });
  },
};
