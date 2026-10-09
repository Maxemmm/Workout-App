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

describe('Screen — zone de l\'encoche', () => {
  const IPHONE = { top: 59, left: 0, right: 0, bottom: 34 };

  it('marge haute = encoche dès le premier rendu (valeur du provider racine, pas du SafeAreaView natif)', async () => {
    await renderWithProviders(<Screen><Text>x</Text></Screen>, { insets: IPHONE });
    expect(StyleSheet.flatten(screen.getByTestId('screen-root').props.style).paddingTop).toBe(59);
  });

  it('modale « feuille » iOS (déjà sous la barre d\'état) : pas de marge haute', async () => {
    await renderWithProviders(<Screen safeTop={false}><Text>x</Text></Screen>, { insets: IPHONE });
    expect(StyleSheet.flatten(screen.getByTestId('screen-root').props.style).paddingTop).toBe(0);
  });
});
