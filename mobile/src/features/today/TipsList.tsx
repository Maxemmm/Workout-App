// Séances cardio / repos : cartes de conseils
import { Text, View } from 'react-native';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';

export function TipsList({ tips, accent }: { tips: { title: string; body: string }[]; accent: string | null | undefined }) {
  const { colors, fonts, radius, spacing } = useTheme();
  const titleColor = accentColors(colors, accent).text;
  return (
    <View style={{ gap: 12 }}>
      {tips.map((tip, i) => (
        <View key={i} style={{ gap: 4, backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }}>
          <Text style={{ color: titleColor, fontFamily: fonts.uiBold }}>{tip.title}</Text>
          <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{tip.body}</Text>
        </View>
      ))}
    </View>
  );
}
