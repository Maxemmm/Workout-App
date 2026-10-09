// Route Import (modale) — programme : Plan ; sauvegarde : Today.
// On ferme la modale puis on va sur l'onglet : un `replace` empilerait un second jeu d'onglets
// et jouerait une animation latérale à la place de la fermeture de la modale.
import { router } from 'expo-router';
import { ImportScreen } from '@/features/import/ImportScreen';

export default function ImportRoute() {
  return (
    <ImportScreen
      onCancel={() => router.back()}
      onDone={(kind) => {
        router.dismiss();
        router.navigate(kind === 'program' ? '/plan' : '/today');
      }}
    />
  );
}
