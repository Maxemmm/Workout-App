// Conseils des séances cardio / repos : titre + texte, ≤ 20
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from '@/features/common/TextField';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

type Tip = { title: string; body: string };
const MAX_TIPS = 20;

export function TipsEditor({ tips, onChange }: { tips: Tip[]; onChange(tips: Tip[]): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];
  const patch = (i: number, p: Partial<Tip>) => onChange(tips.map((tip, j) => (j === i ? { ...tip, ...p } : tip)));
  return (
    <View style={styles.root}>
      {tips.map((tip, i) => (
        <View key={i} style={[styles.card, { borderColor: colors.border, borderRadius: radius.md }]}>
          <View style={styles.row}>
            <TextField testID={`tip-title-${i}`} value={tip.title} maxLength={100} placeholder={t('editor_tip_title_ph')} placeholderTextColor={colors.textDim} onChangeText={(title) => patch(i, { title })} style={[field, styles.flex]} />
            <Pressable accessibilityRole="button" accessibilityLabel={`${t('editor_remove_item')} ${i + 1}`} onPress={() => onChange(tips.filter((_, j) => j !== i))} style={styles.icon}>
              <Ionicons name="close" size={18} color={colors.textDim} />
            </Pressable>
          </View>
          <TextField testID={`tip-body-${i}`} value={tip.body} maxLength={300} multiline placeholder={t('editor_tip_body_ph')} placeholderTextColor={colors.textDim} onChangeText={(body) => patch(i, { body })} style={field} />
        </View>
      ))}
      {tips.length < MAX_TIPS ? (
        <Pressable testID="tips-add" accessibilityRole="button" onPress={() => onChange([...tips, { title: '', body: '' }])} style={styles.add}>
          <Ionicons name="add" size={18} color={colors.gold} />
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('editor_add_tip')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  card: { borderWidth: 1, padding: 8, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
  input: { minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  icon: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  add: { minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
