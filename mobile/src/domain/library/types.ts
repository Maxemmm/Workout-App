// Bibliothèque d'exercices — entrée du catalogue (2 langues) et élément affiché (1 langue)
import type { EquipmentKey } from './equipment';
import type { MuscleKey } from './muscles';

export type LibraryEntry = {
  id: string;
  name: { fr: string; en: string };
  primary: MuscleKey;
  secondary: MuscleKey[];
  equipment: EquipmentKey;
  steps: { fr: string[]; en: string[] } | null;
  illustration: string | null;
};

export type LibraryItem = {
  id: string;
  /** Nom dans la langue de l'app */
  name: string;
  /** Nom dans l'autre langue (recherche) */
  altName: string;
  primary: MuscleKey;
  secondary: MuscleKey[];
  equipment: EquipmentKey;
  steps: string[] | null;
  illustration: string | null;
  custom: boolean;
};

export type LibraryFilters = {
  query: string;
  muscle: MuscleKey | null;
  equipment: EquipmentKey | null;
  favoritesOnly: boolean;
  myEquipmentOnly: boolean;
};

export const NO_FILTERS: LibraryFilters = { query: '', muscle: null, equipment: null, favoritesOnly: false, myEquipmentOnly: false };
