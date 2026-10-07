// Route éditeur · étape 4 (séance)
import { useLocalSearchParams } from 'expo-router';
import { SessionStep } from '@/features/editor/SessionStep';
import { useRouterNav } from '@/features/editor/useRouterNav';

export default function EditorSessionRoute() {
  const { key } = useLocalSearchParams<{ key: string }>();
  return <SessionStep nav={useRouterNav()} sessionKey={key ?? ''} />;
}
