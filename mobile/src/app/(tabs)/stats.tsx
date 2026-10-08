// Route Stats — ErrorBoundary ; l'écran n'est calculé que quand l'onglet a le focus
import { useIsFocused } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { StatsScreen } from '@/features/stats/StatsScreen';

export default function StatsRoute() {
  const focused = useIsFocused();
  return (
    <TabErrorBoundary>
      <StatsScreen focused={focused} />
    </TabErrorBoundary>
  );
}
