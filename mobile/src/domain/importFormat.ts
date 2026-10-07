// Détection du contenu importé — règle isBackupSnapshot de la PWA + format natif
export type ImportFormat = 'program' | 'pwa-backup' | 'native-backup' | 'unknown';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function detectImportFormat(value: unknown): ImportFormat {
  if (!isObj(value)) return 'unknown';
  if (value._format === 'workout-native') return 'native-backup';
  if (isObj(value.meta) && isObj(value.sessions) && !('programs' in value)) return 'program';
  if (value._backupFormat === 1 || 'programs' in value || 'activeProgram' in value) return 'pwa-backup';
  if (Object.keys(value).some((k) => /^(weight|log|track|layout):/.test(k))) return 'pwa-backup';
  return 'unknown';
}
