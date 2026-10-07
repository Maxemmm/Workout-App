// Route Today — focus de l'onglet + ErrorBoundary ; l'écran vit dans features/today
import { useIsFocused } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { TodayScreen } from '@/features/today/TodayScreen';

export default function TodayRoute() {
  const focused = useIsFocused();
  return (
    <TabErrorBoundary>
      <TodayScreen focused={focused} />
    </TabErrorBoundary>
  );
}
