// ============================================================
// Réglages de l'appareil — clé/valeur JSON typée
// ============================================================
import { eq } from 'drizzle-orm';
import type { Lang, ThemePref } from '@/domain/prefs';
import type { Draft } from '@/domain/draft';
import type { Units } from '@/domain/program';
import type { StatsPeriod } from '@/domain/stats/period';
import type { TimerState } from '@/domain/timer';
import { settings } from '../schema';
import type { RepoCtx } from '../types';

export interface SettingsMap {
  activeProgramId: string;
  lang: Lang;
  theme: ThemePref;
  aiEnabled: boolean;
  keepAwake: boolean;
  onboarded: boolean;
  healthEnabled: boolean;
  programDraft: Draft;
  activeRest: TimerState;
  /** Unité proposée à la création d'un programme */
  defaultUnits: Units;
  /** Horodatage ISO du dernier export réussi */
  lastExportAt: string;
  /** Période des stats */
  statsPeriod: StatsPeriod;
}
export type SettingKey = keyof SettingsMap;

/** Valeur brute décodée ; le typage n'est pas vérifié ici (voir les gardes de prefs.ts) */
export function getSetting<K extends SettingKey>(ctx: RepoCtx, key: K): SettingsMap[K] | undefined {
  const row = ctx.db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as SettingsMap[K];
  } catch {
    return undefined;
  }
}

export function setSetting<K extends SettingKey>(ctx: RepoCtx, key: K, value: SettingsMap[K]): void {
  const now = ctx.now();
  const json = JSON.stringify(value);
  ctx.db
    .insert(settings)
    .values({ key, value: json, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: now } })
    .run();
}

export function deleteSetting(ctx: RepoCtx, key: SettingKey): void {
  ctx.db.delete(settings).where(eq(settings.key, key)).run();
}
