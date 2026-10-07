/** Garde + écran d'onboarding */
import { act, fireEvent, screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { createProgram, getActiveProgram } from '@/db/repos/programsRepo';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { needsOnboarding } from '../needsOnboarding';
import { OnboardingScreen } from '../OnboardingScreen';

describe('needsOnboarding', () => {
  it('vrai seulement sans programme et sans onboarded', () => {
    const ctx = createTestCtx();
    expect(needsOnboarding(ctx)).toBe(true);
    setSetting(ctx, 'onboarded', true);
    expect(needsOnboarding(ctx)).toBe(false);
    const other = createTestCtx();
    createProgram(other, example, 'example');
    expect(needsOnboarding(other)).toBe(false);
  });
});

describe('OnboardingScreen', () => {
  beforeEach(async () => {
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useDraftStore.setState(DRAFT_INITIAL); });
  });

  async function setup() {
    const ctx = createTestCtx();
    const props = { onCreate: jest.fn(), onImport: jest.fn(), onStarted: jest.fn() };
    await renderWithProviders(<OnboardingScreen {...props} />, { ctx });
    return { ctx, props };
  }

  it('créer : brouillon neuf puis éditeur', async () => {
    const { props } = await setup();
    expect(screen.getByText('Entraîne-toi avec intention.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER MON PROGRAMME' }));
    expect(useDraftStore.getState().draft?.sourceProgramId).toBeNull();
    expect(props.onCreate).toHaveBeenCalled();
  });

  it('importer', async () => {
    const { props } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Importer un fichier JSON' }));
    expect(props.onImport).toHaveBeenCalled();
  });

  it('programme exemple : chargé, actif, onboarded', async () => {
    const { ctx, props } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Essayer avec le programme exemple' }));
    expect(getActiveProgram(ctx)?.definition.meta.label).toBe('PROGRAMME SALLE');
    expect(getSetting(ctx, 'onboarded')).toBe(true);
    expect(props.onStarted).toHaveBeenCalled();
  });

  it('langue appliquée immédiatement', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'EN' }));
    // La racine de l'app relit usePrefs.lang pour I18nProvider : on vérifie le store
    expect(usePrefs.getState().lang).toBe('en');
  });
});
