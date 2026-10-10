// ============================================================
// Fiche exercice : illustration animée, muscles, matériel, étapes, historique lié, favori ;
// exercice personnalisé : Modifier / Supprimer.
// ============================================================
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { deleteCustomExercise } from '@/db/repos/customExercisesRepo';
import { exerciseKeysForLibrary, readHistory } from '@/db/repos/statsRepo';
import type { RepoCtx } from '@/db/types';
import { equipmentLabel } from '@/domain/library/equipment';
import { muscleLabel } from '@/domain/library/muscles';
import { displayUnits, exerciseStats } from '@/domain/stats/exerciseSeries';
import { Screen } from '@/features/common/Screen';
import { useDbQuery } from '@/features/common/useDbQuery';
import { formatDay, formatLoad } from '@/features/stats/format';
import { useI18n } from '@/i18n/I18nProvider';
import { confirm } from '@/platform/confirm';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { toggleFavorite } from './favorites';
import { Illustration } from './Illustration';
import { findLibraryItem, readLibraryUser } from './libraryData';

/** Historique lié : premier exercice de programme lié ayant des données */
function readLinkedHistory(ctx: RepoCtx, libraryId: string) {
  const keys = exerciseKeysForLibrary(ctx, libraryId);
  if (keys.length === 0) return null;
  const h = readHistory(ctx);
  for (const key of keys) {
    const stats = exerciseStats(h, key, null);
    const last = [...h.workouts].reverse().find((w) => w.sets.some((s) => s.exerciseId === key && s.performedName === null));
    if (stats.record || last) return { key, record: stats.record, lastDate: last?.date ?? null, units: displayUnits(h) };
  }
  return null;
}

function write(fn: () => void, errorMessage: string): boolean {
  try {
    fn();
    return true;
  } catch {
    useToastStore.getState().show(errorMessage);
    return false;
  } finally {
    usePrefs.getState().bumpData();
  }
}

interface Props {
  id: string;
  onBack(): void;
  onEdit(customId: string): void;
  onOpenStats(key: string): void;
}

export function ExerciseDetail({ id, onBack, onEdit, onOpenStats }: Props) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t, tList, lang } = useI18n();
  const user = useDbQuery(readLibraryUser);
  const history = useDbQuery(readLinkedHistory, id);
  const item = findLibraryItem(id, user.customs, lang);
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };
  const back = (
    <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
      <Ionicons name="chevron-back" size={20} color={colors.gold} />
    </Pressable>
  );

  if (!item) {
    return (
      <Screen safeBottom>
        {back}
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('lib_not_found')}</Text>
      </Screen>
    );
  }
  const favorite = user.favorites.includes(item.id);
  const remove = async () => {
    const ok = await confirm({ title: t('lib_delete'), message: t('lib_delete_confirm', item.name), confirmLabel: t('lib_delete'), cancelLabel: t('lib_cancel'), destructive: true });
    if (ok && write(() => deleteCustomExercise(ctx, item.id.slice('custom:'.length)), t('error_not_saved'))) onBack();
  };

  return (
    <Screen safeBottom>
      <View style={styles.top}>
        {back}
        <Pressable accessibilityRole="button" accessibilityLabel={favorite ? t('lib_favorite_remove') : t('lib_favorite_add')}
          onPress={() => write(() => toggleFavorite(ctx, item.id), t('error_not_saved'))} style={styles.back}>
          <Ionicons name={favorite ? 'star' : 'star-outline'} size={24} color={favorite ? colors.gold : colors.textDim} />
        </Pressable>
      </View>
      <View style={styles.center}>
        <Illustration slug={item.illustration} muscle={item.primary} size={220} />
      </View>
      <Text style={[styles.name, { color: colors.text, fontFamily: fonts.display }]}>{item.name}</Text>
      <Text style={label}>{t('lib_primary').toUpperCase()}</Text>
      <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{muscleLabel(item.primary, lang)}</Text>
      {item.secondary.length ? (
        <>
          <Text style={label}>{t('lib_secondary').toUpperCase()}</Text>
          <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{item.secondary.map((m) => muscleLabel(m, lang)).join(' · ')}</Text>
        </>
      ) : null}
      <Text style={label}>{t('lib_equipment').toUpperCase()}</Text>
      <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{equipmentLabel(item.equipment, lang)}</Text>
      {history ? (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.lg }]}>
          <Text style={label}>{t('lib_history').toUpperCase()}</Text>
          {history.record ? <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('lib_history_record', `${formatLoad(history.record.value, lang)} ${history.units} · ${formatDay(history.record.date, tList('days_short'), tList('months_short'))}`)}</Text> : null}
          {history.lastDate ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('lib_history_last', formatDay(history.lastDate, tList('days_short'), tList('months_short')))}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('lib_history_stats')} onPress={() => onOpenStats(history.key)} style={styles.link}>
            <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('lib_history_stats')}</Text>
          </Pressable>
        </View>
      ) : null}
      {item.steps ? (
        <>
          <Text style={label}>{t('lib_steps').toUpperCase()}</Text>
          {item.steps.map((s, i) => (
            <View key={i} testID={`step-${i}`} style={styles.step}>
              <Text style={{ color: colors.gold, fontFamily: fonts.uiBold, width: 22 }}>{`${i + 1}.`}</Text>
              <Text style={[styles.flex, { color: colors.text, fontFamily: fonts.ui }]}>{s}</Text>
            </View>
          ))}
        </>
      ) : null}
      {item.custom ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('lib_edit')} onPress={() => onEdit(item.id.slice('custom:'.length))}
            style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
            <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('lib_edit')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('lib_delete')} onPress={() => void remove()}
            style={[styles.btn, { borderColor: colors.redDanger, borderWidth: 1, borderRadius: radius.md }]}>
            <Text style={{ color: colors.redDanger, fontFamily: fonts.uiBold }}>{t('lib_delete')}</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  back: { width: TOUCH_MIN, height: TOUCH_MIN, justifyContent: 'center' },
  center: { alignItems: 'center' },
  name: { fontSize: 32, letterSpacing: -0.5 },
  card: { borderWidth: 1, padding: 14, gap: 4 },
  link: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 6 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, minHeight: TOUCH_MIN + 4, alignItems: 'center', justifyContent: 'center' },
});
