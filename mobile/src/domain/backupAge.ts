// Ancienneté de la dernière sauvegarde exportée (rappel dans Profil) — jours calendaires locaux
import { localDateKey } from './schedule';

export type BackupAge = { kind: 'never' } | { kind: 'recent'; days: number } | { kind: 'stale'; days: number };

/** Au-delà de ce nombre de jours, le rappel passe en alerte */
export const STALE_AFTER_DAYS = 14;

const dayNumber = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000;

export function backupAge(lastExportAt: string | undefined, today: string): BackupAge {
  if (typeof lastExportAt !== 'string') return { kind: 'never' };
  const ms = Date.parse(lastExportAt);
  if (Number.isNaN(ms)) return { kind: 'never' };
  const days = Math.max(0, dayNumber(today) - dayNumber(localDateKey(new Date(ms))));
  return days > STALE_AFTER_DAYS ? { kind: 'stale', days } : { kind: 'recent', days };
}
