// « Terminer la séance » + lien « Réinitialiser la séance du jour »
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  canFinish: boolean;
  showReset: boolean;
  onFinish(): void;
  onReset(): void;
}

export function TodayFooter({ canFinish, showReset, onFinish, onReset }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  if (!canFinish && !showReset) return null;
  return (
    <View style={styles.root}>
      {canFinish ? (
        <Pressable accessibilityRole="button" onPress={onFinish} style={[styles.primary, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
          <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('today_finish_session')}</Text>
        </Pressable>
      ) : null}
      {showReset ? (
        <Pressable accessibilityRole="button" onPress={onReset} style={styles.link}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiMedium, textDecorationLine: 'underline' }}>{t('profile_reset_today')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, alignItems: 'stretch' },
  primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
