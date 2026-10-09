// Sélecteur de poids [−][valeur][+] — saisie libre enregistrée à chaque frappe
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from '@/features/common/TextField';
import type { Units } from '@/domain/program';
import { formatWeight, parseWeightInput, weightStep } from '@/domain/scheme';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  value: number | null;
  units: Units;
  testID?: string;
  /** Couleur du texte saisi (carte complète sur fond vert) */
  textColor?: string;
  onChange(value: number | null): void;
}

export function WeightStepper({ value, units, testID, textColor, onChange }: Props) {
  const { colors, fonts, radius } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const step = weightStep(units);
  const shown = draft ?? (value !== null ? formatWeight(value) : '');

  // Chaque frappe est enregistrée tout de suite : une série cochée sans quitter le champ prend le poids tapé
  const edit = (text: string) => {
    setDraft(text);
    onChange(parseWeightInput(text));
  };
  // Sortie du champ : l'affichage revient à la valeur normalisée
  const commit = () => setDraft(null);
  const bump = (delta: number) => {
    const base = draft !== null ? parseWeightInput(draft) : value;
    setDraft(null);
    const next = Math.max(0, (base ?? 0) + delta);
    onChange(next > 0 ? next : null);
  };

  const btn = [styles.btn, { backgroundColor: colors.bgCardSoft, borderRadius: radius.sm }];
  const btnText = { color: colors.text, fontFamily: fonts.uiBold, fontSize: 18 };
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`− ${step} ${units}`} onPress={() => bump(-step)} style={btn}>
        <Text style={btnText}>−</Text>
      </Pressable>
      <TextField
        testID={testID}
        value={shown}
        placeholder="—"
        placeholderTextColor={colors.textDim}
        keyboardType="decimal-pad"
        onChangeText={edit}
        onBlur={commit}
        onSubmitEditing={commit}
        style={[styles.input, { color: textColor ?? colors.text, fontFamily: fonts.uiBold, borderColor: textColor ?? colors.border, borderRadius: radius.sm }]}
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
