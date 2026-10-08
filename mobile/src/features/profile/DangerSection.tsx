// Profil · Zone de danger — supprimer l'historique, réinitialiser l'application (confirmation destructive)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { deleteHistory, resetAll } from '@/db/repos/resetRepo';
import type { RepoCtx } from '@/db/types';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { confirm } from '@/platform/confirm';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { runReset } from './actions';

export function DangerSection() {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();

  const ask = async (title: StringKey, body: StringKey, button: StringKey, write: (c: RepoCtx) => void, done: StringKey | null) => {
    const ok = await confirm({ title: t(title), message: t(body), confirmLabel: t(button), cancelLabel: t('editor_cancel'), destructive: true });
    if (!ok) return;
    if (!runReset(ctx, write)) useToastStore.getState().show(t('error_not_saved'));
    else if (done) useToastStore.getState().show(t(done));
  };

  const item = (labelKey: StringKey, metaKey: StringKey, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(labelKey)}
      onPress={onPress}
      style={[styles.btn, { borderColor: colors.redDanger, borderWidth: 1, borderRadius: radius.md }]}
    >
      <Text style={{ color: colors.redDanger, fontFamily: fonts.uiBold }}>{t(labelKey)}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t(metaKey)}</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.redDanger, fontFamily: fonts.uiBold }]}>{t('profile_danger').toUpperCase()}</Text>
      {item('profile_delete_history', 'profile_delete_history_meta', () =>
        void ask('profile_confirm_history_title', 'profile_confirm_history_body', 'profile_delete_btn', deleteHistory, 'profile_history_deleted'))}
      {item('profile_reset_app', 'profile_reset_meta', () =>
        void ask('profile_confirm_reset_title', 'profile_confirm_reset_body', 'profile_reset_btn', resetAll, null))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  btn: { minHeight: TOUCH_MIN + 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
