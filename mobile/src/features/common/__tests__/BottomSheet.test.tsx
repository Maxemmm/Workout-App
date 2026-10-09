import { screen, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { BottomSheet } from '../BottomSheet';

describe('BottomSheet', () => {
  it('contenu défilant et hauteur bornée (formulaires longs, clavier ouvert)', async () => {
    await renderWithProviders(
      <BottomSheet visible title="Titre" onClose={jest.fn()}>
        <Text>contenu</Text>
      </BottomSheet>,
    );
    const scroll = screen.getByTestId('bottom-sheet-scroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.getByText('contenu')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet').props.style).maxHeight).toBe('90%');
  });

  it('clavier ouvert : la feuille rétrécit (pas de débordement) et ne passe jamais sous la barre d\'état', async () => {
    await renderWithProviders(
      <BottomSheet visible title="Titre" onClose={jest.fn()}>
        <Text>contenu</Text>
      </BottomSheet>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet').props.style).flexShrink).toBe(1);
    // Zone réservée en haut (barre d'état / encoche + marge) : la feuille ne peut pas monter dessous
    expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet-frame').props.style).paddingTop).toBeGreaterThanOrEqual(8);
  });

  it('pied fixe hors du défilement : les actions restent visibles au-dessus du clavier', async () => {
    await renderWithProviders(
      <BottomSheet visible title="Titre" onClose={jest.fn()} footer={<Text>Enregistrer</Text>}>
        <Text>contenu</Text>
      </BottomSheet>,
    );
    expect(within(screen.getByTestId('bottom-sheet-scroll')).queryByText('Enregistrer')).toBeNull();
    expect(within(screen.getByTestId('bottom-sheet-footer')).getByText('Enregistrer')).toBeTruthy();
  });
});
