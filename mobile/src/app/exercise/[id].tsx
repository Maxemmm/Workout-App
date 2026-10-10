// Route Fiche exercice (pile racine) — Stats : onglet + exercice demandé
import { router, useLocalSearchParams } from 'expo-router';
import { ExerciseDetail } from '@/features/library/ExerciseDetail';

export default function ExerciseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ExerciseDetail
      id={id ?? ''}
      onBack={() => router.back()}
      onEdit={(customId) => router.push({ pathname: '/exercise/custom', params: { id: customId } })}
      onOpenStats={(key) => { router.dismissAll(); router.navigate({ pathname: '/stats', params: { exercise: key, at: String(Date.now()) } }); }}
    />
  );
}
