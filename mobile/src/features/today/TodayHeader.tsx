// En-tête de Today : bandeau, « TODAY », séance colorée selon son accent
import { StyleSheet, Text, View } from 'react-native';
import type { DayPlan } from '@/domain/schedule';
import { useI18n } from '@/i18n/I18nProvider';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  programLabel: string;
  dateLabel: string;
  plan: DayPlan;
}

export function TodayHeader({ programLabel, dateLabel, plan }: Props) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const isSession = plan.kind === 'session';
  const title = isSession ? plan.session.name : t('today_rest_label');
  const titleColor = isSession ? accentColors(colors, plan.session.accent).text : colors.textDim;
  const subtitle = isSession ? plan.session.subtitle : t('today_rest_sub');

  return (
    <View style={styles.root}>
      <View style={styles.banner}>
        <Text style={[styles.small, { color: colors.textDim, fontFamily: fonts.uiBold }]}>{programLabel}</Text>
        <Text style={[styles.small, { color: colors.textDim, fontFamily: fonts.uiBold }]}>{dateLabel}</Text>
      </View>
      <Text style={[styles.display, { color: colors.text, fontFamily: fonts.display }]}>{t('today_word')}</Text>
      <Text style={[styles.display, { color: titleColor, fontFamily: fonts.display }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textDim, fontFamily: fonts.uiMedium }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 2 },
  banner: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  small: { fontSize: 11, letterSpacing: 1.5 },
  display: { fontSize: 44, lineHeight: 46, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, letterSpacing: 1.5, marginTop: 4 },
});
