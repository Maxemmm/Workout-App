// Route Profil — ErrorBoundary ; « Gérer » ouvre Plan › Mes programmes
import { router } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { ProfileScreen } from '@/features/profile/ProfileScreen';

export default function ProfileRoute() {
  return (
    <TabErrorBoundary>
      <ProfileScreen
        onManagePrograms={() => router.navigate({ pathname: '/plan', params: { tab: 'programs', at: String(Date.now()) } })}
        onOpenEditor={() => router.push('/editor/meta')}
        onImport={() => router.push('/import')}
      />
    </TabErrorBoundary>
  );
}
