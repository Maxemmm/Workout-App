// Écran provisoire pour les onglets livrés aux jalons suivants
import { StyleSheet, Text } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { useTheme } from '@/theme/ThemeProvider';
import { Screen } from './Screen';

export function ComingSoon({ titleKey }: { titleKey: StringKey }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t(titleKey).toUpperCase()}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('coming_soon')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { fontSize: 40, letterSpacing: -0.5 } });
