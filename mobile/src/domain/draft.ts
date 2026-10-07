// ============================================================
// Brouillon de l'éditeur — document unique, opérations PURES.
// Rien ici ne touche la base : l'enregistrement valide puis écrit.
// ============================================================
import { defaultAccent, type AccentKey } from './accents';
import { makeEntityId, type RandomSuffix } from './entityIds';
import type { Program, Session, SessionType, Units } from './program';
import { moveId } from './reorder';
import type { Weekday } from './schedule';

export type Draft = {
  /** Programme modifié ; null = nouveau programme */
  sourceProgramId: string | null;
  program: Program;
  /** Séances dont la couleur a été choisie à la main (jamais recalculée) */
  manualAccents: string[];
};

export type SessionPatch = Partial<Pick<Session, 'name' | 'subtitle' | 'note' | 'type' | 'warmup' | 'cardio' | 'tips'>>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const withProgram = (d: Draft, program: Program): Draft => ({ ...d, program });

const withSessions = (d: Draft, sessions: Record<string, Session>): Draft =>
  withProgram(d, { ...d.program, sessions });

/** Recrée un objet en insérant `key` juste après `afterKey` (l'ordre des clés = ordre d'affichage) */
function insertAfter<T>(record: Record<string, T>, afterKey: string, key: string, value: T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) {
    out[k] = v;
    if (k === afterKey) out[key] = value;
  }
  return out;
}

/* ── Création ─────────────────────────────────────────── */
export function newDraft(): Draft {
  return {
    sourceProgramId: null,
    program: { meta: { label: '', units: 'kg', restDefaultSec: 90 }, sessions: {}, schedule: {}, rules: [] } as Program,
    manualAccents: [],
  };
}

export function draftFromProgram(id: string, program: Program): Draft {
  return { sourceProgramId: id, program: clone(program), manualAccents: Object.keys(program.sessions) };
}

/* ── Programme ────────────────────────────────────────── */
export function setMeta(d: Draft, patch: Partial<{ label: string; units: Units; restDefaultSec: number }>): Draft {
  return withProgram(d, { ...d.program, meta: { ...d.program.meta, ...patch } });
}

export function setRules(d: Draft, rules: string[]): Draft {
  return withProgram(d, { ...d.program, rules: [...rules] });
}

/* ── Séances ──────────────────────────────────────────── */
function emptySession(type: SessionType, accent: AccentKey): Session {
  return { type, name: '', accent, subtitle: null, note: null, warmup: [], exercises: [], cardio: null, bonus: null, tips: [] } as Session;
}

export function addSession(d: Draft, type: SessionType = 'lift', suffix?: RandomSuffix): { draft: Draft; key: string } {
  const sessions = d.program.sessions;
  const key = makeEntityId(type, Object.keys(sessions), suffix);
  const accent = defaultAccent(type, Object.values(sessions));
  return { draft: withSessions(d, { ...sessions, [key]: emptySession(type, accent) }), key };
}

export function updateSession(d: Draft, key: string, patch: SessionPatch): Draft {
  const current = d.program.sessions[key];
  if (!current) return d;
  const next: Session = { ...current, ...patch };
  if (patch.type && patch.type !== current.type && !d.manualAccents.includes(key)) {
    const others = Object.entries(d.program.sessions).filter(([k]) => k !== key).map(([, s]) => s);
    next.accent = defaultAccent(patch.type, others);
  }
  return withSessions(d, { ...d.program.sessions, [key]: next });
}

export function setSessionAccent(d: Draft, key: string, accent: AccentKey): Draft {
  const current = d.program.sessions[key];
  if (!current) return d;
  const manualAccents = d.manualAccents.includes(key) ? d.manualAccents : [...d.manualAccents, key];
  return { ...withSessions(d, { ...d.program.sessions, [key]: { ...current, accent } }), manualAccents };
}

export function isScheduled(d: Draft, key: string): boolean {
  return Object.values(d.program.schedule).includes(key);
}

export function deleteSession(d: Draft, key: string): Draft {
  const { [key]: _removed, ...sessions } = d.program.sessions;
  const schedule = Object.fromEntries(Object.entries(d.program.schedule).filter(([, k]) => k !== key));
  return {
    ...withProgram(d, { ...d.program, sessions, schedule }),
    manualAccents: d.manualAccents.filter((k) => k !== key),
  };
}

export function duplicateSession(d: Draft, key: string, copySuffix: string, suffix?: RandomSuffix): { draft: Draft; key: string } {
  const source = d.program.sessions[key];
  if (!source) return { draft: d, key };
  const newKey = makeEntityId(source.type, Object.keys(d.program.sessions), suffix);
  const copy: Session = { ...clone(source), name: `${source.name}${copySuffix}` };
  const draft = withSessions(d, insertAfter(d.program.sessions, key, newKey, copy));
  return {
    draft: d.manualAccents.includes(key) ? { ...draft, manualAccents: [...draft.manualAccents, newKey] } : draft,
    key: newKey,
  };
}

export function moveSession(d: Draft, from: number, to: number): Draft {
  const order = moveId(Object.keys(d.program.sessions), from, to);
  return withSessions(d, Object.fromEntries(order.map((k) => [k, d.program.sessions[k]])));
}

/* ── Planning ─────────────────────────────────────────── */
export function setSchedule(d: Draft, weekday: Weekday, key: string | null): Draft {
  const schedule = { ...d.program.schedule };
  if (key === null) delete schedule[String(weekday)];
  else schedule[String(weekday)] = key;
  return withProgram(d, { ...d.program, schedule });
}
