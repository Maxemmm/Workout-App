// Conteneur d'écran : clavier et zones de sécurité
import { screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Screen } from '../Screen';

describe('Screen', () => {
  it('le clavier ne masque pas les champs : défilement ajusté et fermeture au glisser', async () => {
    await renderWithProviders(<Screen><Text>x</Text></Screen>);
    const scroll = screen.getByTestId('screen-scroll');
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(scroll.props.keyboardDismissMode).toBe('interactive');
  });

  it('écran sans barre d\'onglets : marge basse de la zone de sécurité (barre d\'accueil)', async () => {
    const { rerender } = await renderWithProviders(<Screen><Text>x</Text></Screen>);
    const base = StyleSheet.flatten(screen.getByTestId('screen-scroll').props.contentContainerStyle).paddingBottom as number;
    await rerender(<Screen safeBottom><Text>x</Text></Screen>);
    const withSafe = StyleSheet.flatten(screen.getByTestId('screen-scroll').props.contentContainerStyle).paddingBottom as number;
    expect(withSafe).toBeGreaterThan(base);
  });
});
