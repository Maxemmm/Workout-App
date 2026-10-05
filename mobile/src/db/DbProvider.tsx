// Applique les migrations au démarrage puis fournit le RepoCtx aux écrans
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { ReactNode } from 'react';
import migrations from '../../drizzle/migrations';
import { MigrationErrorScreen } from '@/features/common/MigrationErrorScreen';
import { appCtx, db } from './client';
import { DbContext } from './DbContext';

export function DbProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  if (error) return <MigrationErrorScreen error={error} />;
  if (!success) return null;
  return <DbContext.Provider value={appCtx}>{children}</DbContext.Provider>;
}
