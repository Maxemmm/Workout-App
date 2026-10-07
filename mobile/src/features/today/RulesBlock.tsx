// Règles du programme, repliables
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

export function RulesBlock({ rules }: { rules: string[] }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (rules.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{ minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('today_rules').toUpperCase()}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textDim} />
      </Pressable>
      {open && rules.map((r, i) => <Text key={i} style={{ color: colors.textDim, fontFamily: fonts.ui }}>{`· ${r}`}</Text>)}
    </View>
  );
}
