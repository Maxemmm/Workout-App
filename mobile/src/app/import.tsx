// Route Import — programme : retour à Plan ; sauvegarde : Today
import { router } from 'expo-router';
import { ImportScreen } from '@/features/import/ImportScreen';

export default function ImportRoute() {
  return (
    <ImportScreen
      onCancel={() => router.back()}
      onDone={(kind) => router.replace(kind === 'program' ? '/plan' : '/today')}
    />
  );
}
