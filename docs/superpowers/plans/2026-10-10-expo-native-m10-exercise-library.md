# App native Expo — M10 Bibliothèque d'exercices — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une bibliothèque hors ligne d'environ 1 400 exercices (exercises-dataset fusionné avec workout-guide), noms traduits, instructions FR, illustrations animées, dans un 5e onglet « Exercices », avec fiche, favoris, mon matériel, exercices personnalisés et choix depuis l'éditeur.

**Architecture:** un script Node (`scripts/build-catalog.mjs`) génère une fois des données versionnées (catalogue JSON, illustrations SVG optimisées, table des illustrations) ; `domain/library/` (pur) porte les listes de muscles / matériel et la recherche ; une table `custom_exercises` + des réglages gèrent les données utilisateur ; les écrans vivent dans `features/library/`.

**Tech Stack:** Expo SDK 57, TypeScript strict, Expo Router, expo-sqlite + Drizzle (migrations `drizzle-kit`), Zustand, Jest (jest-expo) + RNTL 14, `react-native-svg` (`SvgXml`), `expo-asset`, `expo-file-system`, `svgo` (dev, script uniquement).

**Spec:** `docs/superpowers/specs/2026-10-10-expo-native-m10-exercise-library-design.md` (+ `docs/superpowers/specs/2026-10-05-expo-native-foundation-design.md`, jalon M10).

Toutes les commandes se lancent depuis `mobile/`.

## Global Constraints

