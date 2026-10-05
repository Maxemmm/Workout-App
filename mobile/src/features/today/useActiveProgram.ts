// Programme actif, relu à chaque changement de données (dataVersion)
import { useMemo } from 'react';
import { useRepoCtx } from '@/db/DbContext';
import { getActiveProgram, type StoredProgram } from '@/db/repos/programsRepo';
import { usePrefs } from '@/state/prefsStore';

export function useActiveProgram(): StoredProgram | null {
  const ctx = useRepoCtx();
  const dataVersion = usePrefs((s) => s.dataVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion force la relecture
  return useMemo(() => getActiveProgram(ctx), [ctx, dataVersion]);
}
