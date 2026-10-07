// Jour absent du planning : repos implicite générique
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function RestDayScreen() {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <View testID="rest-day" style={{ alignItems: 'center', gap: 10, paddingVertical: 40 }}>
      <Ionicons name="bed-outline" size={48} color={colors.textDim} />
      <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 32 }}>{t('today_rest_label')}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui, textAlign: 'center' }}>{t('today_rest_sub')}</Text>
    </View>
  );
}
