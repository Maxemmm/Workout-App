// Note de séance affichée en tête de liste
import { Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function SessionNote({ text }: { text: string }) {
  const { colors, fonts, radius, spacing } = useTheme();
  return (
    <View style={{ backgroundColor: colors.bgCardSoft, borderRadius: radius.md, padding: spacing.md }}>
      <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{text}</Text>
    </View>
  );
}
