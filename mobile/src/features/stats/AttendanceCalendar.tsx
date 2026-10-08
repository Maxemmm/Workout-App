// Calendrier d'assiduité : 7 colonnes (lundi → dimanche) × N semaines
import { StyleSheet, Text, View } from 'react-native';
import type { CalendarDay, DayState } from '@/domain/stats/attendance';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function AttendanceCalendar({ weeks }: { weeks: CalendarDay[][] }) {
  const { colors, fonts, radius } = useTheme();
  const { tList } = useI18n();
  const short = tList('days_short');
  const header = [1, 2, 3, 4, 5, 6, 0].map((d) => short[d] ?? '');

  const cellStyle = (state: DayState) => {
    switch (state) {
      case 'done': return { backgroundColor: colors.gold };
      case 'missed': return { borderWidth: 1.5, borderColor: colors.rust };
      case 'today': return { borderWidth: 1.5, borderColor: colors.gold, backgroundColor: colors.bgCardSoft };
      case 'future': return { borderWidth: 1, borderColor: colors.border };
      default: return { backgroundColor: colors.bgCardSoft };
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        {header.map((h, i) => (
          <Text key={i} style={[styles.head, { color: colors.textDim, fontFamily: fonts.uiBold }]}>{h}</Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0].date} style={styles.row}>
          {week.map((d) => (
            <View
              key={d.date}
              testID={`cal-${d.date}`}
              accessibilityLabel={`${d.date} ${d.state}`}
              style={[styles.cell, { borderRadius: radius.sm / 2 }, cellStyle(d.state)]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  row: { flexDirection: 'row', gap: 4 },
  head: { flex: 1, textAlign: 'center', fontSize: 10, letterSpacing: 1 },
  cell: { flex: 1, aspectRatio: 1 },
});
