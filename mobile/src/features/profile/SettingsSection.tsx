// Profil · Réglages — langue, thème, unité par défaut, écran allumé, Coach IA
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import type { Lang, ThemePref } from '@/domain/prefs';
import type { Units } from '@/domain/program';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Segmented } from './Segmented';

const readSettings = (ctx: RepoCtx) => ({
  keepAwake: getSetting(ctx, 'keepAwake') !== false,
  aiEnabled: getSetting(ctx, 'aiEnabled') === true,
  units: (getSetting(ctx, 'defaultUnits') === 'lbs' ? 'lbs' : 'kg') as Units,
});

/** Écriture d'un réglage puis rafraîchissement ; toast si elle échoue (fonction de module : compatible React Compiler) */
function write(fn: () => void, errorMessage: string): void {
  try {
    fn();
  } catch {
    useToastStore.getState().show(errorMessage);
  }
  usePrefs.getState().bumpData();
}

export function SettingsSection() {
  const ctx = useRepoCtx();
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const lang = usePrefs((s) => s.lang);
  const theme = usePrefs((s) => s.theme);
  const s = useDbQuery(readSettings);
  const label = [styles.label, { color: colors.textDim, fontFamily: fonts.uiBold }];
  const meta = { color: colors.textDim, fontFamily: fonts.ui };
  const failed = t('error_not_saved');

  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('profile_settings').toUpperCase()}</Text>
      <View style={styles.group}>
        <Text style={label}>{t('profile_language').toUpperCase()}</Text>
        <Segmented<Lang> options={[{ value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }]} value={lang} onChange={(v) => usePrefs.getState().setLang(ctx, v)} />
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
        <Text style={label}>{t('profile_default_units').toUpperCase()}</Text>
        <Text style={meta}>{t('profile_default_units_meta')}</Text>
        <Segmented<Units>
          options={[{ value: 'kg', label: 'kg' }, { value: 'lbs', label: 'lbs' }]}
          value={s.units}
          onChange={(v) => write(() => setSetting(ctx, 'defaultUnits', v), failed)}
        />
      </View>
      <View style={styles.group}>
        <Text style={label}>{t('profile_keep_awake').toUpperCase()}</Text>
        <Text style={meta}>{t('profile_keep_awake_meta')}</Text>
        <Segmented<'on' | 'off'>
          options={[{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }]}
          value={s.keepAwake ? 'on' : 'off'}
          onChange={(v) => write(() => setSetting(ctx, 'keepAwake', v === 'on'), failed)}
        />
      </View>
      <View style={[styles.group, styles.row]}>
        <View style={styles.flex}>
          <Text style={label}>{t('profile_ai_label').toUpperCase()}</Text>
          <Text style={meta}>{t('profile_ai_desc')}</Text>
        </View>
        <Switch
          testID="ai-switch"
          accessibilityLabel={t('profile_ai_label')}
          value={s.aiEnabled}
          onValueChange={(v) => write(() => setSetting(ctx, 'aiEnabled', v), failed)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  group: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 4 },
  label: { fontSize: 11, letterSpacing: 1.5 },
});
