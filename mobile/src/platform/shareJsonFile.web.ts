// Web : téléchargement direct du fichier
import type { ShareResult } from './types';

export async function shareJsonFile(fileName: string, text: string): Promise<ShareResult> {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return 'shared';
}
