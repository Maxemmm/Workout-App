// Contrôle segmenté simple (cibles ≥ 44 pt)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors, fonts, radius } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.item, { borderRadius: radius.md, backgroundColor: active ? colors.gold : 'transparent' }]}
          >
            <Text style={{ color: active ? colors.onGold : colors.text, fontFamily: fonts.uiBold }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4, gap: 4 },
  item: { flex: 1, minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
