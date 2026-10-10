// Route Exercices — ErrorBoundary ; fiche et création d'exercice personnalisé dans la pile racine
import { router } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { LibraryScreen } from '@/features/library/LibraryScreen';

export default function ExercisesRoute() {
  return (
    <TabErrorBoundary>
      <LibraryScreen
        onOpen={(id) => router.push({ pathname: '/exercise/[id]', params: { id } })}
        onNewCustom={() => router.push('/exercise/custom')}
      />
    </TabErrorBoundary>
  );
}
