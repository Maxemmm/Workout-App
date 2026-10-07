// Navigation réelle de l'éditeur (Expo Router) — fonctions de module, donc stables.
// dismissTo (POP_TO) revient à l'écran s'il est déjà dans la pile, sinon remplace l'écran courant :
// la pile de l'éditeur ne grossit pas au fil des allers-retours entre étapes.
import { router } from 'expo-router';
import type { EditorNav, EditorStep } from './nav';

const STEP_ROUTES = { 1: '/editor/meta', 2: '/editor/sessions', 3: '/editor/schedule' } as const;

const NAV: EditorNav = {
  goToStep: (step: EditorStep) => router.dismissTo(STEP_ROUTES[step]),
  openSession: (key) => router.push({ pathname: '/editor/session/[key]', params: { key } }),
  closeSession: () => router.dismissTo('/editor/sessions'),
  finish: () => router.dismissTo('/plan'),
};

export function useRouterNav(): EditorNav {
  return NAV;
}
