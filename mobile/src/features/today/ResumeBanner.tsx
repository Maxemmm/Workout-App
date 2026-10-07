// Séance d'un jour précédent restée en cours (passage de minuit)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  dateLabel: string;
  canResume: boolean;
  onResume(): void;
  onFinish(): void;
}

export function ResumeBanner({ dateLabel, canResume, onResume, onFinish }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const btn = [styles.btn, { borderRadius: radius.md, borderColor: colors.rust }];
  return (
    <View style={{ gap: 10, borderColor: colors.rust, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.bgCard }}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('today_resume_title', dateLabel)}</Text>
      <View style={styles.row}>
        {canResume ? (
          <Pressable accessibilityRole="button" onPress={onResume} style={btn}>
            <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('today_resume')}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onFinish} style={btn}>
          <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('today_resume_finish')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, minHeight: TOUCH_MIN, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
