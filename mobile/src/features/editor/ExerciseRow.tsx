// Ligne d'exercice dans l'éditeur de séance : nom, schéma, actions
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Exercise } from '@/domain/program';
import { formatScheme } from '@/domain/scheme';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  exercise: Exercise;
  onEdit(): void;
  onDuplicate(): void;
  onDelete(): void;
  header?: (title: ReactElement) => ReactElement;
}

export function ExerciseRow({ exercise, onEdit, onDuplicate, onDelete, header }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const title = (
    <View>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{exercise.name}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{formatScheme(exercise)}</Text>
    </View>
  );
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${exercise.name}`} onPress={onPress} style={styles.icon}>
      <Ionicons name={name} size={18} color={colors.textDim} />
    </Pressable>
  );
  return (
    <View style={[styles.row, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
      <View style={styles.flex}>{header ? header(title) : title}</View>
      {icon('create-outline', t('editor_edit_exo'), onEdit)}
      {icon('copy-outline', t('editor_duplicate'), onDuplicate)}
      {icon('trash-outline', t('editor_delete'), onDelete)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  flex: { flex: 1 },
  icon: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
