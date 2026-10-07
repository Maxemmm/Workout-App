// Route Plan — ErrorBoundary + ouverture de l'éditeur (pile plein écran)
import { router } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { PlanScreen } from '@/features/plan/PlanScreen';

const STEP_ROUTES = { 1: '/editor/meta', 2: '/editor/sessions', 3: '/editor/schedule' } as const;

export default function PlanRoute() {
  return (
    <TabErrorBoundary>
      <PlanScreen onOpenEditor={(step) => router.push(STEP_ROUTES[step])} onOpenImport={() => router.push('/import')} />
    </TabErrorBoundary>
  );
}
