// Recherche dans la bibliothèque : sans accents ni casse, fr + en, mots dans n'importe quel ordre ; filtres ; tri
import type { EquipmentKey } from './equipment';
import type { LibraryFilters, LibraryItem } from './types';

/** Minuscules, sans accents ; apostrophes, tirets et espaces multiples → un espace */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/['’\-_/.,()]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function searchLibrary(
  items: LibraryItem[],
  f: LibraryFilters,
  ctx: { favorites: string[]; myEquipment: EquipmentKey[] },
): LibraryItem[] {
  const words = normalize(f.query).split(' ').filter(Boolean);
  const favorites = new Set(ctx.favorites);
  const mine = new Set(ctx.myEquipment);
  const result = items.filter((i) => {
    if (f.muscle && i.primary !== f.muscle && !i.secondary.includes(f.muscle)) return false;
    if (f.equipment && i.equipment !== f.equipment) return false;
    if (f.favoritesOnly && !favorites.has(i.id)) return false;
    if (f.myEquipmentOnly && mine.size > 0 && !mine.has(i.equipment)) return false;
    if (words.length === 0) return true;
    const hay = `${normalize(i.name)} ${normalize(i.altName)}`;
    return words.every((w) => hay.includes(w));
  });
  return result.sort((a, b) => {
    const ia = a.illustration ? 0 : 1;
    const ib = b.illustration ? 0 : 1;
    return ia - ib || normalize(a.name).localeCompare(normalize(b.name));
  });
}
