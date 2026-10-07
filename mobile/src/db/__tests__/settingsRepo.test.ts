/** @jest-environment node */
import { settings } from '../schema';
import { deleteSetting, getSetting, setSetting } from '../repos/settingsRepo';
import { createTestCtx } from '../testing/createTestCtx';

describe('settingsRepo', () => {
  it('lit undefined pour une clé absente', () => {
    expect(getSetting(createTestCtx(), 'lang')).toBeUndefined();
  });

  it('écrit puis relit des valeurs typées (upsert)', () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'lang', 'en');
    setSetting(ctx, 'lang', 'fr');
    setSetting(ctx, 'aiEnabled', true);
    const rest = { mode: 'rest' as const, startedAt: 0, endAt: 123, workoutId: 'w', exerciseId: 'x', setIndex: 0, pending: null };
    setSetting(ctx, 'activeRest', rest);
    expect(getSetting(ctx, 'lang')).toBe('fr');
    expect(getSetting(ctx, 'aiEnabled')).toBe(true);
    expect(getSetting(ctx, 'activeRest')).toEqual(rest);
  });

  it('retourne undefined pour une valeur JSON corrompue', () => {
    const ctx = createTestCtx();
    ctx.db.insert(settings).values({ key: 'lang', value: '{pas du json', updatedAt: ctx.now() }).run();
    expect(getSetting(ctx, 'lang')).toBeUndefined();
  });

  it('supprime une clé', () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'onboarded', true);
    deleteSetting(ctx, 'onboarded');
    expect(getSetting(ctx, 'onboarded')).toBeUndefined();
  });
});
