// Version affichée dans Profil › À propos (app.json → expo.version)
import Constants from 'expo-constants';

export function appVersion(): string {
  return Constants.expoConfig?.version ?? '?';
}
