// Route éditeur · étape 3
import { ScheduleStep } from '@/features/editor/ScheduleStep';
import { useRouterNav } from '@/features/editor/useRouterNav';

export default function EditorScheduleRoute() {
  return <ScheduleStep nav={useRouterNav()} />;
}
