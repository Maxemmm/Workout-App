// Route éditeur · étape 2
import { SessionsStep } from '@/features/editor/SessionsStep';
import { useRouterNav } from '@/features/editor/useRouterNav';

export default function EditorSessionsRoute() {
  return <SessionsStep nav={useRouterNav()} />;
}
