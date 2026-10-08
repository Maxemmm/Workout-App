// Profil · Données — exporter (+ rappel de sauvegarde), importer
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { getSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { backupAge, type BackupAge } from '@/domain/backupAge';
import { localDateKey } from '@/domain/schedule';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { exportData } from './actions';

const readLastExport = (ctx: RepoCtx) => getSetting(ctx, 'lastExportAt');

function reminder(age: BackupAge, t: (k: StringKey, ...a: (string | number)[]) => string): string {
  if (age.kind === 'never') return t('profile_backup_never');
  if (age.days === 0) return t('profile_backup_today');
  return age.days === 1 ? t('profile_backup_one') : t('profile_backup_days', age.days);
}

export function DataSection({ onImport }: { onImport(): void }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const lastExportAt = useDbQuery(readLastExport);
  // Garde synchrone : deux taps avant le rendu suivant n'ouvrent qu'un partage
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const age = backupAge(lastExportAt, localDateKey(new Date()));
  const alert = age.kind !== 'recent';

  const onExport = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const outcome = await exportData(ctx, new Date());
    inFlight.current = false;
    setBusy(false);
    if (outcome === 'shared') useToastStore.getState().show(t('profile_export_done'));
    else if (outcome === 'failed') useToastStore.getState().show(t('profile_export_failed'));
    usePrefs.getState().bumpData();
  };

  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('profile_data').toUpperCase()}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile_export')}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => void onExport()}
        style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md, opacity: busy ? 0.6 : 1 }]}
      >
        <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('profile_export')}</Text>
      </Pressable>
      <Text style={{ color: alert ? colors.rust : colors.textDim, fontFamily: fonts.ui }}>{reminder(age, t)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile_import_label')}
        onPress={onImport}
        style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}
      >
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('profile_import_label')}</Text>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t('profile_import_sub')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  btn: { minHeight: TOUCH_MIN + 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
