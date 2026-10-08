// Partage d'un fichier JSON : écrit dans le cache puis feuille de partage système.
// iOS : Share de React Native, qui signale la fermeture sans partage ('cancelled').
// Android : l'annulation n'est pas détectable → 'shared' dès que la feuille se ferme sans erreur.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';
import type { ShareResult } from './types';

export async function shareJsonFile(fileName: string, text: string): Promise<ShareResult> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(text);
  if (Platform.OS === 'ios') {
    const result = await Share.share({ url: file.uri });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: fileName });
  return 'shared';
}
