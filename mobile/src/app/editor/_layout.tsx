// Pile de l'éditeur (ouverte en plein écran par-dessus les onglets)
import { Stack } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { useTheme } from '@/theme/ThemeProvider';

export default function EditorLayout() {
  const { colors } = useTheme();
  return (
    <TabErrorBoundary>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </TabErrorBoundary>
  );
}
