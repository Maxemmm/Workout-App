// ============================================================
// Bibliothèque affichable : catalogue embarqué (chargé une fois) + exercices personnalisés, dans une langue
// ============================================================
import { listCustomExercises, type CustomExercise } from '@/db/repos/customExercisesRepo';
import { getSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { isEquipmentKey, type EquipmentKey } from '@/domain/library/equipment';
import type { LibraryEntry, LibraryItem } from '@/domain/library/types';
import type { Lang } from '@/domain/prefs';

let catalog: LibraryEntry[] | null = null;
let byId: Map<string, LibraryEntry> | null = null;

function load(): { list: LibraryEntry[]; index: Map<string, LibraryEntry> } {
  if (!catalog || !byId) {
    // Chargement paresseux : le JSON (~2 Mo) n'est lu qu'à la première ouverture de la bibliothèque
    catalog = require('@/data/library/catalog.json') as LibraryEntry[];
    byId = new Map(catalog.map((e) => [e.id, e]));
  }
  return { list: catalog, index: byId };
}

const other = (lang: Lang): Lang => (lang === 'fr' ? 'en' : 'fr');

function fromEntry(e: LibraryEntry, lang: Lang): LibraryItem {
  const steps = e.steps ? (e.steps[lang].length ? e.steps[lang] : e.steps.en) : null;
  return {
    id: e.id, name: e.name[lang], altName: e.name[other(lang)], primary: e.primary, secondary: e.secondary,
    equipment: e.equipment, steps: steps && steps.length ? steps : null, illustration: e.illustration, custom: false,
  };
}

function fromCustom(c: CustomExercise): LibraryItem {
  return {
    id: `custom:${c.id}`, name: c.name, altName: c.name, primary: c.primary, secondary: c.secondary,
    equipment: c.equipment, steps: c.steps, illustration: null, custom: true,
  };
}

/** Catalogue affichable par langue (construit une fois) */
const catalogItems = new Map<Lang, LibraryItem[]>();
/** Dernier résultat : même langue + mêmes exercices perso (contenu) → même tableau, sans reconstruction */
let last: { key: string; items: LibraryItem[] } | null = null;

export function libraryItems(customs: CustomExercise[], lang: Lang): LibraryItem[] {
  const key = `${lang}|${JSON.stringify(customs)}`;
  if (last?.key === key) return last.items;
  let base = catalogItems.get(lang);
  if (!base) {
    base = load().list.map((e) => fromEntry(e, lang));
    catalogItems.set(lang, base);
  }
  last = { key, items: [...base, ...customs.map(fromCustom)] };
  return last.items;
}

export function findLibraryItem(id: string, customs: CustomExercise[], lang: Lang): LibraryItem | null {
  if (id.startsWith('custom:')) {
    const c = customs.find((x) => `custom:${x.id}` === id);
    return c ? fromCustom(c) : null;
  }
  const e = load().index.get(id);
  return e ? fromEntry(e, lang) : null;
}

/** Données utilisateur de la bibliothèque (requête de useDbQuery) */
export function readLibraryUser(ctx: RepoCtx): { customs: CustomExercise[]; favorites: string[]; myEquipment: EquipmentKey[] } {
  const favorites = getSetting(ctx, 'favoriteExercises');
  const mine = getSetting(ctx, 'myEquipment');
  return {
    customs: listCustomExercises(ctx),
    favorites: Array.isArray(favorites) ? favorites.filter((f): f is string => typeof f === 'string') : [],
    myEquipment: Array.isArray(mine) ? mine.filter(isEquipmentKey) : [],
  };
}
