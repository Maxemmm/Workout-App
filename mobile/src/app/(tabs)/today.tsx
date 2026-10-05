// ============================================================
// TODAY (M1) — séance du jour depuis la base, navigation par jour.
// Les cartes d'exercices, séries et minuteur arrivent en M2.
// ============================================================
import { useState } from 'react';
import { Text, View } from 'react-native';
import example from '@/data/program.example.json';
import { useRepoCtx } from '@/db/DbContext';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { resolveDay, weekdayOf, weekStrip, type Weekday } from '@/domain/schedule';
import { Screen } from '@/features/common/Screen';
import { formatShortDate } from '@/features/today/formatDate';
import { NoProgram } from '@/features/today/NoProgram';
import { TodayHeader } from '@/features/today/TodayHeader';
import { useActiveProgram } from '@/features/today/useActiveProgram';
import { WeekStrip } from '@/features/today/WeekStrip';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function TodayScreen() {
  const ctx = useRepoCtx();
  const program = useActiveProgram();
  const bumpData = usePrefs((s) => s.bumpData);
  const { colors, fonts } = useTheme();
  const { tList } = useI18n();
  const today = new Date();
  const [selected, setSelected] = useState<Weekday>(weekdayOf(today));

  if (!program) {
    const loadExample = () => {
      const created = createProgram(ctx, example, 'example');
      setActiveProgram(ctx, created.id);
      bumpData();
    };
    return (
      <Screen>
        <NoProgram onLoadExample={loadExample} />
      </Screen>
    );
  }

  const def = program.definition;
  const daysShort = tList('days_short');
  const plan = resolveDay(def, selected);

  return (
    <Screen>
      <TodayHeader
        programLabel={def.meta.label}
        dateLabel={formatShortDate(today, daysShort, tList('months_short'))}
        plan={plan}
      />
      <WeekStrip
        days={weekStrip(def, today)}
        selected={selected}
        dayLabels={daysShort.map((d) => d.toUpperCase())}
        onSelect={setSelected}
      />
      {plan.kind === 'session' && (
        <View style={{ gap: 8 }}>
          {plan.session.exercises.map((ex) => (
            <Text key={ex.id} style={{ color: colors.text, fontFamily: fonts.ui }}>
              {ex.name} · {ex.scheme}
            </Text>
          ))}
        </View>
      )}
    </Screen>
  );
}
