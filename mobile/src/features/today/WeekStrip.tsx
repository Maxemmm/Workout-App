// Pilules des 7 jours : point = aujourd'hui, bordure = jour affiché,
// jours sans séance atténués mais cliquables (CLAUDE.md §5)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Weekday, WeekStripDay } from '@/domain/schedule';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  days: WeekStripDay[];
  selected: Weekday;
  dayLabels: string[];
  onSelect: (weekday: Weekday) => void;
}

export function WeekStrip({ days, selected, dayLabels, onSelect }: Props) {
  const { colors, fonts, radius } = useTheme();
  return (
    <View style={styles.row}>
      {days.map(({ weekday, isToday, plan }) => {
        const isSelected = weekday === selected;
        const isRest = plan.kind === 'implicit-rest';
        const accent = plan.kind === 'session' ? accentColors(colors, plan.session.accent).text : colors.textDim;
        return (
          <Pressable
            key={weekday}
            testID={`day-${weekday}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(weekday)}
            style={[
              styles.pill,
              {
                borderRadius: radius.full,
                backgroundColor: colors.bgCard,
                borderColor: isSelected ? accent : colors.border,
                opacity: isRest && !isSelected ? 0.5 : 1,
              },
            ]}
          >
            <Text style={{ color: isSelected ? accent : colors.text, fontFamily: fonts.uiBold, fontSize: 11 }}>
              {dayLabels[weekday]}
            </Text>
            {isToday && <View testID="today-dot" style={[styles.dot, { backgroundColor: accent }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  pill: { flex: 1, minHeight: TOUCH_MIN, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
