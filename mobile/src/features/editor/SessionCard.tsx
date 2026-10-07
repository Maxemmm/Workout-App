// Carte de séance dans l'éditeur : pastille de couleur, nom, « Type · N exercices », actions
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Session } from '@/domain/program';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  session: Session;
  onEdit(): void;
  onDuplicate(): void;
  onDelete(): void;
  header?: (title: ReactElement) => ReactElement;
}

export function SessionCard({ session, onEdit, onDuplicate, onDelete, header }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const n = session.exercises.length;
  const meta = `${t(`session_type_${session.type}` as StringKey)} · ${n} ${n > 1 ? t('plan_exercises') : t('plan_exercise')}`;
  const title = (
    <View style={styles.titleRow}>
      <View style={[styles.dot, { backgroundColor: accentColors(colors, session.accent).fill }]} />
      <View style={styles.flex}>
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{session.name || t('editor_no_name')}</Text>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{meta}</Text>
      </View>
    </View>
  );
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.icon}>
      <Ionicons name={name} size={20} color={colors.textDim} />
    </Pressable>
  );
  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
      <View style={styles.flex}>{header ? header(title) : title}</View>
      {icon('create-outline', t('editor_edit_session'), onEdit)}
      {icon('copy-outline', t('editor_duplicate'), onDuplicate)}
      {icon('trash-outline', t('editor_delete'), onDelete)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  flex: { flex: 1 },
  icon: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
