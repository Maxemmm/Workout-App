import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { getSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { CreditsSection } from '../CreditsSection';
import { MyEquipmentSection } from '../MyEquipmentSection';

describe('Mon matériel', () => {
  beforeEach(async () => { await act(async () => { usePrefs.setState(PREFS_INITIAL); }); });

  it('« Poids du corps » coché par défaut ; cocher / décocher enregistre', async () => {
    const ctx = createTestCtx();
    await renderWithProviders(<MyEquipmentSection />, { ctx });
    expect(screen.getByRole('checkbox', { name: 'Poids du corps' }).props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Haltères' }));
    expect(getSetting(ctx, 'myEquipment')).toEqual(['bodyweight', 'dumbbell']);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Poids du corps' }));
    expect(getSetting(ctx, 'myEquipment')).toEqual(['dumbbell']);
  });
});

describe('Crédits', () => {
  it('sources, licences, lien CC BY-SA 4.0', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await renderWithProviders(<CreditsSection />);
    expect(screen.getByText(/^Exercices : exercises-dataset/)).toBeTruthy();
    expect(screen.getByText(/Bryl Lim/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Licence CC BY-SA 4.0' }));
    expect(open).toHaveBeenCalledWith('https://creativecommons.org/licenses/by-sa/4.0/');
    await fireEvent.press(screen.getByRole('link', { name: 'workout-guide' }));
    expect(open).toHaveBeenCalledWith('https://github.com/bryllim/workout-guide');
  });
});
