// ============================================================
// Racine : polices → base (migrations) → préférences → thème + i18n
// ============================================================
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useRepoCtx } from '@/db/DbContext';
import { DbProvider } from '@/db/DbProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ BarlowCondensed_800ExtraBold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const ready = fontsLoaded || fontError != null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return (
    <DbProvider>
      <PrefsGate />
    </DbProvider>
  );
}

function PrefsGate() {
  const ctx = useRepoCtx();
  const [hydrated, setHydrated] = useState(false);
  const lang = usePrefs((s) => s.lang);
  const theme = usePrefs((s) => s.theme);

  useEffect(() => {
    usePrefs.getState().hydrate(ctx);
    setHydrated(true);
  }, [ctx]);

  if (!hydrated) return null;
  return (
    <ThemeProvider pref={theme}>
      <I18nProvider lang={lang}>
        <ThemedStack />
      </I18nProvider>
    </ThemeProvider>
  );
}

function ThemedStack() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}