- **Aucun média Gym visual** (images / GIF d'exercises-dataset) dans le dépôt ni dans l'app ; seules les illustrations workout-guide (CC BY-SA 4.0) sont embarquées, avec crédit.
- Sources figées : exercises-dataset `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`, workout-guide `aac599224bb9780305239607ef98540b7e0ce389`.
- Identifiants : `ds:<id>`, `wg:<slug>`, `custom:<uuid>` ; une entrée fusionnée garde `ds:…`.
- `catalog.json` ≤ 3 Mo ; illustrations `assets/exercises/` ≤ 12 Mo (sinon ruling + réduction de précision svgo).
- Muscles : la liste de la spec (20 clés) **étendue de 2 clés** — `hip_flexors` (Fléchisseurs de hanche) et `full_body` (Corps entier) — pour des valeurs sources sans équivalent (« hip flexors », « Mobility », « Posterior Chain »). Toute valeur source non mappée fait échouer le script.
- `names.fr.json` et `wg-match.json` ne sont **jamais écrasés** par le script (il complète seulement les entrées manquantes).
- Exercice de programme : champ facultatif `libraryId` ; programmes existants valides.
- Sauvegarde native v1 : `customExercises` facultatif ; réglages `favoriteExercises`, `myEquipment` dans `settings`.
- Code et commentaires en français ; chaînes via i18n (fr + en). Pas de nouveau build (Expo Go). Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ; push uniquement sur `expo-native`.

## Review Focus

1. **Restaurer sa propre sauvegarde contenant des exercices personnalisés** : mêmes identifiants conservés (les `libraryId: custom:…` des programmes restent valides), pas de conflit de clé (Task 5 — test).
2. **Recherche avec accents, apostrophes, tirets et majuscules** (« développé », « pull-up », « d'haltères ») : résultats identiques à la saisie sans accent (Task 2 — test).
3. **Exercice personnalisé supprimé alors qu'un programme y est lié** : carte sans vignette, fiche « Exercice introuvable », aucun plantage (Task 9 et Task 11 — tests).
4. **Changement de langue** : noms, muscles, matériel et instructions suivent la langue ; un exercice sans instructions dans la langue retombe sur l'anglais (Task 6 — test).
5. **Illustration illisible / absente** : pastille du muscle à la place, aucune erreur (Task 6 — test).

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/domain/library/muscles.ts`, `equipment.ts`, `types.ts`, `search.ts` (créés) | Listes, types, recherche (pur) |
| `scripts/build-catalog.mjs` (créé) | Génération des données |
| `src/data/library/catalog.json`, `names.fr.json`, `wg-match.json`, `illustrations.ts` (générés) | Données versionnées |
| `assets/exercises/<slug>/frame-{1,2,3}.svg`, `assets/exercises/LICENSE-ASSETS.md` (générés) | Illustrations |
| `metro.config.js`, `package.json` (jest), `src/test/svgStub.js`, `.gitignore` | Configuration |
| `src/domain/program.ts` | `libraryId` facultatif |
| `src/db/schema.ts`, `drizzle/*` | Table `custom_exercises` + migration |
| `src/db/repos/customExercisesRepo.ts` (créé), `settingsRepo.ts`, `exportRepo.ts`, `importRepo.ts`, `statsRepo.ts` | Données utilisateur, sauvegarde, historique lié |
| `src/domain/importBundle.ts`, `nativeBackup.ts` | `customExercises` dans la sauvegarde |
| `src/platform/assetText.ts` / `.web.ts` (créés) | Lecture du texte d'un SVG embarqué |
| `src/features/library/*` (créés) | Données d'affichage, illustration, écrans |
| `src/app/(tabs)/exercises.tsx`, `src/app/exercise/[id].tsx`, `src/app/exercise/custom.tsx`, `src/app/editor/library.tsx` (créés) | Routes |
| `src/app/(tabs)/_layout.tsx`, `src/app/_layout.tsx` | Onglet, écrans de pile |
| `src/features/editor/*`, `src/features/today/*`, `src/features/stats/*`, `src/features/profile/*` | Intégrations |
| `src/i18n/locales/fr.json`, `en.json` | Chaînes |
| `docs/DEVICE_CHECKLIST.md` | Section M10 |

---

### Task 1: Listes de muscles et de matériel (`domain/library`)

**Files:**
- Create: `mobile/src/domain/library/muscles.ts`, `mobile/src/domain/library/equipment.ts`, `mobile/src/domain/library/__tests__/taxonomy.test.ts`

**Interfaces:**
- Produces:
  - `MUSCLE_KEYS` (22 clés, ordre d'affichage) ; `type MuscleKey` ; `isMuscleKey(v): v is MuscleKey` ; `muscleLabel(key, lang): string`
  - `EQUIPMENT_KEYS` (13 clés) ; `type EquipmentKey` ; `isEquipmentKey(v)` ; `equipmentLabel(key, lang): string`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/library/__tests__/taxonomy.test.ts` :
```ts
import { EQUIPMENT_KEYS, equipmentLabel, isEquipmentKey } from '../equipment';
import { isMuscleKey, MUSCLE_KEYS, muscleLabel } from '../muscles';

describe('muscles', () => {
  it('22 clés uniques, libellés fr / en non vides', () => {
    expect(MUSCLE_KEYS).toHaveLength(22);
    expect(new Set(MUSCLE_KEYS).size).toBe(22);
    for (const k of MUSCLE_KEYS) {
      expect(muscleLabel(k, 'fr').length).toBeGreaterThan(0);
      expect(muscleLabel(k, 'en').length).toBeGreaterThan(0);
    }
    expect(muscleLabel('hamstrings', 'fr')).toBe('Ischio-jambiers');
    expect(muscleLabel('lats', 'en')).toBe('Lats');
  });
  it('garde de type', () => {
    expect(isMuscleKey('chest')).toBe(true);
    expect(isMuscleKey('pectorals')).toBe(false);
  });
});

describe('matériel', () => {
  it('13 clés uniques, libellés fr / en', () => {
    expect(EQUIPMENT_KEYS).toHaveLength(13);
    expect(new Set(EQUIPMENT_KEYS).size).toBe(13);
    expect(equipmentLabel('dumbbell', 'fr')).toBe('Haltères');
    expect(equipmentLabel('cable', 'fr')).toBe('Poulie');
    expect(isEquipmentKey('bodyweight')).toBe(true);
    expect(isEquipmentKey('body weight')).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/domain/library`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/library/muscles.ts` :
```ts
// Muscles de la bibliothèque — liste propre à l'app (calée sur les groupes de MuscleMap pour le M11)
import type { Lang } from '../prefs';

export const MUSCLE_KEYS = [
  'chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'serratus',
  'lats', 'upper_back', 'traps', 'lower_back', 'neck',
  'glutes', 'hip_flexors', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves',
  'cardio', 'full_body',
] as const;
export type MuscleKey = (typeof MUSCLE_KEYS)[number];

const LABELS: Record<MuscleKey, { fr: string; en: string }> = {
  chest: { fr: 'Pectoraux', en: 'Chest' },
  shoulders: { fr: 'Épaules', en: 'Shoulders' },
  biceps: { fr: 'Biceps', en: 'Biceps' },
  triceps: { fr: 'Triceps', en: 'Triceps' },
  forearms: { fr: 'Avant-bras', en: 'Forearms' },
  abs: { fr: 'Abdominaux', en: 'Abs' },
  obliques: { fr: 'Obliques', en: 'Obliques' },
  serratus: { fr: 'Dentelés', en: 'Serratus' },
  lats: { fr: 'Dorsaux', en: 'Lats' },
  upper_back: { fr: 'Haut du dos', en: 'Upper back' },
  traps: { fr: 'Trapèzes', en: 'Traps' },
  lower_back: { fr: 'Lombaires', en: 'Lower back' },
  neck: { fr: 'Cou', en: 'Neck' },
  glutes: { fr: 'Fessiers', en: 'Glutes' },
  hip_flexors: { fr: 'Fléchisseurs de hanche', en: 'Hip flexors' },
  quads: { fr: 'Quadriceps', en: 'Quads' },
  hamstrings: { fr: 'Ischio-jambiers', en: 'Hamstrings' },
  adductors: { fr: 'Adducteurs', en: 'Adductors' },
  abductors: { fr: 'Abducteurs', en: 'Abductors' },
  calves: { fr: 'Mollets', en: 'Calves' },
  cardio: { fr: 'Cardio', en: 'Cardio' },
  full_body: { fr: 'Corps entier', en: 'Full body' },
};

export const isMuscleKey = (v: unknown): v is MuscleKey => typeof v === 'string' && (MUSCLE_KEYS as readonly string[]).includes(v);
export const muscleLabel = (key: MuscleKey, lang: Lang): string => LABELS[key][lang];
```

`mobile/src/domain/library/equipment.ts` :
```ts
// Matériel de la bibliothèque — valeurs sources regroupées
import type { Lang } from '../prefs';

export const EQUIPMENT_KEYS = [
  'bodyweight', 'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'band',
  'weighted', 'ball', 'pullup_bar', 'bench', 'cardio_machine', 'other',
] as const;
export type EquipmentKey = (typeof EQUIPMENT_KEYS)[number];

const LABELS: Record<EquipmentKey, { fr: string; en: string }> = {
  bodyweight: { fr: 'Poids du corps', en: 'Bodyweight' },
  barbell: { fr: 'Barre', en: 'Barbell' },
  dumbbell: { fr: 'Haltères', en: 'Dumbbells' },
  kettlebell: { fr: 'Kettlebell', en: 'Kettlebell' },
  cable: { fr: 'Poulie', en: 'Cable' },
  machine: { fr: 'Machine', en: 'Machine' },
  band: { fr: 'Élastique', en: 'Band' },
  weighted: { fr: 'Lest / disque', en: 'Weight / plate' },
  ball: { fr: 'Ballon', en: 'Ball' },
  pullup_bar: { fr: 'Barre de traction', en: 'Pull-up bar' },
  bench: { fr: 'Banc', en: 'Bench' },
  cardio_machine: { fr: 'Machine cardio', en: 'Cardio machine' },
  other: { fr: 'Autre', en: 'Other' },
};

export const isEquipmentKey = (v: unknown): v is EquipmentKey => typeof v === 'string' && (EQUIPMENT_KEYS as readonly string[]).includes(v);
export const equipmentLabel = (key: EquipmentKey, lang: Lang): string => LABELS[key][lang];
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/domain/library && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/domain/library
git commit -m "feat(mobile): add the exercise library muscle and equipment lists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Types d'entrée et recherche (`domain/library/search`)

**Files:**
- Create: `mobile/src/domain/library/types.ts`, `mobile/src/domain/library/search.ts`, `mobile/src/domain/library/__tests__/search.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `type LibraryEntry = { id: string; name: { fr: string; en: string }; primary: MuscleKey; secondary: MuscleKey[]; equipment: EquipmentKey; steps: { fr: string[]; en: string[] } | null; illustration: string | null }` (forme de `catalog.json`)
  - `type LibraryItem = { id: string; name: string; altName: string; primary: MuscleKey; secondary: MuscleKey[]; equipment: EquipmentKey; steps: string[] | null; illustration: string | null; custom: boolean }` (affichage, une langue)
  - `type LibraryFilters = { query: string; muscle: MuscleKey | null; equipment: EquipmentKey | null; favoritesOnly: boolean; myEquipmentOnly: boolean }`
  - `normalize(s: string): string` ; `searchLibrary(items: LibraryItem[], f: LibraryFilters, ctx: { favorites: string[]; myEquipment: EquipmentKey[] }): LibraryItem[]`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/library/__tests__/search.test.ts` :
```ts
import { normalize, searchLibrary } from '../search';
import type { LibraryFilters, LibraryItem } from '../types';

const item = (o: Partial<LibraryItem> & Pick<LibraryItem, 'id' | 'name'>): LibraryItem => ({
  altName: o.name, primary: 'chest', secondary: [], equipment: 'barbell', steps: null, illustration: null, custom: false, ...o,
});
const items: LibraryItem[] = [
  item({ id: 'ds:1', name: 'Développé couché', altName: 'barbell bench press', illustration: null }),
  item({ id: 'ds:2', name: 'Traction pronation', altName: 'pull-up', primary: 'lats', secondary: ['biceps'], equipment: 'pullup_bar', illustration: 'pull-up' }),
  item({ id: 'ds:3', name: "Curl d'haltères", altName: 'dumbbell curl', primary: 'biceps', equipment: 'dumbbell' }),
  item({ id: 'custom:x', name: 'Mon exercice', altName: 'Mon exercice', primary: 'quads', equipment: 'machine', custom: true }),
];
const none: LibraryFilters = { query: '', muscle: null, equipment: null, favoritesOnly: false, myEquipmentOnly: false };
const ctx = { favorites: [] as string[], myEquipment: [] as ('barbell' | 'dumbbell')[] };
const ids = (r: LibraryItem[]) => r.map((i) => i.id);

describe('normalize', () => {
  it('accents, casse, apostrophes, tirets', () => {
    expect(normalize("Développé  D'Haltères")).toBe('developpe d halteres');
    expect(normalize('Pull-Up')).toBe('pull up');
  });
});

describe('searchLibrary', () => {
  it('sans filtre : illustrés d\'abord, puis ordre alphabétique', () => {
    // illustré (ds:2) d'abord, puis alphabétique : « curl d haltères », « developpe couche », « mon exercice »
    expect(ids(searchLibrary(items, none, ctx))).toEqual(['ds:2', 'ds:3', 'ds:1', 'custom:x']);
  });

  it('Review Focus 2 : recherche sans accents, mots dans le désordre, fr ou en', () => {
    expect(ids(searchLibrary(items, { ...none, query: 'couche developpe' }, ctx))).toEqual(['ds:1']);
    expect(ids(searchLibrary(items, { ...none, query: 'DÉVELOPPÉ' }, ctx))).toEqual(['ds:1']);
    expect(ids(searchLibrary(items, { ...none, query: 'pull up' }, ctx))).toEqual(['ds:2']);
    expect(ids(searchLibrary(items, { ...none, query: 'pull-up' }, ctx))).toEqual(['ds:2']);
    expect(ids(searchLibrary(items, { ...none, query: "d'haltères" }, ctx))).toEqual(['ds:3']);
    expect(ids(searchLibrary(items, { ...none, query: 'bench' }, ctx))).toEqual(['ds:1']);
  });

  it('filtre muscle : principal ou secondaire', () => {
    expect(ids(searchLibrary(items, { ...none, muscle: 'biceps' }, ctx)).sort()).toEqual(['ds:2', 'ds:3']);
  });

  it('filtres combinés : matériel + favoris + mon matériel', () => {
    expect(ids(searchLibrary(items, { ...none, equipment: 'dumbbell' }, ctx))).toEqual(['ds:3']);
    expect(ids(searchLibrary(items, { ...none, favoritesOnly: true }, { ...ctx, favorites: ['ds:1', 'custom:x'] }))).toEqual(['ds:1', 'custom:x']);
    expect(ids(searchLibrary(items, { ...none, myEquipmentOnly: true }, { ...ctx, myEquipment: ['barbell', 'dumbbell'] }))).toEqual(['ds:3', 'ds:1']);
  });

  it('mon matériel vide : filtre sans effet', () => {
    expect(searchLibrary(items, { ...none, myEquipmentOnly: true }, ctx)).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/domain/library/__tests__/search.test.ts`
Expected: FAIL — module `../search` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/library/types.ts` :
```ts
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
```

`mobile/src/domain/library/search.ts` :
```ts
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
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/domain/library && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/domain/library
git commit -m "feat(mobile): search and filter the exercise library

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Génération du catalogue et des illustrations

**Files:**
- Create: `mobile/scripts/build-catalog.mjs`, `mobile/src/data/library/catalog.json` (généré), `mobile/src/data/library/names.fr.json` (généré, complété en Task 4), `mobile/src/data/library/wg-match.json` (généré puis relu), `mobile/src/data/library/illustrations.ts` (généré), `mobile/assets/exercises/**` (généré), `mobile/src/test/svgStub.js`, `mobile/src/data/library/__tests__/catalog.test.ts`
- Modify: `mobile/metro.config.js`, `mobile/package.json` (jest `moduleNameMapper`, devDependency `svgo`), `mobile/.gitignore` (`/.cache/`)

**Interfaces:**
- Consumes: Task 1 (clés valides, vérifiées par le test), Task 2 (`LibraryEntry`).
- Produces: `catalog.json` : `LibraryEntry[]` trié par id ; `ILLUSTRATIONS: Record<string, readonly [number, number, number]>` (`src/data/library/illustrations.ts`).

- [ ] **Step 1: Écrire le test des données générées**

`mobile/src/data/library/__tests__/catalog.test.ts` :
```ts
/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { isEquipmentKey } from '@/domain/library/equipment';
import { isMuscleKey } from '@/domain/library/muscles';
import type { LibraryEntry } from '@/domain/library/types';
import catalog from '../catalog.json';
import names from '../names.fr.json';
import { ILLUSTRATIONS } from '../illustrations';

const entries = catalog as LibraryEntry[];
const ROOT = path.resolve(__dirname, '../../../..');

describe('catalogue généré', () => {
  it('1 324 entrées ds: + des entrées wg: propres à workout-guide ; ids uniques', () => {
    expect(entries.filter((e) => e.id.startsWith('ds:'))).toHaveLength(1324);
    expect(entries.filter((e) => e.id.startsWith('wg:')).length).toBeGreaterThan(0);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });

  it('chaque entrée : noms fr / en non vides, muscles et matériel connus, secondaires sans doublon ni principal', () => {
    for (const e of entries) {
      expect(e.name.en.length).toBeGreaterThan(0);
      expect(e.name.fr.length).toBeGreaterThan(0);
      expect(isMuscleKey(e.primary)).toBe(true);
      expect(isEquipmentKey(e.equipment)).toBe(true);
      expect(e.secondary.every(isMuscleKey)).toBe(true);
      expect(new Set(e.secondary).size).toBe(e.secondary.length);
      expect(e.secondary).not.toContain(e.primary);
    }
  });

  it('instructions : entrées ds avec étapes fr et en ; wg sans instructions', () => {
    for (const e of entries.filter((x) => x.id.startsWith('ds:'))) {
      expect(e.steps?.fr.length).toBeGreaterThan(0);
      expect(e.steps?.en.length).toBeGreaterThan(0);
    }
    for (const e of entries.filter((x) => x.id.startsWith('wg:'))) expect(e.steps).toBeNull();
  });

  it('chaque illustration référencée a ses 3 fichiers et sa ligne dans ILLUSTRATIONS', () => {
    for (const e of entries.filter((x) => x.illustration)) {
      for (const n of [1, 2, 3]) {
        expect(fs.existsSync(path.join(ROOT, 'mobile/assets/exercises', e.illustration!, `frame-${n}.svg`))).toBe(true);
      }
      expect(ILLUSTRATIONS[e.illustration!]).toHaveLength(3);
    }
  });

  it('aucun média Gym visual ; tailles maîtrisées', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'mobile/src/data/library/catalog.json'), 'utf8');
    expect(raw).not.toMatch(/gymvisual|images\/|videos\/|\.gif/i);
    expect(raw.length).toBeLessThanOrEqual(3 * 1024 * 1024);
  });

  it('table de noms français : une entrée par exercice', () => {
    for (const e of entries) expect(Object.hasOwn(names, e.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/data/library`
Expected: FAIL — `../catalog.json` introuvable.

- [ ] **Step 3: Préparer la configuration**

```bash
npm install --save-dev svgo
npx expo install expo-asset
```

`metro.config.js` — après `config.resolver.assetExts.push('wasm');` :
```js
// Illustrations d'exercices : SVG embarqués comme fichiers (lus à la demande, pas dans le bundle JS)
config.resolver.assetExts.push('svg');
```

`package.json` → `jest.moduleNameMapper` : ajouter **avant** l'alias `@/` :
```json
"\\.svg$": "<rootDir>/src/test/svgStub.js",
```

`mobile/src/test/svgStub.js` :
```js
// Les SVG embarqués sont des modules d'asset (nombre) côté Metro ; en test, un identifiant factice
module.exports = 1;
```

`.gitignore` (mobile) : ajouter `/.cache/` (sources téléchargées par le script).

- [ ] **Step 4: Écrire le script**

`mobile/scripts/build-catalog.mjs` :
```js
// ============================================================
// Génère la bibliothèque d'exercices (une fois, hors app) :
//   exercises-dataset (MIT, données / textes) + workout-guide (MIT ; illustrations CC BY-SA 4.0).
// Sorties versionnées : src/data/library/{catalog.json,names.fr.json,wg-match.json,illustrations.ts}
//                       assets/exercises/<slug>/frame-{1,2,3}.svg + LICENSE-ASSETS.md
// Jamais de média Gym visual. names.fr.json et wg-match.json ne sont jamais écrasés (complétés).
// Usage : node scripts/build-catalog.mjs
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize } from 'svgo';

const DS_SHA = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd';
const WG_SHA = 'aac599224bb9780305239607ef98540b7e0ce389';
const DS_URL = `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${DS_SHA}/data/exercises.json`;
const WG_BASE = `https://raw.githubusercontent.com/bryllim/workout-guide/${WG_SHA}/packages/workout-guide`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache/library-src');
const OUT = path.join(ROOT, 'src/data/library');
const ASSETS = path.join(ROOT, 'assets/exercises');

const MUSCLE = {
  // exercises-dataset (target + secondary_muscles)
  abs: 'abs', abdominals: 'abs', 'lower abs': 'abs', core: 'abs', obliques: 'obliques',
  pectorals: 'chest', chest: 'chest', 'upper chest': 'chest',
  delts: 'shoulders', deltoids: 'shoulders', shoulders: 'shoulders', 'rear deltoids': 'shoulders', 'rotator cuff': 'shoulders',
  biceps: 'biceps', brachialis: 'biceps', triceps: 'triceps',
  forearms: 'forearms', 'grip muscles': 'forearms', hands: 'forearms', wrists: 'forearms', 'wrist flexors': 'forearms', 'wrist extensors': 'forearms',
  lats: 'lats', 'latissimus dorsi': 'lats', 'upper back': 'upper_back', back: 'upper_back', rhomboids: 'upper_back',
  traps: 'traps', trapezius: 'traps', spine: 'lower_back', 'lower back': 'lower_back',
  'levator scapulae': 'neck', sternocleidomastoid: 'neck', 'serratus anterior': 'serratus',
  glutes: 'glutes', 'hip flexors': 'hip_flexors', quads: 'quads', quadriceps: 'quads', hamstrings: 'hamstrings',
  adductors: 'adductors', 'inner thighs': 'adductors', groin: 'adductors', abductors: 'abductors',
  calves: 'calves', soleus: 'calves', shins: 'calves', ankles: 'calves', 'ankle stabilizers': 'calves', feet: 'calves',
  'cardiovascular system': 'cardio',
  // workout-guide (primaryMuscle + secondaryMuscles)
  Chest: 'chest', Shoulders: 'shoulders', 'Rear Delts': 'shoulders', 'Upper Back': 'upper_back', Back: 'upper_back',
  Lats: 'lats', Biceps: 'biceps', Triceps: 'triceps', Forearms: 'forearms', Grip: 'forearms',
  Core: 'abs', 'Lower Back': 'lower_back', Glutes: 'glutes', Hips: 'glutes', Quads: 'quads', Legs: 'quads',
  Hamstrings: 'hamstrings', 'Posterior Chain': 'full_body', Adductors: 'adductors', Groin: 'adductors',
  Calves: 'calves', Cardio: 'cardio', Mobility: 'full_body',
};
const EQUIPMENT = {
  'body weight': 'bodyweight', assisted: 'machine', barbell: 'barbell', 'olympic barbell': 'barbell', 'ez barbell': 'barbell', 'trap bar': 'barbell',
  dumbbell: 'dumbbell', kettlebell: 'kettlebell', cable: 'cable',
  'leverage machine': 'machine', 'smith machine': 'machine', 'sled machine': 'machine',
  band: 'band', 'resistance band': 'band', weighted: 'weighted',
  'stability ball': 'ball', 'medicine ball': 'ball', 'bosu ball': 'ball',
  'stationary bike': 'cardio_machine', 'elliptical machine': 'cardio_machine', 'stepmill machine': 'cardio_machine',
  'skierg machine': 'cardio_machine', 'upper body ergometer': 'cardio_machine',
  rope: 'other', roller: 'other', 'wheel roller': 'other', tire: 'other', hammer: 'other',
  // workout-guide
  Bodyweight: 'bodyweight', Barbell: 'barbell', Dumbbell: 'dumbbell', Kettlebell: 'kettlebell', Cable: 'cable', Machine: 'machine',
  'Resistance Band': 'band', Plate: 'weighted', 'Stability Ball': 'ball', 'Pull-up Bar': 'pullup_bar', Bench: 'bench',
  Cardio: 'cardio_machine', Wall: 'other', Chair: 'other', Doorway: 'other', Towel: 'other', Box: 'other',
};

const fail = (msg) => { throw new Error(msg); };
const muscle = (v, ctx) => MUSCLE[v] ?? fail(`muscle inconnu « ${v} » (${ctx}) : compléter la table MUSCLE`);
const equipment = (v, ctx) => EQUIPMENT[v] ?? fail(`matériel inconnu « ${v} » (${ctx}) : compléter la table EQUIPMENT`);
const uniq = (list, primary) => [...new Set(list)].filter((m) => m !== primary);
const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);
const writeJson = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\bs\b/g, '').trim().replace(/s$/, '');

async function cached(url, file) {
  const p = path.join(CACHE, file);
  if (!fs.existsSync(p)) {
    const res = await fetch(url);
    if (!res.ok) fail(`téléchargement impossible : ${url} (${res.status})`);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
  return fs.readFileSync(p, 'utf8');
}

const ds = JSON.parse(await cached(DS_URL, 'exercises.json'));
const wg = JSON.parse(await cached(`${WG_BASE}/manifest.json`, 'manifest.json'));

// Correspondance workout-guide → exercises-dataset : relue à la main, jamais écrasée
const matchFile = path.join(OUT, 'wg-match.json');
const match = readJson(matchFile, {});
const dsByNorm = new Map(ds.map((e) => [norm(e.name), e.id]));
for (const w of wg) if (!(w.slug in match)) match[w.slug] = dsByNorm.get(norm(w.name)) ?? null;
const dsIllustration = new Map(Object.entries(match).filter(([, id]) => id).map(([slug, id]) => [id, slug]));

const entries = [];
for (const e of ds) {
  const primary = muscle(e.target, `ds:${e.id}`);
  entries.push({
    id: `ds:${e.id}`,
    name: { fr: '', en: e.name.charAt(0).toUpperCase() + e.name.slice(1) },
    primary,
    secondary: uniq((e.secondary_muscles ?? []).map((m) => muscle(m, `ds:${e.id}`)), primary),
    equipment: equipment(e.equipment, `ds:${e.id}`),
    steps: { fr: e.instruction_steps?.fr ?? [], en: e.instruction_steps?.en ?? [] },
    illustration: dsIllustration.get(e.id) ?? null,
  });
}
for (const w of wg) {
  if (match[w.slug]) continue; // fusionné dans l'entrée ds:
  const primary = muscle(w.primaryMuscle, `wg:${w.slug}`);
  entries.push({
    id: `wg:${w.slug}`,
    name: { fr: '', en: w.name },
    primary,
    secondary: uniq((w.secondaryMuscles ?? []).map((m) => muscle(m, `wg:${w.slug}`)), primary),
    equipment: equipment(w.equipment, `wg:${w.slug}`),
    steps: null,
    illustration: w.slug,
  });
}
entries.sort((a, b) => a.id.localeCompare(b.id));

// Noms français : table relue à la main, jamais écrasée ; entrée vide = à traduire (repli anglais)
const namesFile = path.join(OUT, 'names.fr.json');
const names = readJson(namesFile, {});
let missing = 0;
for (const e of entries) {
  if (!(e.id in names)) names[e.id] = '';
  if (!names[e.id]) missing += 1;
  e.name.fr = names[e.id] || e.name.en;
}

// Illustrations : 3 images par exercice illustré, optimisées (svgo), remplissage d'origine conservé
const slugs = [...new Set(entries.map((e) => e.illustration).filter(Boolean))].sort();
for (const slug of slugs) {
  for (const n of [1, 2, 3]) {
    const raw = await cached(`${WG_BASE}/assets/${slug}/frame-${n}.svg`, `assets/${slug}/frame-${n}.svg`);
    const out = optimize(raw, { multipass: true, floatPrecision: 1 }).data;
    fs.mkdirSync(path.join(ASSETS, slug), { recursive: true });
    fs.writeFileSync(path.join(ASSETS, slug, `frame-${n}.svg`), out);
  }
}
fs.writeFileSync(path.join(ASSETS, 'LICENSE-ASSETS.md'), `# Illustrations d'exercices

Adaptées (optimisées avec svgo, recolorées à l'affichage) de [workout-guide](https://github.com/bryllim/workout-guide)
par [Bryl Lim](https://bryllim.com), elles-mêmes issues en partie d'[Everkinetic](https://github.com/everkinetic/data).
Licence : [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — ces fichiers adaptés restent sous CC BY-SA 4.0.
`);
fs.writeFileSync(path.join(OUT, 'illustrations.ts'), `// Généré par scripts/build-catalog.mjs — ne pas modifier à la main.
// Illustrations workout-guide (CC BY-SA 4.0, Bryl Lim / Everkinetic) : 3 images par exercice.
export const ILLUSTRATIONS: Record<string, readonly [number, number, number]> = {
${slugs.map((s) => `  '${s}': [require('../../../assets/exercises/${s}/frame-1.svg'), require('../../../assets/exercises/${s}/frame-2.svg'), require('../../../assets/exercises/${s}/frame-3.svg')],`).join('\n')}
};
`);

writeJson(matchFile, Object.fromEntries(Object.entries(match).sort(([a], [b]) => a.localeCompare(b))));
writeJson(namesFile, Object.fromEntries(Object.entries(names).sort(([a], [b]) => a.localeCompare(b))));
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(entries));
const unmatched = Object.values(match).filter((v) => v === null).length;
console.log(`catalogue : ${entries.length} entrées (${slugs.length} illustrées) ; wg sans correspondance : ${unmatched} ; noms FR manquants : ${missing}`);
```

- [ ] **Step 5: Générer, puis relire la correspondance**

Run: `node scripts/build-catalog.mjs`
Expected : `catalogue : … entrées (… illustrées) ; wg sans correspondance : N ; noms FR manquants : …`. Une erreur « muscle inconnu » / « matériel inconnu » → compléter la table du script (ledger).

Relire `src/data/library/wg-match.json` : pour chaque slug à `null`, chercher l'exercice équivalent dans exercises-dataset (ex. `bench-press` ↔ « barbell bench press », `bicep-curl` ↔ « dumbbell biceps curl ») et renseigner son id (`"0025"` sans le préfixe `ds:`) ; laisser `null` s'il n'existe pas. Vérifier aussi quelques correspondances automatiques au hasard. Relancer `node scripts/build-catalog.mjs` jusqu'à stabilité. Vérifier les tailles :
`du -sh assets/exercises src/data/library/catalog.json`
Expected : illustrations ≤ 12 Mo, catalogue ≤ 3 Mo (sinon passer `floatPrecision` à `0` et ledger).

- [ ] **Step 6: Relancer le test**

Run: `npx jest src/data/library && npx tsc --noEmit`
Expected: PASS (le test « noms fr non vides » passe grâce au repli anglais ; la Task 4 remplit les traductions), tsc propre.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-catalog.mjs src/data/library assets/exercises src/test/svgStub.js metro.config.js package.json package-lock.json .gitignore
git commit -m "feat(mobile): generate the merged exercise catalog and illustrations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Noms français des exercices

**Files:**
- Modify: `mobile/src/data/library/names.fr.json`, `mobile/src/data/library/catalog.json` (régénéré)
- Test: `mobile/src/data/library/__tests__/catalog.test.ts` (ajout)

**Interfaces:**
- Consumes: Task 3 (`names.fr.json` complet en clés, valeurs vides).
- Produces: un nom français non vide pour chaque entrée.

- [ ] **Step 1: Écrire le test**

Ajouter à `catalog.test.ts` :
```ts
describe('noms français', () => {
  it('chaque entrée a une traduction (pas de repli anglais) ; la grande majorité diffère de l\'anglais', () => {
    const table = names as Record<string, string>;
    for (const e of entries) expect(table[e.id]?.trim().length).toBeGreaterThan(0);
    const same = entries.filter((e) => e.name.fr.toLowerCase() === e.name.en.toLowerCase()).length;
    expect(same / entries.length).toBeLessThan(0.05);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/data/library`
Expected: FAIL — traductions vides.

- [ ] **Step 3: Traduire**

Remplir `names.fr.json` par lots (par exemple 150 entrées à la fois, dans l'ordre des ids), en traduisant le nom anglais de `catalog.json` selon ce glossaire et ces règles :
- Majuscule initiale seulement ; termes de salle usuels en français : *bench press* → « Développé couché », *incline / decline* → « incliné / décliné », *press* (épaules) → « Développé épaules », *overhead press* → « Développé militaire », *fly* → « Écarté », *row* → « Rowing », *pulldown* → « Tirage vertical », *pull-up* → « Traction pronation », *chin-up* → « Traction supination », *curl* → « Curl », *hammer curl* → « Curl marteau », *preacher curl* → « Curl pupitre », *extension* (triceps) → « Extension », *pushdown* → « Extension à la poulie », *kickback* → « Kickback », *dip* → « Dips », *squat* → « Squat », *front squat* → « Squat avant », *lunge* → « Fente », *split squat* → « Squat bulgare » (si *bulgarian*), *deadlift* → « Soulevé de terre », *romanian deadlift* → « Soulevé de terre roumain », *hip thrust* → « Hip thrust », *glute bridge* → « Pont fessier », *leg press* → « Presse à cuisses », *leg curl* → « Leg curl », *leg extension* → « Leg extension », *calf raise* → « Extension mollets », *lateral raise* → « Élévation latérale », *front raise* → « Élévation frontale », *rear delt* → « Oiseau » (raise) / « deltoïde postérieur », *shrug* → « Haussement d'épaules », *crunch* → « Crunch », *sit-up* → « Relevé de buste », *plank* → « Gainage », *side plank* → « Gainage latéral », *push-up* → « Pompe », *burpee* → « Burpee », *stretch* → « Étirement », *wrist curl* → « Curl poignet ».
- Matériel en complément : *barbell* → « à la barre », *dumbbell* → « aux haltères », *cable* → « à la poulie », *band* → « à l'élastique », *lever / leverage* → « à la machine », *smith* → « à la Smith machine », *kettlebell* → « au kettlebell », *ez barbell* → « à la barre EZ », *weighted* → « lesté », *assisted* → « assisté », *stability ball* → « sur swiss ball », *bosu* → « sur Bosu ».
- Position / prise : *seated* → « assis », *standing* → « debout », *lying* → « allongé », *one arm / single arm* → « unilatéral », *alternate* → « alterné », *close grip* → « prise serrée », *wide grip* → « prise large », *reverse grip* → « prise inversée ».
- Ordre français : mouvement, puis précisions, puis matériel (« Développé couché incliné aux haltères »).
- Noms propres d'exercices sans équivalent courant gardés tels quels (« Russian twist », « Good morning », « Jefferson curl »).

Puis : `node scripts/build-catalog.mjs` (régénère `catalog.json` avec les noms français).

- [ ] **Step 4: Relancer**

Run: `npx jest src/data/library`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/library
git commit -m "feat(mobile): translate the exercise library names to French

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `libraryId`, exercices personnalisés, réglages et sauvegarde

**Files:**
- Modify: `mobile/src/domain/program.ts` (`libraryId`), `mobile/src/db/schema.ts`, `mobile/src/db/repos/settingsRepo.ts`, `mobile/src/domain/importBundle.ts`, `mobile/src/domain/nativeBackup.ts`, `mobile/src/db/repos/exportRepo.ts`, `mobile/src/db/repos/importRepo.ts`, `mobile/drizzle/*` (généré)
- Create: `mobile/src/db/repos/customExercisesRepo.ts`, `mobile/src/db/__tests__/customExercisesRepo.test.ts`

**Interfaces:**
- Consumes: Task 1 (`MuscleKey`, `EquipmentKey`, gardes).
- Produces:
  - `ExerciseSchema` : `libraryId: z.string().optional()`
  - table `custom_exercises` ; `type CustomExercise = { id: string; name: string; primary: MuscleKey; secondary: MuscleKey[]; equipment: EquipmentKey; steps: string[] | null }` (`id` = id natif, exposé `custom:<id>`)
  - `type CustomExerciseInput = Omit<CustomExercise, 'id'>`
  - `listCustomExercises(ctx): CustomExercise[]`, `getCustomExercise(ctx, id): CustomExercise | null`, `createCustomExercise(ctx, input): CustomExercise`, `updateCustomExercise(ctx, id, input): void`, `deleteCustomExercise(ctx, id): void`
  - `SettingsMap.favoriteExercises: string[]`, `SettingsMap.myEquipment: EquipmentKey[]`
  - `BundleCustomExercise = CustomExercise` ; `ImportBundle.customExercises: BundleCustomExercise[]` ; `BundleSettings.favoriteExercises?`, `BundleSettings.myEquipment?`

- [ ] **Step 1: Écrire les tests**

`mobile/src/db/__tests__/customExercisesRepo.test.ts` :
```ts
/** @jest-environment node */
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { parseNativeBackup, toNativeBackup } from '@/domain/nativeBackup';
import { parseProgram } from '@/domain/program';
import { createCustomExercise, deleteCustomExercise, getCustomExercise, listCustomExercises, updateCustomExercise } from '../repos/customExercisesRepo';
import { readBundle } from '../repos/exportRepo';
import { replaceAll } from '../repos/importRepo';
import { getSetting, setSetting } from '../repos/settingsRepo';
import { createTestCtx } from '../testing/createTestCtx';

const input = { name: 'Presse à cuisses 45°', primary: 'quads' as const, secondary: ['glutes' as const], equipment: 'machine' as const, steps: ['Pousser'] };

describe('exercices personnalisés', () => {
  it('créer, lister, modifier, supprimer (logiquement)', () => {
    const ctx = createTestCtx();
    const c = createCustomExercise(ctx, input);
    expect(listCustomExercises(ctx)).toEqual([c]);
    updateCustomExercise(ctx, c.id, { ...input, name: 'Presse 45°', steps: null });
    expect(getCustomExercise(ctx, c.id)).toMatchObject({ name: 'Presse 45°', steps: null });
    deleteCustomExercise(ctx, c.id);
    expect(listCustomExercises(ctx)).toEqual([]);
    expect(getCustomExercise(ctx, c.id)).toBeNull();
  });

  it('nom vide ou muscle / matériel inconnu → erreur', () => {
    const ctx = createTestCtx();
    expect(() => createCustomExercise(ctx, { ...input, name: '  ' })).toThrow();
    expect(() => createCustomExercise(ctx, { ...input, primary: 'pecs' as never })).toThrow();
    expect(() => createCustomExercise(ctx, { ...input, equipment: 'rocks' as never })).toThrow();
  });
});

describe('programme : libraryId', () => {
  it('conservé par le schéma ; facultatif', () => {
    const r = parseProgram({ meta: { label: 'P' }, sessions: { s: { name: 'S', exercises: [{ id: 'dc', name: 'DC', sets: 3, libraryId: 'ds:0025' }] } }, schedule: { 1: 's' } });
    expect(r.ok && r.program.sessions.s.exercises[0].libraryId).toBe('ds:0025');
  });
});

describe('sauvegarde : exercices personnalisés, favoris, mon matériel', () => {
  it('Review Focus 1 : export → restauration dans la même base → mêmes ids, aucun conflit', () => {
    const ctx = createTestCtx();
    const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
    if (!r.ok) throw new Error('fixture');
    replaceAll(ctx, r.bundle);
    const c = createCustomExercise(ctx, input);
    setSetting(ctx, 'favoriteExercises', ['ds:0001', `custom:${c.id}`]);
    setSetting(ctx, 'myEquipment', ['dumbbell', 'bodyweight']);
    const json = JSON.parse(JSON.stringify(toNativeBackup(readBundle(ctx), 'x')));
    const back = parseNativeBackup(json);
    if (!back.ok) throw new Error('export illisible');
    replaceAll(ctx, back.bundle); // même base : les ids existent déjà (supprimés logiquement)
    expect(listCustomExercises(ctx)).toEqual([{ ...c }]);
    expect(getSetting(ctx, 'favoriteExercises')).toEqual(['ds:0001', `custom:${c.id}`]);
    expect(getSetting(ctx, 'myEquipment')).toEqual(['dumbbell', 'bodyweight']);

    const fresh = createTestCtx();
    replaceAll(fresh, back.bundle);
    expect(listCustomExercises(fresh).map((x) => x.id)).toEqual([c.id]);
  });

  it('ancienne sauvegarde sans customExercises : valide, liste vide', () => {
    const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
    if (!r.ok) throw new Error('fixture');
    const json = JSON.parse(JSON.stringify(toNativeBackup(r.bundle, 'x')));
    delete json.customExercises;
    const back = parseNativeBackup(json);
    expect(back.ok && back.bundle.customExercises).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/db/__tests__/customExercisesRepo.test.ts`
Expected: FAIL — module `../repos/customExercisesRepo` introuvable.

- [ ] **Step 3: Schéma, migration, réglages**

`program.ts` — dans `ExerciseSchema`, après `alternatives` :
```ts
  /** Lien vers la bibliothèque (ds:… | wg:… | custom:…) */
  libraryId: z.string().trim().min(1).optional(),
```

`schema.ts` — ajouter :
```ts
/** Exercices personnalisés de la bibliothèque (synchronisables) */
export const customExercises = sqliteTable('custom_exercises', {
  ...syncColumns(),
  name: text('name').notNull(),
  primary: text('primary_muscle').notNull(),
  secondary: text('secondary_muscles').notNull().default('[]'),
  equipment: text('equipment').notNull(),
  steps: text('steps'),
});
```

Run: `npm run db:generate`
Expected : nouveau fichier `drizzle/0001_*.sql` (`CREATE TABLE custom_exercises`) ; `drizzle/migrations.js` et `drizzle/meta/_journal.json` mis à jour. Vérifier que `migrations.js` importe le nouveau `.sql` (sinon l'ajouter sur le modèle de `m0000`).

`settingsRepo.ts` — imports `EquipmentKey` et ajout à `SettingsMap` :
```ts
  /** Bibliothèque : ids favoris */
  favoriteExercises: string[];
  /** Bibliothèque : matériel disponible (filtre « Mon matériel ») */
  myEquipment: EquipmentKey[];
```

- [ ] **Step 4: Repo**

`mobile/src/db/repos/customExercisesRepo.ts` :
```ts
// ============================================================
// Exercices personnalisés de la bibliothèque — suppression logique ; id exposé : custom:<id>
// ============================================================
import { and, asc, eq, isNull } from 'drizzle-orm';
import { isEquipmentKey, type EquipmentKey } from '@/domain/library/equipment';
import { isMuscleKey, type MuscleKey } from '@/domain/library/muscles';
import { customExercises } from '../schema';
import type { RepoCtx } from '../types';

export type CustomExercise = { id: string; name: string; primary: MuscleKey; secondary: MuscleKey[]; equipment: EquipmentKey; steps: string[] | null };
export type CustomExerciseInput = Omit<CustomExercise, 'id'>;
type Row = typeof customExercises.$inferSelect;

function parseList(text: string | null): unknown[] | null {
  if (text === null) return null;
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function toCustom(r: Row): CustomExercise | null {
  if (!isMuscleKey(r.primary) || !isEquipmentKey(r.equipment)) return null;
  const secondary = (parseList(r.secondary) ?? []).filter(isMuscleKey);
  const steps = parseList(r.steps)?.filter((s): s is string => typeof s === 'string') ?? null;
  return { id: r.id, name: r.name, primary: r.primary, secondary, equipment: r.equipment, steps };
}

function validate(input: CustomExerciseInput): CustomExerciseInput {
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error('nom d\'exercice invalide');
  if (!isMuscleKey(input.primary) || !input.secondary.every(isMuscleKey)) throw new Error('muscle inconnu');
  if (!isEquipmentKey(input.equipment)) throw new Error('matériel inconnu');
  const steps = input.steps?.map((s) => s.trim()).filter(Boolean) ?? null;
  return { ...input, name, secondary: [...new Set(input.secondary)].filter((m) => m !== input.primary), steps: steps && steps.length ? steps : null };
}

const values = (v: CustomExerciseInput) => ({
  name: v.name, primary: v.primary, secondary: JSON.stringify(v.secondary), equipment: v.equipment, steps: v.steps ? JSON.stringify(v.steps) : null,
});

export function listCustomExercises(ctx: RepoCtx): CustomExercise[] {
  return ctx.db.select().from(customExercises).where(isNull(customExercises.deletedAt)).orderBy(asc(customExercises.name)).all()
    .map(toCustom).filter((c): c is CustomExercise => c !== null);
}

export function getCustomExercise(ctx: RepoCtx, id: string): CustomExercise | null {
  const r = ctx.db.select().from(customExercises).where(and(eq(customExercises.id, id), isNull(customExercises.deletedAt))).get();
  return r ? toCustom(r) : null;
}

export function createCustomExercise(ctx: RepoCtx, input: CustomExerciseInput): CustomExercise {
  const v = validate(input);
  const now = ctx.now();
  const id = ctx.newId();
  ctx.db.insert(customExercises).values({ id, createdAt: now, updatedAt: now, ...values(v) }).run();
  return { id, ...v };
}

/** Insertion ou mise à jour à id donné (restauration : ids conservés, même si une ligne supprimée existe) */
export function upsertCustomExercise(ctx: RepoCtx, id: string, input: CustomExerciseInput): void {
  const v = validate(input);
  const now = ctx.now();
  const existing = ctx.db.select({ id: customExercises.id }).from(customExercises).where(eq(customExercises.id, id)).get();
  if (existing) ctx.db.update(customExercises).set({ ...values(v), updatedAt: now, deletedAt: null }).where(eq(customExercises.id, id)).run();
  else ctx.db.insert(customExercises).values({ id, createdAt: now, updatedAt: now, ...values(v) }).run();
}

export function updateCustomExercise(ctx: RepoCtx, id: string, input: CustomExerciseInput): void {
  const v = validate(input);
  ctx.db.update(customExercises).set({ ...values(v), updatedAt: ctx.now() }).where(eq(customExercises.id, id)).run();
}

export function deleteCustomExercise(ctx: RepoCtx, id: string): void {
  const now = ctx.now();
  ctx.db.update(customExercises).set({ deletedAt: now, updatedAt: now }).where(eq(customExercises.id, id)).run();
}
```

- [ ] **Step 5: Sauvegarde**

`importBundle.ts` :
```ts
import type { EquipmentKey } from './library/equipment';
import type { MuscleKey } from './library/muscles';
export type BundleCustomExercise = { id: string; name: string; primary: MuscleKey; secondary: MuscleKey[]; equipment: EquipmentKey; steps: string[] | null };
```
- `BundleSettings` : ajouter `favoriteExercises?: string[]; myEquipment?: EquipmentKey[];`
- `ImportBundle` : ajouter `customExercises: BundleCustomExercise[];`
- `parseLegacyBackup` (`legacyImport.ts`) : ajouter `customExercises: []` au corps du paquet.

`nativeBackup.ts` :
- `NativeBackup` : `customExercises?: BundleCustomExercise[];`
- `toNativeBackup` : `customExercises: bundle.customExercises,`
- `parseNativeBackup` : après les layouts :
```ts
  const customExercises: BundleCustomExercise[] = [];
  list(value.customExercises).forEach((c, i) => {
    if (!isObj(c) || !str(c.id) || !str(c.name) || !c.name.trim() || !isMuscleKey(c.primary) || !isEquipmentKey(c.equipment)) {
      ignored.push({ key: `customExercises[${i}]`, reason: 'invalid_value' });
      return;
    }
    const secondary = list(c.secondary).filter(isMuscleKey).filter((m) => m !== c.primary);
    const steps = Array.isArray(c.steps) ? c.steps.filter(str) : null;
    customExercises.push({ id: c.id, name: c.name.trim(), primary: c.primary, secondary, equipment: c.equipment, steps: steps && steps.length ? steps : null });
  });
```
  réglages : `if (Array.isArray(raw.favoriteExercises)) settings.favoriteExercises = raw.favoriteExercises.filter(str);` et `if (Array.isArray(raw.myEquipment)) settings.myEquipment = raw.myEquipment.filter(isEquipmentKey);` ; ajouter `customExercises` au `body`.

`exportRepo.ts` — `readBundle` : `customExercises: listCustomExercises(ctx),` ; `readSettings` : favoris et matériel (tableaux) s'ils sont présents.

`importRepo.ts` — `replaceAll` : après les organisations, supprimer logiquement les personnalisés absents du paquet puis `upsertCustomExercise(tx, c.id, c)` pour chacun ; réglages : `favoriteExercises`, `myEquipment` s'ils sont définis.
```ts
    tx.db.update(customExercises).set(retire).where(isNull(customExercises.deletedAt)).run();
    for (const c of bundle.customExercises) upsertCustomExercise(tx, c.id, c);
```
(le `retire` global suivi des `upsert` qui remettent `deletedAt = null` : les absents restent supprimés.)

Corriger les tests existants qui construisent un `ImportBundle` à la main (ajouter `customExercises: []`) : `npx tsc --noEmit` les liste.

- [ ] **Step 6: Relancer**

Run: `npx jest src/db src/domain && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 7: Commit**

```bash
git add src/domain src/db drizzle
git commit -m "feat(mobile): add custom exercises, library links and backup support

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Données d'affichage et illustration animée

**Files:**
- Create: `mobile/src/platform/assetText.ts`, `mobile/src/platform/assetText.web.ts`, `mobile/src/features/library/libraryData.ts`, `mobile/src/features/library/Illustration.tsx`, `mobile/src/features/library/__tests__/libraryData.test.tsx`
- Modify: `mobile/src/test/jestSetup.js`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `readAssetText(mod: number): Promise<string>`
  - `libraryItems(customs: CustomExercise[], lang: Lang): LibraryItem[]` (catalogue chargé une fois, en mémoire)
  - `findLibraryItem(id: string, customs: CustomExercise[], lang: Lang): LibraryItem | null`
  - `readLibraryUser(ctx): { customs: CustomExercise[]; favorites: string[]; myEquipment: EquipmentKey[] }` (requête `useDbQuery`)
  - `<Illustration slug={string | null} muscle={MuscleKey} size={number} animate?={boolean} />`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/library/__tests__/libraryData.test.tsx` :
```tsx
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { readAssetText } from '@/platform/assetText';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Illustration } from '../Illustration';
import { findLibraryItem, libraryItems } from '../libraryData';

const custom = { id: 'abc', name: 'Mon exo', primary: 'quads' as const, secondary: [], equipment: 'machine' as const, steps: null };

describe('libraryData', () => {
  it('catalogue + personnalisés ; ids custom: ; badge custom', () => {
    const items = libraryItems([custom], 'fr');
    expect(items.length).toBeGreaterThan(1324);
    expect(items.find((i) => i.id === 'custom:abc')).toMatchObject({ name: 'Mon exo', custom: true });
  });

  it('Review Focus 4 : langue → nom, autre langue en altName ; instructions de la langue', () => {
    const fr = findLibraryItem('ds:0001', [], 'fr')!;
    const en = findLibraryItem('ds:0001', [], 'en')!;
    expect(en.name).toBe(fr.altName);
    expect(fr.steps?.length).toBeGreaterThan(0);
    expect(fr.steps?.[0]).not.toBe(en.steps?.[0]);
  });

  it('id inconnu → null', () => {
    expect(findLibraryItem('custom:nope', [], 'fr')).toBeNull();
    expect(findLibraryItem('ds:9999', [], 'fr')).toBeNull();
  });
});

describe('Illustration', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('charge les 3 images, recolore, anime (≈ 0,8 s par image)', async () => {
    const slug = libraryItems([], 'fr').find((i) => i.illustration)!.illustration!;
    await renderWithProviders(<Illustration slug={slug} muscle="chest" size={120} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByTestId('illustration-frame-0')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(800); });
    expect(screen.getByTestId('illustration-frame-1')).toBeTruthy();
  });

  it('« Réduire les animations » : reste sur la première image', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const slug = libraryItems([], 'fr').find((i) => i.illustration)!.illustration!;
    await renderWithProviders(<Illustration slug={slug} muscle="chest" size={120} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { jest.advanceTimersByTime(2400); });
    expect(screen.getByTestId('illustration-frame-0')).toBeTruthy();
  });

  it('Review Focus 5 : lecture en erreur ou pas d\'illustration → pastille du muscle', async () => {
    jest.mocked(readAssetText).mockRejectedValueOnce(new Error('io'));
    const slug = libraryItems([], 'fr').find((i) => i.illustration)!.illustration!;
    await renderWithProviders(<Illustration slug={slug} muscle="chest" size={120} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByTestId('illustration-fallback')).toBeTruthy();
    await renderWithProviders(<Illustration slug={null} muscle="quads" size={40} />);
    expect(screen.getAllByTestId('illustration-fallback').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/library`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/platform/assetText.ts` :
```ts
// Texte d'un fichier embarqué (SVG d'illustration), lu à la demande
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

export async function readAssetText(mod: number): Promise<string> {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  return new File(asset.localUri ?? asset.uri).text();
}
```

`mobile/src/platform/assetText.web.ts` :
```ts
// Web : le fichier est servi par Metro / l'hébergeur
import { Asset } from 'expo-asset';

export async function readAssetText(mod: number): Promise<string> {
  return (await fetch(Asset.fromModule(mod).uri)).text();
}
```

`jestSetup.js` — ajouter :
```js
jest.mock('@/platform/assetText', () => ({
  readAssetText: jest.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#fff" d="M0 0h10v10H0z"/></svg>')),
}));
```

`mobile/src/features/library/libraryData.ts` :
```ts
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

export function libraryItems(customs: CustomExercise[], lang: Lang): LibraryItem[] {
  return [...load().list.map((e) => fromEntry(e, lang)), ...customs.map(fromCustom)];
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
```

`mobile/src/features/library/Illustration.tsx` :
```tsx
// Illustration animée d'un exercice : 3 images SVG en boucle (~0,8 s), recolorées au thème ;
// pastille du muscle si pas d'illustration ou lecture impossible ; immobile si « Réduire les animations »
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ILLUSTRATIONS } from '@/data/library/illustrations';
import { muscleLabel, type MuscleKey } from '@/domain/library/muscles';
import { useI18n } from '@/i18n/I18nProvider';
import { readAssetText } from '@/platform/assetText';
import { useTheme } from '@/theme/ThemeProvider';

const FRAME_MS = 800;
const cache = new Map<string, Promise<string[]>>();

/** Les 3 images d'un exercice (mises en cache pour la session) */
function loadFrames(slug: string): Promise<string[]> {
  const mods = ILLUSTRATIONS[slug];
  if (!mods) return Promise.reject(new Error('illustration inconnue'));
  let p = cache.get(slug);
  if (!p) {
    p = Promise.all(mods.map(readAssetText));
    p.catch(() => cache.delete(slug));
    cache.set(slug, p);
  }
  return p;
}

/** Les dessins workout-guide sont blancs : recolorés à la couleur de texte du thème */
const recolor = (xml: string, color: string) => xml.replace(/fill="(#fff|#ffffff|white)"/gi, `fill="${color}"`);

interface Props {
  slug: string | null;
  muscle: MuscleKey;
  size: number;
  /** false : première image seulement (vignettes de liste) */
  animate?: boolean;
}

export function Illustration({ slug, muscle, size, animate = true }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { lang } = useI18n();
  const [frames, setFrames] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    setFrames(null);
    setFailed(false);
    setIndex(0);
    if (!slug) return;
    loadFrames(slug).then((f) => { if (alive) setFrames(f); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const moving = animate && !reduceMotion && frames !== null && frames.length > 1;
  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % 3), FRAME_MS);
    return () => clearInterval(id);
  }, [moving]);

  if (!slug || failed) {
    return (
      <View testID="illustration-fallback" style={[styles.fallback, { width: size, height: size, borderRadius: radius.md, backgroundColor: colors.bgCardSoft }]}>
        <Text numberOfLines={2} style={{ color: colors.gold, fontFamily: fonts.uiBold, fontSize: Math.max(9, size / 7), textAlign: 'center' }}>
          {muscleLabel(muscle, lang)}
        </Text>
      </View>
    );
  }
  if (!frames) return <View style={{ width: size, height: size }} />;
  return (
    <View testID={`illustration-frame-${index}`} accessibilityRole="image" style={{ width: size, height: size }}>
      <SvgXml xml={recolor(frames[index], colors.text)} width={size} height={size} />
    </View>
  );
}

const styles = StyleSheet.create({ fallback: { alignItems: 'center', justifyContent: 'center', padding: 4 } });
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/library && npx tsc --noEmit`
Expected: PASS, tsc propre. Si `SvgXml` n'est pas rendu par le mock de react-native-svg en test, le `testID` est porté par la `View` englobante : les assertions restent valables.

- [ ] **Step 5: Commit**

```bash
git add src/platform src/test/jestSetup.js src/features/library
git commit -m "feat(mobile): load library data and animate exercise illustrations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Chaînes M10 (fr / en)

**Files:**
- Modify: `mobile/src/i18n/locales/fr.json`, `mobile/src/i18n/locales/en.json`

**Interfaces:**
- Produces: les clés ci-dessous (Tasks 8–12).

- [ ] **Step 1: Ajouter les clés** (avant `"coming_soon"`)

fr :
```json
  "nav_exercises": "Exercices",
  "lib_title": "EXERCICES",
  "lib_search_ph": "Rechercher un exercice",
  "lib_filter_muscle": "Muscle",
  "lib_filter_equipment": "Matériel",
  "lib_filter_favorites": "Favoris",
  "lib_filter_mine": "Mon matériel",
  "lib_filter_all": "Tous",
  "lib_empty": "Aucun exercice ne correspond",
  "lib_custom_badge": "Perso",
  "lib_count_fmt": "%s exercices",
  "lib_favorite_add": "Ajouter aux favoris",
  "lib_favorite_remove": "Retirer des favoris",
  "lib_new_custom": "Nouvel exercice",
  "lib_primary": "Muscle principal",
  "lib_secondary": "Muscles secondaires",
  "lib_equipment": "Matériel",
  "lib_steps": "Instructions",
  "lib_history": "Ton historique",
  "lib_history_record": "Record : %s",
  "lib_history_last": "Dernière fois : %s",
  "lib_history_stats": "Voir dans Stats",
  "lib_not_found": "Exercice introuvable",
  "lib_edit": "Modifier",
  "lib_delete": "Supprimer",
  "lib_delete_confirm": "Supprimer « %s » ? Les programmes qui l'utilisent gardent l'exercice, sans fiche.",
  "lib_custom_title_new": "NOUVEL EXERCICE",
  "lib_custom_title_edit": "MODIFIER L'EXERCICE",
  "lib_custom_name": "Nom",
  "lib_custom_steps_ph": "Étape",
  "lib_custom_add_step": "Ajouter une étape",
  "lib_save": "Enregistrer",
  "lib_cancel": "Annuler",
  "lib_pick_title": "CHOISIR UN EXERCICE",
  "lib_pick_free": "Exercice libre",
  "lib_choose_from_library": "Choisir dans la bibliothèque",
  "lib_linked_fmt": "Lié à : %s",
  "lib_change": "Changer",
  "lib_unlink": "Délier",
  "lib_open_sheet": "Voir la fiche",
  "profile_my_equipment": "Mon matériel",
  "profile_my_equipment_meta": "Filtre « Mon matériel » de la bibliothèque",
  "profile_credits": "Crédits",
  "credits_dataset": "Exercices : exercises-dataset (hasaneyldrm), licence MIT.",
  "credits_illustrations": "Illustrations : workout-guide par Bryl Lim, d'après Everkinetic — CC BY-SA 4.0. Illustrations adaptées (optimisées, recolorées).",
  "credits_license_link": "Licence CC BY-SA 4.0",
```

en :
```json
  "nav_exercises": "Exercises",
  "lib_title": "EXERCISES",
  "lib_search_ph": "Search exercises",
  "lib_filter_muscle": "Muscle",
  "lib_filter_equipment": "Equipment",
  "lib_filter_favorites": "Favorites",
  "lib_filter_mine": "My equipment",
  "lib_filter_all": "All",
  "lib_empty": "No matching exercise",
  "lib_custom_badge": "Custom",
  "lib_count_fmt": "%s exercises",
  "lib_favorite_add": "Add to favorites",
  "lib_favorite_remove": "Remove from favorites",
  "lib_new_custom": "New exercise",
  "lib_primary": "Primary muscle",
  "lib_secondary": "Secondary muscles",
  "lib_equipment": "Equipment",
  "lib_steps": "Instructions",
  "lib_history": "Your history",
  "lib_history_record": "Record: %s",
  "lib_history_last": "Last time: %s",
  "lib_history_stats": "See in Stats",
  "lib_not_found": "Exercise not found",
  "lib_edit": "Edit",
  "lib_delete": "Delete",
  "lib_delete_confirm": "Delete \"%s\"? Programs using it keep the exercise, without its sheet.",
  "lib_custom_title_new": "NEW EXERCISE",
  "lib_custom_title_edit": "EDIT EXERCISE",
  "lib_custom_name": "Name",
  "lib_custom_steps_ph": "Step",
  "lib_custom_add_step": "Add a step",
  "lib_save": "Save",
  "lib_cancel": "Cancel",
  "lib_pick_title": "PICK AN EXERCISE",
  "lib_pick_free": "Free exercise",
  "lib_choose_from_library": "Choose from the library",
  "lib_linked_fmt": "Linked to: %s",
  "lib_change": "Change",
  "lib_unlink": "Unlink",
  "lib_open_sheet": "Open sheet",
  "profile_my_equipment": "My equipment",
  "profile_my_equipment_meta": "\"My equipment\" filter of the library",
  "profile_credits": "Credits",
  "credits_dataset": "Exercises: exercises-dataset (hasaneyldrm), MIT license.",
  "credits_illustrations": "Illustrations: workout-guide by Bryl Lim, after Everkinetic — CC BY-SA 4.0. Adapted illustrations (optimized, recolored).",
  "credits_license_link": "CC BY-SA 4.0 license",
```

- [ ] **Step 2: Vérifier**

Run: `npx jest src/i18n && npx tsc --noEmit`
Expected: PASS (parité fr / en), tsc propre.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales
git commit -m "feat(mobile): add exercise library strings (fr/en)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Onglet « Exercices » — recherche, filtres, favoris

**Files:**
- Create: `mobile/src/features/library/LibraryList.tsx`, `mobile/src/features/library/LibraryScreen.tsx`, `mobile/src/features/library/favorites.ts`, `mobile/src/app/(tabs)/exercises.tsx`, `mobile/src/features/library/__tests__/LibraryScreen.test.tsx`
- Modify: `mobile/src/app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: Tasks 2, 6, 7 ; `Segmented` n'est pas utilisé ici (pastilles dédiées).
- Produces:
  - `toggleFavorite(ctx, id): void` (`favorites.ts`)
  - `LibraryList({ items, favorites, onOpen, onToggleFavorite?, header? })` — `FlatList` réutilisable (onglet et sélecteur)
  - `LibraryScreen({ onOpen(id), onNewCustom() })` ; route d'onglet `exercises`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/library/__tests__/LibraryScreen.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { LibraryScreen } from '../LibraryScreen';

async function setup(prepare?: (ctx: ReturnType<typeof createTestCtx>) => void) {
  const ctx = createTestCtx();
  prepare?.(ctx);
  const props = { onOpen: jest.fn(), onNewCustom: jest.fn() };
  await renderWithProviders(<LibraryScreen {...props} />, { ctx });
  return { ctx, props };
}

describe('LibraryScreen', () => {
  beforeEach(async () => { await act(async () => { usePrefs.setState(PREFS_INITIAL); }); });

  it('recherche → résultats ; vide → message', async () => {
    await setup();
    await fireEvent.changeText(screen.getByTestId('lib-search'), 'zzzz introuvable');
    expect(screen.getByText('Aucun exercice ne correspond')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('lib-search'), 'developpe couche');
    expect(screen.getAllByTestId(/^lib-row-/).length).toBeGreaterThan(0);
  });

  it('ouvrir une fiche ; favori basculé depuis la ligne', async () => {
    const { ctx, props } = await setup();
    await fireEvent.changeText(screen.getByTestId('lib-search'), 'developpe couche');
    const row = screen.getAllByTestId(/^lib-row-/)[0];
    const id = row.props.testID.replace('lib-row-', '');
    await fireEvent.press(row);
    expect(props.onOpen).toHaveBeenCalledWith(id);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Ajouter aux favoris' })[0]);
    expect(getSetting(ctx, 'favoriteExercises')).toEqual([id]);
    await fireEvent.press(screen.getByRole('button', { name: 'Favoris' }));
    expect(screen.getAllByTestId(/^lib-row-/)).toHaveLength(1);
  });

  it('mon matériel renseigné → filtre actif par défaut', async () => {
    await setup((ctx) => setSetting(ctx, 'myEquipment', ['bodyweight']));
    expect(screen.getByRole('button', { name: 'Mon matériel' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('filtre muscle via la feuille de choix', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Muscle' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Mollets' }));
    expect(screen.getByRole('button', { name: 'Mollets' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('nouvel exercice personnalisé', async () => {
    const { props } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Nouvel exercice' }));
    expect(props.onNewCustom).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/library/__tests__/LibraryScreen.test.tsx`
Expected: FAIL — module `../LibraryScreen` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/library/favorites.ts` :
```ts
// Favoris de la bibliothèque (réglage favoriteExercises)
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';

export function toggleFavorite(ctx: RepoCtx, id: string): void {
  const current = getSetting(ctx, 'favoriteExercises');
  const list = Array.isArray(current) ? current : [];
  setSetting(ctx, 'favoriteExercises', list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
}
```

`mobile/src/features/library/LibraryList.tsx` :
```tsx
// Liste virtualisée d'exercices : vignette, nom, « muscle · matériel », badge Perso, étoile favori
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { equipmentLabel } from '@/domain/library/equipment';
import { muscleLabel } from '@/domain/library/muscles';
import type { LibraryItem } from '@/domain/library/types';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { Illustration } from './Illustration';

interface Props {
  items: LibraryItem[];
  favorites: string[];
  onOpen(id: string): void;
  onToggleFavorite?(id: string): void;
  header?: ReactElement;
  bottomInset?: number;
}

export function LibraryList({ items, favorites, onOpen, onToggleFavorite, header, bottomInset = 0 }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t, lang } = useI18n();
  const fav = new Set(favorites);
  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={20}
      windowSize={10}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: spacing.md, gap: 8, paddingBottom: spacing.md + bottomInset }}
      ListEmptyComponent={<Text style={{ color: colors.textDim, fontFamily: fonts.ui, textAlign: 'center', marginTop: 24 }}>{t('lib_empty')}</Text>}
      renderItem={({ item }) => (
        <Pressable
          testID={`lib-row-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          onPress={() => onOpen(item.id)}
          style={[styles.row, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.md }]}
        >
          <Illustration slug={item.illustration} muscle={item.primary} size={48} animate={false} />
          <View style={styles.flex}>
            <Text numberOfLines={2} style={{ color: colors.text, fontFamily: fonts.uiBold }}>{item.name}</Text>
            <Text numberOfLines={1} style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>
              {`${muscleLabel(item.primary, lang)} · ${equipmentLabel(item.equipment, lang)}`}
            </Text>
          </View>
          {item.custom ? <Text style={[styles.badge, { color: colors.onGold, backgroundColor: colors.gold, borderRadius: radius.sm, fontFamily: fonts.uiBold }]}>{t('lib_custom_badge')}</Text> : null}
          {onToggleFavorite ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={fav.has(item.id) ? t('lib_favorite_remove') : t('lib_favorite_add')}
              onPress={() => onToggleFavorite(item.id)}
              hitSlop={6}
              style={styles.star}
            >
              <Ionicons name={fav.has(item.id) ? 'star' : 'star-outline'} size={20} color={fav.has(item.id) ? colors.gold : colors.textDim} />
            </Pressable>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderWidth: 1, minHeight: TOUCH_MIN + 20 },
  flex: { flex: 1, gap: 2 },
  badge: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  star: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
```

`mobile/src/features/library/LibraryScreen.tsx` :
```tsx
// ============================================================
// Onglet « Exercices » : recherche, pastilles de filtres, liste, nouvel exercice personnalisé
// ============================================================
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRepoCtx } from '@/db/DbContext';
import { EQUIPMENT_KEYS, equipmentLabel, type EquipmentKey } from '@/domain/library/equipment';
import { MUSCLE_KEYS, muscleLabel, type MuscleKey } from '@/domain/library/muscles';
import { searchLibrary } from '@/domain/library/search';
import { NO_FILTERS, type LibraryFilters } from '@/domain/library/types';
import { BottomSheet } from '@/features/common/BottomSheet';
import { TextField } from '@/features/common/TextField';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { toggleFavorite } from './favorites';
import { LibraryList } from './LibraryList';
import { libraryItems, readLibraryUser } from './libraryData';

/** Écriture puis rafraîchissement (fonction de module : compatible React Compiler) */
function write(fn: () => void, errorMessage: string): void {
  try {
    fn();
  } catch {
    useToastStore.getState().show(errorMessage);
  }
  usePrefs.getState().bumpData();
}

export function LibraryContent({ onOpen, onToggleFavorites = true, header }: { onOpen(id: string): void; onToggleFavorites?: boolean; header?: React.ReactElement }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius, spacing } = useTheme();
  const { t, lang } = useI18n();
  const user = useDbQuery(readLibraryUser);
  const [filters, setFilters] = useState<LibraryFilters>(() => ({ ...NO_FILTERS, myEquipmentOnly: user.myEquipment.length > 0 }));
  const [picking, setPicking] = useState<'muscle' | 'equipment' | null>(null);
  const items = searchLibrary(libraryItems(user.customs, lang), filters, user);

  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderRadius: radius.full, borderColor: selected ? colors.gold : colors.border, backgroundColor: selected ? colors.gold : 'transparent' }]}
    >
      <Text style={{ color: selected ? colors.onGold : colors.text, fontFamily: fonts.uiMedium }}>{label}</Text>
    </Pressable>
  );
  const option = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
      style={[styles.option, { backgroundColor: colors.bgCard, borderColor: selected ? colors.borderActive : colors.border, borderRadius: radius.md }]}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{label}</Text>
    </Pressable>
  );

  const top = (
    <View style={{ gap: spacing.sm }}>
      {header}
      <TextField
        testID="lib-search"
        value={filters.query}
        onChangeText={(query) => setFilters((f) => ({ ...f, query }))}
        placeholder={t('lib_search_ph')}
        autoCorrect={false}
        style={[styles.search, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bgCard }]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
        {chip(filters.muscle ? muscleLabel(filters.muscle, lang) : t('lib_filter_muscle'), filters.muscle !== null, () => setPicking('muscle'))}
        {chip(filters.equipment ? equipmentLabel(filters.equipment, lang) : t('lib_filter_equipment'), filters.equipment !== null, () => setPicking('equipment'))}
        {chip(t('lib_filter_favorites'), filters.favoritesOnly, () => setFilters((f) => ({ ...f, favoritesOnly: !f.favoritesOnly })))}
        {user.myEquipment.length > 0 ? chip(t('lib_filter_mine'), filters.myEquipmentOnly, () => setFilters((f) => ({ ...f, myEquipmentOnly: !f.myEquipmentOnly }))) : null}
      </ScrollView>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t('lib_count_fmt', items.length)}</Text>
    </View>
  );

  return (
    <>
      <LibraryList
        items={items}
        favorites={user.favorites}
        onOpen={onOpen}
        onToggleFavorite={onToggleFavorites ? (id) => write(() => toggleFavorite(ctx, id), t('error_not_saved')) : undefined}
        header={top}
      />
      <BottomSheet visible={picking !== null} title={picking === 'muscle' ? t('lib_filter_muscle') : t('lib_filter_equipment')} onClose={() => setPicking(null)}>
        {picking === 'muscle'
          ? [option(t('lib_filter_all'), filters.muscle === null, () => { setFilters((f) => ({ ...f, muscle: null })); setPicking(null); }),
             ...MUSCLE_KEYS.map((m: MuscleKey) => option(muscleLabel(m, lang), filters.muscle === m, () => { setFilters((f) => ({ ...f, muscle: m })); setPicking(null); }))]
          : [option(t('lib_filter_all'), filters.equipment === null, () => { setFilters((f) => ({ ...f, equipment: null })); setPicking(null); }),
             ...EQUIPMENT_KEYS.map((e: EquipmentKey) => option(equipmentLabel(e, lang), filters.equipment === e, () => { setFilters((f) => ({ ...f, equipment: e })); setPicking(null); }))]}
      </BottomSheet>
    </>
  );
}

export function LibraryScreen({ onOpen, onNewCustom }: { onOpen(id: string): void; onNewCustom(): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const header = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('lib_title')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('lib_new_custom')} onPress={onNewCustom}
        style={[styles.add, { borderColor: colors.gold, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{`+ ${t('lib_new_custom')}`}</Text>
      </Pressable>
    </View>
  );
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <LibraryContent onOpen={onOpen} header={header} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 44, letterSpacing: -0.5 },
  add: { minHeight: TOUCH_MIN, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1 },
  search: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
  chips: { gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1 },
  option: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
});
```

`mobile/src/app/(tabs)/exercises.tsx` :
```tsx
// Route Exercices — ErrorBoundary ; fiche et création d'exercice personnalisé dans la pile racine
import { router } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { LibraryScreen } from '@/features/library/LibraryScreen';

export default function ExercisesRoute() {
  return (
    <TabErrorBoundary>
      <LibraryScreen
        onOpen={(id) => router.push({ pathname: '/exercise/[id]', params: { id } })}
        onNewCustom={() => router.push('/exercise/custom')}
      />
    </TabErrorBoundary>
  );
}
```

`(tabs)/_layout.tsx` — entre `plan` et `stats` :
```tsx
      <Tabs.Screen name="exercises" options={{ title: t('nav_exercises'), tabBarIcon: icon('fitness') }} />
```

Les routes `/exercise/[id]` et `/exercise/custom` sont créées en Tasks 9 et 10 : jusque-là, `tsc` peut signaler les chemins inconnus (typed routes). Créer dès maintenant deux fichiers de route minimaux (`src/app/exercise/[id].tsx` et `src/app/exercise/custom.tsx`) renvoyant `null`, remplacés en Tasks 9 et 10, puis régénérer les types de routes (bref `npx expo start`, comme au M3b) ; ledger si nécessaire.

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/library && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/features/library "src/app/(tabs)" src/app/exercise
git commit -m "feat(mobile): add the Exercises tab with search, filters and favorites

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Fiche exercice (`/exercise/[id]`) et historique lié

**Files:**
- Create: `mobile/src/features/library/ExerciseDetail.tsx`, `mobile/src/features/library/__tests__/ExerciseDetail.test.tsx`
- Modify: `mobile/src/app/exercise/[id].tsx`, `mobile/src/app/_layout.tsx` (écran de pile), `mobile/src/db/repos/statsRepo.ts` (`exerciseKeysForLibrary`), `mobile/src/features/stats/StatsScreen.tsx` + `ExerciseSection.tsx` + `src/app/(tabs)/stats.tsx` (exercice demandé)

**Interfaces:**
- Consumes: Tasks 5–8 ; `readHistory`, `exerciseStats`, `lastSession` existants.
- Produces:
  - `exerciseKeysForLibrary(ctx, libraryId): string[]` — clés `weightKey(id, null)` des exercices de programmes (même supprimés) liés à ce `libraryId`
  - `ExerciseDetail({ id, onBack, onEdit(customId), onOpenStats(key) })`
  - `StatsScreen` / `ExerciseSection` : prop facultative `exerciseRequest?: { key: string; at: string }`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/library/__tests__/ExerciseDetail.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createCustomExercise, listCustomExercises } from '@/db/repos/customExercisesRepo';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { getSetting } from '@/db/repos/settingsRepo';
import { completeWorkout, ensureWorkout, upsertSet } from '@/db/repos/workoutsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { confirm } from '@/platform/confirm';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ExerciseDetail } from '../ExerciseDetail';

const props = () => ({ onBack: jest.fn(), onEdit: jest.fn(), onOpenStats: jest.fn() });

describe('ExerciseDetail', () => {
  beforeEach(async () => { jest.clearAllMocks(); await act(async () => { usePrefs.setState(PREFS_INITIAL); }); });

  it('fiche du catalogue : nom, muscles, matériel, étapes ; favori', async () => {
    const ctx = createTestCtx();
    const p = props();
    await renderWithProviders(<ExerciseDetail id="ds:0001" {...p} />, { ctx });
    expect(screen.getByText('Muscle principal'.toUpperCase())).toBeTruthy();
    expect(screen.getByText('Instructions'.toUpperCase())).toBeTruthy();
    expect(screen.getAllByTestId(/^step-/).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter aux favoris' }));
    expect(getSetting(ctx, 'favoriteExercises')).toEqual(['ds:0001']);
  });

  it('historique lié : record et dernière fois ; lien vers Stats', async () => {
    const ctx = createTestCtx();
    const prog = createProgram(ctx, { meta: { label: 'P' }, sessions: { s: { name: 'S', exercises: [{ id: 'dc', name: 'DC', sets: 2, libraryId: 'ds:0001' }] } }, schedule: { 1: 's' } }, 'manual');
    setActiveProgram(ctx, prog.id);
    const w = ensureWorkout(ctx, { programId: prog.id, sessionKey: 's', date: '2026-10-05' });
    upsertSet(ctx, w.id, 'dc', 0, { done: true, weight: 80, reps: 8 });
    completeWorkout(ctx, w.id);
    const p = props();
    await renderWithProviders(<ExerciseDetail id="ds:0001" {...p} />, { ctx });
    expect(screen.getByText('Ton historique'.toUpperCase())).toBeTruthy();
    expect(screen.getByText(/^Record : 80 kg/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Voir dans Stats' }));
    expect(p.onOpenStats).toHaveBeenCalledWith('dc');
  });

  it('personnalisé : Modifier, Supprimer (confirmé)', async () => {
    const ctx = createTestCtx();
    const c = createCustomExercise(ctx, { name: 'Mon exo', primary: 'quads', secondary: [], equipment: 'machine', steps: null });
    const p = props();
    await renderWithProviders(<ExerciseDetail id={`custom:${c.id}`} {...p} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'Modifier' }));
    expect(p.onEdit).toHaveBeenCalledWith(c.id);
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));
    expect(confirm).toHaveBeenCalled();
    expect(listCustomExercises(ctx)).toEqual([]);
    expect(p.onBack).toHaveBeenCalled();
  });

  it('Review Focus 3 : id inconnu (personnalisé supprimé) → « Exercice introuvable »', async () => {
    await renderWithProviders(<ExerciseDetail id="custom:nope" {...props()} />, { ctx: createTestCtx() });
    expect(screen.getByText('Exercice introuvable')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/library/__tests__/ExerciseDetail.test.tsx`
Expected: FAIL — module `../ExerciseDetail` introuvable.

- [ ] **Step 3: Implémenter**

`statsRepo.ts` — ajouter :
```ts
/** Exercices de programmes (même supprimés) liés à une entrée de bibliothèque → clés d'historique */
export function exerciseKeysForLibrary(ctx: RepoCtx, libraryId: string): string[] {
  const keys = new Set<string>();
  for (const p of ctx.db.select({ definition: programs.definition }).from(programs).all()) {
    const def = parseDefinition(p.definition);
    if (!def) continue;
    for (const s of Object.values(def.sessions)) {
      for (const ex of [...s.exercises, ...(s.bonus?.exercises ?? [])]) if (ex.libraryId === libraryId) keys.add(ex.id);
    }
  }
  return [...keys];
}
```

`mobile/src/features/library/ExerciseDetail.tsx` :
```tsx
// ============================================================
// Fiche exercice : illustration animée, muscles, matériel, étapes, historique lié, favori ;
// exercice personnalisé : Modifier / Supprimer.
// ============================================================
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { deleteCustomExercise } from '@/db/repos/customExercisesRepo';
import { exerciseKeysForLibrary, readHistory } from '@/db/repos/statsRepo';
import type { RepoCtx } from '@/db/types';
import { equipmentLabel } from '@/domain/library/equipment';
import { muscleLabel } from '@/domain/library/muscles';
import { displayUnits, exerciseStats } from '@/domain/stats/exerciseSeries';
import { Screen } from '@/features/common/Screen';
import { useDbQuery } from '@/features/common/useDbQuery';
import { formatDay, formatLoad } from '@/features/stats/format';
import { useI18n } from '@/i18n/I18nProvider';
import { confirm } from '@/platform/confirm';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { toggleFavorite } from './favorites';
import { Illustration } from './Illustration';
import { findLibraryItem, readLibraryUser } from './libraryData';

/** Historique lié : premier exercice de programme lié ayant des données */
function readLinkedHistory(ctx: RepoCtx, libraryId: string) {
  const keys = exerciseKeysForLibrary(ctx, libraryId);
  if (keys.length === 0) return null;
  const h = readHistory(ctx);
  for (const key of keys) {
    const stats = exerciseStats(h, key, null);
    const last = [...h.workouts].reverse().find((w) => w.sets.some((s) => s.exerciseId === key && s.performedName === null));
    if (stats.record || last) return { key, record: stats.record, lastDate: last?.date ?? null, units: displayUnits(h) };
  }
  return null;
}

function write(fn: () => void, errorMessage: string): boolean {
  try {
    fn();
    return true;
  } catch {
    useToastStore.getState().show(errorMessage);
    return false;
  } finally {
    usePrefs.getState().bumpData();
  }
}

interface Props {
  id: string;
  onBack(): void;
  onEdit(customId: string): void;
  onOpenStats(key: string): void;
}

export function ExerciseDetail({ id, onBack, onEdit, onOpenStats }: Props) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t, tList, lang } = useI18n();
  const user = useDbQuery(readLibraryUser);
  const history = useDbQuery(readLinkedHistory, id);
  const item = findLibraryItem(id, user.customs, lang);
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };
  const back = (
    <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
      <Ionicons name="chevron-back" size={20} color={colors.gold} />
    </Pressable>
  );

  if (!item) {
    return (
      <Screen safeBottom>
        {back}
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('lib_not_found')}</Text>
      </Screen>
    );
  }
  const favorite = user.favorites.includes(item.id);
  const remove = async () => {
    const ok = await confirm({ title: t('lib_delete'), message: t('lib_delete_confirm', item.name), confirmLabel: t('lib_delete'), cancelLabel: t('lib_cancel'), destructive: true });
    if (ok && write(() => deleteCustomExercise(ctx, item.id.slice('custom:'.length)), t('error_not_saved'))) onBack();
  };

  return (
    <Screen safeBottom>
      <View style={styles.top}>
        {back}
        <Pressable accessibilityRole="button" accessibilityLabel={favorite ? t('lib_favorite_remove') : t('lib_favorite_add')}
          onPress={() => write(() => toggleFavorite(ctx, item.id), t('error_not_saved'))} style={styles.back}>
          <Ionicons name={favorite ? 'star' : 'star-outline'} size={24} color={favorite ? colors.gold : colors.textDim} />
        </Pressable>
      </View>
      <View style={styles.center}>
        <Illustration slug={item.illustration} muscle={item.primary} size={220} />
      </View>
      <Text style={[styles.name, { color: colors.text, fontFamily: fonts.display }]}>{item.name}</Text>
      <Text style={label}>{t('lib_primary').toUpperCase()}</Text>
      <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{muscleLabel(item.primary, lang)}</Text>
      {item.secondary.length ? (
        <>
          <Text style={label}>{t('lib_secondary').toUpperCase()}</Text>
          <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{item.secondary.map((m) => muscleLabel(m, lang)).join(' · ')}</Text>
        </>
      ) : null}
      <Text style={label}>{t('lib_equipment').toUpperCase()}</Text>
      <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{equipmentLabel(item.equipment, lang)}</Text>
      {history ? (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.lg }]}>
          <Text style={label}>{t('lib_history').toUpperCase()}</Text>
          {history.record ? <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('lib_history_record', `${formatLoad(history.record.value, lang)} ${history.units} · ${formatDay(history.record.date, tList('days_short'), tList('months_short'))}`)}</Text> : null}
          {history.lastDate ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('lib_history_last', formatDay(history.lastDate, tList('days_short'), tList('months_short')))}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('lib_history_stats')} onPress={() => onOpenStats(history.key)} style={styles.link}>
            <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('lib_history_stats')}</Text>
          </Pressable>
        </View>
      ) : null}
      {item.steps ? (
        <>
          <Text style={label}>{t('lib_steps').toUpperCase()}</Text>
          {item.steps.map((s, i) => (
            <View key={i} testID={`step-${i}`} style={styles.step}>
              <Text style={{ color: colors.gold, fontFamily: fonts.uiBold, width: 22 }}>{`${i + 1}.`}</Text>
              <Text style={[styles.flex, { color: colors.text, fontFamily: fonts.ui }]}>{s}</Text>
            </View>
          ))}
        </>
      ) : null}
      {item.custom ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('lib_edit')} onPress={() => onEdit(item.id.slice('custom:'.length))}
            style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
            <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('lib_edit')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('lib_delete')} onPress={() => void remove()}
            style={[styles.btn, { borderColor: colors.redDanger, borderWidth: 1, borderRadius: radius.md }]}>
            <Text style={{ color: colors.redDanger, fontFamily: fonts.uiBold }}>{t('lib_delete')}</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  back: { width: TOUCH_MIN, height: TOUCH_MIN, justifyContent: 'center' },
  center: { alignItems: 'center' },
  name: { fontSize: 32, letterSpacing: -0.5 },
  card: { borderWidth: 1, padding: 14, gap: 4 },
  link: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 6 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, minHeight: TOUCH_MIN + 4, alignItems: 'center', justifyContent: 'center' },
});
```

`mobile/src/app/exercise/[id].tsx` :
```tsx
// Route Fiche exercice (pile racine) — Stats : onglet + exercice demandé
import { router, useLocalSearchParams } from 'expo-router';
import { ExerciseDetail } from '@/features/library/ExerciseDetail';

