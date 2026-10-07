// Section BONUS : cartes cochables, hors compteur N
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function BonusBlock({ title, children }: { title: string | null | undefined; children: ReactNode }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{(title || t('today_bonus')).toUpperCase()}</Text>
      {children}
    </View>
  );
}
