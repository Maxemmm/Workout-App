// ============================================================
// PROFIL — programme actif, réglages, données, zone de danger, à propos.
// ============================================================
import { StyleSheet, Text } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { getActiveProgram } from '@/db/repos/programsRepo';
import type { RepoCtx } from '@/db/types';
import { Screen } from '@/features/common/Screen';
import { useDbQuery } from '@/features/common/useDbQuery';
import { prepareEditor } from '@/features/editor/openEditor';
import { useI18n } from '@/i18n/I18nProvider';
import { appVersion } from '@/platform/appVersion';
import { confirm } from '@/platform/confirm';
import { useTheme } from '@/theme/ThemeProvider';
import { ActiveProgramCard } from './ActiveProgramCard';
import { DangerSection } from './DangerSection';
import { DataSection } from './DataSection';
import { SettingsSection } from './SettingsSection';
import { TimerSection } from './TimerSection';

const readActive = (ctx: RepoCtx) => getActiveProgram(ctx)?.definition ?? null;

interface Props {
  onManagePrograms(): void;
  onOpenEditor(): void;
  onImport(): void;
}

export function ProfileScreen({ onManagePrograms, onOpenEditor, onImport }: Props) {
  const ctx = useRepoCtx();
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const active = useDbQuery(readActive);

  const create = async () => {
    const ok = await prepareEditor(ctx, { kind: 'new' }, () =>
      confirm({ title: t('editor_replace_draft_title'), confirmLabel: t('editor_discard'), cancelLabel: t('editor_keep'), destructive: true }));
    if (ok) onOpenEditor();
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('profile_title')}</Text>
      <ActiveProgramCard program={active} onManage={onManagePrograms} onCreate={() => void create()} onImport={onImport} />
      <SettingsSection />
      <TimerSection />
      <DataSection onImport={onImport} />
      <DangerSection />
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('profile_about').toUpperCase()}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('profile_version_fmt', appVersion())}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 44, letterSpacing: -0.5 },
  section: { fontSize: 13, letterSpacing: 1.5 },
});
