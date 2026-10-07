// État vide de Today : pas de programme → créer ou importer
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function NoProgram({ onCreate, onImport }: { onCreate(): void; onImport(): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('today_no_program_title')}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('today_no_program_sub')}</Text>
      <Pressable accessibilityRole="button" onPress={onCreate} style={[styles.button, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
        <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('today_create_program')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onImport} style={[styles.button, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('onboarding_import')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingTop: 40 },
  title: { fontSize: 40, letterSpacing: -0.5 },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
});
