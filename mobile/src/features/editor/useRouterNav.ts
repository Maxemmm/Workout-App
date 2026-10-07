// Navigation réelle de l'éditeur (Expo Router) — fonctions de module, donc stables
import { router } from 'expo-router';
import type { EditorNav, EditorStep } from './nav';

const STEP_ROUTES = { 1: '/editor/meta', 2: '/editor/sessions', 3: '/editor/schedule' } as const;

const NAV: EditorNav = {
  goToStep: (step: EditorStep) => router.navigate(STEP_ROUTES[step]),
  openSession: (key) => router.push({ pathname: '/editor/session/[key]', params: { key } }),
  closeSession: () => router.back(),
  finish: () => router.dismissTo('/plan'),
};

export function useRouterNav(): EditorNav {
  return NAV;
}
