import { act, fireEvent, screen } from '@testing-library/react-native';
import TodayScreen from '@/app/(tabs)/today';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { listPrograms } from '@/db/repos/programsRepo';
import { renderWithProviders } from '@/test/renderWithProviders';

describe('TodayScreen — rafraîchissement après écriture', () => {
  beforeEach(async () => {
    await act(async () => { usePrefs.setState(PREFS_INITIAL); });
  });

  it('passe de « pas de programme » à la séance après « charger l\'exemple », sans doublon', async () => {
    const ctx = createTestCtx();
    await renderWithProviders(<TodayScreen />, { ctx });
    expect(screen.getByText('CHARGER LE PROGRAMME EXEMPLE')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'CHARGER LE PROGRAMME EXEMPLE' }));

    expect(screen.queryByText('CHARGER LE PROGRAMME EXEMPLE')).toBeNull();
    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(listPrograms(ctx)).toHaveLength(1);
  });
});