export default function ExerciseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ExerciseDetail
      id={id ?? ''}
      onBack={() => router.back()}
      onEdit={(customId) => router.push({ pathname: '/exercise/custom', params: { id: customId } })}
      onOpenStats={(key) => { router.dismissAll(); router.navigate({ pathname: '/stats', params: { exercise: key, at: String(Date.now()) } }); }}
    />
  );
}
```

`_layout.tsx` (racine) — ajouter dans la pile :
```tsx
        <Stack.Screen name="exercise/[id]" />
        <Stack.Screen name="exercise/custom" options={{ presentation: 'fullScreenModal' }} />
```

Stats — exercice demandé :
- `(tabs)/stats.tsx` : `const { exercise, at } = useLocalSearchParams<{ exercise?: string; at?: string }>();` et `<StatsScreen focused={focused} exerciseRequest={exercise ? { key: exercise, at: at ?? '' } : undefined} />`
- `StatsScreen` : prop `exerciseRequest?: { key: string; at: string }` transmise à `StatsContent` puis `<ExerciseSection … request={exerciseRequest} />`
- `ExerciseSection` : prop `request?: { key: string; at: string }` ; 
```tsx
  const requestKey = request?.key;
  const requestAt = request?.at;
  useEffect(() => { if (requestKey) setSelected(requestKey); }, [requestKey, requestAt]);
