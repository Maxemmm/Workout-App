// Route éditeur · choix dans la bibliothèque (pile de l'éditeur) — réponse via useLibraryPickStore.
// Une seule réponse (double appui ignoré) ; sortie sans réponse (geste / bouton retour) = « Annuler ».
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ExercisePicker } from '@/features/library/ExercisePicker';
import { useLibraryPickStore, type PickResult } from '@/state/libraryPickStore';

export default function EditorLibraryRoute() {
  const answered = useRef(false);
  useEffect(() => () => {
    const s = useLibraryPickStore.getState();
    if (s.request && s.result === undefined) s.resolve('cancel');
  }, []);
  const done = (r: PickResult) => {
    if (answered.current) return;
    answered.current = true;
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
