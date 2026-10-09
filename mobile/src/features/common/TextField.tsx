// Champ de saisie aux couleurs du thème : clavier iOS sombre en thème sombre (pas de bloc blanc),
// curseur / sélection dorés, texte indicatif atténué. Toutes les props de TextInput passent.
import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export const TextField = forwardRef<TextInput, TextInputProps>(function TextField(props, ref) {
  const { colors, scheme } = useTheme();
  return (
    <TextInput
      ref={ref}
      keyboardAppearance={scheme}
      placeholderTextColor={colors.textDim}
      selectionColor={colors.gold}
      cursorColor={colors.gold}
      {...props}
    />
  );
});