```
Ajouter au test StatsScreen (`src/features/stats/__tests__/StatsScreen.test.tsx`) :
```tsx
  it('exercice demandé (fiche → Stats) : sélectionné', async () => {
    await renderWithProviders(<StatsScreen exerciseRequest={{ key: 'tirage-vertical', at: '1' }} />, { ctx: restoredCtx() });
    expect(screen.getByRole('button', { name: 'Tirage vertical' }).props.accessibilityState).toMatchObject({ selected: true });
  });
```
(dans le `describe('StatsScreen')` existant, qui fige déjà la date).

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/library src/features/stats src/db && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/features/library src/features/stats src/db src/app
git commit -m "feat(mobile): add the exercise sheet with linked history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Exercice personnalisé — création / modification

**Files:**
- Create: `mobile/src/features/library/CustomExerciseEditor.tsx`, `mobile/src/features/library/__tests__/CustomExerciseEditor.test.tsx`
- Modify: `mobile/src/app/exercise/custom.tsx`

**Interfaces:**
- Consumes: Task 5 (repo), Task 1 (listes), `ListEditor`, `TextField`, `BottomSheet`.
- Produces: `CustomExerciseEditor({ customId?: string, onDone(id: string): void, onCancel(): void })` ; route `/exercise/custom?id=…`.

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/library/__tests__/CustomExerciseEditor.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createCustomExercise, getCustomExercise, listCustomExercises } from '@/db/repos/customExercisesRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { CustomExerciseEditor } from '../CustomExerciseEditor';

describe('CustomExerciseEditor', () => {
  beforeEach(async () => { await act(async () => { usePrefs.setState(PREFS_INITIAL); }); });

  it('création : nom + muscle + matériel requis ; secondaires ; étapes', async () => {
    const ctx = createTestCtx();
    const onDone = jest.fn();
    await renderWithProviders(<CustomExerciseEditor onDone={onDone} onCancel={jest.fn()} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(listCustomExercises(ctx)).toEqual([]);
    await fireEvent.changeText(screen.getByTestId('custom-name'), 'Presse 45°');
    await fireEvent.press(screen.getByRole('button', { name: 'Muscle principal' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Quadriceps' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Matériel' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Machine' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Fessiers' }));
    await fireEvent.press(screen.getByTestId('custom-steps-add'));
    await fireEvent.changeText(screen.getByTestId('custom-steps-0'), 'Pousser');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    const [c] = listCustomExercises(ctx);
    expect(c).toMatchObject({ name: 'Presse 45°', primary: 'quads', secondary: ['glutes'], equipment: 'machine', steps: ['Pousser'] });
    expect(onDone).toHaveBeenCalledWith(c.id);
  });

  it('modification : champs préremplis, enregistrés', async () => {
    const ctx = createTestCtx();
    const c = createCustomExercise(ctx, { name: 'A', primary: 'chest', secondary: [], equipment: 'dumbbell', steps: null });
    await renderWithProviders(<CustomExerciseEditor customId={c.id} onDone={jest.fn()} onCancel={jest.fn()} />, { ctx });
    expect(screen.getByTestId('custom-name').props.value).toBe('A');
    await fireEvent.changeText(screen.getByTestId('custom-name'), 'B');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(getCustomExercise(ctx, c.id)?.name).toBe('B');
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/library/__tests__/CustomExerciseEditor.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/library/CustomExerciseEditor.tsx` :
```tsx
// Création / modification d'un exercice personnalisé : nom, muscle principal, secondaires, matériel, étapes
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { createCustomExercise, getCustomExercise, updateCustomExercise } from '@/db/repos/customExercisesRepo';
import { EQUIPMENT_KEYS, equipmentLabel, type EquipmentKey } from '@/domain/library/equipment';
import { MUSCLE_KEYS, muscleLabel, type MuscleKey } from '@/domain/library/muscles';
import { BottomSheet } from '@/features/common/BottomSheet';
import { ListEditor } from '@/features/common/ListEditor';
import { Screen } from '@/features/common/Screen';
import { TextField } from '@/features/common/TextField';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props { customId?: string; onDone(id: string): void; onCancel(): void }

export function CustomExerciseEditor({ customId, onDone, onCancel }: Props) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t, lang } = useI18n();
  const initial = customId ? getCustomExercise(ctx, customId) : null;
  const [name, setName] = useState(initial?.name ?? '');
  const [primary, setPrimary] = useState<MuscleKey | null>(initial?.primary ?? null);
  const [secondary, setSecondary] = useState<MuscleKey[]>(initial?.secondary ?? []);
  const [equipment, setEquipment] = useState<EquipmentKey | null>(initial?.equipment ?? null);
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? []);
  const [picking, setPicking] = useState<'primary' | 'equipment' | null>(null);
  const valid = name.trim().length > 0 && primary !== null && equipment !== null;
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];

  const save = () => {
    if (!valid) return;
    const input = { name, primary: primary!, secondary, equipment: equipment!, steps };
    try {
      const id = customId ? (updateCustomExercise(ctx, customId, input), customId) : createCustomExercise(ctx, input).id;
      usePrefs.getState().bumpData();
      onDone(id);
    } catch {
      useToastStore.getState().show(t('error_not_saved'));
    }
  };
  const pickerButton = (text: string, value: string | null, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress}
      style={[styles.input, styles.picker, { borderColor: colors.border, borderRadius: radius.sm }]}>
      <Text style={{ color: value ? colors.text : colors.textDim, fontFamily: fonts.uiBold }}>{value ?? text}</Text>
    </Pressable>
  );
  const option = (text: string, onPress: () => void) => (
    <Pressable key={text} accessibilityRole="button" accessibilityLabel={text} onPress={onPress}
      style={[styles.option, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.md }]}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{text}</Text>
    </Pressable>
  );

  return (
    <Screen safeBottom>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.hbtn}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('lib_cancel')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid }} onPress={save} style={[styles.hbtn, { alignItems: 'flex-end' }]}>
          <Text style={{ color: valid ? colors.gold : colors.textDim, fontFamily: fonts.uiBold }}>{t('lib_save')}</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{customId ? t('lib_custom_title_edit') : t('lib_custom_title_new')}</Text>
      <Text style={label}>{t('lib_custom_name').toUpperCase()}</Text>
      <TextField testID="custom-name" value={name} maxLength={100} onChangeText={setName} style={field} />
      <Text style={label}>{t('lib_primary').toUpperCase()}</Text>
      {pickerButton(t('lib_primary'), primary ? muscleLabel(primary, lang) : null, () => setPicking('primary'))}
      <Text style={label}>{t('lib_equipment').toUpperCase()}</Text>
      {pickerButton(t('lib_equipment'), equipment ? equipmentLabel(equipment, lang) : null, () => setPicking('equipment'))}
      <Text style={label}>{t('lib_secondary').toUpperCase()}</Text>
      <View style={styles.wrap}>
        {MUSCLE_KEYS.filter((m) => m !== primary).map((m) => {
          const on = secondary.includes(m);
          return (
            <Pressable key={m} accessibilityRole="checkbox" accessibilityLabel={muscleLabel(m, lang)} accessibilityState={{ checked: on }}
              onPress={() => setSecondary((s) => (on ? s.filter((x) => x !== m) : [...s, m]))}
              style={[styles.tag, { borderRadius: radius.full, borderColor: on ? colors.gold : colors.border, backgroundColor: on ? colors.gold : 'transparent' }]}>
              <Text style={{ color: on ? colors.onGold : colors.text, fontFamily: fonts.uiMedium, fontSize: 13 }}>{muscleLabel(m, lang)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={label}>{t('lib_steps').toUpperCase()}</Text>
      <ListEditor items={steps} onChange={setSteps} placeholder={t('lib_custom_steps_ph')} addLabel={t('lib_custom_add_step')} maxItems={20} maxLength={300} testID="custom-steps" />
      <BottomSheet visible={picking !== null} title={picking === 'primary' ? t('lib_primary') : t('lib_equipment')} onClose={() => setPicking(null)}>
        {picking === 'primary'
          ? MUSCLE_KEYS.map((m) => option(muscleLabel(m, lang), () => { setPrimary(m); setSecondary((s) => s.filter((x) => x !== m)); setPicking(null); }))
          : EQUIPMENT_KEYS.map((e) => option(equipmentLabel(e, lang), () => { setEquipment(e); setPicking(null); }))}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  hbtn: { minHeight: TOUCH_MIN, minWidth: TOUCH_MIN, justifyContent: 'center' },
  title: { fontSize: 32, letterSpacing: -0.5 },
  input: { minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  picker: { justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1 },
  option: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
});
```

