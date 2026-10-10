// Profil · À propos · Crédits — attribution obligatoire (MIT, CC BY-SA 4.0) et liens vers les sources
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

const CC_BY_SA = 'https://creativecommons.org/licenses/by-sa/4.0/';
/** Sources (noms propres, non traduits) */
const SOURCES = [
  { label: 'exercises-dataset', url: 'https://github.com/hasaneyldrm/exercises-dataset' },
  { label: 'workout-guide', url: 'https://github.com/bryllim/workout-guide' },
  { label: 'Everkinetic', url: 'https://github.com/everkinetic/data' },
];

export function CreditsSection() {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const text = { color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 };
  const link = (label: string, url: string) => (
    <Pressable key={url} accessibilityRole="link" accessibilityLabel={label} onPress={() => void Linking.openURL(url)} style={styles.link}>
      <Text style={{ color: colors.gold, fontFamily: fonts.uiBold, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.root}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('profile_credits')}</Text>
      <Text style={text}>{t('credits_dataset')}</Text>
      <Text style={text}>{t('credits_illustrations')}</Text>
      <View style={styles.links}>
        {SOURCES.map((s) => link(s.label, s.url))}
        {link(t('credits_license_link'), CC_BY_SA)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 },
  link: { minHeight: TOUCH_MIN, justifyContent: 'center' },
});
