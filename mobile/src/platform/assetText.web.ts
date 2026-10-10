// Web : le fichier est servi par Metro / l'hébergeur
import { Asset } from 'expo-asset';

export async function readAssetText(mod: number): Promise<string> {
  return (await fetch(Asset.fromModule(mod).uri)).text();
}
