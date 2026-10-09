// Ouverture de l'éditeur : reprise du brouillon ou nouveau brouillon (confirmation si une autre cible)
import { getProgram } from '@/db/repos/programsRepo';
import { getSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { draftFromProgram, newDraft, type Draft } from '@/domain/draft';
import { useDraftStore } from '@/state/draftStore';

export type EditorTarget = { kind: 'new' } | { kind: 'edit'; programId: string };

export function sameTarget(d: Draft, target: EditorTarget): boolean {
  return target.kind === 'new' ? d.sourceProgramId === null : d.sourceProgramId === target.programId;
}

export async function prepareEditor(ctx: RepoCtx, target: EditorTarget, confirmReplace: () => Promise<boolean>): Promise<boolean> {
  const store = useDraftStore.getState();
  const current = store.draft;
  if (current && sameTarget(current, target)) return true;
  const program = target.kind === 'edit' ? getProgram(ctx, target.programId) : null;
  if (target.kind === 'edit' && !program) return false;
  // Confirmation seulement si le brouillon en cours contient des modifications
  if (current && store.dirty && !(await confirmReplace())) return false;
  const units = getSetting(ctx, 'defaultUnits') === 'lbs' ? 'lbs' : 'kg';
  store.start(ctx, program ? draftFromProgram(program.id, program.definition) : newDraft(units));
  return true;
}
