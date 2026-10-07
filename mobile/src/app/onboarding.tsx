// Route Onboarding
import { router } from 'expo-router';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  return (
    <OnboardingScreen
      onCreate={() => router.push('/editor/meta')}
      onImport={() => router.push('/import')}
      onStarted={() => router.replace('/today')}
    />
  );
}
