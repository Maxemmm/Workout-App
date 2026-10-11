import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { readAssetText } from '@/platform/assetText';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Illustration } from '../Illustration';
import { findLibraryItem, libraryItems } from '../libraryData';

const custom = { id: 'abc', name: 'Mon exo', primary: 'quads' as const, secondary: [], equipment: 'machine' as const, steps: null };

describe('libraryData', () => {
  it('catalogue + personnalisés ; ids custom: ; badge custom', () => {
    const items = libraryItems([custom], 'fr');
    expect(items.length).toBeGreaterThan(1324);
    expect(items.find((i) => i.id === 'custom:abc')).toMatchObject({ name: 'Mon exo', custom: true });
  });

  it('Review Focus 4 : langue → nom, autre langue en altName ; instructions de la langue', () => {
    const fr = findLibraryItem('ds:0001', [], 'fr')!;
    const en = findLibraryItem('ds:0001', [], 'en')!;
    expect(en.name).toBe(fr.altName);
    expect(fr.steps?.length).toBeGreaterThan(0);
    expect(fr.steps?.[0]).not.toBe(en.steps?.[0]);
  });

  it('mêmes données (nouvelle liste au contenu identique) → même tableau, sans reconstruction', () => {
    const a = libraryItems([{ ...custom }], 'fr');
    expect(libraryItems([{ ...custom }], 'fr')).toBe(a);
    expect(libraryItems([], 'fr')).not.toBe(a);
    expect(libraryItems([{ ...custom }], 'en')).not.toBe(a);
  });

  it('id inconnu → null', () => {
    expect(findLibraryItem('custom:nope', [], 'fr')).toBeNull();
    expect(findLibraryItem('ds:9999', [], 'fr')).toBeNull();
  });
});

describe('Illustration', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('charge les 3 images, recolore, anime (≈ 0,8 s par image)', async () => {
    const slug = libraryItems([], 'fr').find((i) => i.illustration)!.illustration!;
    await renderWithProviders(<Illustration slug={slug} muscle="chest" size={120} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByTestId('illustration-frame-0')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(800); });
    expect(screen.getByTestId('illustration-frame-1')).toBeTruthy();
  });

  it('« Réduire les animations » : reste sur la première image', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const slug = libraryItems([], 'fr').find((i) => i.illustration)!.illustration!;
    await renderWithProviders(<Illustration slug={slug} muscle="chest" size={120} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { jest.advanceTimersByTime(2400); });
    expect(screen.getByTestId('illustration-frame-0')).toBeTruthy();
  });

  it('Review Focus 5 : lecture en erreur ou pas d\'illustration → pastille du muscle', async () => {
    jest.mocked(readAssetText).mockRejectedValueOnce(new Error('io'));
    // slug jamais chargé dans ce fichier (les images lues avec succès restent en cache)
    const slug = libraryItems([], 'fr').filter((i) => i.illustration).at(-1)!.illustration!;
    await renderWithProviders(<Illustration slug={slug} muscle="chest" size={120} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByTestId('illustration-fallback')).toBeTruthy();
    await renderWithProviders(<Illustration slug={null} muscle="quads" size={40} />);
    expect(screen.getAllByTestId('illustration-fallback').length).toBeGreaterThan(0);
  });
});
