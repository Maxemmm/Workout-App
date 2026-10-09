// Stats · assiduité : taux sur la période + calendrier 12 semaines
import { StyleSheet, Text, View } from 'react-native';
import { attendanceCalendar, attendanceRate } from '@/domain/stats/attendance';
import type { StatsHistory } from '@/domain/stats/types';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { AttendanceCalendar } from './AttendanceCalendar';

export function AttendanceSection({ history, today, since }: { history: StatsHistory; today: string; since: string | null }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const rate = attendanceRate(history, today, since);
  const text = rate.kind === 'rate'
    ? t('stats_rate_fmt', rate.done, rate.planned, rate.planned > 0 ? Math.round((rate.done / rate.planned) * 100) : 0)
    : rate.sessions === 1 ? t('stats_count_one') : t('stats_count_fmt', rate.sessions);
  const legend = (color: string, key: 'stats_legend_done' | 'stats_legend_missed' | 'stats_legend_rest', outline = false) => (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, outline ? { borderWidth: 1.5, borderColor: color } : { backgroundColor: color }]} />
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t(key)}</Text>
    </View>
  );
  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('stats_attendance_title').toUpperCase()}</Text>
      <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{text}</Text>
      <AttendanceCalendar weeks={attendanceCalendar(history, today)} />
      <View style={styles.legend}>
        {legend(colors.gold, 'stats_legend_done')}
        {legend(colors.rust, 'stats_legend_missed', true)}
        {legend(colors.textFaint, 'stats_legend_rest')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
});
