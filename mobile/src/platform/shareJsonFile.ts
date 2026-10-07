// Partage d'un fichier JSON : écrit dans le cache puis feuille de partage système
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ShareResult } from './types';

export async function shareJsonFile(fileName: string, text: string): Promise<ShareResult> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: fileName });
  return 'shared';
}
