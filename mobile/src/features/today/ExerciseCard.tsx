// ============================================================
// Carte d'exercice — nom, schéma, consigne, dernière fois, poids,
// cercles de séries, ligne de repos, échange. Verte quand complète.
// ============================================================
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LastPerformance } from '@/db/repos/historyRepo';
import type { EffectiveExercise } from '@/domain/exerciseView';
import type { Units } from '@/domain/program';
import { formatScheme } from '@/domain/scheme';
import { useI18n } from '@/i18n/I18nProvider';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { LastTimeLine } from './LastTimeLine';
import { SetCircle } from './SetCircle';
import { WeightStepper } from './WeightStepper';

export interface ExerciseCardProps {
  exercise: EffectiveExercise;
  units: Units;
  accent: string | null | undefined;
  done: boolean[];
  weight: number | null;
  restSec: number;
  last: LastPerformance | null;
  locked: boolean;
  pendingSet: number | null;
  onPressSet(index: number): void;
  onLongPressSet(index: number): void;
  onChangeWeight(value: number | null): void;
  onSwap?: () => void;
  onPressRest(): void;
  /** Enveloppe du titre (poignée de glisser-déposer) */
  header?: (title: ReactElement) => ReactElement;
}

export function ExerciseCard(p: ExerciseCardProps) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const ex = p.exercise;
  const fill = accentColors(colors, p.accent).fill;
  const complete = Array.from({ length: ex.sets }, (_, i) => p.done[i] === true).every(Boolean);

  const title = (
    <View style={styles.header}>
      <View style={styles.titleCol}>
        <Text style={[styles.name, { color: colors.text, fontFamily: fonts.uiBold }]}>{ex.name}</Text>
        {ex.performedName ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t('today_replaces', ex.originalName)}</Text> : null}
      </View>
      <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{formatScheme(ex)}</Text>
    </View>
  );

  return (
    <View
      testID={complete ? `card-${ex.id}-complete` : `card-${ex.id}`}
      style={[styles.card, { backgroundColor: complete ? colors.greenDone : colors.bgCard, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}
    >
      <View style={styles.headerRow}>
        <View style={styles.flex}>{p.header ? p.header(title) : title}</View>
        {ex.alternatives.length > 0 && p.onSwap ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('today_swap_title')} onPress={p.onSwap} style={styles.iconBtn}>
            <Ionicons name="swap-horizontal" size={20} color={colors.textDim} />
          </Pressable>
        ) : null}
      </View>
      {ex.cue ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontStyle: 'italic' }}>{ex.cue}</Text> : null}
      <LastTimeLine last={p.last} units={p.units} />
      <View style={styles.weightRow}>
        <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('today_weight').toUpperCase()}</Text>
        <WeightStepper testID={`weight-${ex.id}`} value={p.weight} units={p.units} onChange={p.onChangeWeight} />
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{p.units}</Text>
      </View>
      {ex.load ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{ex.load}</Text> : null}
      <View style={styles.circles}>
        {Array.from({ length: ex.sets }, (_, i) => (
          <SetCircle
            key={i}
            testID={`set-${ex.id}-${i}`}
            index={i}
            done={p.done[i] === true}
            pending={p.pendingSet === i}
            disabled={p.locked}
            fill={fill}
            onToggle={() => p.onPressSet(i)}
            onEdit={() => p.onLongPressSet(i)}
          />
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={p.onPressRest} style={styles.restRow}>
        <Ionicons name="timer-outline" size={14} color={colors.textDim} />
        <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 1 }}>{`${t('timer_rest')} ${p.restSec}S`}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  titleCol: { flex: 1, gap: 2 },
  name: { fontSize: 17 },
  iconBtn: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginRight: -10 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  circles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: TOUCH_MIN },
});
