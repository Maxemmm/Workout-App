// Route Stats — ErrorBoundary ; l'écran n'est calculé que quand l'onglet a le focus.
// ?exercise=…&at=… (depuis une fiche exercice) : sélectionne cet exercice.
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { StatsScreen } from '@/features/stats/StatsScreen';

export default function StatsRoute() {
  const focused = useIsFocused();
  const { exercise, at } = useLocalSearchParams<{ exercise?: string; at?: string }>();
  return (
    <TabErrorBoundary>
      <StatsScreen focused={focused} exerciseRequest={exercise ? { key: exercise, at: at ?? '' } : undefined} />
    </TabErrorBoundary>
  );
}
