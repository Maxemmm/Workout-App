// Saisie poids / reps d'une série (appui long sur un cercle)
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Units } from '@/domain/program';
import { formatWeight, parseWeightInput } from '@/domain/scheme';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { BottomSheet } from '@/features/common/BottomSheet';

interface Props {
  visible: boolean;
  setIndex: number;
  units: Units;
  initialWeight: number | null;
  initialReps: number | null;
  onSave(values: { weight: number | null; reps: number | null }): void;
  onClose(): void;
}

function parseReps(text: string): number | null {
  const n = parseInt(text.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function SetEditSheet({ visible, setIndex, units, initialWeight, initialReps, onSave, onClose }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const [weight, setWeight] = useState(initialWeight !== null ? formatWeight(initialWeight) : '');
  const [reps, setReps] = useState(initialReps !== null ? String(initialReps) : '');
  const field = [styles.input, { color: colors.text, fontFamily: fonts.uiBold, borderColor: colors.border, borderRadius: radius.sm }];
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };

  const actions = (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onClose} style={[styles.btn, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('today_cancel')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSave({ weight: parseWeightInput(weight), reps: parseReps(reps) })}
        style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}
      >
        <Text style={{ color: colors.onGold, fontFamily: fonts.uiBold }}>{t('today_save')}</Text>
      </Pressable>
    </View>
  );

  return (
    <BottomSheet visible={visible} title={t('today_set_title', setIndex + 1)} onClose={onClose} footer={actions}>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={label}>{`${t('today_weight').toUpperCase()} (${units})`}</Text>
          <TextInput testID="set-edit-weight" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.textDim} style={field} />
        </View>
        <View style={styles.col}>
          <Text style={label}>{t('today_reps').toUpperCase()}</Text>
          <TextInput testID="set-edit-reps" value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="—" placeholderTextColor={colors.textDim} style={field} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1, gap: 6 },
  input: { height: TOUCH_MIN + 4, borderWidth: 1, textAlign: 'center', fontSize: 18 },
  btn: { flex: 1, minHeight: TOUCH_MIN + 4, alignItems: 'center', justifyContent: 'center' },
});
