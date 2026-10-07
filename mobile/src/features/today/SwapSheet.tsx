// Choix de la variante : exercice du programme ou une de ses alternatives
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { EffectiveExercise } from '@/domain/exerciseView';
import { alternativeName } from '@/domain/program';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { BottomSheet } from './BottomSheet';

interface Props {
  visible: boolean;
  exercise: EffectiveExercise | null;
  onSelect(name: string | null): void;
  onClose(): void;
}

export function SwapSheet({ visible, exercise, onSelect, onClose }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  if (!exercise) return null;
  const options: { name: string | null; label: string; meta?: string }[] = [
    { name: null, label: exercise.originalName, meta: t('today_swap_original') },
    ...exercise.alternatives.map((a) => ({ name: alternativeName(a), label: alternativeName(a) })),
  ];

  return (
    <BottomSheet visible={visible} title={t('today_swap_title')} onClose={onClose}>
      {options.map((o) => {
        const current = o.name === exercise.performedName;
        return (
          <Pressable
            key={o.name ?? '__original__'}
            accessibilityRole="button"
            accessibilityState={{ selected: current }}
            onPress={() => onSelect(o.name)}
            style={[styles.option, { backgroundColor: colors.bgCard, borderColor: current ? colors.borderActive : colors.border, borderRadius: radius.md }]}
          >
            <Text style={[styles.flex, { color: colors.text, fontFamily: fonts.uiBold }]}>{o.label}</Text>
            {o.meta ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{o.meta}</Text> : null}
            {current ? <Ionicons name="checkmark" size={18} color={colors.gold} /> : null}
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
