// Web : le sélecteur fournit un objet File du navigateur
import * as DocumentPicker from 'expo-document-picker';
import type { PickedFile } from './types';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export async function pickJsonFile(): Promise<PickedFile> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], multiple: false });
    const asset = result.canceled ? undefined : result.assets?.[0];
    if (!asset) return { kind: 'cancel' };
    if ((asset.size ?? 0) > MAX_IMPORT_BYTES) return { kind: 'too_large' };
    const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
    return { kind: 'ok', text };
  } catch {
    return { kind: 'error' };
  }
}
