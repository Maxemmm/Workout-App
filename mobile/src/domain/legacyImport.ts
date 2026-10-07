// ============================================================
// Sauvegarde de la PWA (instantané du localStorage, valeurs en chaînes)
// → ImportBundle. Règles : addendum M3b §2. Fonction pure.
// ============================================================
import {
  isIsoDay, makeReport, type BundleLayout, type BundleProgram, type BundleSet, type BundleSettings,
  type BundleWeight, type BundleWorkout, type IgnoredItem, type ParseResult,
} from './importBundle';
import { isLang, isThemePref } from './prefs';
import { parseProgram, type Exercise, type Program } from './program';
import { parseWeightInput, schemeReps } from './scheme';

/** Clés de la PWA volontairement ignorées sans être signalées */
const SILENT = new Set(['_backupFormat', '_exportedAt', 'program-draft', 'workout-active-timer']);
/** Clés traitées ailleurs dans ce module */
const HANDLED = new Set(['programs', 'program', 'activeProgram', 'lang', 'theme', 'aiEnabled', 'pref-timer-wakelock', 'onboarded']);
const PREFIXED = /^(weight|log|track|layout):/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valeur du localStorage : JSON si possible, sinon la chaîne brute */
function decode(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

const bool = (v: unknown): boolean | undefined => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined);
const noonIso = (date: string) => new Date(`${date}T12:00:00`).toISOString();
const allExercises = (p: Program, sessionKey: string): Exercise[] => {
  const s = p.sessions[sessionKey];
  return s ? [...s.exercises, ...(s.bonus?.exercises ?? [])] : [];
};

