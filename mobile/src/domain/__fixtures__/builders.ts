// Fabriques de programmes pour les tests du domaine
import { parseProgram, type Program } from '../program';

export function makeExercise(id: string, sets = 3, extra: Record<string, unknown> = {}) {
  return {
    id, name: id.toUpperCase(), scheme: `${sets}×10`, sets,
    load: null, restSec: 90, cue: null, alternatives: [], ...extra,
  };
}

export function makeSession(name: string, exercises: unknown[] = [makeExercise(`${name}-a`)], extra: Record<string, unknown> = {}) {
  return { type: 'lift', name, accent: 'gold', subtitle: null, note: null, warmup: [], exercises, ...extra };
}

export function makeProgramInput(
  schedule: Record<string, string | null>,
  sessions: Record<string, unknown>,
  meta: Record<string, unknown> = {},
) {
  return { meta: { label: 'TEST', units: 'kg', restDefaultSec: 90, ...meta }, sessions, schedule, rules: [] };
}

/** Programme 7 jours en lbs : critère d'extensibilité du CLAUDE.md */
export function sevenDayLbsInput() {
  const sessions: Record<string, unknown> = {};
  const schedule: Record<string, string> = {};
  for (let d = 0; d < 7; d++) {
    sessions[`s${d}`] = makeSession(`SÉANCE ${d}`, [makeExercise(`ex-${d}`, 4)]);
    schedule[String(d)] = `s${d}`;
  }
  return makeProgramInput(schedule, sessions, { units: 'lbs' });
}

export function parseOrThrow(input: unknown): Program {
  const r = parseProgram(input);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.program;
}
