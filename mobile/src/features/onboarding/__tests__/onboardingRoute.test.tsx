/** Garde inverse : une fois l'onboarding fait, la route ne réaffiche jamais l'écran
 *  (ex. bouton retour Android depuis Today quand l'onboarding est resté dans la pile) */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Redirect: jest.fn(() => null),
}));

import { act, screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import OnboardingRoute from '@/app/onboarding';
import { setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';

describe('route onboarding', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); });
  });

  it('premier lancement : affiche l\'onboarding', async () => {
    await renderWithProviders(<OnboardingRoute />, { ctx: createTestCtx() });
    expect(Redirect).not.toHaveBeenCalled();
    expect(screen.getByText('CRÉER MON PROGRAMME')).toBeTruthy();
  });

  it('déjà onboardé : redirige vers Today sans afficher l\'écran', async () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'onboarded', true);
    await renderWithProviders(<OnboardingRoute />, { ctx });
    expect(Redirect).toHaveBeenCalledWith(expect.objectContaining({ href: '/today' }), undefined);
    expect(screen.queryByText('CRÉER MON PROGRAMME')).toBeNull();
  });
});
