// ============================================================
// Paquet d'import — contenu normalisé, indépendant du format source,
// écrit ensuite en une seule transaction (db/repos/importRepo).
// Les ids (sourceId, ref) ne servent qu'au remappage.
// ============================================================
import type { Lang, ThemePref } from './prefs';
import type { Program, Units } from './program';

export type BundleSource = 'manual' | 'ai' | 'import' | 'example';
export type BundleProgram = { sourceId: string; definition: Program; source: BundleSource };
export type WorkoutStatus = 'in_progress' | 'completed' | 'abandoned';
export type BundleWorkout = {
  ref: string; programRef: string; sessionKey: string; date: string;
  status: WorkoutStatus; startedAt: string; completedAt: string | null;
};
export type BundleSet = {
  workoutRef: string; exerciseId: string; setIndex: number; done: boolean;
  weight: number | null; reps: number | null; performedName: string | null; doneAt: string | null;
};
export type BundleWeight = { key: string; weight: number; unit: Units };
export type BundleLayout = { programRef: string; sessionKey: string; order: string[]; swaps: Record<string, string> };
export type BundleSettings = { lang?: Lang; theme?: ThemePref; aiEnabled?: boolean; keepAwake?: boolean };

export type IgnoreReason =
  | 'unknown_key' | 'invalid_program' | 'unknown_program' | 'unknown_session'
  | 'no_checked_set' | 'already_logged' | 'duplicate' | 'invalid_value';
export type IgnoredItem = { key: string; reason: IgnoreReason };
export type ImportReport = { programs: number; workouts: number; sets: number; weights: number; layouts: number; ignored: IgnoredItem[] };

export type ImportBundle = {
  programs: BundleProgram[];
  activeProgramRef: string | null;
  workouts: BundleWorkout[];
  sets: BundleSet[];
  weights: BundleWeight[];
  layouts: BundleLayout[];
  settings: BundleSettings;
  report: ImportReport;
};

export type ParseResult = { ok: true; bundle: ImportBundle } | { ok: false; error: 'invalid' | 'no_valid_program' };

/** Date calendaire AAAA-MM-JJ réelle (rejette 2026-13-45, 2026-02-30…) */
export const isIsoDay = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(`${d}T12:00:00Z`).toISOString().startsWith(d);

export function makeReport(b: Omit<ImportBundle, 'report'>, ignored: IgnoredItem[]): ImportReport {
  return {
    programs: b.programs.length, workouts: b.workouts.length, sets: b.sets.length,
    weights: b.weights.length, layouts: b.layouts.length, ignored,
  };
}
