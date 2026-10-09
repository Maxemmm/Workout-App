import { act, screen } from '@testing-library/react-native';
import { TOAST_INITIAL, useToastStore } from '@/state/toastStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Toast } from '../Toast';

describe('Toast', () => {
  beforeEach(() => { jest.useFakeTimers(); useToastStore.setState(TOAST_INITIAL); });
  afterEach(() => jest.useRealTimers());

  it('affiche le message puis le masque après 2,5 s', async () => {
    await renderWithProviders(<Toast />);
    await act(async () => { useToastStore.getState().show('Séance enregistrée ✓'); });
    expect(screen.getByText('Séance enregistrée ✓')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(2600); });
    expect(screen.queryByText('Séance enregistrée ✓')).toBeNull();
  });
});

describe('Toast — position', () => {
  beforeEach(() => { useToastStore.setState(TOAST_INITIAL); });

  it('en haut, sous la barre d\'état : ne chevauche ni la barre de repos, ni les onglets, ni le clavier', async () => {
    const { StyleSheet } = require('react-native') as typeof import('react-native');
    await renderWithProviders(<Toast />);
    await act(async () => { useToastStore.getState().show('ok'); });
    const style = StyleSheet.flatten(screen.getByTestId('toast').props.style);
    expect(style.top).toEqual(expect.any(Number));
    expect(style.bottom).toBeUndefined();
  });
});
