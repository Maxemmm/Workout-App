// ============================================================
// PROFIL (M1-M2) — langue, thème, écran allumé. Le reste arrive en M4.
// ============================================================
import { StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import type { Lang, ThemePref } from '@/domain/prefs';
import { Screen } from '@/features/common/Screen';
import { useDbQuery } from '@/features/common/useDbQuery';
import { Segmented } from '@/features/profile/Segmented';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useTheme } from '@/theme/ThemeProvider';

const readKeepAwake = (ctx: RepoCtx) => getSetting(ctx, 'keepAwake') !== false;

export default function ProfileScreen() {
  const ctx = useRepoCtx();
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const lang = usePrefs((s) => s.lang);
  const theme = usePrefs((s) => s.theme);
  const keepAwakeOn = useDbQuery(readKeepAwake);
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
      <View style={styles.group}>
        <Text style={label}>{t('profile_keep_awake').toUpperCase()}</Text>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('profile_keep_awake_meta')}</Text>
        <Segmented<'on' | 'off'>
          options={[{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }]}
          value={keepAwakeOn ? 'on' : 'off'}
          onChange={(v) => { setSetting(ctx, 'keepAwake', v === 'on'); usePrefs.getState().bumpData(); }}
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
