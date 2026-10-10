// Favoris de la bibliothèque (réglage favoriteExercises)
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';

export function toggleFavorite(ctx: RepoCtx, id: string): void {
  const current = getSetting(ctx, 'favoriteExercises');
  const list = Array.isArray(current) ? current : [];
  setSetting(ctx, 'favoriteExercises', list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
}
