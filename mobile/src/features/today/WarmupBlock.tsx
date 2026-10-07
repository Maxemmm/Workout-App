// Échauffement : affiché, non coché
import { Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function WarmupBlock({ items }: { items: string[] }) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 6, backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }}>
      <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('today_warmup').toUpperCase()}</Text>
      {items.map((item, i) => (
        <Text key={i} style={{ color: colors.text, fontFamily: fonts.ui }}>{`· ${item}`}</Text>
      ))}
    </View>
  );
}
