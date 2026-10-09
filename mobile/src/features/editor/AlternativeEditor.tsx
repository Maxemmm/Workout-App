// Alternatives d'un exercice : nom seul, ou détail repliable (séries, schéma, charge, repos)
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from '@/features/common/TextField';
import { alternativeName, type Alternative } from '@/domain/program';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

const MAX_ALTERNATIVES = 10;
type AltObject = Exclude<Alternative, string>;

/** Détails vides retirés ; alternative sans aucun détail → simple nom (format historique) */
function normalize(alt: AltObject): Alternative {
  const clean = Object.fromEntries(
    Object.entries(alt).filter(([k, v]) => k === 'name' || (v !== undefined && v !== null && v !== '')),
  ) as AltObject;
  return Object.keys(clean).length > 1 ? clean : alt.name;
}

const toObject = (alt: Alternative): AltObject => (typeof alt === 'string' ? ({ name: alt } as AltObject) : alt);

export function AlternativeEditor({ value, onChange }: { value: Alternative[]; onChange(v: Alternative[]): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];

  const patch = (i: number, p: Partial<AltObject>) =>
    onChange(value.map((a, j) => (j === i ? normalize({ ...toObject(a), ...p }) : a)));
  const num = (text: string) => {
    const n = parseInt(text, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  return (
    <View style={styles.root}>
      {value.map((alt, i) => {
        const obj = toObject(alt);
        return (
          <View key={i} style={styles.item}>
            <View style={styles.row}>
              <TextField
                testID={`alt-name-${i}`}
                value={alternativeName(alt)}
                maxLength={100}
                placeholder={t('exo_alt_name_ph')}
                placeholderTextColor={colors.textDim}
                onChangeText={(name) => patch(i, { name })}
                style={field}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('editor_alt_details')} ${i + 1}`} onPress={() => setOpen(open === i ? null : i)} style={styles.icon}>
                <Ionicons name={open === i ? 'chevron-up' : 'options-outline'} size={18} color={colors.textDim} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('editor_remove_item')} ${i + 1}`} onPress={() => onChange(value.filter((_, j) => j !== i))} style={styles.icon}>
                <Ionicons name="close" size={18} color={colors.textDim} />
              </Pressable>
            </View>
            {open === i ? (
              <View style={styles.details}>
                <TextField
                  testID={`alt-sets-${i}`}
                  keyboardType="number-pad"
                  value={obj.sets != null ? String(obj.sets) : ''}
                  placeholder={t('exo_sets_label')}
                  placeholderTextColor={colors.textDim}
                  onChangeText={(v) => {
                    const n = num(v);
                    patch(i, { sets: n !== undefined && n >= 1 ? Math.min(20, n) : undefined });
                  }}
                  style={field}
                />
                <TextField testID={`alt-scheme-${i}`} maxLength={50} value={obj.scheme ?? ''} placeholder={t('exo_scheme_label')} placeholderTextColor={colors.textDim} onChangeText={(v) => patch(i, { scheme: v })} style={field} />
                <TextField testID={`alt-load-${i}`} maxLength={100} value={obj.load ?? ''} placeholder={t('exo_load_label_fmt', '')} placeholderTextColor={colors.textDim} onChangeText={(v) => patch(i, { load: v || null })} style={field} />
                <TextField
                  testID={`alt-rest-${i}`}
                  keyboardType="number-pad"
                  value={obj.restSec != null ? String(obj.restSec) : ''}
                  placeholder={t('exo_rest_label')}
                  placeholderTextColor={colors.textDim}
                  onChangeText={(v) => {
                    const n = num(v);
                    patch(i, { restSec: n !== undefined ? Math.min(600, n) : null });
                  }}
                  style={field}
                />
              </View>
            ) : null}
          </View>
        );
      })}
      {value.length < MAX_ALTERNATIVES ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('exo_add_alt')} onPress={() => onChange([...value, ''])} style={styles.add}>
          <Ionicons name="add" size={18} color={colors.gold} />
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('exo_add_alt')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  item: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: { flex: 1, minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  icon: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  details: { gap: 6, paddingLeft: 12 },
  add: { minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
