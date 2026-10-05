// ============================================================
// PROFIL (M1) — langue et thème. Le reste arrive en M4.
// ============================================================
import { StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import type { Lang, ThemePref } from '@/domain/prefs';
import { Screen } from '@/features/common/Screen';
import { Segmented } from '@/features/profile/Segmented';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileScreen() {
  const ctx = useRepoCtx();
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const lang = usePrefs((s) => s.lang);
  const theme = usePrefs((s) => s.theme);
  const label = [styles.label, { color: colors.textDim, fontFamily: fonts.uiBold }];

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('profile_title')}</Text>
      <View style={styles.group}>
        <Text style={label}>{t('profile_language').toUpperCase()}</Text>
        <Segmented<Lang>
          options={[{ value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }]}
          value={lang}
          onChange={(v) => usePrefs.getState().setLang(ctx, v)}
        />
      </View>
      <View style={styles.group}>
        <Text style={label}>{t('profile_theme').toUpperCase()}</Text>
        <Segmented<ThemePref>
          options={[
            { value: 'dark', label: t('profile_theme_dark') },
            { value: 'light', label: t('profile_theme_light') },
            { value: 'system', label: t('profile_theme_system') },
          ]}
          value={theme}
          onChange={(v) => usePrefs.getState().setTheme(ctx, v)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 44, letterSpacing: -0.5 },
  group: { gap: 8 },
  label: { fontSize: 11, letterSpacing: 1.5 },
});