Le test « bouton Muscle principal » cible le bouton de choix (libellé = « Muscle principal » tant qu'aucun muscle n'est choisi) : `accessibilityLabel` reste le texte générique (`text`), la valeur choisie n'étant que le contenu affiché.

`mobile/src/app/exercise/custom.tsx` :
```tsx
// Route Exercice personnalisé (plein écran) — ?id=… pour modifier ; création : ouvre la fiche créée
import { router, useLocalSearchParams } from 'expo-router';
import { CustomExerciseEditor } from '@/features/library/CustomExerciseEditor';

export default function CustomExerciseRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <CustomExerciseEditor
      customId={id}
      onCancel={() => router.back()}
      onDone={(newId) => {
        router.back();
        if (!id) router.push({ pathname: '/exercise/[id]', params: { id: `custom:${newId}` } });
      }}
    />
  );
}
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/library && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/features/library src/app/exercise
git commit -m "feat(mobile): create and edit custom exercises

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Éditeur — choisir dans la bibliothèque ; vignettes sur les cartes

**Files:**
- Create: `mobile/src/state/libraryPickStore.ts`, `mobile/src/features/library/ExercisePicker.tsx`, `mobile/src/app/editor/library.tsx`, `mobile/src/features/library/LibraryThumb.tsx`, `mobile/src/features/library/__tests__/editorLibrary.test.tsx`
- Modify: `mobile/src/features/editor/SessionStep.tsx`, `mobile/src/features/editor/ExerciseSheet.tsx`, `mobile/src/features/editor/nav.ts`, `mobile/src/features/editor/useRouterNav.ts`, `mobile/src/features/editor/ExerciseRow.tsx`, `mobile/src/features/today/ExerciseCard.tsx`, `mobile/src/features/today/TodaySessionBody.tsx`, `mobile/src/features/today/TodayScreen.tsx`, `mobile/src/app/(tabs)/today.tsx`

**Interfaces:**
- Consumes: Tasks 6, 8.
- Produces:
  - `useLibraryPickStore` : `{ request: { sessionKey: string; section: ExerciseSection; form: ExerciseInput | null; exerciseId: string | null } | null; result: { libraryId: string; name: string } | null; start(req): void; resolve(r): void; consume(): { request, result } | null }`
  - `EditorNav.openLibrary(): void` (route `/editor/library`)
  - `ExercisePicker({ onPick(item: LibraryItem): void; onFree(): void; onCancel(): void })`
  - `LibraryThumb({ libraryId, onOpen })` (rien si id inconnu)
  - `ExerciseSheet` : props `onPickLibrary?(form: ExerciseInput)`, champ `libraryId` affiché « Lié à … », « Délier »
  - `TodayScreen` / `TodaySessionBody` / `ExerciseCard` : prop `onOpenExercise?(libraryId: string)`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/library/__tests__/editorLibrary.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { addSession, newDraft } from '@/domain/draft';
import { effectiveExercise } from '@/domain/exerciseView';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '@/domain/__fixtures__/builders';
import { ExerciseCard } from '@/features/today/ExerciseCard';
import { SessionStep } from '@/features/editor/SessionStep';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { LIBRARY_PICK_INITIAL, useLibraryPickStore } from '@/state/libraryPickStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ExercisePicker } from '../ExercisePicker';

const nav = () => ({ goToStep: jest.fn(), openSession: jest.fn(), closeSession: jest.fn(), finish: jest.fn(), openLibrary: jest.fn() });

describe('éditeur ↔ bibliothèque', () => {
  beforeEach(() => { useDraftStore.setState(DRAFT_INITIAL); useLibraryPickStore.setState(LIBRARY_PICK_INITIAL); });

  it('« Ajouter un exercice » ouvre le sélecteur ; le choix préremplit la feuille avec libraryId', async () => {
    const ctx = createTestCtx();
    const { draft, key } = addSession(newDraft(), 'lift', () => 'aaaa');
    await act(async () => { useDraftStore.getState().start(ctx, draft); });
    const n = nav();
    await renderWithProviders(<SessionStep nav={n} sessionKey={key} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UN EXERCICE' }));
    expect(n.openLibrary).toHaveBeenCalled();
    await act(async () => { useLibraryPickStore.getState().resolve({ libraryId: 'ds:0001', name: 'Relevé de buste 3/4' }); });
    expect(screen.getByTestId('exo-name').props.value).toBe('Relevé de buste 3/4');
    expect(screen.getByText('Lié à : Relevé de buste 3/4')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(useDraftStore.getState().draft!.program.sessions[key].exercises[0]).toMatchObject({ name: 'Relevé de buste 3/4', libraryId: 'ds:0001' });
  });

  it('« Exercice libre » : feuille vide, sans lien', async () => {
    const ctx = createTestCtx();
    const { draft, key } = addSession(newDraft(), 'lift', () => 'aaaa');
    await act(async () => { useDraftStore.getState().start(ctx, draft); });
    await renderWithProviders(<SessionStep nav={nav()} sessionKey={key} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UN EXERCICE' }));
    await act(async () => { useLibraryPickStore.getState().resolve(null); });
    expect(screen.getByTestId('exo-name').props.value).toBe('');
    expect(screen.queryByText(/^Lié à/)).toBeNull();
  });

  it('feuille d\'un exercice lié : Délier retire le lien', async () => {
    const ctx = createTestCtx();
    const base = addSession(newDraft(), 'lift', () => 'aaaa');
    await act(async () => { useDraftStore.getState().start(ctx, base.draft); });
    await act(async () => {
      const { addExercise } = require('@/domain/draft') as typeof import('@/domain/draft');
      useDraftStore.getState().apply(ctx, (d) => addExercise(d, base.key, 'main', { name: 'Crunch', sets: 3, scheme: '', alternatives: [], libraryId: 'ds:0001' } as never).draft);
    });
    await renderWithProviders(<SessionStep nav={nav()} sessionKey={base.key} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: /^Modifier l'exercice Crunch|^Modifier Crunch/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Délier' }));
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(useDraftStore.getState().draft!.program.sessions[base.key].exercises[0].libraryId).toBeUndefined();
  });

  it('sélecteur : recherche puis choix ; Exercice libre', async () => {
    const onPick = jest.fn();
    const onFree = jest.fn();
    await renderWithProviders(<ExercisePicker onPick={onPick} onFree={onFree} onCancel={jest.fn()} />, { ctx: createTestCtx() });
    await fireEvent.changeText(screen.getByTestId('lib-search'), 'developpe couche');
    await fireEvent.press(screen.getAllByTestId(/^lib-row-/)[0]);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: expect.stringMatching(/^(ds|wg):/) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Exercice libre' }));
    expect(onFree).toHaveBeenCalled();
  });

  it('Review Focus 3 : carte Today liée → vignette qui ouvre la fiche ; lien inconnu → pas de vignette', async () => {
    const program = parseOrThrow(makeProgramInput({ '1': 's' }, { s: makeSession('S', [makeExercise('a', 2, { name: 'A', libraryId: 'ds:0001' }), makeExercise('b', 2, { name: 'B', libraryId: 'custom:gone' })]) }));
    const onOpenExercise = jest.fn();
    const base = { units: 'kg' as const, accent: 'gold', done: [], weight: null, restSec: 90, last: null, locked: false, pendingSet: null,
      onPressSet: jest.fn(), onLongPressSet: jest.fn(), onChangeWeight: jest.fn(), onPressRest: jest.fn(), onOpenExercise };
    await renderWithProviders(<ExerciseCard {...base} exercise={effectiveExercise(program.sessions.s.exercises[0], null)} />, { ctx: createTestCtx() });
    await fireEvent.press(screen.getByRole('button', { name: 'Voir la fiche' }));
    expect(onOpenExercise).toHaveBeenCalledWith('ds:0001');
    await renderWithProviders(<ExerciseCard {...base} exercise={effectiveExercise(program.sessions.s.exercises[1], null)} />, { ctx: createTestCtx() });
    expect(screen.getAllByRole('button', { name: 'Voir la fiche' })).toHaveLength(1);
  });
});
```

