// Fenêtre de détail d'un exercice : séries, chronométré, reps/secondes, charge, repos, consigne, alternatives
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { TextField } from '@/features/common/TextField';
import type { ExerciseInput } from '@/domain/draft';
import { alternativeName, type Exercise, type Units } from '@/domain/program';
import { BottomSheet } from '@/features/common/BottomSheet';
import { NumberStepper } from '@/features/common/NumberStepper';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { AlternativeEditor } from './AlternativeEditor';

/** Nouvel exercice : restSec null = repos par défaut du programme (meta.restDefaultSec) */
export function blankExercise(): ExerciseInput {
  return { name: '', sets: 3, scheme: '', timed: false, load: null, restSec: null, cue: null, alternatives: [] } as ExerciseInput;
}

interface Props {
  visible: boolean;
  initial: Exercise | ExerciseInput;
  isNew: boolean;
  units: Units;
  /** Repos par défaut du programme, affiché tant que l'exercice n'a pas son propre repos */
  restDefault: number;
  onSave(input: ExerciseInput): void;
  onClose(): void;
  /** Ouvre le sélecteur de la bibliothèque avec le formulaire en cours */
  onPickLibrary?(form: ExerciseInput): void;
  /** Nom de l'entrée liée (langue de l'app) ; null si inconnue */
  libraryName?: string | null;
}

export function ExerciseSheet({ visible, initial, isNew, units, restDefault, onSave, onClose, onPickLibrary, libraryName }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const { id: _id, ...rest } = initial as Exercise;
  const [form, setForm] = useState<ExerciseInput>({ ...rest, timed: rest.timed === true, restSec: rest.restSec ?? null } as ExerciseInput);
  const set = (p: Partial<ExerciseInput>) => setForm((f) => ({ ...f, ...p }));
  const valid = form.name.trim().length > 0;
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };
  const text = (v: string) => (v.trim() ? v.trim() : null);

  const submit = () => {
    if (!valid) return;
    // Délié : la clé disparaît (pas de libraryId: undefined dans le programme)
    const { libraryId, ...unlinked } = form;
    onSave({
      ...unlinked,
      ...(typeof libraryId === 'string' && libraryId ? { libraryId } : {}),
      name: form.name.trim(),
      scheme: form.scheme.trim(),
      load: text(form.load ?? ''),
      cue: text(form.cue ?? ''),
      alternatives: form.alternatives.filter((a) => alternativeName(a).trim() !== ''),
    } as ExerciseInput);
  };

  const actions = (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onClose} style={[styles.btn, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('exo_cancel')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid }} onPress={submit} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md, opacity: valid ? 1 : 0.5 }]}>
        <Text style={{ color: colors.onGold, fontFamily: fonts.uiBold }}>{t('exo_save')}</Text>
      </Pressable>
    </View>
  );

  return (
    <BottomSheet visible={visible} title={isNew ? t('editor_new_exo') : t('editor_edit_exo')} onClose={onClose} footer={actions}>
      {typeof form.libraryId === 'string' && form.libraryId ? (
        <View style={styles.linkRow}>
          <Text style={[styles.flexText, { color: colors.textDim, fontFamily: fonts.uiMedium }]}>{t('lib_linked_fmt', libraryName ?? form.libraryId)}</Text>
          {onPickLibrary ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('lib_change')} onPress={() => onPickLibrary(form)} style={styles.linkBtn}>
              <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('lib_change')}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('lib_unlink')} onPress={() => set({ libraryId: undefined })} style={styles.linkBtn}>
            <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('lib_unlink')}</Text>
          </Pressable>
        </View>
      ) : onPickLibrary ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('lib_choose_from_library')} onPress={() => onPickLibrary(form)} style={[styles.pickBtn, { borderColor: colors.gold, borderRadius: radius.md }]}>
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('lib_choose_from_library')}</Text>
        </Pressable>
      ) : null}
      <Text style={label}>{t('exo_name_label').toUpperCase()}</Text>
      <TextField testID="exo-name" value={form.name} maxLength={100} placeholder={t('exo_name_ph')} placeholderTextColor={colors.textDim} onChangeText={(name) => set({ name })} style={field} />
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={label}>{t('exo_sets_label').toUpperCase()}</Text>
          <NumberStepper value={form.sets} min={1} max={20} label={t('exo_sets_label')} onChange={(sets) => set({ sets })} />
        </View>
        <View style={styles.timed}>
          <Text style={label}>{t('exo_timed_label')}</Text>
          <Switch testID="exo-timed" value={form.timed === true} onValueChange={(timed) => set({ timed })} />
        </View>
      </View>
      <Text style={label}>{t('exo_scheme_label').toUpperCase()}</Text>
      <TextField testID="exo-scheme" value={form.scheme} maxLength={50} placeholder={form.timed ? t('exo_scheme_ph_timed') : t('exo_scheme_ph')} placeholderTextColor={colors.textDim} onChangeText={(scheme) => set({ scheme })} style={field} />
      <Text style={label}>{t('exo_load_label_fmt', units).toUpperCase()}</Text>
      <TextField testID="exo-load" value={form.load ?? ''} maxLength={100} placeholderTextColor={colors.textDim} onChangeText={(load) => set({ load })} style={field} />
      <Text style={label}>{t('exo_rest_label').toUpperCase()}</Text>
      <NumberStepper value={form.restSec ?? restDefault} min={0} max={600} step={15} label={t('exo_rest_label')} onChange={(restSec) => set({ restSec })} />
      <Text style={label}>{t('exo_cue_label').toUpperCase()}</Text>
      <TextField testID="exo-cue" value={form.cue ?? ''} maxLength={300} placeholder={t('exo_cue_ph')} placeholderTextColor={colors.textDim} onChangeText={(cue) => set({ cue })} style={field} />
      <Text style={label}>{t('exo_alt_label').toUpperCase()}</Text>
      <AlternativeEditor value={form.alternatives} onChange={(alternatives) => set({ alternatives })} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  col: { flex: 1, gap: 6 },
  timed: { alignItems: 'center', gap: 6 },
  btn: { flex: 1, minHeight: TOUCH_MIN + 4, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flexText: { flex: 1 },
  linkBtn: { minHeight: TOUCH_MIN, justifyContent: 'center', paddingHorizontal: 6 },
  pickBtn: { minHeight: TOUCH_MIN + 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
