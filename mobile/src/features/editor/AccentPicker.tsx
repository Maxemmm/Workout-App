// Choix de la couleur d'une séance (or / rouille / bleu / gris)
import { Pressable, StyleSheet, View } from 'react-native';
import { ACCENT_KEYS, type AccentKey } from '@/domain/accents';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

export function AccentPicker({ value, onChange }: { value: string | null | undefined; onChange(accent: AccentKey): void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {ACCENT_KEYS.map((key) => {
        const selected = (value ?? 'gold') === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={t(`accent_${key}` as StringKey)}
            accessibilityState={{ selected }}
            onPress={() => onChange(key)}
            style={[styles.hit, { borderColor: selected ? colors.text : 'transparent' }]}
          >
            <View style={[styles.dot, { backgroundColor: accentColors(colors, key).fill }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  hit: { width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: TOUCH_MIN / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14 },
});
