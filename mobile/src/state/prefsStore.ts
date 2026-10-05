// ============================================================
// Store des préférences (Zustand) — persistées dans settings
// dataVersion : incrémenté après une écriture pour rafraîchir les écrans
// ============================================================
import { create } from 'zustand';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { DEFAULT_LANG, DEFAULT_THEME, isLang, isThemePref, type Lang, type ThemePref } from '@/domain/prefs';

interface PrefsData {
  lang: Lang;
  theme: ThemePref;
  dataVersion: number;
}

interface PrefsActions {
  hydrate(ctx: RepoCtx): void;
  setLang(ctx: RepoCtx, lang: Lang): void;
  setTheme(ctx: RepoCtx, theme: ThemePref): void;
  bumpData(): void;
}

export const PREFS_INITIAL: PrefsData = { lang: DEFAULT_LANG, theme: DEFAULT_THEME, dataVersion: 0 };

export const usePrefs = create<PrefsData & PrefsActions>((set) => ({
  ...PREFS_INITIAL,
  hydrate: (ctx) => {
    const lang = getSetting(ctx, 'lang');
    const theme = getSetting(ctx, 'theme');
    set({ lang: isLang(lang) ? lang : DEFAULT_LANG, theme: isThemePref(theme) ? theme : DEFAULT_THEME });
  },
  setLang: (ctx, lang) => {
    setSetting(ctx, 'lang', lang);
    set({ lang });
  },
  setTheme: (ctx, theme) => {
    setSetting(ctx, 'theme', theme);
    set({ theme });
  },
  bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
