// ============================================================
// Sauvegarde native « workout-native » v1 (spec §3.7).
// Lecture au M3b ; l'export du M4 utilisera toNativeBackup.
// ============================================================
import {
  isIsoDay, makeReport, type BundleLayout, type BundleProgram, type BundleSet, type BundleSettings, type BundleSource,
  type BundleWeight, type BundleWorkout, type IgnoredItem, type ImportBundle, type ParseResult, type WorkoutStatus,
} from './importBundle';
import { isLang, isThemePref } from './prefs';
import { parseProgram, type Program } from './program';

export type NativeBackup = {
  _format: 'workout-native';
  _version: 1;
  exportedAt: string;
  programs: { id: string; source: BundleSource; definition: Program }[];
  activeProgramId: string | null;
  workouts: { id: string; programId: string; sessionKey: string; date: string; status: WorkoutStatus; startedAt: string; completedAt: string | null }[];
  setEntries: {
    workoutId: string; exerciseId: string; setIndex: number; done: boolean;
    weight: number | null; reps: number | null; performedName: string | null; doneAt: string | null;
  }[];
  weights: BundleWeight[];
  layouts: { programId: string; sessionKey: string; order: string[]; swaps: Record<string, string> }[];
  settings: BundleSettings;
};

const SOURCES: BundleSource[] = ['manual', 'ai', 'import', 'example'];
const STATUSES: WorkoutStatus[] = ['in_progress', 'completed', 'abandoned'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function toNativeBackup(bundle: ImportBundle, exportedAt: string): NativeBackup {
  return {
    _format: 'workout-native',
    _version: 1,
    exportedAt,
    programs: bundle.programs.map((p) => ({ id: p.sourceId, source: p.source, definition: p.definition })),
    activeProgramId: bundle.activeProgramRef,
    workouts: bundle.workouts.map((w) => ({
      id: w.ref, programId: w.programRef, sessionKey: w.sessionKey, date: w.date,
      status: w.status, startedAt: w.startedAt, completedAt: w.completedAt,
    })),
    setEntries: bundle.sets.map(({ workoutRef, ...rest }) => ({ workoutId: workoutRef, ...rest })),
    weights: bundle.weights,
    layouts: bundle.layouts.map(({ programRef, ...rest }) => ({ programId: programRef, ...rest })),
    settings: bundle.settings,
  };
}

export function parseNativeBackup(value: unknown): ParseResult {
  if (!isObj(value) || value._format !== 'workout-native' || value._version !== 1) return { ok: false, error: 'invalid' };
  const ignored: IgnoredItem[] = [];

  const programs: BundleProgram[] = [];
  list(value.programs).forEach((p, i) => {
    const parsed = isObj(p) ? parseProgram(p.definition) : null;
    if (!isObj(p) || !str(p.id) || !parsed?.ok) {
      ignored.push({ key: `programs[${i}]`, reason: 'invalid_program' });
      return;
    }
    const source = SOURCES.includes(p.source as BundleSource) ? (p.source as BundleSource) : 'import';
    programs.push({ sourceId: p.id, source, definition: parsed.program });
  });
  if (programs.length === 0) return { ok: false, error: 'no_valid_program' };
  const programIds = new Set(programs.map((p) => p.sourceId));

  const workouts: BundleWorkout[] = [];
  list(value.workouts).forEach((w, i) => {
    if (!isObj(w) || !str(w.id) || !str(w.programId) || !str(w.sessionKey) || !str(w.date) || !isIsoDay(w.date) || !str(w.startedAt) || !STATUSES.includes(w.status as WorkoutStatus)) {
      ignored.push({ key: `workouts[${i}]`, reason: 'invalid_value' });
      return;
    }
    if (!programIds.has(w.programId)) {
      ignored.push({ key: `workouts[${i}]`, reason: 'unknown_program' });
      return;
    }
    workouts.push({ ref: w.id, programRef: w.programId, sessionKey: w.sessionKey, date: w.date, status: w.status as WorkoutStatus, startedAt: w.startedAt, completedAt: strOrNull(w.completedAt) });
  });
  const workoutIds = new Set(workouts.map((w) => w.ref));

  const sets: BundleSet[] = [];
  list(value.setEntries).forEach((s, i) => {
    if (!isObj(s) || !str(s.workoutId) || !str(s.exerciseId) || typeof s.setIndex !== 'number' || !workoutIds.has(s.workoutId)) {
      ignored.push({ key: `setEntries[${i}]`, reason: 'invalid_value' });
      return;
    }
    sets.push({
      workoutRef: s.workoutId, exerciseId: s.exerciseId, setIndex: s.setIndex, done: s.done === true,
      weight: numOrNull(s.weight), reps: numOrNull(s.reps), performedName: strOrNull(s.performedName), doneAt: strOrNull(s.doneAt),
    });
  });

  const weights: BundleWeight[] = [];
  list(value.weights).forEach((w, i) => {
    if (!isObj(w) || !str(w.key) || typeof w.weight !== 'number' || !(w.weight > 0) || (w.unit !== 'kg' && w.unit !== 'lbs')) {
      ignored.push({ key: `weights[${i}]`, reason: 'invalid_value' });
      return;
    }
    weights.push({ key: w.key, weight: w.weight, unit: w.unit });
  });

  const layouts: BundleLayout[] = [];
  list(value.layouts).forEach((l, i) => {
    if (!isObj(l) || !str(l.programId) || !str(l.sessionKey) || !Array.isArray(l.order) || !programIds.has(l.programId)) {
      ignored.push({ key: `layouts[${i}]`, reason: 'invalid_value' });
      return;
    }
    const swaps = isObj(l.swaps) ? Object.fromEntries(Object.entries(l.swaps).filter(([, v]) => str(v))) as Record<string, string> : {};
    layouts.push({ programRef: l.programId, sessionKey: l.sessionKey, order: l.order.filter(str), swaps });
  });

  const raw = isObj(value.settings) ? value.settings : {};
  const settings: BundleSettings = {};
  if (isLang(raw.lang)) settings.lang = raw.lang;
  if (isThemePref(raw.theme)) settings.theme = raw.theme;
  if (typeof raw.aiEnabled === 'boolean') settings.aiEnabled = raw.aiEnabled;
  if (typeof raw.keepAwake === 'boolean') settings.keepAwake = raw.keepAwake;

  const active = str(value.activeProgramId) && programIds.has(value.activeProgramId) ? value.activeProgramId : programs[0].sourceId;
  const body = { programs, activeProgramRef: active, workouts, sets, weights, layouts, settings };
  return { ok: true, bundle: { ...body, report: makeReport(body, ignored) } };
}
