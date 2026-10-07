// Route Plan — ErrorBoundary + ouverture de l'éditeur (pile plein écran) ; ?tab=programs&at=… ouvre « Mes programmes »
import { router, useLocalSearchParams } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { PlanScreen } from '@/features/plan/PlanScreen';
import type { PlanTab } from '@/features/plan/PlanTabs';

const STEP_ROUTES = { 1: '/editor/meta', 2: '/editor/sessions', 3: '/editor/schedule' } as const;

export default function PlanRoute() {
  const { tab, at } = useLocalSearchParams<{ tab?: string; at?: string }>();
  const tabRequest = tab === 'programs' || tab === 'week' ? { tab: tab as PlanTab, at: at ?? '' } : undefined;
  return (
    <TabErrorBoundary>
      <PlanScreen
        onOpenEditor={(step) => router.push(STEP_ROUTES[step])}
        onOpenImport={() => router.push('/import')}
        tabRequest={tabRequest}
      />
    </TabErrorBoundary>
  );
}
