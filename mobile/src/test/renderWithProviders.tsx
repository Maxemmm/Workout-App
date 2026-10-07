// Rendu de test avec thème, i18n, zones de sécurité et (optionnellement) une base en mémoire
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DbTestProvider } from '@/db/DbContext';
import type { RepoCtx } from '@/db/types';
import type { Lang, ThemePref } from '@/domain/prefs';
import { I18nProvider } from '@/i18n/I18nProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

// Dans l'app, Expo Router fournit le SafeAreaProvider ; en test on le fournit avec des métriques fixes
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

export function renderWithProviders(ui: ReactElement, opts: { lang?: Lang; theme?: ThemePref; ctx?: RepoCtx } = {}) {
  const tree = (
    <SafeAreaProvider initialMetrics={METRICS}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider pref={opts.theme ?? 'dark'}>
          <I18nProvider lang={opts.lang ?? 'fr'}>{ui}</I18nProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
  return render(opts.ctx ? <DbTestProvider value={opts.ctx}>{tree}</DbTestProvider> : tree);
}
