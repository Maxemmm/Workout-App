// Contrat de navigation de l'éditeur : revenir à une étape ou à la liste des séances
// remonte la pile (POP_TO) au lieu d'empiler un nouvel écran à chaque passage.
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() },
}));

import { router } from 'expo-router';
import { useRouterNav } from '../useRouterNav';

describe('useRouterNav', () => {
  beforeEach(() => jest.clearAllMocks());

  it('changer d\'étape revient à l\'écran déjà ouvert (dismissTo), sans empiler', () => {
    const nav = useRouterNav();
    nav.goToStep(1);
    nav.goToStep(2);
    nav.goToStep(3);
    expect(router.dismissTo).toHaveBeenNthCalledWith(1, '/editor/meta');
    expect(router.dismissTo).toHaveBeenNthCalledWith(2, '/editor/sessions');
    expect(router.dismissTo).toHaveBeenNthCalledWith(3, '/editor/schedule');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('fermer une séance revient à la liste des séances (étape 2), pas à l\'écran précédent', () => {
    useRouterNav().closeSession();
    expect(router.dismissTo).toHaveBeenCalledWith('/editor/sessions');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('ouvrir une séance empile son écran ; sortir revient à Plan', () => {
    const nav = useRouterNav();
    nav.openSession('s1');
    nav.finish();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/editor/session/[key]', params: { key: 's1' } });
    expect(router.dismissTo).toHaveBeenCalledWith('/plan');
  });
});
