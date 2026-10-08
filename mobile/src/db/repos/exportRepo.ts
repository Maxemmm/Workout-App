// ============================================================
// Export — relit toute la base (lignes non supprimées) en ImportBundle,
// l'inverse de importRepo.replaceAll. Les ids natifs servent de références.
// Les programmes supprimés qui portent encore de l'historique sont inclus, marqués `deleted`.
// ============================================================
import { asc, isNotNull, isNull } from 'drizzle-orm';
import { makeReport, type BundleProgram, type BundleSettings, type ImportBundle } from '@/domain/importBundle';
import { isLang, isThemePref } from '@/domain/prefs';
import { parseProgram } from '@/domain/program';
import { programs, sessionLayouts, setEntries, workouts } from '../schema';
import type { RepoCtx } from '../types';
import { getLayout } from './layoutsRepo';
import { getActiveProgram, listPrograms } from './programsRepo';
import { getSetting } from './settingsRepo';
import { getAllWeights } from './weightsRepo';

function readSettings(ctx: RepoCtx): BundleSettings {
  const s: BundleSettings = {};
  const lang = getSetting(ctx, 'lang');
  const theme = getSetting(ctx, 'theme');
  const aiEnabled = getSetting(ctx, 'aiEnabled');
  const keepAwake = getSetting(ctx, 'keepAwake');
  const defaultUnits = getSetting(ctx, 'defaultUnits');
  if (isLang(lang)) s.lang = lang;
  if (isThemePref(theme)) s.theme = theme;
  if (typeof aiEnabled === 'boolean') s.aiEnabled = aiEnabled;
  if (typeof keepAwake === 'boolean') s.keepAwake = keepAwake;
  if (defaultUnits === 'kg' || defaultUnits === 'lbs') s.defaultUnits = defaultUnits;
  return s;
}

/** Programmes supprimés encore référencés par l'historique : exportés marqués `deleted` (Last time, Stats) */
function deletedWithHistory(ctx: RepoCtx, referenced: Set<string>): BundleProgram[] {
  return ctx.db.select().from(programs).where(isNotNull(programs.deletedAt))
    .orderBy(asc(programs.createdAt), asc(programs.id)).all()
    .filter((row) => referenced.has(row.id))
    .flatMap((row) => {
      let raw: unknown;
      try {
        raw = JSON.parse(row.definition);
      } catch {
        return [];
      }
      const parsed = parseProgram(raw);
      return parsed.ok ? [{ sourceId: row.id, definition: parsed.program, source: row.source, deleted: true as const }] : [];
    });
}

export function readBundle(ctx: RepoCtx): ImportBundle {
  // listPrograms écarte déjà les programmes supprimés ou illisibles
  const visible: BundleProgram[] = listPrograms(ctx).map((p) => ({ sourceId: p.id, definition: p.definition, source: p.source }));
  const liveWorkouts = ctx.db.select().from(workouts).where(isNull(workouts.deletedAt))
    .orderBy(asc(workouts.date), asc(workouts.id)).all();
  const progs = [...visible, ...deletedWithHistory(ctx, new Set(liveWorkouts.map((w) => w.programId)))];
  const programIds = new Set(progs.map((p) => p.sourceId));
  const visibleIds = new Set(visible.map((p) => p.sourceId));

  const ws = liveWorkouts.filter((w) => programIds.has(w.programId));
  const workoutIds = new Set(ws.map((w) => w.id));

  const ss = ctx.db.select().from(setEntries).where(isNull(setEntries.deletedAt))
    .orderBy(asc(setEntries.workoutId), asc(setEntries.exerciseId), asc(setEntries.setIndex)).all()
    .filter((s) => workoutIds.has(s.workoutId));

  const layouts = ctx.db.select().from(sessionLayouts).where(isNull(sessionLayouts.deletedAt)).all()
    .filter((l) => visibleIds.has(l.programId))
    .map((l) => ({ programRef: l.programId, sessionKey: l.sessionKey, ...getLayout(ctx, l.programId, l.sessionKey) }));

  const body = {
    programs: progs,
    activeProgramRef: getActiveProgram(ctx)?.id ?? null,
    workouts: ws.map((w) => ({
      ref: w.id, programRef: w.programId, sessionKey: w.sessionKey, date: w.date,
      status: w.status, startedAt: w.startedAt, completedAt: w.completedAt,
    })),
    sets: ss.map((s) => ({
      workoutRef: s.workoutId, exerciseId: s.exerciseId, setIndex: s.setIndex, done: s.done,
      weight: s.weight, reps: s.reps, performedName: s.performedName, doneAt: s.doneAt,
    })),
    weights: Object.entries(getAllWeights(ctx)).map(([key, w]) => ({ key, weight: w.weight, unit: w.unit })),
    layouts,
    settings: readSettings(ctx),
  };
  return { ...body, report: makeReport(body, []) };
}
