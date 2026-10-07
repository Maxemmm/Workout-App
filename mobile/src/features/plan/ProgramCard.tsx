// Carte d'un programme — tap = activer ; Modifier / Dupliquer / Supprimer
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { programSummary } from './planStats';

interface Props {
  program: StoredProgram;
  active: boolean;
  onActivate(): void;
  onEdit(): void;
  onDuplicate(): void;
  onDelete(): void;
}

export function ProgramCard({ program, active, onActivate, onEdit, onDuplicate, onDelete }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const { days, exercises } = programSummary(program.definition);
  const meta = `${days} ${days > 1 ? t('plan_days') : t('plan_day')} · ${exercises} ${exercises > 1 ? t('plan_exercises') : t('plan_exercise')}`;
  const action = (label: string, onPress: () => void, danger = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}>
      <Text style={{ color: danger ? colors.redDanger : colors.text, fontFamily: fonts.uiBold, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
  return (
    <Pressable
      testID={`program-${program.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onActivate}
      style={[styles.card, { backgroundColor: colors.bgCard, borderColor: active ? colors.borderActive : colors.border, borderRadius: radius.lg, padding: spacing.md }]}
    >
      <View style={styles.header}>
        <Text style={[styles.flex, { color: colors.text, fontFamily: fonts.uiBold, fontSize: 16 }]}>{program.definition.meta.label}</Text>
        {active ? <Text style={{ color: colors.gold, fontFamily: fonts.uiBold, fontSize: 11 }}>{t('plan_active_badge')}</Text> : null}
      </View>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{meta}</Text>
      <View style={styles.actions}>
        {action(t('plan_edit'), onEdit)}
        {action(t('plan_duplicate'), onDuplicate)}
        {action(t('plan_delete'), onDelete, true)}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 4, marginTop: 4 },
  action: { minHeight: TOUCH_MIN, paddingHorizontal: 10, justifyContent: 'center' },
});
