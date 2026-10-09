// Barre d'onglets : Today · Plan · Stats · Profil (REFONTE_V2 §3)
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useDbQuery } from '@/features/common/useDbQuery';
import { needsOnboarding } from '@/features/onboarding/needsOnboarding';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  // Premier lancement (aucun programme, onboarding jamais terminé) → onboarding
  const firstLaunch = useDbQuery(needsOnboarding);
  if (firstLaunch) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Fondu court entre onglets : changement fluide sans glissement latéral
        animation: 'fade',
        // Fond des scènes pendant le fondu = fond de l'app
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.bgCard, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.uiMedium },
      }}
    >
      <Tabs.Screen name="today" options={{ title: t('nav_today'), tabBarIcon: icon('barbell') }} />
      <Tabs.Screen name="plan" options={{ title: t('nav_plan'), tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="stats" options={{ title: t('nav_stats'), tabBarIcon: icon('stats-chart') }} />
      <Tabs.Screen name="profile" options={{ title: t('nav_profile'), tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
