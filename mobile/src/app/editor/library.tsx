// Route éditeur · choix dans la bibliothèque (pile de l'éditeur) — réponse via useLibraryPickStore
import { router } from 'expo-router';
import { ExercisePicker } from '@/features/library/ExercisePicker';
import { useLibraryPickStore, type PickResult } from '@/state/libraryPickStore';

export default function EditorLibraryRoute() {
  const done = (r: PickResult) => {
    useLibraryPickStore.getState().resolve(r);
    router.back();
  };
  return (
    <ExercisePicker
      onPick={(item) => done({ libraryId: item.id, name: item.name })}
      onFree={() => done(null)}
      onCancel={() => done('cancel')}
    />
  );
}
