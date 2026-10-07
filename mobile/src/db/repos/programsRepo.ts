// ============================================================
// Programmes — documents JSON validés par ProgramSchema
// ============================================================
import { and, asc, eq, isNull } from 'drizzle-orm';
import { parseProgram, type Program } from '@/domain/program';
import { programs } from '../schema';
import type { RepoCtx } from '../types';
import { deleteSetting, getSetting, setSetting } from './settingsRepo';

export type ProgramSource = 'manual' | 'ai' | 'import' | 'example';

export interface StoredProgram {
  id: string;
  definition: Program;
  source: ProgramSource;
  createdAt: string;
  updatedAt: string;
}

export class ProgramValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join('\n'));
    this.name = 'ProgramValidationError';
  }
}

type ProgramRow = typeof programs.$inferSelect;

/** Ligne → programme validé ; null si JSON illisible ou programme invalide */
function toStored(row: ProgramRow): StoredProgram | null {
  let raw: unknown;
  try {
    raw = JSON.parse(row.definition);
  } catch {
    return null;
  }
  const parsed = parseProgram(raw);
  if (!parsed.ok) return null;
  return { id: row.id, definition: parsed.program, source: row.source, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export function createProgram(ctx: RepoCtx, input: unknown, source: ProgramSource): StoredProgram {
  const parsed = parseProgram(input);
  if (!parsed.ok) throw new ProgramValidationError(parsed.errors);
  const now = ctx.now();
  const id = ctx.newId();
  ctx.db.insert(programs).values({ id, createdAt: now, updatedAt: now, definition: JSON.stringify(parsed.program), source }).run();
  return { id, definition: parsed.program, source, createdAt: now, updatedAt: now };
}

export function listPrograms(ctx: RepoCtx): StoredProgram[] {
  return ctx.db
    .select().from(programs)
    .where(isNull(programs.deletedAt))
    .orderBy(asc(programs.createdAt), asc(programs.id))
    .all()
    .map(toStored)
    .filter((p): p is StoredProgram => p !== null);
}

export function getProgram(ctx: RepoCtx, id: string): StoredProgram | null {
  const row = ctx.db.select().from(programs).where(and(eq(programs.id, id), isNull(programs.deletedAt))).get();
  return row ? toStored(row) : null;
}

export function softDeleteProgram(ctx: RepoCtx, id: string): void {
  const now = ctx.now();
  ctx.db.update(programs).set({ deletedAt: now, updatedAt: now }).where(eq(programs.id, id)).run();
}

export function setActiveProgram(ctx: RepoCtx, id: string): void {
  setSetting(ctx, 'activeProgramId', id);
}

/** Programme actif ; s'il a disparu, repli sur le premier programme disponible */
export function getActiveProgram(ctx: RepoCtx): StoredProgram | null {
  const id = getSetting(ctx, 'activeProgramId');
  const active = typeof id === 'string' ? getProgram(ctx, id) : null;
  if (active) return active;
  const first = listPrograms(ctx)[0] ?? null;
  if (first) setActiveProgram(ctx, first.id);
  else if (id !== undefined) deleteSetting(ctx, 'activeProgramId');
  return first;
}

export function updateProgram(ctx: RepoCtx, id: string, input: unknown): StoredProgram {
  const parsed = parseProgram(input);
  if (!parsed.ok) throw new ProgramValidationError(parsed.errors);
  const existing = getProgram(ctx, id);
  if (!existing) throw new Error('programme introuvable');
  const now = ctx.now();
  ctx.db.update(programs).set({ definition: JSON.stringify(parsed.program), updatedAt: now }).where(eq(programs.id, id)).run();
  return { ...existing, definition: parsed.program, updatedAt: now };
}

/** Copie d'un programme (ids d'exercices et de séances conservés : les poids suivent) ; non activée */
export function duplicateProgram(ctx: RepoCtx, id: string, copySuffix: string): StoredProgram | null {
  const source = getProgram(ctx, id);
  if (!source) return null;
  const label = source.definition.meta.label.trim();
  const already = label.endsWith(copySuffix.trim());
  const definition = { ...source.definition, meta: { ...source.definition.meta, label: already ? label : `${label}${copySuffix}` } };
  return createProgram(ctx, definition, 'manual');
}