Vérifier dans `ExerciseRow.tsx` le libellé exact du bouton d'édition (`${t('editor_edit_exo')} ${exercise.name}`) et ajuster la regex du troisième test.

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/library/__tests__/editorLibrary.test.tsx`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/state/libraryPickStore.ts` :
```ts
// Sélection d'un exercice de la bibliothèque depuis l'éditeur (route /editor/library ↔ écran de séance)
import { create } from 'zustand';
import type { ExerciseInput, ExerciseSection } from '@/domain/draft';

export type PickRequest = { sessionKey: string; section: ExerciseSection; form: ExerciseInput | null; exerciseId: string | null };
export type PickResult = { libraryId: string; name: string } | null;

interface State {
  request: PickRequest | null;
  /** undefined = pas encore de réponse ; null = « Exercice libre » */
  result: PickResult | undefined;
  start(req: PickRequest): void;
  resolve(r: PickResult): void;
  consume(): { request: PickRequest; result: PickResult } | null;
  cancel(): void;
}

export const LIBRARY_PICK_INITIAL = { request: null, result: undefined };

export const useLibraryPickStore = create<State>((set, get) => ({
  ...LIBRARY_PICK_INITIAL,
  start: (request) => set({ request, result: undefined }),
  resolve: (result) => set({ result }),
  consume: () => {
    const { request, result } = get();
    if (!request || result === undefined) return null;
    set(LIBRARY_PICK_INITIAL);
    return { request, result };
  },
  cancel: () => set(LIBRARY_PICK_INITIAL),
}));
```

