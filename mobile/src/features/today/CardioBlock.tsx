// Cardio de fin de séance
import { Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function CardioBlock({ label, detail }: { label: string; detail: string | null | undefined }) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: 4, backgroundColor: colors.bgCard, borderColor: colors.blue, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }}>
      <Text style={{ color: colors.blue, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('today_cardio').toUpperCase()}</Text>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{label}</Text>
      {detail ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{detail}</Text> : null}
    </View>
  );
}
