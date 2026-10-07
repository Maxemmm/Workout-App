// Le vrai module sound (mocké ailleurs) : le mode audio « mixWithOthers » doit être appliqué AVANT le premier bip,
// sinon le premier bip peut couper la musique de l'utilisateur.
jest.unmock('@/platform/sound');

const order: string[] = [];
let resolveMode: () => void = () => {};

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => {
    order.push('mode:requested');
    return new Promise<void>((resolve) => {
      resolveMode = () => { order.push('mode:applied'); resolve(); };
    });
  }),
  createAudioPlayer: jest.fn(() => ({
    seekTo: jest.fn(() => Promise.resolve()),
    play: jest.fn(() => { order.push('play'); }),
  })),
}));

describe('sound', () => {
  it('attend que le mode audio soit appliqué avant de jouer le premier bip', async () => {
    const { sound } = require('../sound') as typeof import('../sound');
    sound.playRestDone();
    await Promise.resolve();
    expect(order).not.toContain('play');
    resolveMode();
    await new Promise((r) => setTimeout(r, 0));
    expect(order).toEqual(['mode:requested', 'mode:applied', 'play']);
  });
});
