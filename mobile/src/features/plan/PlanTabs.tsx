// Onglets segmentés « Cette semaine » / « Mes programmes » — indicateur glissant (< 250 ms)
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

export type PlanTab = 'week' | 'programs';

export function PlanTabs({ value, onChange }: { value: PlanTab; onChange(v: PlanTab): void }) {
  const { colors, fonts, radius, duration } = useTheme();
  const { t } = useI18n();
  const [width, setWidth] = useState(0);
  const half = (width - 8) / 2;
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(value === 'week' ? 0 : half, { duration: duration.normal }) }],
  }));
  const tab = (key: PlanTab, label: string) => (
    <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: value === key }} onPress={() => onChange(key)} style={styles.tab}>
      <Text style={{ color: value === key ? '#0a0a0a' : colors.text, fontFamily: fonts.uiBold }}>{label}</Text>
    </Pressable>
  );
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[styles.row, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
      {width > 0 ? <Animated.View style={[styles.thumb, { width: half, backgroundColor: colors.gold, borderRadius: radius.md }, thumb]} /> : null}
      {tab('week', t('plan_this_week'))}
      {tab('programs', t('plan_my_programs'))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4 },
  thumb: { position: 'absolute', top: 4, bottom: 4, left: 4 },
  tab: { flex: 1, minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