`nav.ts` — `EditorNav` : ajouter `openLibrary(): void;` ; `useRouterNav.ts` : `openLibrary: () => router.push('/editor/library'),` ; mettre à jour les faux `nav` des tests existants de l'éditeur (ajouter `openLibrary: jest.fn()`) et `EditorFlow.test.tsx`.

`mobile/src/features/library/ExercisePicker.tsx` :
```tsx
// Sélecteur d'exercice (éditeur) : même recherche / filtres que l'onglet, « Exercice libre », Annuler
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LibraryItem } from '@/domain/library/types';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { LibraryContent } from './LibraryScreen';
import { findLibraryItem, readLibraryUser } from './libraryData';
import { useDbQuery } from '@/features/common/useDbQuery';

export function ExercisePicker({ onPick, onFree, onCancel }: { onPick(item: LibraryItem): void; onFree(): void; onCancel(): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const user = useDbQuery(readLibraryUser);
  const header = (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.hbtn}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('lib_cancel')}</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('lib_pick_title')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('lib_pick_free')} onPress={onFree}
        style={[styles.free, { borderColor: colors.gold, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('lib_pick_free')}</Text>
      </Pressable>
    </View>
  );
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <LibraryContent
        header={header}
        onToggleFavorites={false}
        onOpen={(id) => { const item = findLibraryItem(id, user.customs, lang); if (item) onPick(item); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row' },
  hbtn: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  title: { fontSize: 32, letterSpacing: -0.5 },
  free: { minHeight: TOUCH_MIN + 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
```

