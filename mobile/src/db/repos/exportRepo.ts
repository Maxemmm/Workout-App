// ============================================================
// Export — relit toute la base (lignes non supprimées) en ImportBundle,
// l'inverse de importRepo.replaceAll. Les ids natifs servent de références.
// ============================================================
import { asc, isNull } from 'drizzle-orm';
import { makeReport, type BundleSettings, type ImportBundle } from '@/domain/importBundle';
import { isLang, isThemePref } from '@/domain/prefs';
import { sessionLayouts, setEntries, workouts } from '../schema';
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

export function readBundle(ctx: RepoCtx): ImportBundle {
  // listPrograms écarte déjà les programmes supprimés ou illisibles
  const progs = listPrograms(ctx);
  const programIds = new Set(progs.map((p) => p.id));

  const ws = ctx.db.select().from(workouts).where(isNull(workouts.deletedAt))
    .orderBy(asc(workouts.date), asc(workouts.id)).all()
    .filter((w) => programIds.has(w.programId));
  const workoutIds = new Set(ws.map((w) => w.id));

  const ss = ctx.db.select().from(setEntries).where(isNull(setEntries.deletedAt))
    .orderBy(asc(setEntries.workoutId), asc(setEntries.exerciseId), asc(setEntries.setIndex)).all()
    .filter((s) => workoutIds.has(s.workoutId));

  const layouts = ctx.db.select().from(sessionLayouts).where(isNull(sessionLayouts.deletedAt)).all()
    .filter((l) => programIds.has(l.programId))
    .map((l) => ({ programRef: l.programId, sessionKey: l.sessionKey, ...getLayout(ctx, l.programId, l.sessionKey) }));

  const body = {
    programs: progs.map((p) => ({ sourceId: p.id, definition: p.definition, source: p.source })),
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
