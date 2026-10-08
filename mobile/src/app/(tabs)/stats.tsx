// Route Stats — ErrorBoundary ; l'écran vit dans features/stats
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { StatsScreen } from '@/features/stats/StatsScreen';

export default function StatsRoute() {
  return (
    <TabErrorBoundary>
      <StatsScreen />
    </TabErrorBoundary>
  );
}
