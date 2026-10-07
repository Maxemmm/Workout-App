// Route éditeur · étape 1
import { MetaStep } from '@/features/editor/MetaStep';
import { useRouterNav } from '@/features/editor/useRouterNav';

export default function EditorMetaRoute() {
  return <MetaStep nav={useRouterNav()} />;
}
