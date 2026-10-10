// Création / modification d'un exercice personnalisé : nom, muscle principal, secondaires, matériel, étapes
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { createCustomExercise, getCustomExercise, updateCustomExercise } from '@/db/repos/customExercisesRepo';
import { EQUIPMENT_KEYS, equipmentLabel, type EquipmentKey } from '@/domain/library/equipment';
import { MUSCLE_KEYS, muscleLabel, type MuscleKey } from '@/domain/library/muscles';
import { BottomSheet } from '@/features/common/BottomSheet';
import { ListEditor } from '@/features/common/ListEditor';
import { Screen } from '@/features/common/Screen';
import { TextField } from '@/features/common/TextField';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props { customId?: string; onDone(id: string): void; onCancel(): void }

export function CustomExerciseEditor({ customId, onDone, onCancel }: Props) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t, lang } = useI18n();
  const initial = customId ? getCustomExercise(ctx, customId) : null;
  const [name, setName] = useState(initial?.name ?? '');
  const [primary, setPrimary] = useState<MuscleKey | null>(initial?.primary ?? null);
  const [secondary, setSecondary] = useState<MuscleKey[]>(initial?.secondary ?? []);
  const [equipment, setEquipment] = useState<EquipmentKey | null>(initial?.equipment ?? null);
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? []);
  const [picking, setPicking] = useState<'primary' | 'equipment' | null>(null);
  const valid = name.trim().length > 0 && primary !== null && equipment !== null;
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];

  const save = () => {
    if (!valid) return;
    const input = { name, primary: primary!, secondary, equipment: equipment!, steps };
    try {
      const id = customId ? (updateCustomExercise(ctx, customId, input), customId) : createCustomExercise(ctx, input).id;
      usePrefs.getState().bumpData();
      onDone(id);
    } catch {
      useToastStore.getState().show(t('error_not_saved'));
    }
  };
  const pickerButton = (text: string, value: string | null, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress}
      style={[styles.input, styles.picker, { borderColor: colors.border, borderRadius: radius.sm }]}>
      <Text style={{ color: value ? colors.text : colors.textDim, fontFamily: fonts.uiBold }}>{value ?? text}</Text>
    </Pressable>
  );
  const option = (text: string, onPress: () => void) => (
    <Pressable key={text} accessibilityRole="button" accessibilityLabel={text} onPress={onPress}
      style={[styles.option, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.md }]}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{text}</Text>
    </Pressable>
  );

  return (
    <Screen safeBottom>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.hbtn}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('lib_cancel')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid }} onPress={save} style={[styles.hbtn, { alignItems: 'flex-end' }]}>
          <Text style={{ color: valid ? colors.gold : colors.textDim, fontFamily: fonts.uiBold }}>{t('lib_save')}</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{customId ? t('lib_custom_title_edit') : t('lib_custom_title_new')}</Text>
      <Text style={label}>{t('lib_custom_name').toUpperCase()}</Text>
      <TextField testID="custom-name" value={name} maxLength={100} onChangeText={setName} style={field} />
      <Text style={label}>{t('lib_primary').toUpperCase()}</Text>
      {pickerButton(t('lib_primary'), primary ? muscleLabel(primary, lang) : null, () => setPicking('primary'))}
      <Text style={label}>{t('lib_equipment').toUpperCase()}</Text>
      {pickerButton(t('lib_equipment'), equipment ? equipmentLabel(equipment, lang) : null, () => setPicking('equipment'))}
      <Text style={label}>{t('lib_secondary').toUpperCase()}</Text>
      <View style={styles.wrap}>
        {MUSCLE_KEYS.filter((m) => m !== primary).map((m) => {
          const on = secondary.includes(m);
          return (
            <Pressable key={m} accessibilityRole="checkbox" accessibilityLabel={muscleLabel(m, lang)} accessibilityState={{ checked: on }}
              onPress={() => setSecondary((s) => (on ? s.filter((x) => x !== m) : [...s, m]))}
              style={[styles.tag, { borderRadius: radius.full, borderColor: on ? colors.gold : colors.border, backgroundColor: on ? colors.gold : 'transparent' }]}>
              <Text style={{ color: on ? colors.onGold : colors.text, fontFamily: fonts.uiMedium, fontSize: 13 }}>{muscleLabel(m, lang)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={label}>{t('lib_steps').toUpperCase()}</Text>
      <ListEditor items={steps} onChange={setSteps} placeholder={t('lib_custom_steps_ph')} addLabel={t('lib_custom_add_step')} maxItems={20} maxLength={300} testID="custom-steps" />
      <BottomSheet visible={picking !== null} title={picking === 'primary' ? t('lib_primary') : t('lib_equipment')} onClose={() => setPicking(null)}>
        {picking === 'primary'
          ? MUSCLE_KEYS.map((m) => option(muscleLabel(m, lang), () => { setPrimary(m); setSecondary((s) => s.filter((x) => x !== m)); setPicking(null); }))
          : EQUIPMENT_KEYS.map((e) => option(equipmentLabel(e, lang), () => { setEquipment(e); setPicking(null); }))}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  hbtn: { minHeight: TOUCH_MIN, minWidth: TOUCH_MIN, justifyContent: 'center' },
  title: { fontSize: 32, letterSpacing: -0.5 },
  input: { minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  picker: { justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1 },
  option: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
});
