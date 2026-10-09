// Masque l'écran de lancement seulement quand l'interface thémée est montée
// (après polices, migrations et préférences) : pas de flash blanc au démarrage.
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

export function HideSplashWhenReady() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return null;
}
