// Actions de Profil (fonctions de module : compatibles React Compiler)
import { readBundle } from '@/db/repos/exportRepo';
import { setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { toNativeBackup } from '@/domain/nativeBackup';
import { localDateKey } from '@/domain/schedule';
import { shareJsonFile } from '@/platform/shareJsonFile';
import { useDraftStore } from '@/state/draftStore';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';

export type ExportOutcome = 'shared' | 'cancelled' | 'failed';

/** Export natif v1 → feuille de partage ; lastExportAt écrit seulement si le partage aboutit */
export async function exportData(ctx: RepoCtx, now: Date): Promise<ExportOutcome> {
  try {
    const text = JSON.stringify(toNativeBackup(readBundle(ctx), now.toISOString()), null, 2);
    const result = await shareJsonFile(`workout-backup-${localDateKey(now)}.json`, text);
    if (result === 'shared') setSetting(ctx, 'lastExportAt', now.toISOString());
    return result;
  } catch {
    return 'failed';
  }
}

/** Suppression (une transaction) puis relecture des stores ; false si l'écriture échoue */
export function runReset(ctx: RepoCtx, write: (ctx: RepoCtx) => void): boolean {
  try {
    write(ctx);
  } catch {
    return false;
  }
  usePrefs.getState().hydrate(ctx);
  useTimerStore.getState().clear(ctx);
  useDraftStore.getState().hydrate(ctx);
  usePrefs.getState().bumpData();
  return true;
}
