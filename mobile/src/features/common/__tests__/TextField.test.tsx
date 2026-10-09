// Champ de saisie aux couleurs du thème : clavier iOS sombre en thème sombre (pas de bloc blanc)
import { screen } from '@testing-library/react-native';
import { palettes } from '@/theme/tokens';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TextField } from '../TextField';

describe('TextField', () => {
  it('thème sombre : clavier sombre, curseur et texte indicatif aux couleurs du thème', async () => {
    await renderWithProviders(<TextField testID="f" value="" onChangeText={jest.fn()} />, { theme: 'dark' });
    const input = screen.getByTestId('f');
    expect(input.props.keyboardAppearance).toBe('dark');
    expect(input.props.placeholderTextColor).toBe(palettes.dark.textDim);
    expect(input.props.selectionColor).toBe(palettes.dark.gold);
  });

  it('thème clair : clavier clair', async () => {
    await renderWithProviders(<TextField testID="f" value="" onChangeText={jest.fn()} />, { theme: 'light' });
    expect(screen.getByTestId('f').props.keyboardAppearance).toBe('light');
  });

  it('les props passées l\'emportent', async () => {
    await renderWithProviders(<TextField testID="f" value="" onChangeText={jest.fn()} placeholderTextColor="#123456" />);
    expect(screen.getByTestId('f').props.placeholderTextColor).toBe('#123456');
  });
});
