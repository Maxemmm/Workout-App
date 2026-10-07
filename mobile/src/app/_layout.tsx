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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRepoCtx } from '@/db/DbContext';
import { DbProvider } from '@/db/DbProvider';
import { Toast } from '@/features/common/Toast';
import { I18nProvider } from '@/i18n/I18nProvider';
import { useDraftStore } from '@/state/draftStore';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DbProvider>
        <PrefsGate />
      </DbProvider>
    </GestureHandlerRootView>
  );
}

function PrefsGate() {
  const ctx = useRepoCtx();
  const [hydrated, setHydrated] = useState(false);
  const lang = usePrefs((s) => s.lang);
  const theme = usePrefs((s) => s.theme);

  useEffect(() => {
    usePrefs.getState().hydrate(ctx);
    useTimerStore.getState().hydrate(ctx, Date.now());
    useDraftStore.getState().hydrate(ctx);
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
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="editor" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
      <Toast />
    </>
  );
}
