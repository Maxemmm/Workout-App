// Stats · résumé : série en cours, volume de la semaine, dernière séance
import { StyleSheet, Text, View } from 'react-native';
import type { Units } from '@/domain/program';
import type { LastSession, WeekVolume } from '@/domain/stats/summary';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDay, formatNumber } from './format';

interface Props {
  streak: number;
  /** true : la série compte des séances prévues ; false : des jours calendaires */
  plannedStreak: boolean;
  week: WeekVolume;
  last: LastSession | null;
  units: Units;
}

export function SummaryCards({ streak, plannedStreak, week, last, units }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t, tList, lang } = useI18n();
  const card = [styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.lg }];
  const label = [styles.label, { color: colors.textDim, fontFamily: fonts.uiBold }];
  const big = [styles.big, { color: colors.text, fontFamily: fonts.display }];
  const dim = { color: colors.textDim, fontFamily: fonts.ui };
  const streakUnit = plannedStreak
    ? (streak === 1 ? t('stats_streak_unit_one') : t('stats_streak_unit'))
    : (streak === 1 ? t('stats_streak_unit_days_one') : t('stats_streak_unit_days'));
  const delta = week.deltaPct === null ? null : `${week.deltaPct > 0 ? '+' : ''}${week.deltaPct} %`;

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={[card, styles.half]}>
          <Text style={label}>{t('stats_card_streak').toUpperCase()}</Text>
          <Text style={big}>{streak}</Text>
          <Text style={dim}>{streakUnit}</Text>
        </View>
        <View style={[card, styles.half]}>
          <Text style={label}>{t('stats_week_vol').toUpperCase()}</Text>
          <Text style={big}>{`${formatNumber(week.current, lang)} ${units}`}</Text>
          {delta ? <Text style={{ color: (week.deltaPct ?? 0) >= 0 ? colors.gold : colors.rust, fontFamily: fonts.ui }}>{t('stats_delta_fmt', delta)}</Text> : null}
        </View>
      </View>
      {last ? (
        <View style={card}>
          <Text style={label}>{t('stats_last_session').toUpperCase()}</Text>
          <Text style={[styles.session, { color: colors.text, fontFamily: fonts.display }]}>{last.sessionName}</Text>
          <Text style={dim}>
            {[formatDay(last.date, tList('days_short'), tList('months_short')), t('stats_sets_fmt', last.sets), last.durationMin !== null ? t('stats_duration_fmt', last.durationMin) : null]
              .filter(Boolean).join(' · ')}
          </Text>
          {last.newRecords > 0 ? (
            <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>
              {last.newRecords === 1 ? t('stats_new_records_one') : t('stats_new_records', last.newRecords)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  card: { borderWidth: 1, padding: 14, gap: 4 },
  label: { fontSize: 11, letterSpacing: 1.5 },
  big: { fontSize: 30 },
  session: { fontSize: 24 },
});
