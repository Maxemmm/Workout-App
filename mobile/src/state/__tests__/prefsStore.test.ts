/** @jest-environment node */
import { settings } from '@/db/schema';
import { getSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { PREFS_INITIAL, usePrefs } from '../prefsStore';

beforeEach(() => usePrefs.setState(PREFS_INITIAL));

describe('prefsStore', () => {
  it('hydrate avec les valeurs par défaut sur une base vide', () => {
    usePrefs.getState().hydrate(createTestCtx());
    expect(usePrefs.getState()).toMatchObject({ lang: 'fr', theme: 'dark' });
  });

  it('persiste langue et thème, puis les relit', () => {
    const ctx = createTestCtx();
    usePrefs.getState().setLang(ctx, 'en');
    usePrefs.getState().setTheme(ctx, 'light');
    expect(getSetting(ctx, 'lang')).toBe('en');
    usePrefs.setState(PREFS_INITIAL);
    usePrefs.getState().hydrate(ctx);
    expect(usePrefs.getState()).toMatchObject({ lang: 'en', theme: 'light' });
  });

  it('ignore des valeurs invalides en base', () => {
    const ctx = createTestCtx();
    const now = ctx.now();
    ctx.db.insert(settings).values([
      { key: 'lang', value: '"de"', updatedAt: now },
      { key: 'theme', value: '42', updatedAt: now },
    ]).run();
    usePrefs.getState().hydrate(ctx);
    expect(usePrefs.getState()).toMatchObject({ lang: 'fr', theme: 'dark' });
  });

  it('bumpData incrémente la version des données', () => {
    usePrefs.getState().bumpData();
    expect(usePrefs.getState().dataVersion).toBe(1);
  });
});
