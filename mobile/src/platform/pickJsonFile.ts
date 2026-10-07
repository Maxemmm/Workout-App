// Choix d'un fichier JSON (Fichiers, iCloud, Drive…) puis lecture du texte
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { PickedFile } from './types';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export async function pickJsonFile(): Promise<PickedFile> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
    const asset = result.canceled ? undefined : result.assets?.[0];
    if (!asset) return { kind: 'cancel' };
    if ((asset.size ?? 0) > MAX_IMPORT_BYTES) return { kind: 'too_large' };
    return { kind: 'ok', text: await new File(asset.uri).text() };
  } catch {
    return { kind: 'error' };
  }
}
