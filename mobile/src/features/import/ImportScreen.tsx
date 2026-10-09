// ============================================================
// IMPORT — fichier ou JSON collé → aperçu (type + rapport) → confirmation.
// Sauvegarde : remplacement total en une transaction, après confirmation.
// ============================================================
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { importProgram, replaceAll } from '@/db/repos/importRepo';
import type { RepoCtx } from '@/db/types';
import type { ImportBundle } from '@/domain/importBundle';
import { localDateKey } from '@/domain/schedule';
import { Screen } from '@/features/common/Screen';
import { programSummary } from '@/features/plan/planStats';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { confirm } from '@/platform/confirm';
import { pickJsonFile } from '@/platform/pickJsonFile';
import { useDraftStore } from '@/state/draftStore';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { analyzeImport } from './analyzeImport';

/** Écriture puis relecture des stores ; false si elle échoue (hors composant : compatible React Compiler) */
function attempt(ctx: RepoCtx, write: () => void): boolean {
  try {
    write();
  } catch {
    return false;
  }
  usePrefs.getState().hydrate(ctx);
  useTimerStore.getState().hydrate(ctx, Date.now());
  useDraftStore.getState().hydrate(ctx);
  usePrefs.getState().bumpData();
  return true;
}

export function ImportScreen({ onDone, onCancel }: { onDone(kind: 'program' | 'backup'): void; onCancel(): void }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [pickError, setPickError] = useState<StringKey | null>(null);
  const analysis = analyzeImport(text, localDateKey(new Date()));

  const pick = async () => {
    const r = await pickJsonFile();
    if (r.kind === 'ok') {
      setPickError(null);
      setText(r.text);
    } else if (r.kind === 'too_large') setPickError('import_err_too_large');
    else if (r.kind === 'error') setPickError('import_err_read');
  };

  const ignoredLine = (bundle: ImportBundle) => {
    const items = bundle.report.ignored.map((i) => `${i.key} (${t(`import_reason_${i.reason}` as StringKey)})`);
    return items.length ? t('import_ignored', items.length, items.join(', ')) : null;
  };

  const confirmProgram = () => {
    if (analysis.kind !== 'program') return;
    if (attempt(ctx, () => { importProgram(ctx, analysis.raw); })) {
      useToastStore.getState().show(t('editor_imported'));
      onDone('program');
    } else useToastStore.getState().show(t('error_not_saved'));
  };
  const confirmBackup = async () => {
    if (analysis.kind !== 'backup') return;
    const ok = await confirm({ title: t('import_confirm_replace_title'), message: t('import_replace_body'), confirmLabel: t('import_backup_confirm_btn'), cancelLabel: t('editor_cancel'), destructive: true });
    if (!ok) return;
    if (attempt(ctx, () => { replaceAll(ctx, analysis.bundle); })) {
      useToastStore.getState().show(t('profile_import_toast'));
      onDone('backup');
    } else useToastStore.getState().show(t('error_not_saved'));
  };

  const primary = [styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }];
  const ignored = analysis.kind === 'backup' ? ignoredLine(analysis.bundle) : null;
  return (
    <Screen safeBottom>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.back}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('editor_cancel')}</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('import_title')}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('import_auto_body')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void pick()} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('import_file_btn')}</Text>
      </Pressable>
      {pickError ? <Text style={{ color: colors.redDanger, fontFamily: fonts.ui }}>{t(pickError)}</Text> : null}
      <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('import_paste_label').toUpperCase()}</Text>
      <TextInput
        testID="import-text"
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={t('import_auto_ph')}
        placeholderTextColor={colors.textDim}
        style={[styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }]}
      />
      {analysis.kind === 'error' ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.redDanger, fontFamily: fonts.uiBold }}>{t(analysis.message)}</Text>
          {analysis.details?.map((d, i) => <Text key={i} style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{d}</Text>)}
        </View>
      ) : null}
      {analysis.kind === 'program' ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontFamily: fonts.ui }}>
            {t('import_preview_program', analysis.program.meta.label, Object.keys(analysis.program.sessions).length, programSummary(analysis.program).days)}
          </Text>
          <Pressable accessibilityRole="button" onPress={confirmProgram} style={primary}>
            <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('import_confirm_btn')}</Text>
          </Pressable>
        </View>
      ) : null}
      {analysis.kind === 'backup' ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontFamily: fonts.ui }}>
            {t('import_preview_backup', analysis.bundle.report.programs, analysis.bundle.report.workouts, analysis.bundle.report.sets, analysis.bundle.report.weights)}
          </Text>
          {ignored ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{ignored}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => void confirmBackup()} style={primary}>
            <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('import_backup_confirm_btn')}</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  back: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  title: { fontSize: 40, letterSpacing: -0.5 },
  btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 140, borderWidth: 1, padding: 12, textAlignVertical: 'top' },
});
