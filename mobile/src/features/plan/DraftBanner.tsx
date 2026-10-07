// Bannière « Brouillon en cours » — reprendre ou abandonner
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

export function DraftBanner({ label, onResume, onDiscard }: { label: string; onResume(): void; onDiscard(): void }) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const btn = [styles.btn, { borderColor: colors.gold, borderRadius: radius.md }];
  return (
    <View style={{ gap: 10, borderColor: colors.gold, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.bgCard }}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('editor_draft_banner', label || t('editor_no_name'))}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onResume} style={btn}>
          <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('editor_draft_resume')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDiscard} style={btn}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('editor_discard')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, minHeight: TOUCH_MIN, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