export function parseLegacyBackup(raw: Record<string, unknown>, today: string): ParseResult {
  const ignored: IgnoredItem[] = [];
  const keys = Object.keys(raw).sort();

  /* ── Programmes ── */
  const decodedList = decode(raw.programs ?? raw.program);
  const items = Array.isArray(decodedList) ? decodedList : decodedList ? [decodedList] : [];
  const programs: BundleProgram[] = [];
  items.forEach((item, i) => {
    const parsed = parseProgram(item);
    if (!parsed.ok) {
      ignored.push({ key: `programs[${i}]`, reason: 'invalid_program' });
      return;
    }
    const { id: _pwaId, ...definition } = parsed.program as Program & { id?: unknown };
    const sourceId = isObj(item) && typeof item.id === 'string' ? item.id : `program-${i}`;
    programs.push({ sourceId, definition: definition as Program, source: 'import' });
  });
  if (programs.length === 0) return { ok: false, error: 'no_valid_program' };

  const byId = new Map(programs.map((p) => [p.sourceId, p]));
  const activeId = decode(raw.activeProgram);
  const active = (typeof activeId === 'string' && byId.get(activeId)) || programs[0];
  const hasSession = (p: BundleProgram, key: string) => Object.hasOwn(p.definition.sessions, key);

  /* ── Poids mémorisés ── */
  const weightOf = new Map<string, number>();
  const weights: BundleWeight[] = [];
  const unitOf = (exerciseId: string) => {
    const owner = programs.find((p) => Object.keys(p.definition.sessions).some((k) => allExercises(p.definition, k).some((e) => e.id === exerciseId)));
    return (owner ?? active).definition.meta.units;
  };
  for (const key of keys.filter((k) => k.startsWith('weight:'))) {
    const w = parseWeightInput(String(raw[key] ?? ''));
    if (w === null) {
      ignored.push({ key, reason: 'invalid_value' });
      continue;
    }
    const exerciseId = key.slice('weight:'.length);
    weightOf.set(exerciseId, w);
    weights.push({ key: exerciseId, weight: w, unit: unitOf(exerciseId) });
  }

  /* ── Séances terminées (log:) ── */
  const workouts: BundleWorkout[] = [];
  const sets: BundleSet[] = [];
  const seen = new Set<string>();
  const logged = new Set<string>();
  for (const key of keys.filter((k) => k.startsWith('log:'))) {
    const entry = decode(raw[key]);
    if (!isObj(entry) || typeof entry.sessionKey !== 'string') {
      ignored.push({ key, reason: 'invalid_value' });
      continue;
    }
    const sessionKey = entry.sessionKey;
    const date = typeof entry.date === 'string' ? entry.date : key.slice('log:'.length, 'log:'.length + 10);
    if (!isIsoDay(date)) {
      ignored.push({ key, reason: 'invalid_value' });
      continue;
    }
    const byProgramId = typeof entry.programId === 'string' ? byId.get(entry.programId) : undefined;
    const program = byProgramId ?? (hasSession(active, sessionKey) ? active : undefined);
    if (!program) {
      ignored.push({ key, reason: 'unknown_program' });
      continue;
    }
    if (!hasSession(program, sessionKey)) {
      ignored.push({ key, reason: 'unknown_session' });
      continue;
    }
    const unique = `${program.sourceId}|${sessionKey}|${date}`;
    if (seen.has(unique)) {
      ignored.push({ key, reason: 'duplicate' });
      continue;
    }
    seen.add(unique);
    logged.add(`${date}:${sessionKey}`);
    const finished = typeof entry.finishedAt === 'string' ? entry.finishedAt : noonIso(date);
    const ref = `log:${date}:${sessionKey}`;
    workouts.push({ ref, programRef: program.sourceId, sessionKey, date, status: 'completed', startedAt: finished, completedAt: finished });
    const defs = allExercises(program.definition, sessionKey);
    for (const ex of Array.isArray(entry.exercises) ? entry.exercises : []) {
      if (!isObj(ex) || typeof ex.id !== 'string') continue;
      const count = Math.max(0, Math.floor(Number(ex.sets) || 0));
      const weight = ex.weight == null ? null : parseWeightInput(String(ex.weight));
      const def = defs.find((d) => d.id === ex.id);
      const reps = def ? schemeReps(def) : null;
      for (let i = 0; i < count; i++) {
        sets.push({ workoutRef: ref, exerciseId: ex.id, setIndex: i, done: true, weight, reps, performedName: null, doneAt: finished });
      }
    }
  }

  /* ── Séances entamées (track:) — la PWA ne suivait que le programme actif ── */
  for (const key of keys.filter((k) => k.startsWith('track:'))) {
    const date = key.slice('track:'.length, 'track:'.length + 10);
    const sessionKey = key.slice('track:'.length + 11);
    if (!isIsoDay(date)) {
      ignored.push({ key, reason: 'invalid_value' });
      continue;
    }
    if (!hasSession(active, sessionKey)) {
      ignored.push({ key, reason: 'unknown_session' });
      continue;
    }
    const data = decode(raw[key]);
    const defs = allExercises(active.definition, sessionKey);
    const checked: [string, number][] = [];
    if (Array.isArray(data)) {
      data.forEach((row, i) => {
        const id = active.definition.sessions[sessionKey].exercises[i]?.id;
        if (id && Array.isArray(row)) row.forEach((v, j) => { if (v === true) checked.push([id, j]); });
      });
    } else if (isObj(data)) {
      for (const [id, row] of Object.entries(data)) {
        if (id !== 'v' && Array.isArray(row)) row.forEach((v, j) => { if (v === true) checked.push([id, j]); });
      }
    }
    if (checked.length === 0) {
      ignored.push({ key, reason: 'no_checked_set' });
      continue;
    }
    if (logged.has(`${date}:${sessionKey}`)) {
      ignored.push({ key, reason: 'already_logged' });
      continue;
    }
    const unique = `${active.sourceId}|${sessionKey}|${date}`;
    if (seen.has(unique)) {
      ignored.push({ key, reason: 'duplicate' });
      continue;
    }
    seen.add(unique);
    const at = noonIso(date);
    const ref = `track:${date}:${sessionKey}`;
    workouts.push({ ref, programRef: active.sourceId, sessionKey, date, status: date === today ? 'in_progress' : 'abandoned', startedAt: at, completedAt: null });
    for (const [exerciseId, setIndex] of checked) {
      const def = defs.find((d) => d.id === exerciseId);
      sets.push({ workoutRef: ref, exerciseId, setIndex, done: true, weight: weightOf.get(exerciseId) ?? null, reps: def ? schemeReps(def) : null, performedName: null, doneAt: at });
    }
  }

  /* ── Organisation (layout:) ── */
  const layouts: BundleLayout[] = [];
  for (const key of keys.filter((k) => k.startsWith('layout:'))) {
    const sessionKey = key.slice('layout:'.length);
    const data = decode(raw[key]);
    if (!hasSession(active, sessionKey)) {
      ignored.push({ key, reason: 'unknown_session' });
      continue;
    }
    const order = isObj(data) && Array.isArray(data.order) ? data.order.filter((x): x is string => typeof x === 'string') : null;
    const swaps = isObj(data) && isObj(data.swaps)
      ? Object.fromEntries(Object.entries(data.swaps).filter(([, v]) => typeof v === 'string')) as Record<string, string>
      : {};
    if (!order) {
      ignored.push({ key, reason: 'invalid_value' });
      continue;
    }
    layouts.push({ programRef: active.sourceId, sessionKey, order, swaps });
  }

  /* ── Réglages ── */
  const settings: BundleSettings = {};
  if (isLang(raw.lang)) settings.lang = raw.lang;
  if (isThemePref(raw.theme)) settings.theme = raw.theme;
  const ai = bool(raw.aiEnabled);
  if (ai !== undefined) settings.aiEnabled = ai;
  const awake = bool(raw['pref-timer-wakelock']);
  if (awake !== undefined) settings.keepAwake = awake;

  /* ── Clés inconnues ── */
  for (const key of keys) {
    if (SILENT.has(key) || HANDLED.has(key) || PREFIXED.test(key)) continue;
    ignored.push({ key, reason: 'unknown_key' });
  }

  const body = { programs, activeProgramRef: active.sourceId, workouts, sets, weights, layouts, settings };
  return { ok: true, bundle: { ...body, report: makeReport(body, ignored) } };
}
