// ============================================================
// PLAN — Cette semaine / Mes programmes, bannière de brouillon.
// Les écritures (activer, dupliquer, supprimer) passent par programsRepo.
// ============================================================
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { useRepoCtx } from '@/db/DbContext';
import { duplicateProgram, getActiveProgram, listPrograms, setActiveProgram, softDeleteProgram } from '@/db/repos/programsRepo';
import type { RepoCtx } from '@/db/types';
import { Screen } from '@/features/common/Screen';
import { useDbQuery } from '@/features/common/useDbQuery';
import type { EditorStep } from '@/features/editor/nav';
import { prepareEditor, type EditorTarget } from '@/features/editor/openEditor';
import { useI18n } from '@/i18n/I18nProvider';
import { confirm } from '@/platform/confirm';
import { useDraftStore } from '@/state/draftStore';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { DraftBanner } from './DraftBanner';
import { PlanTabs, type PlanTab } from './PlanTabs';
import { ProgramsView } from './ProgramsView';
import { WeekView } from './WeekView';

const readPlan = (ctx: RepoCtx) => ({ programs: listPrograms(ctx), active: getActiveProgram(ctx) });

/** Écriture + rafraîchissement ; false et toast d'erreur si elle échoue (fonction de module : compatible React Compiler) */
function attempt(write: () => void, errorMessage: string): boolean {
  try {
    write();
    return true;
  } catch {
    useToastStore.getState().show(errorMessage);
    return false;
  } finally {
    usePrefs.getState().bumpData();
  }
}

export function PlanScreen({ onOpenEditor }: { onOpenEditor(step: EditorStep): void }) {
  const ctx = useRepoCtx();
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const { programs, active } = useDbQuery(readPlan);
  const draft = useDraftStore((s) => s.draft);
  const lost = useDraftStore((s) => s.lost);
  const [tab, setTab] = useState<PlanTab>('week');

  useEffect(() => {
    if (!lost) return;
    useToastStore.getState().show(t('editor_draft_lost'));
    useDraftStore.getState().ackLost();
  }, [lost, t]);

  const open = async (target: EditorTarget, step: EditorStep) => {
    const ok = await prepareEditor(ctx, target, () =>
      confirm({ title: t('editor_replace_draft_title'), confirmLabel: t('editor_discard'), cancelLabel: t('editor_keep'), destructive: true }));
    if (ok) onOpenEditor(step);
  };
  const activate = (id: string) => {
    if (attempt(() => setActiveProgram(ctx, id), t('error_not_saved'))) useToastStore.getState().show(t('plan_activated'));
  };
  const duplicate = (id: string) => {
    if (attempt(() => { duplicateProgram(ctx, id, t('editor_copy_suffix')); }, t('error_not_saved'))) useToastStore.getState().show(t('plan_duplicated'));
  };
  const remove = async (id: string) => {
    const label = programs.find((p) => p.id === id)?.definition.meta.label ?? '';
    const ok = await confirm({ title: t('plan_delete'), message: t('plan_confirm_delete', label), confirmLabel: t('plan_delete'), cancelLabel: t('editor_cancel'), destructive: true });
    if (!ok) return;
    if (attempt(() => softDeleteProgram(ctx, id), t('error_not_saved'))) useToastStore.getState().show(t('plan_deleted'));
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('plan_title')}</Text>
      {draft ? (
        <DraftBanner
          label={draft.program.meta.label}
          onResume={() => onOpenEditor(1)}
          onDiscard={() => useDraftStore.getState().discard(ctx)}
        />
      ) : null}
      <PlanTabs value={tab} onChange={setTab} />
      <Animated.View key={tab} entering={(tab === 'programs' ? SlideInRight : SlideInLeft).duration(220)}>
        {tab === 'week' ? (
          <WeekView
            program={active?.definition ?? null}
            today={new Date()}
            onAddSession={() => { if (active) void open({ kind: 'edit', programId: active.id }, 2); }}
            onCreate={() => void open({ kind: 'new' }, 1)}
          />
        ) : (
          <ProgramsView
            programs={programs}
            activeId={active?.id ?? null}
            onActivate={activate}
            onEdit={(id) => void open({ kind: 'edit', programId: id }, 1)}
            onDuplicate={duplicate}
            onDelete={(id) => void remove(id)}
            onCreate={() => void open({ kind: 'new' }, 1)}
          />
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { fontSize: 44, letterSpacing: -0.5 } });