`mobile/src/app/editor/library.tsx` :
```tsx
// Route éditeur · choix dans la bibliothèque (pile de l'éditeur) — réponse via useLibraryPickStore
import { router } from 'expo-router';
import { ExercisePicker } from '@/features/library/ExercisePicker';
import { useLibraryPickStore } from '@/state/libraryPickStore';

export default function EditorLibraryRoute() {
  const done = (r: { libraryId: string; name: string } | null) => {
    useLibraryPickStore.getState().resolve(r);
    router.back();
  };
  return (
    <ExercisePicker
      onPick={(item) => done({ libraryId: item.id, name: item.name })}
      onFree={() => done(null)}
      onCancel={() => { useLibraryPickStore.getState().cancel(); router.back(); }}
    />
  );
}
```

`ExerciseSheet.tsx` :
- Props : `onPickLibrary?(form: ExerciseInput): void` ; `libraryName?: string | null` (nom de l'entrée liée, fourni par l'appelant).
- État : `form.libraryId` fait partie du formulaire (`ExerciseInput` accepte les clés supplémentaires).
- En tête de feuille, avant le nom :
```tsx
      {form.libraryId ? (
        <View style={styles.linkRow}>
          <Text style={[styles.flexText, { color: colors.textDim, fontFamily: fonts.uiMedium }]}>{t('lib_linked_fmt', libraryName ?? String(form.libraryId))}</Text>
          {onPickLibrary ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('lib_change')} onPress={() => onPickLibrary(form)} style={styles.linkBtn}>
              <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('lib_change')}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('lib_unlink')} onPress={() => set({ libraryId: undefined })} style={styles.linkBtn}>
            <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('lib_unlink')}</Text>
          </Pressable>
        </View>
      ) : onPickLibrary ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('lib_choose_from_library')} onPress={() => onPickLibrary(form)} style={[styles.pickBtn, { borderColor: colors.gold, borderRadius: radius.md }]}>
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('lib_choose_from_library')}</Text>
        </Pressable>
      ) : null}
```
  styles : `linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }`, `flexText: { flex: 1 }`, `linkBtn: { minHeight: TOUCH_MIN, justifyContent: 'center', paddingHorizontal: 6 }`, `pickBtn: { minHeight: TOUCH_MIN + 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }`.
- `submit` : si `form.libraryId` est `undefined`, le retirer de l'objet transmis (`const { libraryId, ...rest } = form; onSave(libraryId ? { ...rest, libraryId } : rest)` appliqué après la normalisation existante) — `updateExercise` fusionne `{ ...e, ...input }` : pour **délier**, l'entrée enregistrée ne doit plus contenir `libraryId`. Modifier `updateExercise` (`draft.ts`) pour remplacer l'exercice par `{ ...input, id }` plutôt que `{ ...e, ...input, id }` **uniquement pour la clé `libraryId`** : `const next = { ...e, ...input, id }; if (!('libraryId' in input) || input.libraryId === undefined) delete next.libraryId;`.

`SessionStep.tsx` :
- « Ajouter un exercice » (et bonus) : `useLibraryPickStore.getState().start({ sessionKey, section, form: null, exerciseId: null }); nav.openLibrary();` au lieu d'ouvrir directement la feuille.
- Au focus / à chaque rendu : consommer la réponse :
```tsx
  const pick = useLibraryPickStore((s) => (s.request?.sessionKey === sessionKey && s.result !== undefined ? s.result : undefined));
  useEffect(() => {
    if (pick === undefined) return;
    const done = useLibraryPickStore.getState().consume();
    if (!done) return;
    const { request, result } = done;
    const base = request.form ?? blankExercise();
    const initial = result ? { ...base, name: result.name, libraryId: result.libraryId } : { ...base, libraryId: undefined };
    const existing = request.exerciseId ? sectionExercises(session!, request.section).find((e) => e.id === request.exerciseId) ?? null : null;
    setSheet({ section: request.section, exercise: existing, initial });
  }, [pick]);
```
  (l'état `sheet` gagne un champ `initial?: ExerciseInput` utilisé comme `initial` de la feuille quand il est présent ; `key` de la feuille inclut un compteur pour remonter le formulaire).
- `ExerciseSheet` reçoit `onPickLibrary={(form) => { useLibraryPickStore.getState().start({ sessionKey, section: sheet.section, form, exerciseId: sheet.exercise?.id ?? null }); setSheet(null); nav.openLibrary(); }}` et `libraryName={…}` (via `findLibraryItem(form.libraryId, customs, lang)?.name`).

`LibraryThumb.tsx` :
```tsx
// Vignette d'un exercice lié (cartes Today / éditeur) : ouvre la fiche ; rien si le lien est inconnu
import { Pressable } from 'react-native';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import { Illustration } from './Illustration';
import { findLibraryItem, readLibraryUser } from './libraryData';

export function LibraryThumb({ libraryId, onOpen, size = 36 }: { libraryId: string | undefined; onOpen?(id: string): void; size?: number }) {
  const { t, lang } = useI18n();
  const user = useDbQuery(readLibraryUser);
  const item = libraryId ? findLibraryItem(libraryId, user.customs, lang) : null;
  if (!item) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('lib_open_sheet')} onPress={() => onOpen?.(item.id)} hitSlop={4}>
      <Illustration slug={item.illustration} muscle={item.primary} size={size} animate={false} />
    </Pressable>
  );
}
```

`ExerciseCard.tsx` — prop `onOpenExercise?(libraryId: string)` ; dans la ligne d'en-tête, avant le titre : `<LibraryThumb libraryId={ex.libraryId} onOpen={p.onOpenExercise} />` (la vignette reste hors de la poignée de glisser-déposer).
`ExerciseRow.tsx` (éditeur) — idem, sans `onOpen` (affichage seul).
`TodaySessionBody` / `TodayScreen` — propagent `onOpenExercise` ; `(tabs)/today.tsx` : `onOpenExercise={(id) => router.push({ pathname: '/exercise/[id]', params: { id } })}`.

`EffectiveExercise` hérite de `Exercise` : `libraryId` y est déjà présent (Task 5).

- [ ] **Step 4: Relancer**

Run: `npx jest src/features && npx tsc --noEmit`
Expected: PASS (dont les tests éditeur existants mis à jour pour `openLibrary` et le nouveau parcours « Ajouter un exercice » : remplacer, dans `SessionStep.test.tsx`, l'ouverture directe de la feuille par `useLibraryPickStore.getState().resolve(null)` après l'appui), tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/state src/features src/app
git commit -m "feat(mobile): pick exercises from the library in the editor; thumbnails on cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Profil — Mon matériel et Crédits

**Files:**
- Create: `mobile/src/features/profile/MyEquipmentSection.tsx`, `mobile/src/features/profile/CreditsSection.tsx`, `mobile/src/features/profile/__tests__/librarySections.test.tsx`
- Modify: `mobile/src/features/profile/ProfileScreen.tsx`

**Interfaces:**
- Consumes: Task 1, Task 5 (`myEquipment`), Task 7.
- Produces: `MyEquipmentSection()`, `CreditsSection()`.

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/profile/__tests__/librarySections.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { getSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { CreditsSection } from '../CreditsSection';
import { MyEquipmentSection } from '../MyEquipmentSection';

describe('Mon matériel', () => {
  beforeEach(async () => { await act(async () => { usePrefs.setState(PREFS_INITIAL); }); });

  it('« Poids du corps » coché par défaut ; cocher / décocher enregistre', async () => {
    const ctx = createTestCtx();
    await renderWithProviders(<MyEquipmentSection />, { ctx });
    expect(screen.getByRole('checkbox', { name: 'Poids du corps' }).props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Haltères' }));
    expect(getSetting(ctx, 'myEquipment')).toEqual(['bodyweight', 'dumbbell']);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Poids du corps' }));
    expect(getSetting(ctx, 'myEquipment')).toEqual(['dumbbell']);
  });
});

describe('Crédits', () => {
  it('sources, licences, lien CC BY-SA 4.0', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await renderWithProviders(<CreditsSection />);
    expect(screen.getByText(/exercises-dataset/)).toBeTruthy();
    expect(screen.getByText(/Bryl Lim/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Licence CC BY-SA 4.0' }));
    expect(open).toHaveBeenCalledWith('https://creativecommons.org/licenses/by-sa/4.0/');
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/profile/__tests__/librarySections.test.tsx`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/features/profile/MyEquipmentSection.tsx` :
```tsx
// Profil · Mon matériel — filtre par défaut de la bibliothèque (« Poids du corps » coché au départ)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { EQUIPMENT_KEYS, equipmentLabel, isEquipmentKey, type EquipmentKey } from '@/domain/library/equipment';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

const DEFAULT_EQUIPMENT: EquipmentKey[] = ['bodyweight'];

const readMine = (ctx: RepoCtx): EquipmentKey[] => {
  const v = getSetting(ctx, 'myEquipment');
  return Array.isArray(v) ? v.filter(isEquipmentKey) : DEFAULT_EQUIPMENT;
};

function save(ctx: RepoCtx, next: EquipmentKey[], errorMessage: string): void {
  try {
    setSetting(ctx, 'myEquipment', next);
  } catch {
    useToastStore.getState().show(errorMessage);
  }
  usePrefs.getState().bumpData();
}

export function MyEquipmentSection() {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t, lang } = useI18n();
  const mine = useDbQuery(readMine);
  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('profile_my_equipment').toUpperCase()}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('profile_my_equipment_meta')}</Text>
      <View style={styles.wrap}>
        {EQUIPMENT_KEYS.map((e) => {
          const on = mine.includes(e);
          return (
            <Pressable key={e} accessibilityRole="checkbox" accessibilityLabel={equipmentLabel(e, lang)} accessibilityState={{ checked: on }}
              onPress={() => save(ctx, on ? mine.filter((x) => x !== e) : [...mine, e], t('error_not_saved'))}
              style={[styles.tag, { borderRadius: radius.full, borderColor: on ? colors.gold : colors.border, backgroundColor: on ? colors.gold : 'transparent' }]}>
              <Text style={{ color: on ? colors.onGold : colors.text, fontFamily: fonts.uiMedium, fontSize: 13 }}>{equipmentLabel(e, lang)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1 },
});
```

`mobile/src/features/profile/CreditsSection.tsx` :
```tsx
// Profil · À propos · Crédits — attribution obligatoire (MIT, CC BY-SA 4.0)
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

const CC_BY_SA = 'https://creativecommons.org/licenses/by-sa/4.0/';

export function CreditsSection() {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const text = { color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 };
  return (
    <View style={styles.root}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('profile_credits')}</Text>
      <Text style={text}>{t('credits_dataset')}</Text>
      <Text style={text}>{t('credits_illustrations')}</Text>
      <Pressable accessibilityRole="link" accessibilityLabel={t('credits_license_link')} onPress={() => void Linking.openURL(CC_BY_SA)} style={styles.link}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold, fontSize: 12 }}>{t('credits_license_link')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({ root: { gap: 4 }, link: { minHeight: TOUCH_MIN, justifyContent: 'center' } });
```

`ProfileScreen.tsx` — `<MyEquipmentSection />` après `<TimerSection />` ; `<CreditsSection />` après la ligne de version.

La valeur par défaut `['bodyweight']` n'est **pas** écrite tant que l'utilisateur ne coche rien : le filtre « Mon matériel » de la bibliothèque (Task 8) reste inactif tant que `myEquipment` est absent (spec : « absent ou vide = filtre inactif »), et la section affiche « Poids du corps » coché comme point de départ.

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/profile && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile
git commit -m "feat(mobile): add My equipment and credits to Profile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Checklist M10 et vérification complète

**Files:**
- Modify: `mobile/docs/DEVICE_CHECKLIST.md`

- [ ] **Step 1: Checklist**

Ajouter :
```markdown

## M10 — Bibliothèque d'exercices (Expo Go)
- [ ] Onglet « Exercices » : ~1 400 exercices ; défilement fluide ; vignettes des exercices illustrés en tête.
- [ ] Recherche « developpe couche », « pull up », « squat » : résultats pertinents en FR et en EN.
- [ ] Filtres Muscle / Matériel / Favoris / Mon matériel combinables ; compteur à jour.
- [ ] Fiche : illustration animée (3 images), muscles, matériel, étapes en français ; « Réduire les animations » (Réglages iOS) → image fixe.
- [ ] Thème clair et sombre : illustrations lisibles (dessin recoloré).
- [ ] Favori depuis la liste et depuis la fiche.
- [ ] Nouvel exercice personnalisé → fiche ; Modifier ; Supprimer (confirmation).
- [ ] Éditeur › séance › « Ajouter un exercice » → sélecteur → choix → feuille préremplie « Lié à : … » ; « Exercice libre » ; « Délier ».
- [ ] Today : vignette sur la carte d'un exercice lié → fiche ; historique (record, dernière fois) → « Voir dans Stats » sélectionne l'exercice.
- [ ] Profil › Mon matériel ; Profil › À propos › Crédits (lien CC BY-SA 4.0).
- [ ] Export puis restauration : exercices personnalisés, favoris et mon matériel conservés.
- [ ] Web : onglet, recherche, fiche et illustrations.
```

- [ ] **Step 2: Vérification complète**

Run: `npx jest && npx tsc --noEmit && npx expo export --platform web --output-dir "$TEMP/m10-web" && npx expo export --platform ios --output-dir "$TEMP/m10-ios"`
Expected: suite verte, `tsc` propre, deux bundles exportés (les SVG figurent dans les assets exportés).

- [ ] **Step 3: Commit**

```bash
git add docs/DEVICE_CHECKLIST.md
git commit -m "docs(mobile): add the M10 device checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Couverture de la spec (auto-revue)

| Exigence (addendum M10) | Task |
|---|---|
| Catalogue fusionné, ids stables, correspondance relue, commits figés, pas de Gym visual, tailles | 3 |
| Noms français relisibles, jamais écrasés | 3, 4 |
| Muscles / matériel propres à l'app, valeur source inconnue → échec | 1, 3 |
| Illustrations optimisées, CC BY-SA, chargement à la demande, recoloration, animation, réduction des animations, repli | 3, 6 |
| Recherche fr / en sans accents, filtres combinés, tri | 2, 8 |
| Onglet « Exercices » (5e), favoris, nouvel exercice | 8 |
| Fiche : muscles, matériel, étapes (langue, repli anglais), historique lié, Stats, introuvable | 6, 9 |
| Exercices personnalisés (table, CRUD, validation) | 5, 10 |
| Mon matériel (défaut poids du corps), filtre par défaut | 8, 12 |
| `libraryId` ; éditeur : choisir / exercice libre / lié / changer / délier | 5, 11 |
| Vignettes sur les cartes, lien inconnu sans vignette | 11 |
| Sauvegarde : customExercises, favoris, mon matériel ; ids conservés | 5 |
| Crédits | 12 |
| Checklist Expo Go + web | 13 |
