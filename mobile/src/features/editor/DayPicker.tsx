// Choix de la séance d'un jour : Repos ou une séance du brouillon
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { BottomSheet } from '@/features/common/BottomSheet';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  visible: boolean;
  title: string;
  sessions: { key: string; name: string }[];
  value: string | null;
  onSelect(key: string | null): void;
  onClose(): void;
}

export function DayPicker({ visible, title, sessions, value, onSelect, onClose }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const option = (key: string | null, label: string) => (
    <Pressable
      key={key ?? '__rest__'}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: value === key }}
      onPress={() => onSelect(key)}
      style={[styles.option, { backgroundColor: colors.bgCard, borderColor: value === key ? colors.borderActive : colors.border, borderRadius: radius.md }]}
    >
      <Text style={[styles.flex, { color: colors.text, fontFamily: fonts.uiBold }]}>{label}</Text>
      {value === key ? <Ionicons name="checkmark" size={18} color={colors.gold} /> : null}
    </Pressable>
  );
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      {option(null, t('plan_rest'))}
      {sessions.map((s) => option(s.key, s.name || t('editor_no_name')))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
