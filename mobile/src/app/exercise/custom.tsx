// Route Exercice personnalisé (plein écran) — ?id=… pour modifier ; création : ouvre la fiche créée
import { router, useLocalSearchParams } from 'expo-router';
import { CustomExerciseEditor } from '@/features/library/CustomExerciseEditor';

export default function CustomExerciseRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <CustomExerciseEditor
      customId={id}
      onCancel={() => router.back()}
      onDone={(newId) => {
        router.back();
        if (!id) router.push({ pathname: '/exercise/[id]', params: { id: `custom:${newId}` } });
      }}
    />
  );
}
