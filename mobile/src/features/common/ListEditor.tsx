// Liste de textes éditable (échauffement, règles) — plafond d'éléments et de longueur
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from '@/features/common/TextField';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  items: string[];
  onChange(items: string[]): void;
  placeholder: string;
  addLabel: string;
  maxItems: number;
  maxLength: number;
  testID: string;
}

export function ListEditor({ items, onChange, placeholder, addLabel, maxItems, maxLength, testID }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];
  return (
    <View style={styles.root}>
      {items.map((item, i) => (
        <View key={i} style={styles.row}>
          <TextField
            testID={`${testID}-${i}`}
            value={item}
            maxLength={maxLength}
            placeholder={placeholder}
            placeholderTextColor={colors.textDim}
            onChangeText={(text) => onChange(items.map((v, j) => (j === i ? text : v)))}
            style={field}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('editor_remove_item')} ${i + 1}`}
            onPress={() => onChange(items.filter((_, j) => j !== i))}
            style={styles.icon}
          >
            <Ionicons name="close" size={18} color={colors.textDim} />
          </Pressable>
        </View>
      ))}
      {items.length < maxItems ? (
        <Pressable testID={`${testID}-add`} accessibilityRole="button" onPress={() => onChange([...items, ''])} style={styles.add}>
          <Ionicons name="add" size={18} color={colors.gold} />
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{addLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { flex: 1, minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  icon: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  add: { minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
