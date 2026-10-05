// Programme actif, relu à chaque changement de données (dataVersion)
import { getActiveProgram, type StoredProgram } from '@/db/repos/programsRepo';
import { useDbQuery } from '@/features/common/useDbQuery';

export function useActiveProgram(): StoredProgram | null {
  return useDbQuery(getActiveProgram);
}
