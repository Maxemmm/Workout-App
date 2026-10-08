// ============================================================
// Stats — lecture de l'historique (séances terminées, séries faites).
// Les programmes supprimés restent lus pour les noms et les unités.
// ============================================================
import { and, asc, eq, isNull } from 'drizzle-orm';
import { parseProgram, type Program } from '@/domain/program';
import { localDateKey, resolveDay, WEEKDAYS } from '@/domain/schedule';
import type { ActivePlan, HistoryWorkout, StatsHistory } from '@/domain/stats/types';
import { programs, setEntries, workouts } from '../schema';
import type { RepoCtx } from '../types';
import { getActiveProgram } from './programsRepo';

function parseDefinition(text: string): Program | null {
  try {
    const parsed = parseProgram(JSON.parse(text));
    return parsed.ok ? parsed.program : null;
  } catch {
    return null;
  }
}

function addNames(names: Record<string, string>, def: Program) {
  for (const s of Object.values(def.sessions)) {
    for (const ex of [...s.exercises, ...(s.bonus?.exercises ?? [])]) names[ex.id] ??= ex.name;
  }
}

export function readHistory(ctx: RepoCtx): StatsHistory {
  const activeStored = getActiveProgram(ctx);
  const defs = new Map<string, Program | null>(
    ctx.db.select({ id: programs.id, definition: programs.definition }).from(programs).all()
      .map((p) => [p.id, parseDefinition(p.definition)]),
  );

  const names: Record<string, string> = {};
  if (activeStored) addNames(names, activeStored.definition);
  for (const def of defs.values()) if (def) addNames(names, def);

  const rows = ctx.db.select().from(workouts)
    .where(and(eq(workouts.status, 'completed'), isNull(workouts.deletedAt)))
    .orderBy(asc(workouts.date), asc(workouts.completedAt), asc(workouts.id)).all();
  const sets = ctx.db.select({
    workoutId: setEntries.workoutId, exerciseId: setEntries.exerciseId, performedName: setEntries.performedName,
    weight: setEntries.weight, reps: setEntries.reps,
  }).from(setEntries)
    .innerJoin(workouts, eq(setEntries.workoutId, workouts.id))
    .where(and(eq(setEntries.done, true), isNull(setEntries.deletedAt), eq(workouts.status, 'completed'), isNull(workouts.deletedAt)))
    .orderBy(asc(setEntries.workoutId), asc(setEntries.exerciseId), asc(setEntries.setIndex)).all();

  const activeUnits = activeStored?.definition.meta.units ?? 'kg';
  const byWorkout = new Map<string, HistoryWorkout>();
  const list: HistoryWorkout[] = rows.map((r) => {
    const def = defs.get(r.programId) ?? null;
    const session = def && Object.hasOwn(def.sessions, r.sessionKey) ? def.sessions[r.sessionKey] : null;
    const w: HistoryWorkout = {
      id: r.id, date: r.date, sessionKey: r.sessionKey, sessionName: session?.name ?? r.sessionKey,
      units: def?.meta.units ?? activeUnits, startedAt: r.startedAt, completedAt: r.completedAt, sets: [],
    };
    byWorkout.set(r.id, w);
    return w;
  });
  for (const s of sets) {
    byWorkout.get(s.workoutId)?.sets.push({ exerciseId: s.exerciseId, performedName: s.performedName, weight: s.weight, reps: s.reps });
  }

  let active: ActivePlan | null = null;
  if (activeStored) {
    const def = activeStored.definition;
    const trainDays = WEEKDAYS.filter((d) => {
      const plan = resolveDay(def, d);
      return plan.kind === 'session' && plan.session.type !== 'rest';
    });
    active = { trainDays, units: def.meta.units, since: localDateKey(new Date(activeStored.createdAt)) };
  }
  return { workouts: list, exerciseNames: names, active };
}
