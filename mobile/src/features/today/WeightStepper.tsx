// Sélecteur de poids [−][valeur][+] — saisie libre validée à la sortie du champ
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Units } from '@/domain/program';
import { formatWeight, parseWeightInput, weightStep } from '@/domain/scheme';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  value: number | null;
  units: Units;
  testID?: string;
  onChange(value: number | null): void;
}

export function WeightStepper({ value, units, testID, onChange }: Props) {
  const { colors, fonts, radius } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const step = weightStep(units);
  const shown = draft ?? (value !== null ? formatWeight(value) : '');

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    onChange(parseWeightInput(draft));
  };
  const bump = (delta: number) => {
    const next = Math.max(0, (value ?? 0) + delta);
    onChange(next > 0 ? next : null);
  };

  const btn = [styles.btn, { backgroundColor: colors.bgCardSoft, borderRadius: radius.sm }];
  const btnText = { color: colors.text, fontFamily: fonts.uiBold, fontSize: 18 };
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`− ${step} ${units}`} onPress={() => bump(-step)} style={btn}>
        <Text style={btnText}>−</Text>
      </Pressable>
      <TextInput
        testID={testID}
        value={shown}
        placeholder="—"
        placeholderTextColor={colors.textDim}
        keyboardType="decimal-pad"
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        style={[styles.input, { color: colors.text, fontFamily: fonts.uiBold, borderColor: colors.border, borderRadius: radius.sm }]}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={`+ ${step} ${units}`} onPress={() => bump(step)} style={btn}>
        <Text style={btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  input: { minWidth: 72, height: TOUCH_MIN, borderWidth: 1, textAlign: 'center', fontSize: 16 },
});
