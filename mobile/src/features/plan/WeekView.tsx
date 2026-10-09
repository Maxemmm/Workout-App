// Plan · Cette semaine — lundi → dimanche, séance colorée, badge Aujourd'hui
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Program } from '@/domain/program';
import { resolveDay, WEEK_ORDER, weekdayOf } from '@/domain/schedule';
import { useI18n } from '@/i18n/I18nProvider';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  program: Program | null;
  today: Date;
  onAddSession(): void;
  onCreate(): void;
}

export function WeekView({ program, today, onAddSession, onCreate }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t, tList } = useI18n();
  const primary = [styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }];

  if (!program) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('plan_no_active')}</Text>
        <Pressable accessibilityRole="button" onPress={onCreate} style={primary}>
          <Text style={{ color: colors.onGold, fontFamily: fonts.uiBold }}>{t('plan_create_program')}</Text>
        </Pressable>
      </View>
    );
  }

  const days = tList('days_short');
  const current = weekdayOf(today);
  return (
    <View style={{ gap: 8 }}>
      {WEEK_ORDER.map((weekday) => {
        const plan = resolveDay(program, weekday);
        const isRest = plan.kind === 'implicit-rest';
        const n = plan.kind === 'session' ? plan.session.exercises.length : 0;
        return (
          <View
            key={weekday}
            testID={`week-${weekday}`}
            style={[styles.row, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, opacity: isRest ? 0.55 : 1 }]}
          >
            <Text style={[styles.day, { color: colors.textDim, fontFamily: fonts.uiBold }]}>{days[weekday].toUpperCase()}</Text>
            <View style={styles.flex}>
              <Text style={{ color: plan.kind === 'session' ? accentColors(colors, plan.session.accent).text : colors.textDim, fontFamily: fonts.uiBold }}>
                {plan.kind === 'session' ? plan.session.name : t('plan_rest')}
              </Text>
              {plan.kind === 'session' ? (
                <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{`${n} ${n > 1 ? t('plan_exercises') : t('plan_exercise')}`}</Text>
              ) : null}
            </View>
            {weekday === current ? (
              <Text testID="today-badge" style={{ color: colors.gold, fontFamily: fonts.uiBold, fontSize: 11 }}>{t('plan_today_badge').toUpperCase()}</Text>
            ) : null}
          </View>
        );
      })}
      <Pressable accessibilityRole="button" onPress={onAddSession} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('plan_add_session')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  day: { width: 40, fontSize: 12, letterSpacing: 1 },
  flex: { flex: 1, gap: 2 },
  btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
});
