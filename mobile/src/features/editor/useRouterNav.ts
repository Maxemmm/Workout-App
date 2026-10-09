// Navigation réelle de l'éditeur (Expo Router) — fonctions de module, donc stables.
// Avancer d'une étape empile l'écran (animation « avancer », geste retour possible) ;
// reculer utilise dismissTo (POP_TO) : retour à l'écran déjà ouvert, animation « reculer »,
// et la pile ne grossit pas au fil des allers-retours. Sans étape d'origine connue : dismissTo.
import { router } from 'expo-router';
import type { EditorNav, EditorStep } from './nav';

const STEP_ROUTES = { 1: '/editor/meta', 2: '/editor/sessions', 3: '/editor/schedule' } as const;

const NAV: EditorNav = {
  goToStep: (step: EditorStep, from?: EditorStep) =>
    (from !== undefined && step > from ? router.push(STEP_ROUTES[step]) : router.dismissTo(STEP_ROUTES[step])),
  openSession: (key) => router.push({ pathname: '/editor/session/[key]', params: { key } }),
  closeSession: () => router.dismissTo('/editor/sessions'),
  finish: () => router.dismissTo('/plan'),
};

export function useRouterNav(): EditorNav {
  return NAV;
}
