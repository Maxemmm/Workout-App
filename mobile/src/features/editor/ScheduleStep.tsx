// Étape 3 — planning : une séance (ou repos) par jour, lundi → dimanche
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { setSchedule } from '@/domain/draft';
import { WEEK_ORDER, type Weekday } from '@/domain/schedule';
import { useI18n } from '@/i18n/I18nProvider';
import { useDraftStore } from '@/state/draftStore';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { DayPicker } from './DayPicker';
import { EditorScreen } from './EditorScreen';
import type { EditorNav } from './nav';

export function ScheduleStep({ nav }: { nav: EditorNav }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t, tList } = useI18n();
  const program = useDraftStore((s) => s.draft?.program);
  const apply = useDraftStore((s) => s.apply);
  const [picking, setPicking] = useState<Weekday | null>(null);
  const daysLong = tList('days_long');

  const sessions = program ? Object.entries(program.sessions).map(([key, s]) => ({ key, name: s.name })) : [];
  const valueOf = (d: Weekday) => {
    const key = program?.schedule[String(d)] ?? null;
    return key && program && Object.hasOwn(program.sessions, key) ? key : null;
  };

  return (
    <EditorScreen nav={nav} step={3}>
      {({ save }) => (program ? (
        <View style={styles.root}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('editor_step3_title').toUpperCase()}</Text>
          <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('editor_step3_sub')}</Text>
          {WEEK_ORDER.map((d) => {
            const key = valueOf(d);
            const session = key ? program.sessions[key] : null;
            return (
              <Pressable
                key={d}
                testID={`day-row-${d}`}
                accessibilityRole="button"
                onPress={() => setPicking(d)}
                style={[styles.row, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.md }]}
              >
                <Text style={[styles.day, { color: colors.textDim, fontFamily: fonts.uiBold }]}>{daysLong[d]}</Text>
                <Text style={[styles.flex, { color: session ? accentColors(colors, session.accent).text : colors.textDim, fontFamily: fonts.uiBold }]}>
                  {session ? session.name || t('editor_no_name') : t('plan_rest')}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textDim} />
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" onPress={save} style={[styles.save, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
            <Text style={{ color: colors.onGold, fontFamily: fonts.uiBold }}>{t('editor_save_program_btn')}</Text>
          </Pressable>
          <DayPicker
            visible={picking !== null}
            title={picking !== null ? daysLong[picking] : ''}
            sessions={sessions}
            value={picking !== null ? valueOf(picking) : null}
            onSelect={(key) => {
              if (picking !== null) apply(ctx, (dr) => setSchedule(dr, picking, key));
              setPicking(null);
            }}
            onClose={() => setPicking(null)}
          />
        </View>
      ) : null)}
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  title: { fontSize: 36, letterSpacing: -0.5 },
  row: { minHeight: TOUCH_MIN + 8, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  day: { width: 90 },
  flex: { flex: 1 },
  save: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
