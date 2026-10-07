// Premier lancement : aucun programme et onboarding jamais terminé
import { listPrograms } from '@/db/repos/programsRepo';
import { getSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';

export function needsOnboarding(ctx: RepoCtx): boolean {
  return listPrograms(ctx).length === 0 && getSetting(ctx, 'onboarded') !== true;
}
