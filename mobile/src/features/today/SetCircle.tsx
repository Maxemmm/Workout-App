// Cercle de série — 44 pt, rempli à la couleur d'accent quand coché, bordé en attente
import { Pressable, StyleSheet, Text } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { readableOn } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  index: number;
  done: boolean;
  pending: boolean;
  disabled: boolean;
  fill: string;
  testID?: string;
  onToggle(): void;
  onEdit(): void;
}

export function SetCircle({ index, done, pending, disabled, fill, testID, onToggle, onEdit }: Props) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled }}
      accessibilityLabel={t('today_set_title', index + 1)}
      accessibilityHint={t('today_set_hint')}
      onPress={disabled ? undefined : onToggle}
      onLongPress={onEdit}
      style={[
        styles.circle,
        {
          backgroundColor: done ? fill : colors.bgCardSoft,
          borderColor: pending || done ? fill : colors.border,
          borderWidth: pending ? 3 : 1.5,
        },
      ]}
    >
      <Text style={{ color: done ? readableOn(fill) : colors.text, fontFamily: fonts.uiBold }}>{index + 1}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: TOUCH_MIN / 2, alignItems: 'center', justifyContent: 'center' },
});
