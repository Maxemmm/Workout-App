// ============================================================
// Organisation d'une séance : ordre des exercices et échanges
// ============================================================
import { and, eq, isNull } from 'drizzle-orm';
import { EMPTY_LAYOUT, type SessionLayout } from '@/domain/exerciseView';
import { sessionLayouts } from '../schema';
import type { RepoCtx } from '../types';

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function findRow(ctx: RepoCtx, programId: string, sessionKey: string) {
  return ctx.db.select().from(sessionLayouts).where(and(
    eq(sessionLayouts.programId, programId),
    eq(sessionLayouts.sessionKey, sessionKey),
    isNull(sessionLayouts.deletedAt),
  )).get();
}

export function getLayout(ctx: RepoCtx, programId: string, sessionKey: string): SessionLayout {
  const row = findRow(ctx, programId, sessionKey);
  if (!row) return EMPTY_LAYOUT;
  const order = parseJson(row.exerciseOrder);
  const swaps = parseJson(row.swaps);
  const validOrder = Array.isArray(order) && order.every((id) => typeof id === 'string');
  const validSwaps = typeof swaps === 'object' && swaps !== null && !Array.isArray(swaps)
    && Object.values(swaps).every((v) => typeof v === 'string');
  if (!validOrder || !validSwaps) return EMPTY_LAYOUT;
  return { order: order as string[], swaps: swaps as Record<string, string> };
}

function saveLayout(ctx: RepoCtx, programId: string, sessionKey: string, layout: SessionLayout): void {
  const now = ctx.now();
  const values = { exerciseOrder: JSON.stringify(layout.order), swaps: JSON.stringify(layout.swaps), updatedAt: now };
  const row = findRow(ctx, programId, sessionKey);
  if (row) {
    ctx.db.update(sessionLayouts).set(values).where(eq(sessionLayouts.id, row.id)).run();
    return;
  }
  ctx.db.insert(sessionLayouts).values({ id: ctx.newId(), createdAt: now, programId, sessionKey, ...values }).run();
}

export function setOrder(ctx: RepoCtx, programId: string, sessionKey: string, order: string[]): void {
  saveLayout(ctx, programId, sessionKey, { ...getLayout(ctx, programId, sessionKey), order });
}

export function setSwap(ctx: RepoCtx, programId: string, sessionKey: string, exerciseId: string, name: string | null): void {
  const layout = getLayout(ctx, programId, sessionKey);
  const swaps = { ...layout.swaps };
  if (name === null) delete swaps[exerciseId];
  else swaps[exerciseId] = name;
  saveLayout(ctx, programId, sessionKey, { ...layout, swaps });
}
