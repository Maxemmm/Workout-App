import { screen } from '@testing-library/react-native';
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
});
