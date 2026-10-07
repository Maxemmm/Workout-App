/** @jest-environment node */
import example from '@/data/program.example.json';
import { EMPTY_LAYOUT } from '@/domain/exerciseView';
import { sessionLayouts } from '../schema';
import { createProgram } from '../repos/programsRepo';
import { getLayout, setOrder, setSwap } from '../repos/layoutsRepo';
import { createTestCtx } from '../testing/createTestCtx';

describe('layoutsRepo', () => {
  it('layout vide par défaut, puis ordre et échanges persistés', () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    expect(getLayout(ctx, p.id, 'full-body')).toEqual(EMPTY_LAYOUT);
    setOrder(ctx, p.id, 'full-body', ['b', 'a']);
    setSwap(ctx, p.id, 'full-body', 'a', 'Alt');
    expect(getLayout(ctx, p.id, 'full-body')).toEqual({ order: ['b', 'a'], swaps: { a: 'Alt' } });
    setSwap(ctx, p.id, 'full-body', 'a', null);
    expect(getLayout(ctx, p.id, 'full-body').swaps).toEqual({});
  });

  it('JSON corrompu en base : layout vide', () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    setOrder(ctx, p.id, 'full-body', ['a']);
    ctx.db.update(sessionLayouts).set({ exerciseOrder: '{oops', swaps: '[1]' }).run();
    expect(getLayout(ctx, p.id, 'full-body')).toEqual(EMPTY_LAYOUT);
  });
});
