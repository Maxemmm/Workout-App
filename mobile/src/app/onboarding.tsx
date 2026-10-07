// Route Onboarding — garde inverse : déjà onboardé → Today (l'écran peut rester dans la pile
// après un import ou l'éditeur ; le retour Android ne doit jamais le réafficher)
import { Redirect, router } from 'expo-router';
import { useDbQuery } from '@/features/common/useDbQuery';
import { needsOnboarding } from '@/features/onboarding/needsOnboarding';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  const firstLaunch = useDbQuery(needsOnboarding);
  if (!firstLaunch) return <Redirect href="/today" />;
  return (
    <OnboardingScreen
      onCreate={() => router.push('/editor/meta')}
      onImport={() => router.push('/import')}
      onStarted={() => router.replace('/today')}
    />
  );
}
