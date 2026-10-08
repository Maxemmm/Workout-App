// ============================================================
// STATS — résumé, progression par exercice, assiduité, records.
// Une lecture (readHistory) ; tous les calculs dans domain/stats.
// ============================================================
import { StyleSheet, Text } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { readHistory } from '@/db/repos/statsRepo';
import type { RepoCtx } from '@/db/types';
import { localDateKey } from '@/domain/schedule';
import { displayUnits } from '@/domain/stats/exerciseSeries';
import { DEFAULT_STATS_PERIOD, isStatsPeriod, periodStart, STATS_PERIODS, type StatsPeriod } from '@/domain/stats/period';
import { personalRecords } from '@/domain/stats/records';
import { currentStreak, lastSession, weekVolume } from '@/domain/stats/summary';
import { Screen } from '@/features/common/Screen';
import { useDbQuery } from '@/features/common/useDbQuery';
import { Segmented } from '@/features/profile/Segmented';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { AttendanceSection } from './AttendanceSection';
import { ExerciseSection } from './ExerciseSection';
import { RecordsList } from './RecordsList';
import { SummaryCards } from './SummaryCards';

const readStats = (ctx: RepoCtx) => {
  const stored = getSetting(ctx, 'statsPeriod');
  return { history: readHistory(ctx), period: isStatsPeriod(stored) ? stored : DEFAULT_STATS_PERIOD };
};

/** Écriture de la période puis rafraîchissement (fonction de module : compatible React Compiler) */
function savePeriod(ctx: RepoCtx, period: StatsPeriod, errorMessage: string): void {
  try {
    setSetting(ctx, 'statsPeriod', period);
  } catch {
    useToastStore.getState().show(errorMessage);
  }
  usePrefs.getState().bumpData();
}

export function StatsScreen() {
  const ctx = useRepoCtx();
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const { history, period } = useDbQuery(readStats);
  const today = localDateKey(new Date());
  const title = <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('stats_title')}</Text>;

  if (history.workouts.length === 0) {
    return (
      <Screen>
        {title}
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('stats_empty')}</Text>
      </Screen>
    );
  }

  const since = periodStart(period, today);
  const units = displayUnits(history);
  return (
    <Screen>
      {title}
      <SummaryCards
        streak={currentStreak(history, today)}
        plannedStreak={(history.active?.trainDays.length ?? 0) > 0}
        week={weekVolume(history, today)}
        last={lastSession(history)}
        units={units}
      />
      <Segmented<StatsPeriod>
        options={STATS_PERIODS.map((p) => ({ value: p, label: t(`stats_period_${p}`) }))}
        value={period}
        onChange={(p) => savePeriod(ctx, p, t('error_not_saved'))}
      />
      <ExerciseSection history={history} since={since} />
      <AttendanceSection history={history} today={today} since={since} />
      <RecordsList records={personalRecords(history, today)} units={units} />
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { fontSize: 44, letterSpacing: -0.5 } });
