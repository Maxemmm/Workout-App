// Stepper numérique −/+ borné (séries, repos) — cibles 44 pt, boutons libellés pour le lecteur d'écran
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  format?: (v: number) => string;
  testID?: string;
  onChange(value: number): void;
}

export function NumberStepper({ value, min, max, step = 1, label, format = String, testID, onChange }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const canDec = value - step >= min;
  const canInc = value + step <= max;
  const dec = () => { if (canDec) onChange(value - step); };
  const inc = () => { if (canInc) onChange(value + step); };
  const btn = (enabled: boolean) => [styles.btn, { backgroundColor: colors.bgCardSoft, borderRadius: radius.sm, opacity: enabled ? 1 : 0.4 }];
  const sign = { color: colors.text, fontFamily: fonts.uiBold, fontSize: 18 };
  return (
    <View testID={testID} style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('stepper_decrease')} ${label}`} accessibilityState={{ disabled: !canDec }} onPress={dec} style={btn(canDec)}>
        <Text style={sign}>−</Text>
      </Pressable>
      <Text style={[styles.value, { color: colors.text, fontFamily: fonts.uiBold }]}>{format(value)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('stepper_increase')} ${label}`} accessibilityState={{ disabled: !canInc }} onPress={inc} style={btn(canInc)}>
        <Text style={sign}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 56, textAlign: 'center', fontSize: 18 },
});
