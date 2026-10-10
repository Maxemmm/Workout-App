// Texte d'un fichier embarqué (SVG d'illustration), lu à la demande
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

export async function readAssetText(mod: number): Promise<string> {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  return new File(asset.localUri ?? asset.uri).text();
}
