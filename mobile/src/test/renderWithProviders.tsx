// Rendu de test avec thème, i18n et (optionnellement) une base en mémoire
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { DbTestProvider } from '@/db/DbContext';
import type { RepoCtx } from '@/db/types';
import type { Lang, ThemePref } from '@/domain/prefs';
import { I18nProvider } from '@/i18n/I18nProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

export function renderWithProviders(ui: ReactElement, opts: { lang?: Lang; theme?: ThemePref; ctx?: RepoCtx } = {}) {
  const tree = (
    <ThemeProvider pref={opts.theme ?? 'dark'}>
      <I18nProvider lang={opts.lang ?? 'fr'}>{ui}</I18nProvider>
    </ThemeProvider>
  );
  return render(opts.ctx ? <DbTestProvider value={opts.ctx}>{tree}</DbTestProvider> : tree);
}
