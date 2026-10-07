// Enregistrement du brouillon : validation puis création (et activation) ou mise à jour
import { createProgram, getProgram, setActiveProgram, updateProgram } from '@/db/repos/programsRepo';
import type { RepoCtx } from '@/db/types';
import type { Draft } from '@/domain/draft';
import { validateDraft, type DraftError } from '@/domain/programRules';

export type SaveResult = { ok: true; programId: string } | { ok: false; errors: DraftError[] };

export function saveDraft(ctx: RepoCtx, draft: Draft): SaveResult {
  const v = validateDraft(draft);
  if (!v.ok) return v;
  const existing = draft.sourceProgramId ? getProgram(ctx, draft.sourceProgramId) : null;
  if (existing) {
    updateProgram(ctx, existing.id, v.program);
    return { ok: true, programId: existing.id };
  }
  const created = createProgram(ctx, v.program, 'manual');
  setActiveProgram(ctx, created.id);
  return { ok: true, programId: created.id };
}
