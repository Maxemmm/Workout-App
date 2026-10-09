// Récapitulatif de la séance terminée + « Rouvrir »
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Units } from '@/domain/program';
import type { SessionSummary } from '@/domain/progress';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

export function CompletedSummary({ summary, units, onReopen }: { summary: SessionSummary; units: Units; onReopen(): void }) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const stat = (label: string, value: string) => (
    <View style={styles.stat}>
      <Text style={{ color: colors.onDone, fontFamily: fonts.display, fontSize: 26 }}>{value}</Text>
      <Text style={{ color: colors.onDone, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{label.toUpperCase()}</Text>
    </View>
  );
  return (
    <View testID="completed-summary" style={{ gap: 12, backgroundColor: colors.greenDone, borderRadius: radius.lg, padding: spacing.md }}>
      <Text style={{ color: colors.onDone, fontFamily: fonts.display, fontSize: 28 }}>{t('today_summary_title')}</Text>
      <View style={styles.row}>
        {stat(t('today_summary_duration'), t('today_summary_min', summary.durationMin))}
        {stat(t('today_summary_sets'), String(summary.setsDone))}
        {stat(t('today_summary_volume'), `${Math.round(summary.volume)} ${units}`)}
      </View>
      <Pressable accessibilityRole="button" onPress={onReopen} style={[styles.btn, { borderColor: colors.onDone, borderRadius: radius.md }]}>
        <Text style={{ color: colors.onDone, fontFamily: fonts.uiBold }}>{t('today_reopen')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'flex-start', gap: 2 },
  btn: { minHeight: TOUCH_MIN, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
