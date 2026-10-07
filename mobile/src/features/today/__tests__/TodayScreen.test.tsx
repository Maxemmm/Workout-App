import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TodayScreen } from '../TodayScreen';

describe('TodayScreen — pas de programme', () => {
  beforeEach(async () => {
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useDraftStore.setState(DRAFT_INITIAL); });
  });

  it('propose Créer (brouillon neuf + éditeur) et Importer', async () => {
    const ctx = createTestCtx();
    const onOpenEditor = jest.fn();
    const onOpenImport = jest.fn();
    await renderWithProviders(<TodayScreen onOpenEditor={onOpenEditor} onOpenImport={onOpenImport} />, { ctx });
    expect(screen.queryByText('CHARGER LE PROGRAMME EXEMPLE')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER MON PROGRAMME' }));
    expect(useDraftStore.getState().draft).not.toBeNull();
    expect(onOpenEditor).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Importer un fichier JSON' }));
    expect(onOpenImport).toHaveBeenCalled();
  });
});
