// L'écran de lancement reste affiché jusqu'à ce que l'interface thémée soit prête (pas de flash blanc)
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()), preventAutoHideAsync: jest.fn(() => Promise.resolve()) }));

import { render } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { HideSplashWhenReady } from '../SplashGate';

describe('HideSplashWhenReady', () => {
  it('masque l\'écran de lancement une fois monté (interface prête), une seule fois', async () => {
    const { rerender } = await render(<HideSplashWhenReady />);
    await rerender(<HideSplashWhenReady />);
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });
});
