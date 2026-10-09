// Stats · progression par exercice : pastilles, bascule Charge / 1RM, courbe, chiffres
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { displayUnits, exerciseSeries, exerciseStats, trackedExercises, type SeriesMetric } from '@/domain/stats/exerciseSeries';
import type { StatsHistory } from '@/domain/stats/types';
import { Segmented } from '@/features/profile/Segmented';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { formatDay, formatLoad, formatNumber } from './format';
import { LineChart } from './LineChart';

export function ExerciseSection({ history, since }: { history: StatsHistory; since: string | null }) {
  const { colors, fonts, radius } = useTheme();
  const { t, tList, lang } = useI18n();
  const exercises = trackedExercises(history);
  const [selected, setSelected] = useState<string | null>(null);
  const [metric, setMetric] = useState<SeriesMetric>('load');
  const current = exercises.find((e) => e.key === selected) ?? exercises[0];
  if (!current) return null;

  const units = displayUnits(history);
  const series = exerciseSeries(history, current.key, metric, since);
  const stats = exerciseStats(history, current.key, since);
  const recordIndex = series.reduce((best, p, i) => (p.value >= series[best].value ? i : best), 0);
  const day = (key: string) => formatDay(key, tList('days_short'), tList('months_short'));
  const label = [styles.label, { color: colors.textDim, fontFamily: fonts.uiBold }];
  const value = { color: colors.text, fontFamily: fonts.uiBold };

  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('stats_progress_title').toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {exercises.map((e) => {
          const active = e.key === current.key;
          return (
            <Pressable
              key={e.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(e.key)}
              style={[styles.chip, { borderRadius: radius.full, borderColor: active ? colors.gold : colors.border, backgroundColor: active ? colors.gold : 'transparent' }]}
            >
              <Text style={{ color: active ? colors.onGold : colors.text, fontFamily: fonts.uiMedium }}>{e.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {stats.record === null ? (
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('stats_no_weight')}</Text>
      ) : (
        <>
          <Segmented<SeriesMetric>
            options={[{ value: 'load', label: t('stats_metric_load') }, { value: 'oneRm', label: t('stats_metric_onerm') }]}
            value={metric}
            onChange={setMetric}
          />
          {series.length > 0 ? (
            <LineChart points={series.map((p) => ({ value: p.value, label: formatLoad(p.value, lang) }))} recordIndex={recordIndex} />
          ) : (
            <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('stats_no_sessions')}</Text>
          )}
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Text style={label}>{t('stats_record_load').toUpperCase()}</Text>
              <Text style={value}>{`${formatLoad(stats.record.value, lang)} ${units}`}</Text>
              <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{day(stats.record.date)}</Text>
            </View>
            {stats.best ? (
              <View style={styles.cell}>
                <Text style={label}>{t('stats_best_set').toUpperCase()}</Text>
                <Text style={value}>{`${formatLoad(stats.best.weight, lang)} ${units} × ${stats.best.reps}`}</Text>
                <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{`${t('stats_onerm')} ${formatLoad(stats.best.oneRm, lang)} ${units}`}</Text>
              </View>
            ) : null}
            <View style={styles.cell}>
              <Text style={label}>{t('stats_volume_period').toUpperCase()}</Text>
              <Text style={value}>{`${formatNumber(stats.volume, lang)} ${units}`}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { minHeight: TOUCH_MIN, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { minWidth: '45%', flexGrow: 1, gap: 2 },
  label: { fontSize: 10, letterSpacing: 1.2 },
});
