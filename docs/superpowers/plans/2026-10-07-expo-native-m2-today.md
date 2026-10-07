# App native Expo — Jalon M2 (Today) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter l'écran Today de la PWA dans l'app Expo (parité complète) avec quatre améliorations natives : séance terminée visible, poids/reps par série, « La dernière fois », minuteur pilotable.

**Architecture:** SQLite est la seule source de vérité : chaque action écrit immédiatement via un repository (`src/db/repos/`), puis `bumpData()` ; l'écran relit tout par `useDbQuery(loadTodayView, …)`. La logique pure (schéma, exercice effectif, progression, minuteur) vit dans `src/domain/`. Les actions de l'écran (`features/today/actions.ts`) orchestrent repositories, store du minuteur (Zustand, persisté dans `settings.activeRest`) et adaptateurs `src/platform/` (haptique, son, écran allumé, confirmation). Un composant `TimerDriver` sans rendu fait avancer le minuteur ; la barre flottante `RestBar` porte son propre rafraîchissement pour ne pas re-rendre l'écran 4 fois/s.

**Tech Stack:** Expo SDK 57 · TypeScript strict · Expo Router · expo-sqlite + Drizzle · Zod 4 · Zustand · Reanimated 4 + Gesture Handler (glisser-déposer) · expo-haptics · expo-keep-awake · expo-audio · Jest (jest-expo) + React Native Testing Library 14 · better-sqlite3 (tests).

**Spec:** [docs/superpowers/specs/2026-10-07-expo-native-m2-today-design.md](../specs/2026-10-07-expo-native-m2-today-design.md) (addendum M2, prioritaire) et [docs/superpowers/specs/2026-10-05-expo-native-foundation-design.md](../specs/2026-10-05-expo-native-foundation-design.md) (spec du sous-projet 1).

## Global Constraints

- Tout le code vit dans `mobile/` ; ne modifier ni `index.html`, ni `api/`, ni les fichiers PWA.
- `src/domain/` n'importe jamais React, React Native, Expo, Drizzle ni SQLite.
- `src/db/` est le seul module qui touche SQLite ; il peut importer `src/domain/`, rien d'autre de `src/`.
- Les écrans ne testent jamais `Platform.OS` : les différences de plateforme passent par les extensions de fichier de `src/platform/` (`.web.ts`).
- Aucun nom de jour, de séance, d'exercice, de couleur de séance ou de durée de repos en dur dans la logique (`CLAUDE.md` §2). Couleur de séance via `accentColors()`.
- Dates de suivi = jour **local** `YYYY-MM-DD` (`localDateKey`) ; horodatages = ISO 8601 UTC.
- Suppression = logique (`deleted_at`), jamais `DELETE` (sauf `settings`). Les requêtes Drizzle utilisent `.all()`, `.get()`, `.run()`.
- Chaque écriture déclenchée par l'UI est suivie de `bumpData()` ; une écriture multi-lignes passe par `inTransaction`.
- `N` (compteur « SÉRIES FAITES X / N ») = somme des séries des exercices **principaux effectifs** ; les bonus sont exclus.
- Cibles tactiles ≥ 44 pt (`TOUCH_MIN`). Couleurs uniquement via le thème (`useTheme()`), jamais de littéral hors `'#0a0a0a'` déjà utilisé comme texte sur fond doré.
- Toutes les chaînes visibles passent par `t()` ; chaque nouvelle clé existe dans `fr.json` **et** `en.json` (test de parité existant).
- Commentaires de code en français, sections délimitées.
- Paquets Expo installés avec `npx expo install`.
- Commits conventionnels (`feat(mobile): …`, `test(mobile): …`, `chore(mobile): …`), terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Toutes les commandes s'exécutent depuis `mobile/`.
- Tests RNTL 14 : `render`, `fireEvent.*` et `act` sont **asynchrones** (`await`).

## Review Focus

1. **Programme modifié après un échange ou un réordonnancement** (alternative supprimée, exercice supprimé ou ajouté) : l'échange orphelin est ignoré (l'original s'affiche), les ids inconnus de l'ordre sont ignorés et les nouveaux exercices apparaissent en fin de liste (Task 3).
2. **Unité du programme changée (kg → lbs) avec des poids déjà mémorisés** : un poids stocké dans l'autre unité n'est ni affiché ni enregistré dans une série ; la carte retombe sur la suggestion `load` (Task 11).
3. **App tuée pendant un minuteur puis rouverte plus tard** : un repos expiré est purgé sans son ; un chrono d'effort expiré coche sa série en silence, sans démarrer de repos (Tasks 5 et 12).
4. **Tap sur une série d'un autre exercice pendant qu'un chrono d'effort est en attente** : un seul minuteur ; le chrono en attente est abandonné sans cocher sa série, et le nouveau tap s'applique normalement (Task 11).
5. **Saisie de poids libre** (`"102,5"`, `""`, `"0"`, `"-5"`, `"abc"`) : virgule acceptée ; vide, zéro, négatif ou illisible = poids effacé, jamais `NaN` en base (Task 2).

---

## File Structure

```
mobile/
├── package.json                         ← + expo-haptics, expo-keep-awake, expo-audio ; jest.setupFiles
├── assets/sounds/rest-done.wav          ← deux bips générés (Task 9)
├── scripts/generate-beep.mjs            ← générateur du .wav (Task 9)
├── docs/DEVICE_CHECKLIST.md             ← + section M2 (Task 19)
└── src/
    ├── app/
    │   ├── _layout.tsx                  ← + GestureHandlerRootView, hydratation du minuteur, Toast
    │   └── (tabs)/today.tsx             ← route mince : focus + ErrorBoundary → features/today/TodayScreen
    │   └── (tabs)/profile.tsx           ← + réglage « écran allumé »
    ├── domain/
    │   ├── scheme.ts                    ← schéma, chronométré, poids suggéré / saisi
    │   ├── exerciseView.ts              ← exercice effectif, clé de poids, séance effective
    │   ├── reorder.ts                   ← moveId
    │   ├── progress.ts                  ← + trackFromEntries, sessionSummary
    │   └── timer.ts                     ← minuteur unique (rest | work)
    ├── db/
    │   ├── transaction.ts               ← inTransaction
    │   └── repos/
    │       ├── settingsRepo.ts          ← activeRest: TimerState
    │       ├── workoutsRepo.ts
    │       ├── weightsRepo.ts
    │       ├── layoutsRepo.ts
    │       └── historyRepo.ts
    ├── platform/
    │   ├── types.ts                     ← interfaces Haptics, KeepAwake, Sound, Confirm
    │   ├── haptics.ts / haptics.web.ts
    │   ├── keepAwake.ts
    │   ├── sound.ts
    │   ├── confirm.ts / confirm.web.ts
    │   └── extensions.ts                ← points d'extension M6/M7/M8 (vides)
    ├── state/
    │   ├── timerStore.ts
    │   └── toastStore.ts
    ├── features/
    │   ├── common/useDbQuery.ts         ← + arguments
    │   ├── common/Screen.tsx            ← + scrollRef, scrollEnabled, overlay, bottomInset
    │   ├── common/Toast.tsx
    │   ├── common/TabErrorBoundary.tsx
    │   └── today/
    │       ├── todayView.ts             ← loadTodayView, cardWeight
    │       ├── actions.ts               ← actions de l'écran
    │       ├── timerDriver.ts           ← driveTimer (logique testable)
    │       ├── TimerDriver.tsx          ← intervalle + AppState
    │       ├── TodayScreen.tsx          ← assemblage
    │       ├── TodaySessionBody.tsx     ← séance lift/mixed
    │       ├── ExerciseCard.tsx, SetCircle.tsx, WeightStepper.tsx, LastTimeLine.tsx
    │       ├── SetEditSheet.tsx, SwapSheet.tsx, BottomSheet.tsx
    │       ├── ReorderableList.tsx
    │       ├── ProgressBar.tsx, SessionNote.tsx, WarmupBlock.tsx, CardioBlock.tsx
    │       ├── BonusBlock.tsx, RulesBlock.tsx, TipsList.tsx, RestDayScreen.tsx
    │       ├── RestBar.tsx, TodayFooter.tsx, CompletedSummary.tsx, ResumeBanner.tsx
    │       └── (existants) TodayHeader, WeekStrip, NoProgram, formatDate, useActiveProgram
    ├── i18n/locales/fr.json, en.json    ← + clés M2
    └── test/
        ├── jestSetup.js                 ← mocks Reanimated / Gesture Handler / platform
        └── renderWithProviders.tsx      ← + GestureHandlerRootView
```

---

### Task 1: Outillage M2 (dépendances, mocks Jest, `useDbQuery` avec arguments)

**Files:**
- Modify: `mobile/package.json`, `mobile/src/features/common/useDbQuery.ts`, `mobile/src/test/renderWithProviders.tsx`, `mobile/src/app/_layout.tsx`
- Create: `mobile/src/test/jestSetup.js`, `mobile/src/platform/types.ts`, `mobile/src/features/common/__tests__/useDbQuery.test.tsx`

**Interfaces:**
- Produces: `useDbQuery<A extends unknown[], T>(query: (ctx: RepoCtx, ...args: A) => T, ...args: A): T` ; mocks globaux `@/platform/haptics` (`haptics.light/success/warning` = `jest.fn()`), `@/platform/sound` (`sound.playRestDone`), `@/platform/keepAwake` (`keepAwake.activate/deactivate`), `@/platform/confirm` (`confirm` = `jest.fn().mockResolvedValue(true)`) ; interfaces de `@/platform/types`.

- [ ] **Step 1: Installer les dépendances**

```bash
npx expo install expo-haptics expo-keep-awake expo-audio
```
Vérifier dans `package.json` : `expo-haptics ~57.0.x`, `expo-keep-awake ~57.0.x`, `expo-audio ~57.0.x`.

- [ ] **Step 2: Interfaces de plateforme**

`mobile/src/platform/types.ts` :
```ts
// ============================================================
// Capacités natives — une interface par capacité (spec §5.2).
// Implémentation par plateforme via les extensions de fichier.
// ============================================================
export interface Haptics {
  light(): void;
  success(): void;
  warning(): void;
}

export interface KeepAwake {
  activate(): void;
  deactivate(): void;
}

export interface Sound {
  /** Deux bips de fin de minuteur */
  playRestDone(): void;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

export type Confirm = (opts: ConfirmOptions) => Promise<boolean>;
```

- [ ] **Step 3: Setup Jest**

`mobile/src/test/jestSetup.js` :
```js
// ============================================================
// Setup Jest — mocks des bibliothèques natives et des adaptateurs platform/.
// Les adaptateurs sont vérifiés à la main sur appareil (checklist).
// ============================================================
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-gesture-handler/jestSetup');

jest.mock('@/platform/haptics', () => ({ haptics: { light: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock('@/platform/sound', () => ({ sound: { playRestDone: jest.fn() } }));
jest.mock('@/platform/keepAwake', () => ({ keepAwake: { activate: jest.fn(), deactivate: jest.fn() } }));
jest.mock('@/platform/confirm', () => ({ confirm: jest.fn(() => Promise.resolve(true)) }));
```
Ces modules `@/platform/*` n'existent qu'à partir de la Task 9 : créer dès maintenant des fichiers provisoires pour que la résolution Jest fonctionne :
- `mobile/src/platform/haptics.ts` : `import type { Haptics } from './types'; export const haptics: Haptics = { light() {}, success() {}, warning() {} };`
- `mobile/src/platform/sound.ts` : `import type { Sound } from './types'; export const sound: Sound = { playRestDone() {} };`
- `mobile/src/platform/keepAwake.ts` : `import type { KeepAwake } from './types'; export const keepAwake: KeepAwake = { activate() {}, deactivate() {} };`
- `mobile/src/platform/confirm.ts` : `import type { Confirm } from './types'; export const confirm: Confirm = async () => true;`

Dans `mobile/package.json`, section `jest`, ajouter :
```json
"setupFiles": ["<rootDir>/src/test/jestSetup.js"],
```

- [ ] **Step 4: Écrire le test de `useDbQuery` avec arguments**

`mobile/src/features/common/__tests__/useDbQuery.test.tsx` :
```tsx
import { act, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import type { RepoCtx } from '@/db/types';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { useDbQuery } from '../useDbQuery';

function readLabel(ctx: RepoCtx, prefix: string, suffix: string): string {
  return `${prefix}${String(getSetting(ctx, 'activeProgramId') ?? '-')}${suffix}`;
}

function Probe({ prefix }: { prefix: string }) {
  const label = useDbQuery(readLabel, prefix, '!');
  return <Text>{label}</Text>;
}

describe('useDbQuery', () => {
  beforeEach(async () => {
    await act(async () => { usePrefs.setState(PREFS_INITIAL); });
  });

  it('passe les arguments à la requête et relit après bumpData', async () => {
    const ctx = createTestCtx();
    await renderWithProviders(<Probe prefix="id:" />, { ctx });
    expect(screen.getByText('id:-!')).toBeTruthy();

    setSetting(ctx, 'activeProgramId', 'abc');
    await act(async () => { usePrefs.getState().bumpData(); });
    expect(screen.getByText('id:abc!')).toBeTruthy();
  });
});
```

- [ ] **Step 5: Lancer le test, vérifier l'échec**

Run: `npx jest src/features/common/__tests__/useDbQuery.test.tsx`
Expected: FAIL (erreur TypeScript/runtime : `useDbQuery` n'accepte qu'un argument, `prefix` vaut `undefined` → texte `undefined-…`).

- [ ] **Step 6: Implémenter**

`mobile/src/features/common/useDbQuery.ts` (remplacer le contenu) :
```ts
// ============================================================
// Lecture synchrone de la base, relue à chaque changement de données.
// La version des données (dataVersion) est passée en ARGUMENT de la lecture :
// le React Compiler la voit donc comme une vraie dépendance (pas de useMemo +
// eslint-disable, que le compilateur contournerait en supprimant la dépendance).
// ============================================================
import { useRepoCtx } from '@/db/DbContext';
import type { RepoCtx } from '@/db/types';
import { usePrefs } from '@/state/prefsStore';

/** Exécute la requête pour une version de données donnée (la version ne sert que de clé de rafraîchissement). */
function readAtVersion<A extends unknown[], T>(
  query: (ctx: RepoCtx, ...args: A) => T,
  ctx: RepoCtx,
  _version: number,
  args: A,
): T {
  return query(ctx, ...args);
}

/** `query` doit être stable (fonction de module) ; ses arguments suivent `ctx`. */
export function useDbQuery<A extends unknown[], T>(query: (ctx: RepoCtx, ...args: A) => T, ...args: A): T {
  const ctx = useRepoCtx();
  const dataVersion = usePrefs((s) => s.dataVersion);
  return readAtVersion(query, ctx, dataVersion, args);
}
```

`mobile/src/test/renderWithProviders.tsx` : envelopper l'arbre dans `GestureHandlerRootView` :
```tsx
// Rendu de test avec thème, i18n et (optionnellement) une base en mémoire
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DbTestProvider } from '@/db/DbContext';
import type { RepoCtx } from '@/db/types';
import type { Lang, ThemePref } from '@/domain/prefs';
import { I18nProvider } from '@/i18n/I18nProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

export function renderWithProviders(ui: ReactElement, opts: { lang?: Lang; theme?: ThemePref; ctx?: RepoCtx } = {}) {
  const tree = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider pref={opts.theme ?? 'dark'}>
        <I18nProvider lang={opts.lang ?? 'fr'}>{ui}</I18nProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
  return render(opts.ctx ? <DbTestProvider value={opts.ctx}>{tree}</DbTestProvider> : tree);
}
```

`mobile/src/app/_layout.tsx` : dans `RootLayout`, envelopper le retour final :
```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// …
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DbProvider>
        <PrefsGate />
      </DbProvider>
    </GestureHandlerRootView>
  );
```

- [ ] **Step 7: Lancer toute la suite + typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (82 tests), aucune erreur TypeScript. `useActiveProgram` (`useDbQuery(getActiveProgram)`) compile toujours (`A = []`).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/test src/platform src/features/common src/app/_layout.tsx
git commit -m "chore(mobile): M2 tooling — haptics/keep-awake/audio deps, Jest mocks, useDbQuery args

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `domain/scheme.ts` — schéma, chronométré, poids

**Files:**
- Create: `mobile/src/domain/scheme.ts`, `mobile/src/domain/__tests__/scheme.test.ts`

**Interfaces:**
- Consumes: `Exercise`, `Units` de `@/domain/program`.
- Produces:
  - `type SchemeFields = Pick<Exercise, 'scheme' | 'sets' | 'timed'>`
  - `repsPart(scheme: string): string`
  - `parseTimedSeconds(scheme: string): number`
  - `isTimed(ex: SchemeFields): boolean`
  - `workSeconds(ex: SchemeFields): number`
  - `schemeReps(ex: SchemeFields): number | null`
  - `formatScheme(ex: SchemeFields): string`
  - `suggestedWeight(load: string | null | undefined): number | null`
  - `parseWeightInput(text: string): number | null`
  - `weightStep(units: Units): number`
  - `formatWeight(w: number): string`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/__tests__/scheme.test.ts` :
```ts
import {
  formatScheme, formatWeight, isTimed, parseTimedSeconds, parseWeightInput,
  repsPart, schemeReps, suggestedWeight, weightStep, workSeconds,
} from '../scheme';

const ex = (scheme: string, sets = 3, timed?: boolean) => ({ scheme, sets, timed });

describe('repsPart', () => {
  it('prend la partie après « × » ou tout le schéma', () => {
    expect(repsPart('4×8')).toBe('8');
    expect(repsPart(' 3 × 45 sec ')).toBe('45 sec');
    expect(repsPart('8-12')).toBe('8-12');
    expect(repsPart('')).toBe('');
  });
});

describe('chronométré (règle PWA)', () => {
  it('parseTimedSeconds lit le dernier « N sec »', () => {
    expect(parseTimedSeconds('3×45 sec')).toBe(45);
    expect(parseTimedSeconds('30 sec puis 45 sec')).toBe(45);
    expect(parseTimedSeconds('4×8')).toBe(0);
  });

  it('isTimed : timed explicite prioritaire, sinon « N sec »', () => {
    expect(isTimed(ex('45', 3, true))).toBe(true);
    expect(isTimed(ex('3×45 sec', 3, false))).toBe(false);
    expect(isTimed(ex('3×45 sec'))).toBe(true);
    expect(isTimed(ex('4×8'))).toBe(false);
  });

  it('workSeconds : secondes du schéma, ou nombre nu si timed', () => {
    expect(workSeconds(ex('3×45 sec'))).toBe(45);
    expect(workSeconds(ex('60', 3, true))).toBe(60);
    expect(workSeconds(ex('3×40', 3, true))).toBe(40);
    expect(workSeconds(ex('4×8'))).toBe(0);
    expect(workSeconds(ex('999', 3, true))).toBe(0);
  });
});

describe('schemeReps', () => {
  it('nombre de reps, borne basse d\'une fourchette, null sinon', () => {
    expect(schemeReps(ex('4×8'))).toBe(8);
    expect(schemeReps(ex('8-12'))).toBe(8);
    expect(schemeReps(ex('MAX'))).toBeNull();
    expect(schemeReps(ex('3×45 sec'))).toBeNull();
  });
});

describe('formatScheme', () => {
  it('« séries × reps », suffixe sec pour un chronométré', () => {
    expect(formatScheme(ex('4×8', 4))).toBe('4 × 8');
    expect(formatScheme(ex('45', 3, true))).toBe('3 × 45 sec');
    expect(formatScheme(ex('3×45 sec'))).toBe('3 × 45 sec');
    expect(formatScheme(ex('', 2))).toBe('2 × ?');
  });
});

describe('poids', () => {
  it('suggestedWeight prend le premier nombre de load', () => {
    expect(suggestedWeight('100 à 120 kg')).toBe(100);
    expect(suggestedWeight('6,5 kg')).toBe(6.5);
    expect(suggestedWeight('poids du corps')).toBeNull();
    expect(suggestedWeight(null)).toBeNull();
    expect(suggestedWeight('0 kg')).toBeNull();
  });

  it('parseWeightInput accepte la virgule et rejette vide / zéro / négatif / illisible', () => {
    expect(parseWeightInput('102,5')).toBe(102.5);
    expect(parseWeightInput(' 80 ')).toBe(80);
    expect(parseWeightInput('')).toBeNull();
    expect(parseWeightInput('0')).toBeNull();
    expect(parseWeightInput('-5')).toBeNull();
    expect(parseWeightInput('abc')).toBeNull();
  });

  it('weightStep selon l\'unité', () => {
    expect(weightStep('kg')).toBe(2.5);
    expect(weightStep('lbs')).toBe(5);
  });

  it('formatWeight sans décimales inutiles', () => {
    expect(formatWeight(100)).toBe('100');
    expect(formatWeight(102.5)).toBe('102.5');
    expect(formatWeight(0.1 + 0.2)).toBe('0.3');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/scheme.test.ts`
Expected: FAIL — `Cannot find module '../scheme'`.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/scheme.ts` :
```ts
// ============================================================
// Schéma d'exercice (« 4×8 », « 3×45 sec »), exercices chronométrés,
// poids suggéré et saisi. Règles reprises de la PWA (index.html).
// ============================================================
import type { Exercise, Units } from './program';

export type SchemeFields = Pick<Exercise, 'scheme' | 'sets' | 'timed'>;

const MAX_WORK_SEC = 600;

/** Partie « reps » : après « × » s'il y en a un, sinon tout le schéma */
export function repsPart(scheme: string): string {
  const raw = scheme.trim();
  return raw.includes('×') ? (raw.split('×')[1] ?? '').trim() : raw;
}

/** Dernière occurrence de « N sec » ; 0 si absente */
export function parseTimedSeconds(scheme: string): number {
  const matches = [...scheme.matchAll(/(\d+)\s*sec/gi)];
  const last = matches[matches.length - 1];
  return last ? parseInt(last[1], 10) : 0;
}

/** timed explicite prioritaire ; sinon ancien format « N sec » */
export function isTimed(ex: SchemeFields): boolean {
  if (ex.timed === true) return true;
  if (ex.timed === false) return false;
  return parseTimedSeconds(ex.scheme) > 0;
}

/** Durée d'effort d'une série chronométrée ; 0 si non chronométrée ou illisible */
export function workSeconds(ex: SchemeFields): number {
  if (!isTimed(ex)) return 0;
  const fromSec = parseTimedSeconds(ex.scheme);
  if (fromSec > 0) return fromSec;
  const n = parseInt(repsPart(ex.scheme), 10);
  return n > 0 && n <= MAX_WORK_SEC ? n : 0;
}

/** Reps d'une série : premier nombre de la partie reps ; null si chronométré ou illisible */
export function schemeReps(ex: SchemeFields): number | null {
  if (isTimed(ex)) return null;
  const m = repsPart(ex.scheme).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Affichage « 4 × 8 » / « 3 × 45 sec » */
export function formatScheme(ex: SchemeFields): string {
  const reps = repsPart(ex.scheme);
  const suffix = isTimed(ex) && reps && !/sec/i.test(reps) ? ' sec' : '';
  return `${ex.sets} × ${reps || '?'}${suffix}`;
}

/** Premier nombre de la charge suggérée (« 100 à 120 kg » → 100) */
export function suggestedWeight(load: string | null | undefined): number | null {
  if (!load) return null;
  const m = load.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const w = parseFloat(m[1].replace(',', '.'));
  return w > 0 ? w : null;
}

/** Saisie libre → poids ; vide, zéro, négatif ou illisible → null */
export function parseWeightInput(text: string): number | null {
  const w = Number(text.trim().replace(',', '.'));
  return Number.isFinite(w) && w > 0 ? w : null;
}

export function weightStep(units: Units): number {
  return units === 'lbs' ? 5 : 2.5;
}

export function formatWeight(w: number): string {
  return String(Math.round(w * 100) / 100);
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/domain/__tests__/scheme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/scheme.ts src/domain/__tests__/scheme.test.ts
git commit -m "feat(mobile): add exercise scheme, timed sets and weight parsing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Exercice effectif, séance effective, `moveId`

**Files:**
- Create: `mobile/src/domain/exerciseView.ts`, `mobile/src/domain/reorder.ts`, `mobile/src/domain/__tests__/exerciseView.test.ts`, `mobile/src/domain/__tests__/reorder.test.ts`

**Interfaces:**
- Consumes: `Alternative`, `Exercise`, `Session`, `alternativeName` (`@/domain/program`) ; `orderExercises` (`@/domain/progress`).
- Produces:
  - `type SessionLayout = { order: string[]; swaps: Record<string, string> }` et `EMPTY_LAYOUT`
  - `type EffectiveExercise = Exercise & { performedName: string | null; originalName: string }`
  - `findAlternative(ex: Exercise, name: string): Alternative | undefined`
  - `effectiveExercise(ex: Exercise, swapName?: string | null): EffectiveExercise`
  - `weightKey(exerciseId: string, performedName: string | null): string`
  - `type EffectiveSession = { exercises: EffectiveExercise[]; bonus: EffectiveExercise[] }`
  - `effectiveSession(session: Session, layout: SessionLayout): EffectiveSession`
  - `moveId(order: readonly string[], from: number, to: number): string[]`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/__tests__/exerciseView.test.ts` :
```ts
import { EMPTY_LAYOUT, effectiveExercise, effectiveSession, findAlternative, weightKey } from '../exerciseView';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '../__fixtures__/builders';

const program = parseOrThrow(makeProgramInput({ '1': 'a' }, {
  a: makeSession('A', [
    makeExercise('presse', 4, {
      name: 'Presse', scheme: '4×8', load: '100 kg', restSec: 120, cue: 'Dos plaqué',
      alternatives: ['Squat guidé', { name: 'Fentes', sets: 3, scheme: '3×12', load: '10 kg', restSec: 0 }],
    }),
    makeExercise('curl', 3),
    makeExercise('dips', 3),
  ], { bonus: { title: 'BONUS', exercises: [makeExercise('abdos', 2, { alternatives: ['Planche'] })] } }),
}));
const session = program.sessions.a;
const presse = session.exercises[0];

describe('effectiveExercise', () => {
  it('sans échange : exercice inchangé', () => {
    const e = effectiveExercise(presse, null);
    expect(e).toMatchObject({ id: 'presse', name: 'Presse', sets: 4, performedName: null, originalName: 'Presse', cue: 'Dos plaqué' });
  });

  it('alternative chaîne : seul le nom change, la consigne est retirée', () => {
    const e = effectiveExercise(presse, 'Squat guidé');
    expect(e).toMatchObject({ id: 'presse', name: 'Squat guidé', sets: 4, scheme: '4×8', load: '100 kg', restSec: 120, performedName: 'Squat guidé', originalName: 'Presse', cue: null });
  });

  it('alternative objet : surcharge sets/scheme/load/restSec (0 conservé)', () => {
    const e = effectiveExercise(presse, 'Fentes');
    expect(e).toMatchObject({ name: 'Fentes', sets: 3, scheme: '3×12', load: '10 kg', restSec: 0, performedName: 'Fentes' });
    expect(e.alternatives).toEqual(presse.alternatives);
  });

  it('alternative inconnue (supprimée du programme) : ignorée', () => {
    expect(effectiveExercise(presse, 'Disparue')).toMatchObject({ name: 'Presse', performedName: null });
  });

  it('findAlternative par nom', () => {
    expect(findAlternative(presse, 'Fentes')).toMatchObject({ name: 'Fentes' });
    expect(findAlternative(presse, 'Nope')).toBeUndefined();
  });
});

describe('weightKey', () => {
  it('id seul pour l\'original, id::nom pour une alternative', () => {
    expect(weightKey('presse', null)).toBe('presse');
    expect(weightKey('presse', 'Fentes')).toBe('presse::Fentes');
  });
});

describe('effectiveSession', () => {
  it('sans layout : ordre du programme, bonus séparés', () => {
    const s = effectiveSession(session, EMPTY_LAYOUT);
    expect(s.exercises.map((e) => e.id)).toEqual(['presse', 'curl', 'dips']);
    expect(s.bonus.map((e) => e.id)).toEqual(['abdos']);
  });

  it('applique ordre et échanges ; ids inconnus ignorés, nouveaux exercices en fin', () => {
    const s = effectiveSession(session, { order: ['dips', 'fantome', 'presse'], swaps: { presse: 'Fentes', abdos: 'Planche', fantome: 'X' } });
    expect(s.exercises.map((e) => e.id)).toEqual(['dips', 'presse', 'curl']);
    expect(s.exercises[1].name).toBe('Fentes');
    expect(s.bonus[0].name).toBe('Planche');
  });
});
```

`mobile/src/domain/__tests__/reorder.test.ts` :
```ts
import { moveId } from '../reorder';

describe('moveId', () => {
  const order = ['a', 'b', 'c', 'd'];
  it('déplace vers le bas et vers le haut', () => {
    expect(moveId(order, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveId(order, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('borne les index et ne modifie pas l\'entrée', () => {
    expect(moveId(order, 1, 99)).toEqual(['a', 'c', 'd', 'b']);
    expect(moveId(order, 2, -3)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveId(order, 1, 1)).toEqual(order);
    expect(order).toEqual(['a', 'b', 'c', 'd']);
  });
  it('index de départ invalide : copie inchangée', () => {
    expect(moveId(order, 7, 0)).toEqual(order);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/exerciseView.test.ts src/domain/__tests__/reorder.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/exerciseView.ts` :
```ts
// ============================================================
// Exercice effectif — l'exercice du programme après échange éventuel
// vers une alternative, et séance effective (ordre + échanges).
// L'id reste celui du programme (stats), le nom réalisé est mémorisé.
// ============================================================
import { alternativeName, type Alternative, type Exercise, type Session } from './program';
import { orderExercises } from './progress';

export type SessionLayout = { order: string[]; swaps: Record<string, string> };
export const EMPTY_LAYOUT: SessionLayout = { order: [], swaps: {} };

export type EffectiveExercise = Exercise & {
  /** Nom de l'alternative réalisée ; null pour l'original */
  performedName: string | null;
  /** Nom de l'exercice du programme (affiché « remplace X ») */
  originalName: string;
};

export type EffectiveSession = { exercises: EffectiveExercise[]; bonus: EffectiveExercise[] };

export function findAlternative(ex: Exercise, name: string): Alternative | undefined {
  return ex.alternatives.find((a) => alternativeName(a) === name);
}

export function effectiveExercise(ex: Exercise, swapName?: string | null): EffectiveExercise {
  const alt = swapName ? findAlternative(ex, swapName) : undefined;
  if (!alt) return { ...ex, performedName: null, originalName: ex.name };
  const name = alternativeName(alt);
  const base: EffectiveExercise = { ...ex, name, cue: null, performedName: name, originalName: ex.name };
  if (typeof alt === 'string') return base;
  return {
    ...base,
    sets: alt.sets ?? ex.sets,
    scheme: alt.scheme !== '' ? alt.scheme : ex.scheme,
    load: alt.load ?? ex.load,
    restSec: alt.restSec ?? ex.restSec,
    timed: alt.timed ?? ex.timed,
  };
}

/** Clé de mémorisation du poids : un poids par variante */
export function weightKey(exerciseId: string, performedName: string | null): string {
  return performedName ? `${exerciseId}::${performedName}` : exerciseId;
}

export function effectiveSession(session: Session, layout: SessionLayout): EffectiveSession {
  const swap = (ex: Exercise) => effectiveExercise(ex, layout.swaps[ex.id] ?? null);
  return {
    exercises: orderExercises(session.exercises, layout.order).map(swap),
    bonus: (session.bonus?.exercises ?? []).map(swap),
  };
}
```

`mobile/src/domain/reorder.ts` :
```ts
// Réordonnancement : déplace l'élément d'index `from` vers `to` (bornés)
export function moveId(order: readonly string[], from: number, to: number): string[] {
  const next = [...order];
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/domain && npx tsc --noEmit`
Expected: PASS, pas d'erreur TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/domain/exerciseView.ts src/domain/reorder.ts src/domain/__tests__/exerciseView.test.ts src/domain/__tests__/reorder.test.ts
git commit -m "feat(mobile): add effective exercise (swaps, order) and per-variant weight key

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Progression depuis les séries enregistrées + récapitulatif

**Files:**
- Modify: `mobile/src/domain/progress.ts`
- Test: `mobile/src/domain/__tests__/progress.test.ts` (ajout d'un `describe`)

**Interfaces:**
- Produces:
  - `type SetEntryLike = { exerciseId: string; setIndex: number; done: boolean; weight: number | null; reps: number | null }`
  - `trackFromEntries(entries: readonly SetEntryLike[]): SetTrack`
  - `type SessionSummary = { durationMin: number; setsDone: number; volume: number }`
  - `sessionSummary(entries: readonly SetEntryLike[], startedAt: string, completedAt: string | null): SessionSummary`

- [ ] **Step 1: Écrire les tests** (à la fin de `progress.test.ts`, importer `sessionSummary, trackFromEntries` depuis `'../progress'`)

```ts
describe('trackFromEntries / sessionSummary', () => {
  const e = (exerciseId: string, setIndex: number, done: boolean, weight: number | null = null, reps: number | null = null) =>
    ({ exerciseId, setIndex, done, weight, reps });

  it('construit le suivi à partir des séries cochées seulement', () => {
    const track = trackFromEntries([e('x', 0, true), e('x', 2, true), e('x', 1, false), e('y', 0, true)]);
    expect(track).toEqual({ x: [true, false, true], y: [true] });
  });

  it('le suivi alimente sessionProgress', () => {
    const p = sessionProgress(session, trackFromEntries([e('x', 0, true), e('x', 1, true), e('x', 2, true), e('x', 3, true)]));
    expect(p.completeIds).toEqual(['x']);
  });

  it('récapitulatif : durée arrondie, séries faites, volume (poids × reps)', () => {
    const s = sessionSummary(
      [e('x', 0, true, 100, 8), e('x', 1, true, 102.5, 8), e('y', 0, true, null, 12), e('y', 1, false, 50, 10)],
      '2026-10-05T10:00:00.000Z', '2026-10-05T10:47:40.000Z',
    );
    expect(s).toEqual({ durationMin: 48, setsDone: 3, volume: 1620 });
  });

  it('séance non terminée : durée 0', () => {
    expect(sessionSummary([], '2026-10-05T10:00:00.000Z', null)).toEqual({ durationMin: 0, setsDone: 0, volume: 0 });
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/progress.test.ts`
Expected: FAIL — `trackFromEntries is not a function`.

- [ ] **Step 3: Implémenter** (ajouter à la fin de `progress.ts`, avant la section Minuteur)

```ts
/* ── Séries enregistrées ─────────────────────────────── */
export type SetEntryLike = {
  exerciseId: string;
  setIndex: number;
  done: boolean;
  weight: number | null;
  reps: number | null;
};

export type SessionSummary = { durationMin: number; setsDone: number; volume: number };

/** Lignes set_entries → suivi par exercice (séries cochées uniquement) */
export function trackFromEntries(entries: readonly SetEntryLike[]): SetTrack {
  const track: SetTrack = {};
  for (const e of entries) {
    if (!e.done) continue;
    const row = (track[e.exerciseId] ??= []);
    while (row.length < e.setIndex) row.push(false);
    row[e.setIndex] = true;
  }
  return track;
}

export function sessionSummary(entries: readonly SetEntryLike[], startedAt: string, completedAt: string | null): SessionSummary {
  const done = entries.filter((e) => e.done);
  const volume = done.reduce((sum, e) => sum + (e.weight && e.reps ? e.weight * e.reps : 0), 0);
  const durationMin = completedAt ? Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 60000)) : 0;
  return { durationMin, setsDone: done.length, volume };
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/domain/__tests__/progress.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/progress.ts src/domain/__tests__/progress.test.ts
git commit -m "feat(mobile): derive set tracking and workout summary from stored sets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `domain/timer.ts` — minuteur unique

**Files:**
- Create: `mobile/src/domain/timer.ts`, `mobile/src/domain/__tests__/timer.test.ts`

**Interfaces:**
- Consumes: `remainingSec`, `isRestCritical` (`@/domain/progress`).
- Produces:
  - `type TimerMode = 'rest' | 'work'`
  - `type PendingSet = { weight: number | null; reps: number | null; performedName: string | null; restSec: number }`
  - `type TimerState = { mode: TimerMode; startedAt: number; endAt: number; workoutId: string; exerciseId: string; setIndex: number; pending: PendingSet | null }`
  - `ALERT_GRACE_MS = 1500`, `ADJUST_STEP_SEC = 15`, `FLASH_MS = 1500`
  - `startTimer(p: { mode: TimerMode; nowMs: number; durationSec: number; workoutId: string; exerciseId: string; setIndex: number; pending?: PendingSet | null }): TimerState`
  - `adjustTimer(s: TimerState, deltaSec: number, nowMs: number): TimerState`
  - `type TimerPhase = 'running' | 'critical' | 'done'` ; `timerPhase(s: TimerState, nowMs: number): TimerPhase`
  - `timerProgress(s: TimerState, nowMs: number): number` (fraction écoulée 0..1)
  - `shouldAlert(s: TimerState, nowMs: number): boolean`
  - `isTimerState(v: unknown): v is TimerState`
  - `reviveOnStartup(v: unknown, nowMs: number): TimerState | null`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/__tests__/timer.test.ts` :
```ts
import {
  ADJUST_STEP_SEC, adjustTimer, isTimerState, reviveOnStartup, shouldAlert,
  startTimer, timerPhase, timerProgress,
} from '../timer';

const T0 = 1_000_000;
const rest = startTimer({ mode: 'rest', nowMs: T0, durationSec: 90, workoutId: 'w', exerciseId: 'x', setIndex: 0 });
const work = startTimer({
  mode: 'work', nowMs: T0, durationSec: 45, workoutId: 'w', exerciseId: 'g', setIndex: 1,
  pending: { weight: null, reps: null, performedName: null, restSec: 60 },
});

describe('timer', () => {
  it('startTimer fixe startedAt / endAt', () => {
    expect(rest).toMatchObject({ mode: 'rest', startedAt: T0, endAt: T0 + 90_000, pending: null });
    expect(work.pending?.restSec).toBe(60);
  });

  it('phases : running, critical sous 10 s, done à 0', () => {
    expect(timerPhase(rest, T0 + 1_000)).toBe('running');
    expect(timerPhase(rest, T0 + 80_500)).toBe('critical');
    expect(timerPhase(rest, T0 + 90_000)).toBe('done');
  });

  it('adjustTimer ±15 s sans descendre sous maintenant', () => {
    expect(adjustTimer(rest, ADJUST_STEP_SEC, T0).endAt).toBe(T0 + 105_000);
    expect(adjustTimer(rest, -ADJUST_STEP_SEC, T0).endAt).toBe(T0 + 75_000);
    expect(adjustTimer(rest, -ADJUST_STEP_SEC, T0 + 85_000).endAt).toBe(T0 + 85_000);
  });

  it('timerProgress = fraction écoulée, bornée', () => {
    expect(timerProgress(rest, T0 + 45_000)).toBeCloseTo(0.5);
    expect(timerProgress(rest, T0 + 999_000)).toBe(1);
    expect(timerProgress(rest, T0 - 5)).toBe(0);
  });

  it('shouldAlert seulement juste après la fin (premier plan)', () => {
    expect(shouldAlert(rest, T0 + 90_200)).toBe(true);
    expect(shouldAlert(rest, T0 + 90_000 + 60_000)).toBe(false);
  });

  it('isTimerState rejette les formes invalides', () => {
    expect(isTimerState(rest)).toBe(true);
    expect(isTimerState({ ...rest, mode: 'pause' })).toBe(false);
    expect(isTimerState({ workoutId: 'w', exerciseId: 'x', endAt: 5 })).toBe(false);
    expect(isTimerState(null)).toBe(false);
  });

  it('reviveOnStartup : repos expiré purgé, effort expiré conservé, invalide → null', () => {
    expect(reviveOnStartup(rest, T0 + 10_000)).toEqual(rest);
    expect(reviveOnStartup(rest, T0 + 500_000)).toBeNull();
    expect(reviveOnStartup(work, T0 + 500_000)).toEqual(work);
    expect(reviveOnStartup({ endAt: 'x' }, T0)).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/timer.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/timer.ts` :
```ts
// ============================================================
// Minuteur unique — repos (rest) ou effort d'une série chronométrée (work).
// Défini par une heure de fin : le JS est suspendu en arrière-plan.
// ============================================================
import { isRestCritical, remainingSec } from './progress';

export type TimerMode = 'rest' | 'work';

/** Série à cocher à la fin d'un chrono d'effort, et repos à enchaîner */
export type PendingSet = { weight: number | null; reps: number | null; performedName: string | null; restSec: number };

export type TimerState = {
  mode: TimerMode;
  startedAt: number;
  endAt: number;
  workoutId: string;
  exerciseId: string;
  setIndex: number;
  pending: PendingSet | null;
};

export type TimerPhase = 'running' | 'critical' | 'done';

/** Au-delà de ce délai après la fin, on considère que l'app était en arrière-plan : pas de son */
export const ALERT_GRACE_MS = 1500;
export const ADJUST_STEP_SEC = 15;
/** Durée du flash « terminé » sur la barre */
export const FLASH_MS = 1500;

export function startTimer(p: {
  mode: TimerMode; nowMs: number; durationSec: number;
  workoutId: string; exerciseId: string; setIndex: number; pending?: PendingSet | null;
}): TimerState {
  return {
    mode: p.mode, startedAt: p.nowMs, endAt: p.nowMs + p.durationSec * 1000,
    workoutId: p.workoutId, exerciseId: p.exerciseId, setIndex: p.setIndex, pending: p.pending ?? null,
  };
}

export function adjustTimer(s: TimerState, deltaSec: number, nowMs: number): TimerState {
  return { ...s, endAt: Math.max(nowMs, s.endAt + deltaSec * 1000) };
}

export function timerPhase(s: TimerState, nowMs: number): TimerPhase {
  const remaining = remainingSec(s.endAt, nowMs);
  if (remaining === 0) return 'done';
  return isRestCritical(remaining) ? 'critical' : 'running';
}

export function timerProgress(s: TimerState, nowMs: number): number {
  const total = s.endAt - s.startedAt;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - s.startedAt) / total));
}

export function shouldAlert(s: TimerState, nowMs: number): boolean {
  return nowMs - s.endAt <= ALERT_GRACE_MS;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function isTimerState(v: unknown): v is TimerState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (s.mode === 'rest' || s.mode === 'work')
    && num(s.startedAt) && num(s.endAt) && num(s.setIndex)
    && str(s.workoutId) && str(s.exerciseId)
    && (s.pending === null || (typeof s.pending === 'object' && s.pending !== null && num((s.pending as Record<string, unknown>).restSec)));
}

/** Relecture au démarrage : repos expiré purgé ; effort expiré gardé (sa série sera cochée en silence) */
export function reviveOnStartup(v: unknown, nowMs: number): TimerState | null {
  if (!isTimerState(v)) return null;
  if (v.mode === 'rest' && v.endAt <= nowMs) return null;
  return v;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/domain/__tests__/timer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/timer.ts src/domain/__tests__/timer.test.ts
git commit -m "feat(mobile): add single rest/work timer model with adjust and startup revival

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `workoutsRepo` + `inTransaction`

**Files:**
- Create: `mobile/src/db/transaction.ts`, `mobile/src/db/repos/workoutsRepo.ts`, `mobile/src/db/__tests__/workoutsRepo.test.ts`

**Interfaces:**
- Consumes: `workouts`, `setEntries` (`../schema`), `RepoCtx`, `AppDb`.
- Produces:
  - `inTransaction<T>(ctx: RepoCtx, fn: (tx: RepoCtx) => T): T`
  - `type WorkoutRow = typeof workouts.$inferSelect`, `type SetEntryRow = typeof setEntries.$inferSelect`
  - `type WorkoutKey = { programId: string; sessionKey: string; date: string }`
  - `type SetPatch = { done?: boolean; weight?: number | null; reps?: number | null; performedName?: string | null }`
  - `findWorkout(ctx, key: WorkoutKey): WorkoutRow | null`
  - `getWorkout(ctx, id: string): WorkoutRow | null`
  - `ensureWorkout(ctx, key: WorkoutKey): WorkoutRow`
  - `listEntries(ctx, workoutId: string): SetEntryRow[]`
  - `upsertSet(ctx, workoutId: string, exerciseId: string, setIndex: number, patch: SetPatch): void`
  - `clearExerciseSets(ctx, workoutId: string, exerciseId: string): void`
  - `completeWorkout(ctx, id: string): void`, `reopenWorkout(ctx, id: string): void`, `resetWorkout(ctx, id: string): void`
  - `findStaleInProgress(ctx, today: string): WorkoutRow | null`

- [ ] **Step 1: Écrire les tests**

`mobile/src/db/__tests__/workoutsRepo.test.ts` :
```ts
/** @jest-environment node */
import example from '@/data/program.example.json';
import { createProgram } from '../repos/programsRepo';
import {
  clearExerciseSets, completeWorkout, ensureWorkout, findStaleInProgress, findWorkout,
  getWorkout, listEntries, reopenWorkout, resetWorkout, upsertSet,
} from '../repos/workoutsRepo';
import { createTestCtx } from '../testing/createTestCtx';
import { inTransaction } from '../transaction';

function setup() {
  const ctx = createTestCtx('2026-10-05T10:00:00.000Z');
  const program = createProgram(ctx, example, 'example');
  const key = { programId: program.id, sessionKey: 'full-body', date: '2026-10-05' };
  return { ctx, key };
}

describe('workoutsRepo', () => {
  it('ensureWorkout crée paresseusement puis réutilise', () => {
    const { ctx, key } = setup();
    expect(findWorkout(ctx, key)).toBeNull();
    const w = ensureWorkout(ctx, key);
    expect(w).toMatchObject({ status: 'in_progress', startedAt: '2026-10-05T10:00:00.000Z', completedAt: null });
    expect(ensureWorkout(ctx, key).id).toBe(w.id);
  });

  it('upsertSet coche, décoche et conserve poids / reps', () => {
    const { ctx, key } = setup();
    const w = ensureWorkout(ctx, key);
    upsertSet(ctx, w.id, 'presse', 0, { done: true, weight: 100, reps: 8, performedName: null });
    ctx.advance(1000);
    upsertSet(ctx, w.id, 'presse', 0, { done: false });
    const [e] = listEntries(ctx, w.id);
    expect(e).toMatchObject({ exerciseId: 'presse', setIndex: 0, done: false, weight: 100, reps: 8, doneAt: null });
    upsertSet(ctx, w.id, 'presse', 0, { weight: 105 });
    expect(listEntries(ctx, w.id)).toHaveLength(1);
    expect(listEntries(ctx, w.id)[0].weight).toBe(105);
  });

  it('terminer / rouvrir', () => {
    const { ctx, key } = setup();
    const w = ensureWorkout(ctx, key);
    ctx.advance(60_000);
    completeWorkout(ctx, w.id);
    expect(getWorkout(ctx, w.id)).toMatchObject({ status: 'completed', completedAt: '2026-10-05T10:01:00.000Z' });
    reopenWorkout(ctx, w.id);
    expect(getWorkout(ctx, w.id)).toMatchObject({ status: 'in_progress', completedAt: null });
  });

  it('resetWorkout supprime logiquement séance et séries, puis une nouvelle séance est possible', () => {
    const { ctx, key } = setup();
    const w = ensureWorkout(ctx, key);
    upsertSet(ctx, w.id, 'presse', 0, { done: true });
    resetWorkout(ctx, w.id);
    expect(findWorkout(ctx, key)).toBeNull();
    expect(listEntries(ctx, w.id)).toEqual([]);
    expect(ensureWorkout(ctx, key).id).not.toBe(w.id);
  });

  it('clearExerciseSets ne touche que l\'exercice visé', () => {
    const { ctx, key } = setup();
    const w = ensureWorkout(ctx, key);
    upsertSet(ctx, w.id, 'presse', 0, { done: true });
    upsertSet(ctx, w.id, 'curl', 0, { done: true });
    clearExerciseSets(ctx, w.id, 'presse');
    expect(listEntries(ctx, w.id).map((e) => e.exerciseId)).toEqual(['curl']);
    upsertSet(ctx, w.id, 'presse', 0, { done: true });
    expect(listEntries(ctx, w.id)).toHaveLength(2);
  });

  it('findStaleInProgress : séance en cours d\'un jour précédent seulement', () => {
    const { ctx, key } = setup();
    const old = ensureWorkout(ctx, { ...key, date: '2026-10-03' });
    ensureWorkout(ctx, key);
    expect(findStaleInProgress(ctx, '2026-10-05')?.id).toBe(old.id);
    completeWorkout(ctx, old.id);
    expect(findStaleInProgress(ctx, '2026-10-05')).toBeNull();
  });

  it('inTransaction annule tout en cas d\'erreur', () => {
    const { ctx, key } = setup();
    const w = ensureWorkout(ctx, key);
    expect(() => inTransaction(ctx, (tx) => {
      upsertSet(tx, w.id, 'presse', 0, { done: true });
      throw new Error('boom');
    })).toThrow('boom');
    expect(listEntries(ctx, w.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/db/__tests__/workoutsRepo.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/db/transaction.ts` :
```ts
// Transaction synchrone : le RepoCtx transmis écrit dans la transaction
import type { AppDb, RepoCtx } from './types';

export function inTransaction<T>(ctx: RepoCtx, fn: (tx: RepoCtx) => T): T {
  return ctx.db.transaction((tx) => fn({ ...ctx, db: tx as unknown as AppDb }));
}
```

`mobile/src/db/repos/workoutsRepo.ts` :
```ts
// ============================================================
// Séances réalisées (workouts) et séries (set_entries)
// Un workout par (programme, séance, date locale), créé au premier cercle coché.
// ============================================================
import { and, asc, desc, eq, isNull, lt } from 'drizzle-orm';
import { setEntries, workouts } from '../schema';
import { inTransaction } from '../transaction';
import type { RepoCtx } from '../types';

export type WorkoutRow = typeof workouts.$inferSelect;
export type SetEntryRow = typeof setEntries.$inferSelect;
export type WorkoutKey = { programId: string; sessionKey: string; date: string };
export type SetPatch = { done?: boolean; weight?: number | null; reps?: number | null; performedName?: string | null };

export function findWorkout(ctx: RepoCtx, key: WorkoutKey): WorkoutRow | null {
  return ctx.db.select().from(workouts).where(and(
    eq(workouts.programId, key.programId),
    eq(workouts.sessionKey, key.sessionKey),
    eq(workouts.date, key.date),
    isNull(workouts.deletedAt),
  )).get() ?? null;
}

export function getWorkout(ctx: RepoCtx, id: string): WorkoutRow | null {
  return ctx.db.select().from(workouts).where(and(eq(workouts.id, id), isNull(workouts.deletedAt))).get() ?? null;
}

export function ensureWorkout(ctx: RepoCtx, key: WorkoutKey): WorkoutRow {
  const existing = findWorkout(ctx, key);
  if (existing) return existing;
  const now = ctx.now();
  const row: WorkoutRow = {
    id: ctx.newId(), createdAt: now, updatedAt: now, deletedAt: null, userId: null,
    programId: key.programId, sessionKey: key.sessionKey, date: key.date,
    status: 'in_progress', startedAt: now, completedAt: null, healthSyncedAt: null,
  };
  ctx.db.insert(workouts).values(row).run();
  return row;
}

export function listEntries(ctx: RepoCtx, workoutId: string): SetEntryRow[] {
  return ctx.db.select().from(setEntries)
    .where(and(eq(setEntries.workoutId, workoutId), isNull(setEntries.deletedAt)))
    .orderBy(asc(setEntries.exerciseId), asc(setEntries.setIndex))
    .all();
}

/** Crée ou met à jour la série ; seuls les champs fournis changent */
export function upsertSet(ctx: RepoCtx, workoutId: string, exerciseId: string, setIndex: number, patch: SetPatch): void {
  const now = ctx.now();
  const fields: Partial<SetEntryRow> = { updatedAt: now };
  if (patch.done !== undefined) {
    fields.done = patch.done;
    fields.doneAt = patch.done ? now : null;
  }
  if (patch.weight !== undefined) fields.weight = patch.weight;
  if (patch.reps !== undefined) fields.reps = patch.reps;
  if (patch.performedName !== undefined) fields.performedName = patch.performedName;

  const existing = ctx.db.select({ id: setEntries.id }).from(setEntries).where(and(
    eq(setEntries.workoutId, workoutId),
    eq(setEntries.exerciseId, exerciseId),
    eq(setEntries.setIndex, setIndex),
    isNull(setEntries.deletedAt),
  )).get();

  if (existing) {
    ctx.db.update(setEntries).set(fields).where(eq(setEntries.id, existing.id)).run();
    return;
  }
  ctx.db.insert(setEntries).values({
    id: ctx.newId(), createdAt: now, workoutId, exerciseId, setIndex,
    done: false, doneAt: null, weight: null, reps: null, performedName: null,
    ...fields, updatedAt: now,
  }).run();
}

export function clearExerciseSets(ctx: RepoCtx, workoutId: string, exerciseId: string): void {
  const now = ctx.now();
  ctx.db.update(setEntries).set({ deletedAt: now, updatedAt: now }).where(and(
    eq(setEntries.workoutId, workoutId),
    eq(setEntries.exerciseId, exerciseId),
    isNull(setEntries.deletedAt),
  )).run();
}

export function completeWorkout(ctx: RepoCtx, id: string): void {
  const now = ctx.now();
  ctx.db.update(workouts).set({ status: 'completed', completedAt: now, updatedAt: now }).where(eq(workouts.id, id)).run();
}

export function reopenWorkout(ctx: RepoCtx, id: string): void {
  ctx.db.update(workouts).set({ status: 'in_progress', completedAt: null, updatedAt: ctx.now() }).where(eq(workouts.id, id)).run();
}

/** Réinitialisation du jour : suppression logique de la séance et de ses séries */
export function resetWorkout(ctx: RepoCtx, id: string): void {
  inTransaction(ctx, (tx) => {
    const now = tx.now();
    tx.db.update(setEntries).set({ deletedAt: now, updatedAt: now })
      .where(and(eq(setEntries.workoutId, id), isNull(setEntries.deletedAt))).run();
    tx.db.update(workouts).set({ deletedAt: now, updatedAt: now }).where(eq(workouts.id, id)).run();
  });
}

/** Séance restée en cours un jour précédent (passage de minuit) */
export function findStaleInProgress(ctx: RepoCtx, today: string): WorkoutRow | null {
  return ctx.db.select().from(workouts).where(and(
    eq(workouts.status, 'in_progress'),
    lt(workouts.date, today),
    isNull(workouts.deletedAt),
  )).orderBy(desc(workouts.date)).get() ?? null;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/db && npx tsc --noEmit`
Expected: PASS. Si TypeScript refuse `tx as unknown as AppDb`, garder ce double cast (le type de transaction Drizzle est structurellement un `BaseSQLiteDatabase` synchrone).

- [ ] **Step 5: Commit**

```bash
git add src/db/transaction.ts src/db/repos/workoutsRepo.ts src/db/__tests__/workoutsRepo.test.ts
git commit -m "feat(mobile): add workouts repository with lazy creation, set upsert and soft reset

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `weightsRepo` + `layoutsRepo`

**Files:**
- Create: `mobile/src/db/repos/weightsRepo.ts`, `mobile/src/db/repos/layoutsRepo.ts`, `mobile/src/db/__tests__/weightsRepo.test.ts`, `mobile/src/db/__tests__/layoutsRepo.test.ts`

**Interfaces:**
- Consumes: `exerciseWeights`, `sessionLayouts`, `SessionLayout`, `EMPTY_LAYOUT` (`@/domain/exerciseView`), `Units`.
- Produces:
  - `type StoredWeight = { weight: number; unit: Units }`
  - `getAllWeights(ctx): Record<string, StoredWeight>`
  - `setWeight(ctx, key: string, weight: number | null, unit: Units): void`
  - `getLayout(ctx, programId: string, sessionKey: string): SessionLayout`
  - `setOrder(ctx, programId: string, sessionKey: string, order: string[]): void`
  - `setSwap(ctx, programId: string, sessionKey: string, exerciseId: string, name: string | null): void`

- [ ] **Step 1: Écrire les tests**

`mobile/src/db/__tests__/weightsRepo.test.ts` :
```ts
/** @jest-environment node */
import { getAllWeights, setWeight } from '../repos/weightsRepo';
import { createTestCtx } from '../testing/createTestCtx';

describe('weightsRepo', () => {
  it('enregistre, met à jour et relit par clé', () => {
    const ctx = createTestCtx();
    setWeight(ctx, 'presse', 100, 'kg');
    setWeight(ctx, 'presse', 102.5, 'kg');
    setWeight(ctx, 'presse::Fentes', 12, 'kg');
    expect(getAllWeights(ctx)).toEqual({ presse: { weight: 102.5, unit: 'kg' }, 'presse::Fentes': { weight: 12, unit: 'kg' } });
  });

  it('null efface (suppression logique) puis une nouvelle valeur est acceptée', () => {
    const ctx = createTestCtx();
    setWeight(ctx, 'presse', 100, 'kg');
    setWeight(ctx, 'presse', null, 'kg');
    expect(getAllWeights(ctx)).toEqual({});
    setWeight(ctx, 'presse', 220, 'lbs');
    expect(getAllWeights(ctx)).toEqual({ presse: { weight: 220, unit: 'lbs' } });
  });
});
```

`mobile/src/db/__tests__/layoutsRepo.test.ts` :
```ts
/** @jest-environment node */
import example from '@/data/program.example.json';
import { EMPTY_LAYOUT } from '@/domain/exerciseView';
import { sessionLayouts } from '../schema';
import { createProgram } from '../repos/programsRepo';
import { getLayout, setOrder, setSwap } from '../repos/layoutsRepo';
import { createTestCtx } from '../testing/createTestCtx';

describe('layoutsRepo', () => {
  it('layout vide par défaut, puis ordre et échanges persistés', () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    expect(getLayout(ctx, p.id, 'full-body')).toEqual(EMPTY_LAYOUT);
    setOrder(ctx, p.id, 'full-body', ['b', 'a']);
    setSwap(ctx, p.id, 'full-body', 'a', 'Alt');
    expect(getLayout(ctx, p.id, 'full-body')).toEqual({ order: ['b', 'a'], swaps: { a: 'Alt' } });
    setSwap(ctx, p.id, 'full-body', 'a', null);
    expect(getLayout(ctx, p.id, 'full-body').swaps).toEqual({});
  });

  it('JSON corrompu en base : layout vide', () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    setOrder(ctx, p.id, 'full-body', ['a']);
    ctx.db.update(sessionLayouts).set({ exerciseOrder: '{oops', swaps: '[1]' }).run();
    expect(getLayout(ctx, p.id, 'full-body')).toEqual(EMPTY_LAYOUT);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/db/__tests__/weightsRepo.test.ts src/db/__tests__/layoutsRepo.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/db/repos/weightsRepo.ts` :
```ts
// ============================================================
// Dernier poids saisi par clé de poids (id ou id::alternative)
// ============================================================
import { and, eq, isNull } from 'drizzle-orm';
import type { Units } from '@/domain/program';
import { exerciseWeights } from '../schema';
import type { RepoCtx } from '../types';

export type StoredWeight = { weight: number; unit: Units };

export function getAllWeights(ctx: RepoCtx): Record<string, StoredWeight> {
  const rows = ctx.db.select().from(exerciseWeights).where(isNull(exerciseWeights.deletedAt)).all();
  return Object.fromEntries(rows.map((r) => [r.exerciseId, { weight: r.weight, unit: r.unit }]));
}

/** null (ou ≤ 0) efface le poids mémorisé */
export function setWeight(ctx: RepoCtx, key: string, weight: number | null, unit: Units): void {
  const now = ctx.now();
  const existing = ctx.db.select({ id: exerciseWeights.id }).from(exerciseWeights)
    .where(and(eq(exerciseWeights.exerciseId, key), isNull(exerciseWeights.deletedAt))).get();
  if (weight === null || !(weight > 0)) {
    if (existing) ctx.db.update(exerciseWeights).set({ deletedAt: now, updatedAt: now }).where(eq(exerciseWeights.id, existing.id)).run();
    return;
  }
  if (existing) {
    ctx.db.update(exerciseWeights).set({ weight, unit, updatedAt: now }).where(eq(exerciseWeights.id, existing.id)).run();
    return;
  }
  ctx.db.insert(exerciseWeights).values({ id: ctx.newId(), createdAt: now, updatedAt: now, exerciseId: key, weight, unit }).run();
}
```

`mobile/src/db/repos/layoutsRepo.ts` :
```ts
// ============================================================
// Organisation d'une séance : ordre des exercices et échanges
// ============================================================
import { and, eq, isNull } from 'drizzle-orm';
import { EMPTY_LAYOUT, type SessionLayout } from '@/domain/exerciseView';
import { sessionLayouts } from '../schema';
import type { RepoCtx } from '../types';

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function findRow(ctx: RepoCtx, programId: string, sessionKey: string) {
  return ctx.db.select().from(sessionLayouts).where(and(
    eq(sessionLayouts.programId, programId),
    eq(sessionLayouts.sessionKey, sessionKey),
    isNull(sessionLayouts.deletedAt),
  )).get();
}

export function getLayout(ctx: RepoCtx, programId: string, sessionKey: string): SessionLayout {
  const row = findRow(ctx, programId, sessionKey);
  if (!row) return EMPTY_LAYOUT;
  const order = parseJson(row.exerciseOrder);
  const swaps = parseJson(row.swaps);
  const validOrder = Array.isArray(order) && order.every((id) => typeof id === 'string');
  const validSwaps = typeof swaps === 'object' && swaps !== null && !Array.isArray(swaps)
    && Object.values(swaps).every((v) => typeof v === 'string');
  if (!validOrder || !validSwaps) return EMPTY_LAYOUT;
  return { order: order as string[], swaps: swaps as Record<string, string> };
}

function saveLayout(ctx: RepoCtx, programId: string, sessionKey: string, layout: SessionLayout): void {
  const now = ctx.now();
  const values = { exerciseOrder: JSON.stringify(layout.order), swaps: JSON.stringify(layout.swaps), updatedAt: now };
  const row = findRow(ctx, programId, sessionKey);
  if (row) {
    ctx.db.update(sessionLayouts).set(values).where(eq(sessionLayouts.id, row.id)).run();
    return;
  }
  ctx.db.insert(sessionLayouts).values({ id: ctx.newId(), createdAt: now, programId, sessionKey, ...values }).run();
}

export function setOrder(ctx: RepoCtx, programId: string, sessionKey: string, order: string[]): void {
  saveLayout(ctx, programId, sessionKey, { ...getLayout(ctx, programId, sessionKey), order });
}

export function setSwap(ctx: RepoCtx, programId: string, sessionKey: string, exerciseId: string, name: string | null): void {
  const layout = getLayout(ctx, programId, sessionKey);
  const swaps = { ...layout.swaps };
  if (name === null) delete swaps[exerciseId];
  else swaps[exerciseId] = name;
  saveLayout(ctx, programId, sessionKey, { ...layout, swaps });
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repos/weightsRepo.ts src/db/repos/layoutsRepo.ts src/db/__tests__/weightsRepo.test.ts src/db/__tests__/layoutsRepo.test.ts
git commit -m "feat(mobile): add exercise weights and session layout repositories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `historyRepo.lastPerformance`

**Files:**
- Create: `mobile/src/db/repos/historyRepo.ts`, `mobile/src/db/__tests__/historyRepo.test.ts`

**Interfaces:**
- Produces:
  - `type LastPerformance = { date: string; sets: number; reps: number | null; maxWeight: number | null }`
  - `lastPerformance(ctx, exerciseId: string, performedName: string | null, beforeDate: string): LastPerformance | null`

- [ ] **Step 1: Écrire les tests**

`mobile/src/db/__tests__/historyRepo.test.ts` :
```ts
/** @jest-environment node */
import example from '@/data/program.example.json';
import { lastPerformance } from '../repos/historyRepo';
import { createProgram } from '../repos/programsRepo';
import { completeWorkout, ensureWorkout, upsertSet } from '../repos/workoutsRepo';
import { createTestCtx } from '../testing/createTestCtx';

function setup() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, example, 'example');
  const workoutOn = (date: string, complete = true) => {
    const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 'full-body', date });
    if (complete) completeWorkout(ctx, w.id);
    return w;
  };
  return { ctx, workoutOn };
}

describe('lastPerformance', () => {
  it('séance terminée la plus récente avant la date, séries cochées seulement', () => {
    const { ctx, workoutOn } = setup();
    const a = workoutOn('2026-09-28');
    upsertSet(ctx, a.id, 'presse', 0, { done: true, weight: 90, reps: 8 });
    const b = workoutOn('2026-10-01');
    upsertSet(ctx, b.id, 'presse', 0, { done: true, weight: 100, reps: 8 });
    upsertSet(ctx, b.id, 'presse', 1, { done: true, weight: 105, reps: 6 });
    upsertSet(ctx, b.id, 'presse', 2, { done: false, weight: 200, reps: 8 });
    expect(lastPerformance(ctx, 'presse', null, '2026-10-05')).toEqual({ date: '2026-10-01', sets: 2, reps: 8, maxWeight: 105 });
  });

  it('exclut aujourd\'hui, les séances en cours et les autres variantes', () => {
    const { ctx, workoutOn } = setup();
    const today = workoutOn('2026-10-05');
    upsertSet(ctx, today.id, 'presse', 0, { done: true, weight: 120, reps: 8 });
    const open = workoutOn('2026-10-04', false);
    upsertSet(ctx, open.id, 'presse', 0, { done: true, weight: 110, reps: 8 });
    const alt = workoutOn('2026-10-03');
    upsertSet(ctx, alt.id, 'presse', 0, { done: true, weight: 12, reps: 12, performedName: 'Fentes' });
    expect(lastPerformance(ctx, 'presse', null, '2026-10-05')).toBeNull();
    expect(lastPerformance(ctx, 'presse', 'Fentes', '2026-10-05')).toEqual({ date: '2026-10-03', sets: 1, reps: 12, maxWeight: 12 });
  });

  it('sans poids ni reps : null dans les champs', () => {
    const { ctx, workoutOn } = setup();
    const w = workoutOn('2026-10-01');
    upsertSet(ctx, w.id, 'gainage', 0, { done: true });
    expect(lastPerformance(ctx, 'gainage', null, '2026-10-05')).toEqual({ date: '2026-10-01', sets: 1, reps: null, maxWeight: null });
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/db/__tests__/historyRepo.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/db/repos/historyRepo.ts` :
```ts
// ============================================================
// Historique — « La dernière fois » pour un exercice et une variante
// ============================================================
import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { setEntries, workouts } from '../schema';
import type { RepoCtx } from '../types';

export type LastPerformance = { date: string; sets: number; reps: number | null; maxWeight: number | null };

export function lastPerformance(ctx: RepoCtx, exerciseId: string, performedName: string | null, beforeDate: string): LastPerformance | null {
  const sameVariant = performedName === null ? isNull(setEntries.performedName) : eq(setEntries.performedName, performedName);
  const doneOfExercise = and(
    eq(setEntries.exerciseId, exerciseId), sameVariant,
    eq(setEntries.done, true), isNull(setEntries.deletedAt),
  );

  const last = ctx.db.select({ id: workouts.id, date: workouts.date })
    .from(workouts)
    .innerJoin(setEntries, eq(setEntries.workoutId, workouts.id))
    .where(and(doneOfExercise, eq(workouts.status, 'completed'), lt(workouts.date, beforeDate), isNull(workouts.deletedAt)))
    .orderBy(desc(workouts.date), desc(workouts.completedAt))
    .get();
  if (!last) return null;

  const sets = ctx.db.select().from(setEntries).where(and(doneOfExercise, eq(setEntries.workoutId, last.id))).all();
  const max = (values: (number | null)[]) => {
    const nums = values.filter((v): v is number => v !== null);
    return nums.length > 0 ? Math.max(...nums) : null;
  };
  return { date: last.date, sets: sets.length, reps: max(sets.map((s) => s.reps)), maxWeight: max(sets.map((s) => s.weight)) };
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/db/__tests__/historyRepo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repos/historyRepo.ts src/db/__tests__/historyRepo.test.ts
git commit -m "feat(mobile): add last performance lookup per exercise variant

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Adaptateurs `platform/` + son embarqué

**Files:**
- Create: `mobile/scripts/generate-beep.mjs`, `mobile/assets/sounds/rest-done.wav`, `mobile/src/platform/haptics.web.ts`, `mobile/src/platform/confirm.web.ts`, `mobile/src/platform/extensions.ts`
- Modify (remplacent les fichiers provisoires de la Task 1): `mobile/src/platform/haptics.ts`, `mobile/src/platform/keepAwake.ts`, `mobile/src/platform/sound.ts`, `mobile/src/platform/confirm.ts`

**Interfaces:**
- Consumes: `@/platform/types`, `TimerState` (`@/domain/timer`).
- Produces: `haptics: Haptics`, `keepAwake: KeepAwake`, `sound: Sound`, `confirm: Confirm` ; `timerExtensions = { started(s: TimerState): void; stopped(): void }`, `workoutExtensions = { completed(workoutId: string): void }`.

Ces adaptateurs sont mockés dans tous les tests (Task 1) : ils sont vérifiés à la main sur appareil (Task 19). Aucune nouvelle suite Jest ; la vérification automatique est `tsc` + l'export web.

- [ ] **Step 1: Générer le son**

`mobile/scripts/generate-beep.mjs` :
```js
// Génère assets/sounds/rest-done.wav : deux bips (880 Hz puis 1100 Hz), comme la PWA.
// Usage : node scripts/generate-beep.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const beeps = [{ freq: 880, start: 0, dur: 0.22 }, { freq: 1100, start: 0.28, dur: 0.28 }];
const total = Math.ceil((0.28 + 0.28 + 0.05) * RATE);
const samples = new Int16Array(total);
for (const { freq, start, dur } of beeps) {
  const from = Math.floor(start * RATE);
  const n = Math.floor(dur * RATE);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const gain = 0.28 * Math.pow(0.001 / 0.28, t / dur); // décroissance exponentielle 0.28 → 0.001
    samples[from + i] += Math.round(Math.sin(2 * Math.PI * freq * t) * gain * 32767);
  }
}
const data = Buffer.from(samples.buffer);
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(data.length, 40);
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/sounds/rest-done.wav');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([header, data]));
console.log(`écrit ${out} (${data.length + 44} octets)`);
```
Run: `node scripts/generate-beep.mjs`
Expected: `écrit …/assets/sounds/rest-done.wav (~53 ko)`.

- [ ] **Step 2: Implémenter les adaptateurs**

`mobile/src/platform/haptics.ts` :
```ts
// Retours haptiques natifs (spec §5.6) — échecs silencieux
import * as ExpoHaptics from 'expo-haptics';
import type { Haptics } from './types';

const quiet = (p: Promise<unknown>) => { p.catch(() => {}); };

export const haptics: Haptics = {
  light: () => quiet(ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light)),
  success: () => quiet(ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success)),
  warning: () => quiet(ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning)),
};
```

`mobile/src/platform/haptics.web.ts` :
```ts
// Web : vibration si le navigateur la supporte (motifs de la PWA)
import type { Haptics } from './types';

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch { /* navigateur sans vibration */ }
}

export const haptics: Haptics = {
  light: () => vibrate(15),
  success: () => vibrate([280, 90, 280, 90, 280]),
  warning: () => vibrate(120),
};
```

`mobile/src/platform/keepAwake.ts` :
```ts
// Écran allumé pendant la séance (expo-keep-awake gère aussi le web via Wake Lock)
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { KeepAwake } from './types';

const TAG = 'today-session';

export const keepAwake: KeepAwake = {
  activate: () => { activateKeepAwakeAsync(TAG).catch(() => {}); },
  deactivate: () => {
    try {
      deactivateKeepAwake(TAG);
    } catch { /* déjà inactif */ }
  },
};
```

`mobile/src/platform/sound.ts` :
```ts
// Son de fin de minuteur — se mêle à la musique, coupé par le mode silencieux iOS
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { Sound } from './types';

let player: AudioPlayer | null = null;

function getPlayer(): AudioPlayer {
  if (!player) {
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    player = createAudioPlayer(require('../../assets/sounds/rest-done.wav'));
  }
  return player;
}

export const sound: Sound = {
  playRestDone: () => {
    try {
      const p = getPlayer();
      p.seekTo(0).catch(() => {});
      p.play();
    } catch { /* audio indisponible */ }
  },
};
```

`mobile/src/platform/confirm.ts` :
```ts
// Confirmation native (Alert) → Promise<boolean>
import { Alert } from 'react-native';
import type { Confirm } from './types';

export const confirm: Confirm = ({ title, message, confirmLabel, cancelLabel, destructive }) =>
  new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
```

`mobile/src/platform/confirm.web.ts` :
```ts
// Web : Alert de React Native Web est sans effet → window.confirm
import type { Confirm } from './types';

export const confirm: Confirm = async ({ title, message }) =>
  typeof window !== 'undefined' && window.confirm(message ? `${title}\n\n${message}` : title);
```

`mobile/src/platform/extensions.ts` :
```ts
// ============================================================
// Points d'extension des jalons suivants — vides en M2.
// M6 : notification de fin de repos ; M7 : Live Activity ; M8 : Santé.
// ============================================================
import type { TimerState } from '@/domain/timer';

export const timerExtensions = {
  started(_timer: TimerState): void {},
  stopped(): void {},
};

export const workoutExtensions = {
  completed(_workoutId: string): void {},
};
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npx jest`
Expected: aucune erreur TypeScript ; suite verte (les adaptateurs restent mockés).

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-beep.mjs assets/sounds/rest-done.wav src/platform
git commit -m "feat(mobile): add haptics, keep-awake, sound and confirm platform adapters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Stores minuteur + toast, `activeRest` typé, composant `Toast`

**Files:**
- Create: `mobile/src/state/timerStore.ts`, `mobile/src/state/toastStore.ts`, `mobile/src/features/common/Toast.tsx`, `mobile/src/state/__tests__/timerStore.test.ts`, `mobile/src/features/common/__tests__/Toast.test.tsx`
- Modify: `mobile/src/db/repos/settingsRepo.ts`, `mobile/src/app/_layout.tsx`

**Interfaces:**
- Consumes: `TimerState`, `reviveOnStartup`, `adjustTimer` (`@/domain/timer`), `getSetting/setSetting/deleteSetting`, `timerExtensions`.
- Produces:
  - `SettingsMap.activeRest: TimerState`
  - `useTimerStore` : état `{ timer: TimerState | null; flash: { exerciseId: string; until: number } | null }` ; actions `hydrate(ctx, nowMs)`, `start(ctx, timer)`, `adjust(ctx, deltaSec, nowMs)`, `finish(ctx, flashUntil: number | null)`, `clear(ctx)` ; `TIMER_INITIAL`
  - `useToastStore` : `{ message: string | null; seq: number; show(message: string): void; hide(): void }` ; `TOAST_INITIAL`
  - `<Toast />` (affiche le message 2,5 s)

- [ ] **Step 1: Écrire les tests**

`mobile/src/state/__tests__/timerStore.test.ts` :
```ts
/** @jest-environment node */
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { startTimer } from '@/domain/timer';
import { TIMER_INITIAL, useTimerStore } from '../timerStore';

const T0 = 5_000_000;
const rest = startTimer({ mode: 'rest', nowMs: T0, durationSec: 90, workoutId: 'w', exerciseId: 'x', setIndex: 0 });

describe('timerStore', () => {
  beforeEach(() => useTimerStore.setState(TIMER_INITIAL));

  it('start persiste dans settings.activeRest, clear l\'efface', () => {
    const ctx = createTestCtx();
    useTimerStore.getState().start(ctx, rest);
    expect(getSetting(ctx, 'activeRest')).toEqual(rest);
    useTimerStore.getState().clear(ctx);
    expect(useTimerStore.getState().timer).toBeNull();
    expect(getSetting(ctx, 'activeRest')).toBeUndefined();
  });

  it('adjust décale la fin et persiste', () => {
    const ctx = createTestCtx();
    useTimerStore.getState().start(ctx, rest);
    useTimerStore.getState().adjust(ctx, 15, T0);
    expect(useTimerStore.getState().timer?.endAt).toBe(T0 + 105_000);
    expect(getSetting(ctx, 'activeRest')?.endAt).toBe(T0 + 105_000);
  });

  it('finish efface le minuteur et garde un flash optionnel', () => {
    const ctx = createTestCtx();
    useTimerStore.getState().start(ctx, rest);
    useTimerStore.getState().finish(ctx, T0 + 1500);
    expect(useTimerStore.getState()).toMatchObject({ timer: null, flash: { exerciseId: 'x', until: T0 + 1500 } });
  });

  it('hydrate relit un minuteur valide et purge un repos expiré', () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'activeRest', rest);
    useTimerStore.getState().hydrate(ctx, T0 + 1000);
    expect(useTimerStore.getState().timer).toEqual(rest);
    useTimerStore.getState().hydrate(ctx, T0 + 999_000);
    expect(useTimerStore.getState().timer).toBeNull();
    expect(getSetting(ctx, 'activeRest')).toBeUndefined();
  });
});
```

`mobile/src/features/common/__tests__/Toast.test.tsx` :
```tsx
import { act, screen } from '@testing-library/react-native';
import { TOAST_INITIAL, useToastStore } from '@/state/toastStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Toast } from '../Toast';

describe('Toast', () => {
  beforeEach(() => { jest.useFakeTimers(); useToastStore.setState(TOAST_INITIAL); });
  afterEach(() => jest.useRealTimers());

  it('affiche le message puis le masque après 2,5 s', async () => {
    await renderWithProviders(<Toast />);
    await act(async () => { useToastStore.getState().show('Séance enregistrée ✓'); });
    expect(screen.getByText('Séance enregistrée ✓')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(2600); });
    expect(screen.queryByText('Séance enregistrée ✓')).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/state/__tests__/timerStore.test.ts src/features/common/__tests__/Toast.test.tsx`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/db/repos/settingsRepo.ts` : remplacer la ligne `activeRest` de `SettingsMap` et importer le type :
```ts
import type { TimerState } from '@/domain/timer';
// …
  activeRest: TimerState;
```

`mobile/src/state/timerStore.ts` :
```ts
// ============================================================
// Minuteur unique (Zustand) — recopié dans settings.activeRest
// pour survivre à l'arrêt de l'app (spec §5.1).
// ============================================================
import { create } from 'zustand';
import { deleteSetting, getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { adjustTimer, reviveOnStartup, type TimerState } from '@/domain/timer';
import { timerExtensions } from '@/platform/extensions';

interface TimerData {
  timer: TimerState | null;
  /** Flash « terminé » affiché par la barre jusqu'à `until` */
  flash: { exerciseId: string; until: number } | null;
}

interface TimerActions {
  hydrate(ctx: RepoCtx, nowMs: number): void;
  start(ctx: RepoCtx, timer: TimerState): void;
  adjust(ctx: RepoCtx, deltaSec: number, nowMs: number): void;
  finish(ctx: RepoCtx, flashUntil: number | null): void;
  clear(ctx: RepoCtx): void;
}

export const TIMER_INITIAL: TimerData = { timer: null, flash: null };

export const useTimerStore = create<TimerData & TimerActions>((set, get) => ({
  ...TIMER_INITIAL,
  hydrate: (ctx, nowMs) => {
    const timer = reviveOnStartup(getSetting(ctx, 'activeRest'), nowMs);
    if (!timer) deleteSetting(ctx, 'activeRest');
    set({ timer, flash: null });
  },
  start: (ctx, timer) => {
    setSetting(ctx, 'activeRest', timer);
    set({ timer, flash: null });
    timerExtensions.started(timer);
  },
  adjust: (ctx, deltaSec, nowMs) => {
    const current = get().timer;
    if (!current) return;
    const timer = adjustTimer(current, deltaSec, nowMs);
    setSetting(ctx, 'activeRest', timer);
    set({ timer });
    timerExtensions.started(timer);
  },
  finish: (ctx, flashUntil) => {
    const current = get().timer;
    deleteSetting(ctx, 'activeRest');
    set({ timer: null, flash: current && flashUntil !== null ? { exerciseId: current.exerciseId, until: flashUntil } : null });
    timerExtensions.stopped();
  },
  clear: (ctx) => {
    deleteSetting(ctx, 'activeRest');
    set({ timer: null, flash: null });
    timerExtensions.stopped();
  },
}));
```

`mobile/src/state/toastStore.ts` :
```ts
// Message bref en bas d'écran (confirmation, erreur d'écriture)
import { create } from 'zustand';

interface ToastState {
  message: string | null;
  /** Incrémenté à chaque message : relance le délai d'affichage */
  seq: number;
  show(message: string): void;
  hide(): void;
}

export const TOAST_INITIAL = { message: null, seq: 0 };

export const useToastStore = create<ToastState>((set) => ({
  ...TOAST_INITIAL,
  show: (message) => set((s) => ({ message, seq: s.seq + 1 })),
  hide: () => set({ message: null }),
}));
```

`mobile/src/features/common/Toast.tsx` :
```tsx
// Toast global — affiché 2,5 s au-dessus de la barre d'onglets
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

const VISIBLE_MS = 2500;

export function Toast() {
  const message = useToastStore((s) => s.message);
  const seq = useToastStore((s) => s.seq);
  const { colors, fonts, radius } = useTheme();

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => useToastStore.getState().hide(), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [message, seq]);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: colors.bgElevated, borderColor: colors.border, borderRadius: radius.md }]}>
        <Text style={{ color: colors.text, fontFamily: fonts.uiMedium }}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 96, alignItems: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1 },
});
```

`mobile/src/app/_layout.tsx` : dans `PrefsGate`, hydrater le minuteur ; dans `ThemedStack`, monter le toast :
```tsx
import { Toast } from '@/features/common/Toast';
import { useTimerStore } from '@/state/timerStore';
// … dans PrefsGate, useEffect :
  useEffect(() => {
    usePrefs.getState().hydrate(ctx);
    useTimerStore.getState().hydrate(ctx, Date.now());
    setHydrated(true);
  }, [ctx]);
// … ThemedStack :
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      <Toast />
    </>
  );
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS, aucune erreur TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/state src/features/common/Toast.tsx src/features/common/__tests__/Toast.test.tsx src/db/repos/settingsRepo.ts src/app/_layout.tsx
git commit -m "feat(mobile): add persisted timer store, toast store and toast component

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Vue Today + actions de l'écran

**Files:**
- Create: `mobile/src/features/today/todayView.ts`, `mobile/src/features/today/actions.ts`, `mobile/src/features/today/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: Tasks 2–10.
- Produces:
  - `type TodayView = { workout: WorkoutRow | null; entries: SetEntryRow[]; track: SetTrack; exercises: EffectiveExercise[]; bonus: EffectiveExercise[]; weights: Record<string, number>; last: Record<string, LastPerformance | null> }` (`weights` et `last` indexés par `weightKey`)
  - `loadTodayView(ctx: RepoCtx, program: StoredProgram, sessionKey: string, date: string): TodayView`
  - `cardWeight(view: TodayView, ex: EffectiveExercise): number | null`
  - `type TodayEnv = { ctx: RepoCtx; nowMs: number; program: StoredProgram; sessionKey: string; date: string | null }` (`date: null` = jour local de `nowMs`)
  - `pressSet(env, view, ex, setIndex): void`
  - `saveSetValues(env, view, ex, setIndex, values: { weight: number | null; reps: number | null }): void`
  - `changeWeight(env, ex, weight: number | null): void`
  - `hasCheckedSets(view, exerciseId: string): boolean`
  - `swapExercise(env, view, ex, name: string | null): void`
  - `moveExercise(env, view, from: number, to: number): void`
  - `finishToday(env, view): void`, `reopenToday(env, view): void`, `resetToday(env, view): void`
  - `finishStale(ctx: RepoCtx, workoutId: string): void`
  - `completeWorkTimer(ctx: RepoCtx, timer: TimerState, nowMs: number, startRest: boolean): void`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/today/__tests__/actions.test.ts` :
```ts
/** @jest-environment node */
import { createProgram, type StoredProgram } from '@/db/repos/programsRepo';
import { getAllWeights, setWeight } from '@/db/repos/weightsRepo';
import { completeWorkout, ensureWorkout, getWorkout, listEntries, upsertSet } from '@/db/repos/workoutsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { haptics } from '@/platform/haptics';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import {
  changeWeight, completeWorkTimer, finishToday, moveExercise, pressSet, reopenToday,
  resetToday, saveSetValues, swapExercise, type TodayEnv,
} from '../actions';
import { cardWeight, loadTodayView } from '../todayView';

const T0 = Date.parse('2026-10-05T10:00:00.000Z');
const input = makeProgramInput({ '1': 'fb' }, {
  fb: makeSession('FULL', [
    makeExercise('presse', 2, { load: '100 à 120 kg', restSec: 120, scheme: '2×8', alternatives: [{ name: 'Fentes', sets: 3, scheme: '3×12', load: '10 kg' }] }),
    makeExercise('gainage', 2, { scheme: '2×45 sec', restSec: 60, load: null }),
    makeExercise('curl', 1, { restSec: 0 }),
  ]),
});

function setup() {
  const ctx = createTestCtx('2026-10-05T10:00:00.000Z');
  const program: StoredProgram = createProgram(ctx, input, 'manual');
  const env = (nowMs = T0): TodayEnv => ({ ctx, nowMs, program, sessionKey: 'fb', date: '2026-10-05' });
  const view = () => loadTodayView(ctx, program, 'fb', '2026-10-05');
  const ex = (id: string) => [...view().exercises, ...view().bonus].find((e) => e.id === id)!;
  return { ctx, program, env, view, ex };
}

describe('actions Today', () => {
  beforeEach(() => { useTimerStore.setState(TIMER_INITIAL); jest.clearAllMocks(); });

  it('consulter n\'écrit rien ; cocher crée la séance, enregistre poids/reps et lance le repos', () => {
    const { ctx, env, view, ex } = setup();
    expect(view().workout).toBeNull();
    pressSet(env(), view(), ex('presse'), 0);
    const v = view();
    expect(v.workout?.status).toBe('in_progress');
    expect(v.entries[0]).toMatchObject({ exerciseId: 'presse', setIndex: 0, done: true, weight: 100, reps: 8, performedName: null });
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', exerciseId: 'presse', setIndex: 0, endAt: T0 + 120_000 });
    expect(haptics.light).toHaveBeenCalledTimes(1);
    expect(listEntries(ctx, v.workout!.id)).toHaveLength(1);
  });

  it('dernière série de l\'exercice : haptique success', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    pressSet(env(), view(), ex('presse'), 1);
    expect(haptics.success).toHaveBeenCalledTimes(1);
  });

  it('décocher la série du repos en cours arrête le repos', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    pressSet(env(), view(), ex('presse'), 0);
    expect(view().track.presse ?? []).toEqual([]);
    expect(useTimerStore.getState().timer).toBeNull();
  });

  it('repos de 0 s : aucun minuteur', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('curl'), 0);
    expect(useTimerStore.getState().timer).toBeNull();
  });

  it('date null : la séance est datée du jour local de nowMs', () => {
    const { ctx, program, env, ex } = setup();
    const v = loadTodayView(ctx, program, 'fb', '2026-10-05');
    pressSet({ ...env(), date: null }, v, ex('presse'), 0);
    expect(useTimerStore.getState().timer).not.toBeNull();
    const created = getWorkout(ctx, useTimerStore.getState().timer!.workoutId);
    expect(created?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('chronométré : tap → chrono d\'effort, second tap → annulation sans cocher', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('gainage'), 0);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'work', exerciseId: 'gainage', setIndex: 0, endAt: T0 + 45_000 });
    expect(view().track.gainage ?? []).toEqual([]);
    pressSet(env(), view(), ex('gainage'), 0);
    expect(useTimerStore.getState().timer).toBeNull();
    expect(view().track.gainage ?? []).toEqual([]);
  });

  it('fin du chrono d\'effort : série cochée puis repos (ou pas de repos si retour tardif)', () => {
    const { ctx, env, view, ex } = setup();
    pressSet(env(), view(), ex('gainage'), 0);
    completeWorkTimer(ctx, useTimerStore.getState().timer!, T0 + 45_000, true);
    expect(view().track.gainage).toEqual([true]);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', exerciseId: 'gainage', endAt: T0 + 45_000 + 60_000 });

    pressSet(env(T0 + 200_000), view(), ex('gainage'), 1);
    completeWorkTimer(ctx, useTimerStore.getState().timer!, T0 + 900_000, false);
    expect(view().track.gainage).toEqual([true, true]);
    expect(useTimerStore.getState().timer).toBeNull();
  });

  it('Review Focus 4 : tap sur un autre exercice pendant un chrono d\'effort → chrono abandonné', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('gainage'), 0);
    pressSet(env(), view(), ex('presse'), 0);
    expect(view().track.gainage ?? []).toEqual([]);
    expect(view().track.presse).toEqual([true]);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', exerciseId: 'presse' });
  });

  it('poids de carte : s\'applique aux séries suivantes, les séries cochées gardent le leur', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    changeWeight(env(), ex('presse'), 105);
    pressSet(env(), view(), ex('presse'), 1);
    expect(view().entries.map((e) => e.weight)).toEqual([100, 105]);
    expect(cardWeight(view(), ex('presse'))).toBe(105);
  });

  it('Review Focus 2 : poids mémorisé dans une autre unité ignoré', () => {
    const { ctx, view, ex } = setup();
    setWeight(ctx, 'presse', 250, 'lbs');
    expect(cardWeight(view(), ex('presse'))).toBe(100);
  });

  it('saisie par série : corrige une série cochée, coche une série non cochée', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    saveSetValues(env(), view(), ex('presse'), 0, { weight: 110, reps: 6 });
    saveSetValues(env(), view(), ex('presse'), 1, { weight: 90, reps: 10 });
    expect(view().entries.map((e) => [e.setIndex, e.done, e.weight, e.reps])).toEqual([[0, true, 110, 6], [1, true, 90, 10]]);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', setIndex: 1 });
  });

  it('échange : poids par variante, séries de l\'exercice remises à zéro', () => {
    const { ctx, env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    swapExercise(env(), view(), ex('presse'), 'Fentes');
    const fentes = ex('presse');
    expect(fentes).toMatchObject({ name: 'Fentes', sets: 3, performedName: 'Fentes' });
    expect(view().track.presse ?? []).toEqual([]);
    expect(cardWeight(view(), fentes)).toBe(10);
    changeWeight(env(), fentes, 12);
    expect(getAllWeights(ctx)).toEqual({ 'presse::Fentes': { weight: 12, unit: 'kg' } });
    pressSet(env(), view(), fentes, 0);
    expect(view().entries[0]).toMatchObject({ performedName: 'Fentes', weight: 12, reps: 12 });
    swapExercise(env(), view(), ex('presse'), null);
    expect(cardWeight(view(), ex('presse'))).toBe(100);
  });

  it('réordonnancement persisté', () => {
    const { env, view } = setup();
    moveExercise(env(), view(), 2, 0);
    expect(view().exercises.map((e) => e.id)).toEqual(['curl', 'presse', 'gainage']);
  });

  it('terminer / rouvrir / réinitialiser', () => {
    const { env, view, ex } = setup();
    pressSet(env(), view(), ex('presse'), 0);
    finishToday(env(T0 + 60_000), view());
    expect(view().workout).toMatchObject({ status: 'completed' });
    expect(useTimerStore.getState().timer).toBeNull();

    pressSet(env(), view(), ex('presse'), 1);
    expect(view().track.presse).toEqual([true]);

    reopenToday(env(), view());
    expect(view().workout?.status).toBe('in_progress');

    resetToday(env(), view());
    expect(view().workout).toBeNull();
    expect(cardWeight(view(), ex('presse'))).toBe(100);
  });

  it('« la dernière fois » vient de la séance terminée précédente', () => {
    const { ctx, program, ex } = setup();
    const old = ensureWorkout(ctx, { programId: program.id, sessionKey: 'fb', date: '2026-09-28' });
    upsertSet(ctx, old.id, 'presse', 0, { done: true, weight: 95, reps: 8 });
    completeWorkout(ctx, old.id);
    const v = loadTodayView(ctx, program, 'fb', '2026-10-05');
    expect(v.last.presse).toEqual({ date: '2026-09-28', sets: 1, reps: 8, maxWeight: 95 });
    expect(v.last['presse::Fentes'] ?? null).toBeNull();
    expect(ex('presse').id).toBe('presse');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/today/__tests__/actions.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/features/today/todayView.ts` :
```ts
// ============================================================
// Vue de la séance affichée — tout ce que l'écran lit en base
// ============================================================
import { lastPerformance, type LastPerformance } from '@/db/repos/historyRepo';
import { getLayout } from '@/db/repos/layoutsRepo';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { getAllWeights } from '@/db/repos/weightsRepo';
import { findWorkout, listEntries, type SetEntryRow, type WorkoutRow } from '@/db/repos/workoutsRepo';
import type { RepoCtx } from '@/db/types';
import { effectiveSession, weightKey, type EffectiveExercise } from '@/domain/exerciseView';
import { trackFromEntries, type SetTrack } from '@/domain/progress';
import { suggestedWeight } from '@/domain/scheme';

export type TodayView = {
  workout: WorkoutRow | null;
  entries: SetEntryRow[];
  track: SetTrack;
  exercises: EffectiveExercise[];
  bonus: EffectiveExercise[];
  /** Poids mémorisés dans l'unité du programme, par clé de poids */
  weights: Record<string, number>;
  /** « La dernière fois », par clé de poids */
  last: Record<string, LastPerformance | null>;
};

export function loadTodayView(ctx: RepoCtx, program: StoredProgram, sessionKey: string, date: string): TodayView {
  const session = program.definition.sessions[sessionKey];
  const layout = getLayout(ctx, program.id, sessionKey);
  const { exercises, bonus } = session ? effectiveSession(session, layout) : { exercises: [], bonus: [] };
  const workout = findWorkout(ctx, { programId: program.id, sessionKey, date });
  const entries = workout ? listEntries(ctx, workout.id) : [];

  const units = program.definition.meta.units;
  const weights: Record<string, number> = {};
  for (const [key, stored] of Object.entries(getAllWeights(ctx))) {
    if (stored.unit === units) weights[key] = stored.weight;
  }

  const last: Record<string, LastPerformance | null> = {};
  for (const ex of [...exercises, ...bonus]) {
    last[weightKey(ex.id, ex.performedName)] = lastPerformance(ctx, ex.id, ex.performedName, date);
  }

  return { workout, entries, track: trackFromEntries(entries), exercises, bonus, weights, last };
}

/** Poids affiché sur la carte : mémorisé, sinon suggestion du programme */
export function cardWeight(view: TodayView, ex: EffectiveExercise): number | null {
  return view.weights[weightKey(ex.id, ex.performedName)] ?? suggestedWeight(ex.load);
}
```

`mobile/src/features/today/actions.ts` :
```ts
// ============================================================
// Actions de l'écran Today — écritures en base + minuteur + haptique.
// L'appelant enchaîne avec bumpData() (et un toast en cas d'erreur).
// ============================================================
import { setOrder, setSwap } from '@/db/repos/layoutsRepo';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { setWeight } from '@/db/repos/weightsRepo';
import {
  clearExerciseSets, completeWorkout, ensureWorkout, reopenWorkout, resetWorkout, upsertSet,
} from '@/db/repos/workoutsRepo';
import { inTransaction } from '@/db/transaction';
import type { RepoCtx } from '@/db/types';
import { weightKey, type EffectiveExercise } from '@/domain/exerciseView';
import { restDurationSec } from '@/domain/progress';
import { moveId } from '@/domain/reorder';
import { localDateKey } from '@/domain/schedule';
import { isTimed, schemeReps, workSeconds } from '@/domain/scheme';
import { FLASH_MS, startTimer, type TimerState } from '@/domain/timer';
import { workoutExtensions } from '@/platform/extensions';
import { haptics } from '@/platform/haptics';
import { useTimerStore } from '@/state/timerStore';
import { cardWeight, type TodayView } from './todayView';

export type TodayEnv = {
  ctx: RepoCtx;
  nowMs: number;
  program: StoredProgram;
  sessionKey: string;
  /** Date de la séance affichée ; null = jour local de nowMs (séance du jour) */
  date: string | null;
};

const timerState = () => useTimerStore.getState();

function workoutKey(env: TodayEnv) {
  return { programId: env.program.id, sessionKey: env.sessionKey, date: env.date ?? localDateKey(new Date(env.nowMs)) };
}

function doneCount(view: TodayView, exerciseId: string): number {
  return (view.track[exerciseId] ?? []).filter(Boolean).length;
}

/** Coche une série (crée la séance si besoin) et lance le repos */
function checkSet(env: TodayEnv, view: TodayView, ex: EffectiveExercise, setIndex: number, values: { weight: number | null; reps: number | null }): void {
  const workout = ensureWorkout(env.ctx, workoutKey(env));
  upsertSet(env.ctx, workout.id, ex.id, setIndex, { done: true, ...values, performedName: ex.performedName });
  if (doneCount(view, ex.id) + 1 >= ex.sets) haptics.success();
  else haptics.light();
  const rest = restDurationSec(ex, env.program.definition.meta);
  if (rest > 0) {
    timerState().start(env.ctx, startTimer({ mode: 'rest', nowMs: env.nowMs, durationSec: rest, workoutId: workout.id, exerciseId: ex.id, setIndex }));
  } else {
    timerState().clear(env.ctx);
  }
}

export function pressSet(env: TodayEnv, view: TodayView, ex: EffectiveExercise, setIndex: number): void {
  if (view.workout?.status === 'completed') return;
  const timer = timerState().timer;
  const isThisSet = timer?.exerciseId === ex.id && timer.setIndex === setIndex;

  // Second tap sur une série chronométrée en attente : annulation (tap accidentel)
  if (timer?.mode === 'work' && isThisSet) {
    timerState().clear(env.ctx);
    return;
  }

  if (view.track[ex.id]?.[setIndex]) {
    if (!view.workout) return;
    upsertSet(env.ctx, view.workout.id, ex.id, setIndex, { done: false });
    if (isThisSet) timerState().clear(env.ctx);
    return;
  }

  const values = { weight: cardWeight(view, ex), reps: schemeReps(ex) };
  const work = isTimed(ex) ? workSeconds(ex) : 0;
  if (work > 0) {
    const workout = ensureWorkout(env.ctx, workoutKey(env));
    timerState().start(env.ctx, startTimer({
      mode: 'work', nowMs: env.nowMs, durationSec: work, workoutId: workout.id, exerciseId: ex.id, setIndex,
      pending: { ...values, performedName: ex.performedName, restSec: restDurationSec(ex, env.program.definition.meta) },
    }));
    haptics.light();
    return;
  }
  checkSet(env, view, ex, setIndex, values);
}

/** Feuille de saisie : corrige une série cochée, ou coche une série non cochée avec ces valeurs */
export function saveSetValues(env: TodayEnv, view: TodayView, ex: EffectiveExercise, setIndex: number, values: { weight: number | null; reps: number | null }): void {
  if (view.workout && view.track[ex.id]?.[setIndex]) {
    upsertSet(env.ctx, view.workout.id, ex.id, setIndex, values);
    return;
  }
  if (view.workout?.status === 'completed') return;
  checkSet(env, view, ex, setIndex, values);
}

/** Fin d'un chrono d'effort : coche la série ; enchaîne le repos si demandé */
export function completeWorkTimer(ctx: RepoCtx, timer: TimerState, nowMs: number, startRest: boolean): void {
  const pending = timer.pending;
  upsertSet(ctx, timer.workoutId, timer.exerciseId, timer.setIndex, {
    done: true, weight: pending?.weight ?? null, reps: pending?.reps ?? null, performedName: pending?.performedName ?? null,
  });
  const rest = pending?.restSec ?? 0;
  if (startRest && rest > 0) {
    timerState().start(ctx, startTimer({ mode: 'rest', nowMs, durationSec: rest, workoutId: timer.workoutId, exerciseId: timer.exerciseId, setIndex: timer.setIndex }));
  } else {
    timerState().finish(ctx, startRest ? nowMs + FLASH_MS : null);
  }
}

export function changeWeight(env: TodayEnv, ex: EffectiveExercise, weight: number | null): void {
  setWeight(env.ctx, weightKey(ex.id, ex.performedName), weight, env.program.definition.meta.units);
}

export function hasCheckedSets(view: TodayView, exerciseId: string): boolean {
  return (view.track[exerciseId] ?? []).some(Boolean);
}

/** Échange (name = null : retour à l'original). L'appelant confirme si des séries sont cochées. */
export function swapExercise(env: TodayEnv, view: TodayView, ex: EffectiveExercise, name: string | null): void {
  inTransaction(env.ctx, (tx) => {
    if (view.workout) clearExerciseSets(tx, view.workout.id, ex.id);
    setSwap(tx, env.program.id, env.sessionKey, ex.id, name);
  });
  if (timerState().timer?.exerciseId === ex.id) timerState().clear(env.ctx);
}

export function moveExercise(env: TodayEnv, view: TodayView, from: number, to: number): void {
  setOrder(env.ctx, env.program.id, env.sessionKey, moveId(view.exercises.map((e) => e.id), from, to));
}

export function finishToday(env: TodayEnv, view: TodayView): void {
  if (!view.workout) return;
  completeWorkout(env.ctx, view.workout.id);
  if (timerState().timer?.workoutId === view.workout.id) timerState().clear(env.ctx);
  haptics.success();
  workoutExtensions.completed(view.workout.id);
}

export function reopenToday(env: TodayEnv, view: TodayView): void {
  if (view.workout) reopenWorkout(env.ctx, view.workout.id);
}

export function resetToday(env: TodayEnv, view: TodayView): void {
  if (!view.workout) return;
  if (timerState().timer?.workoutId === view.workout.id) timerState().clear(env.ctx);
  resetWorkout(env.ctx, view.workout.id);
}

/** Bandeau « séance d'hier » : la clôturer telle quelle */
export function finishStale(ctx: RepoCtx, workoutId: string): void {
  completeWorkout(ctx, workoutId);
  if (timerState().timer?.workoutId === workoutId) timerState().clear(ctx);
  workoutExtensions.completed(workoutId);
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/today/__tests__/actions.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/today/todayView.ts src/features/today/actions.ts src/features/today/__tests__/actions.test.ts
git commit -m "feat(mobile): add Today view loader and screen actions (sets, timer, swaps, finish)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Pilote du minuteur (`driveTimer` + `TimerDriver`)

**Files:**
- Create: `mobile/src/features/today/timerDriver.ts`, `mobile/src/features/today/TimerDriver.tsx`, `mobile/src/features/today/__tests__/timerDriver.test.ts`

**Interfaces:**
- Consumes: `useTimerStore`, `timerPhase`, `shouldAlert`, `FLASH_MS`, `completeWorkTimer`, `haptics`, `sound`.
- Produces:
  - `type DriverMemo = { warnedEndAt: number | null; handledEndAt: number | null }` ; `newDriverMemo(): DriverMemo`
  - `driveTimer(ctx: RepoCtx, nowMs: number, memo: DriverMemo): boolean` (true si des données ont changé → `bumpData()`)
  - `<TimerDriver />` : intervalle de 250 ms tant qu'un minuteur existe + recalcul au retour au premier plan.

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/today/__tests__/timerDriver.test.ts` :
```ts
/** @jest-environment node */
import { createProgram } from '@/db/repos/programsRepo';
import { ensureWorkout, listEntries } from '@/db/repos/workoutsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { startTimer } from '@/domain/timer';
import { haptics } from '@/platform/haptics';
import { sound } from '@/platform/sound';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { driveTimer, newDriverMemo } from '../timerDriver';

const T0 = 10_000_000;

function setup() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, makeProgramInput({ '1': 's' }, { s: makeSession('S', [makeExercise('x', 3)]) }), 'manual');
  const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 's', date: '2026-10-05' });
  return { ctx, w };
}

describe('driveTimer', () => {
  beforeEach(() => { useTimerStore.setState(TIMER_INITIAL); jest.clearAllMocks(); });

  it('avertit une seule fois sous 10 s', () => {
    const { ctx, w } = setup();
    useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs: T0, durationSec: 30, workoutId: w.id, exerciseId: 'x', setIndex: 0 }));
    const memo = newDriverMemo();
    driveTimer(ctx, T0 + 5_000, memo);
    driveTimer(ctx, T0 + 21_000, memo);
    driveTimer(ctx, T0 + 22_000, memo);
    expect(haptics.warning).toHaveBeenCalledTimes(1);
  });

  it('fin de repos au premier plan : son + success + flash', () => {
    const { ctx, w } = setup();
    useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs: T0, durationSec: 30, workoutId: w.id, exerciseId: 'x', setIndex: 0 }));
    driveTimer(ctx, T0 + 30_100, newDriverMemo());
    expect(sound.playRestDone).toHaveBeenCalledTimes(1);
    expect(haptics.success).toHaveBeenCalledTimes(1);
    expect(useTimerStore.getState()).toMatchObject({ timer: null, flash: { exerciseId: 'x', until: T0 + 30_100 + 1500 } });
  });

  it('retour tardif (arrière-plan) : terminé sans son ni flash', () => {
    const { ctx, w } = setup();
    useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs: T0, durationSec: 30, workoutId: w.id, exerciseId: 'x', setIndex: 0 }));
    driveTimer(ctx, T0 + 300_000, newDriverMemo());
    expect(sound.playRestDone).not.toHaveBeenCalled();
    expect(useTimerStore.getState()).toMatchObject({ timer: null, flash: null });
  });

  it('Review Focus 3 : chrono d\'effort expiré au retour → série cochée en silence, pas de repos', () => {
    const { ctx, w } = setup();
    useTimerStore.getState().start(ctx, startTimer({
      mode: 'work', nowMs: T0, durationSec: 45, workoutId: w.id, exerciseId: 'x', setIndex: 2,
      pending: { weight: null, reps: null, performedName: null, restSec: 60 },
    }));
    const changed = driveTimer(ctx, T0 + 600_000, newDriverMemo());
    expect(changed).toBe(true);
    expect(listEntries(ctx, w.id)).toMatchObject([{ exerciseId: 'x', setIndex: 2, done: true }]);
    expect(useTimerStore.getState().timer).toBeNull();
    expect(sound.playRestDone).not.toHaveBeenCalled();
  });

  it('chrono d\'effort au premier plan : série cochée, son, repos enchaîné ; une seule fois', () => {
    const { ctx, w } = setup();
    useTimerStore.getState().start(ctx, startTimer({
      mode: 'work', nowMs: T0, durationSec: 45, workoutId: w.id, exerciseId: 'x', setIndex: 0,
      pending: { weight: null, reps: null, performedName: null, restSec: 60 },
    }));
    const memo = newDriverMemo();
    expect(driveTimer(ctx, T0 + 45_050, memo)).toBe(true);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', endAt: T0 + 45_050 + 60_000 });
    expect(driveTimer(ctx, T0 + 45_300, memo)).toBe(false);
    expect(sound.playRestDone).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/today/__tests__/timerDriver.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/today/timerDriver.ts` :
```ts
// ============================================================
// Pilote du minuteur — une itération : avertissement à 10 s, fin.
// Son et haptique seulement si la fin est observée en direct.
// ============================================================
import type { RepoCtx } from '@/db/types';
import { FLASH_MS, shouldAlert, timerPhase } from '@/domain/timer';
import { haptics } from '@/platform/haptics';
import { sound } from '@/platform/sound';
import { useTimerStore } from '@/state/timerStore';
import { completeWorkTimer } from './actions';

export type DriverMemo = { warnedEndAt: number | null; handledEndAt: number | null };

export function newDriverMemo(): DriverMemo {
  return { warnedEndAt: null, handledEndAt: null };
}

/** Retourne true si des données ont été écrites (l'appelant fait bumpData) */
export function driveTimer(ctx: RepoCtx, nowMs: number, memo: DriverMemo): boolean {
  const store = useTimerStore.getState();
  const timer = store.timer;
  if (!timer) return false;
  const phase = timerPhase(timer, nowMs);

  if (phase === 'critical' && memo.warnedEndAt !== timer.endAt) {
    memo.warnedEndAt = timer.endAt;
    haptics.warning();
  }
  if (phase !== 'done' || memo.handledEndAt === timer.endAt) return false;
  memo.handledEndAt = timer.endAt;

  const alert = shouldAlert(timer, nowMs);
  if (alert) {
    haptics.success();
    sound.playRestDone();
  }
  if (timer.mode === 'work') {
    completeWorkTimer(ctx, timer, nowMs, alert);
    return true;
  }
  store.finish(ctx, alert ? nowMs + FLASH_MS : null);
  return false;
}
```

`mobile/src/features/today/TimerDriver.tsx` :
```tsx
// Fait avancer le minuteur (≈ 4 fois/s) sans re-rendre l'écran ; recalcul au retour au premier plan
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';
import { driveTimer, newDriverMemo } from './timerDriver';

const TICK_MS = 250;

export function TimerDriver() {
  const ctx = useRepoCtx();
  const active = useTimerStore((s) => s.timer !== null);
  const memo = useRef(newDriverMemo());

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (driveTimer(ctx, Date.now(), memo.current)) usePrefs.getState().bumpData();
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') tick(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [active, ctx]);

  return null;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/today && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/today/timerDriver.ts src/features/today/TimerDriver.tsx src/features/today/__tests__/timerDriver.test.ts
git commit -m "feat(mobile): drive rest/work timer with 10s warning and foreground-only alerts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Chaînes i18n M2

**Files:**
- Modify: `mobile/src/i18n/locales/fr.json`, `mobile/src/i18n/locales/en.json`

**Interfaces:**
- Produces: les clés ci-dessous (utilisées par les Tasks 14 à 19).

- [ ] **Step 1: Ajouter les clés** (avant `"coming_soon"`, dans les deux fichiers)

`fr.json` :
```json
"today_last_time": "Dernière fois : %s",
"today_sets_count": "%s séries",
"today_replaces": "remplace %s",
"today_swap_title": "Changer d'exercice",
"today_swap_original": "Exercice du programme",
"today_swap_confirm_title": "Changer d'exercice ?",
"today_swap_confirm_body": "Les séries cochées de cet exercice seront remises à zéro.",
"today_swap_action": "Changer",
"today_set_title": "Série %s",
"today_reps": "Reps",
"today_save": "Enregistrer",
"today_cancel": "Annuler",
"today_reset_confirm_body": "Les séries cochées seront effacées. Les poids et l'organisation sont conservés.",
"today_reset_action": "Réinitialiser",
"today_summary_title": "SÉANCE TERMINÉE",
"today_summary_duration": "Durée",
"today_summary_sets": "Séries",
"today_summary_volume": "Volume",
"today_summary_min": "%s min",
"today_reopen": "Rouvrir la séance",
"today_resume_title": "Séance du %s non terminée",
"today_resume": "Reprendre",
"today_resume_finish": "Terminer",
"today_rules": "Règles",
"today_move_up": "Monter",
"today_move_down": "Descendre",
"today_drag_hint": "Appui long sur le titre pour déplacer",
"today_set_hint": "Appui long pour saisir poids et reps",
"timer_skip": "Passer",
"timer_minus": "−15 s",
"timer_plus": "+15 s",
"error_not_saved": "Action non enregistrée",
"error_tab": "Une erreur est survenue.",
"error_reload_tab": "Recharger l'onglet",
"profile_keep_awake": "Écran allumé pendant la séance",
"profile_keep_awake_meta": "Empêche la mise en veille tant qu'une séance est en cours",
```

`en.json` :
```json
"today_last_time": "Last time: %s",
"today_sets_count": "%s sets",
"today_replaces": "replaces %s",
"today_swap_title": "Swap exercise",
"today_swap_original": "Program exercise",
"today_swap_confirm_title": "Swap exercise?",
"today_swap_confirm_body": "Checked sets for this exercise will be cleared.",
"today_swap_action": "Swap",
"today_set_title": "Set %s",
"today_reps": "Reps",
"today_save": "Save",
"today_cancel": "Cancel",
"today_reset_confirm_body": "Checked sets will be cleared. Weights and layout are kept.",
"today_reset_action": "Reset",
"today_summary_title": "WORKOUT DONE",
"today_summary_duration": "Duration",
"today_summary_sets": "Sets",
"today_summary_volume": "Volume",
"today_summary_min": "%s min",
"today_reopen": "Reopen workout",
"today_resume_title": "Unfinished workout from %s",
"today_resume": "Resume",
"today_resume_finish": "Finish",
"today_rules": "Rules",
"today_move_up": "Move up",
"today_move_down": "Move down",
"today_drag_hint": "Long-press the title to move",
"today_set_hint": "Long-press to enter weight and reps",
"timer_skip": "Skip",
"timer_minus": "−15 s",
"timer_plus": "+15 s",
"error_not_saved": "Action not saved",
"error_tab": "Something went wrong.",
"error_reload_tab": "Reload tab",
"profile_keep_awake": "Keep screen on during workout",
"profile_keep_awake_meta": "Prevents sleep while a workout is in progress",
```

- [ ] **Step 2: Vérifier**

Run: `npx jest src/i18n && npx tsc --noEmit`
Expected: PASS (le test de parité des clés fr/en passe).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales
git commit -m "feat(mobile): add M2 Today strings (fr/en)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Carte d'exercice (`SetCircle`, `WeightStepper`, `LastTimeLine`, `ExerciseCard`)

**Files:**
- Create: `mobile/src/features/today/SetCircle.tsx`, `mobile/src/features/today/WeightStepper.tsx`, `mobile/src/features/today/LastTimeLine.tsx`, `mobile/src/features/today/ExerciseCard.tsx`, `mobile/src/features/today/__tests__/ExerciseCard.test.tsx`

**Interfaces:**
- Consumes: `EffectiveExercise`, `formatScheme`, `formatWeight`, `parseWeightInput`, `weightStep`, `LastPerformance`, `Units`, `accentColors`, `TOUCH_MIN`.
- Produces:
  - `<SetCircle index: number; done: boolean; pending: boolean; disabled: boolean; fill: string; onPress(): void; onLongPress(): void />` (testID `set-<exerciseId>-<index>` fourni par la carte)
  - `<WeightStepper value: number | null; units: Units; onChange(value: number | null): void; testID?: string />`
  - `<LastTimeLine last: LastPerformance | null; units: Units />`
  - `<ExerciseCard exercise: EffectiveExercise; units: Units; accent: string | null | undefined; done: boolean[]; weight: number | null; restSec: number; last: LastPerformance | null; locked: boolean; pendingSet: number | null; onPressSet(i: number): void; onLongPressSet(i: number): void; onChangeWeight(v: number | null): void; onSwap?: () => void; onPressRest(): void; header?: (title: ReactElement) => ReactElement />` — `header` permet à la liste de rendre le titre « saisissable » pour le glisser-déposer.

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/today/__tests__/ExerciseCard.test.tsx` :
```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { effectiveExercise } from '@/domain/exerciseView';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '@/domain/__fixtures__/builders';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ExerciseCard } from '../ExerciseCard';

const program = parseOrThrow(makeProgramInput({ '1': 's' }, {
  s: makeSession('S', [makeExercise('presse', 3, { name: 'Presse', scheme: '3×8', load: '100 à 120 kg', cue: 'Dos plaqué', alternatives: ['Squat'] })]),
}));
const base = program.sessions.s.exercises[0];

function renderCard(over: Partial<Parameters<typeof ExerciseCard>[0]> = {}) {
  const props = {
    exercise: effectiveExercise(base, null), units: 'kg' as const, accent: 'gold', done: [true, false, false],
    weight: 100, restSec: 90, last: { date: '2026-09-28', sets: 3, reps: 8, maxWeight: 95 }, locked: false, pendingSet: null,
    onPressSet: jest.fn(), onLongPressSet: jest.fn(), onChangeWeight: jest.fn(), onSwap: jest.fn(), onPressRest: jest.fn(),
    ...over,
  };
  return { props, ...renderWithProviders(<ExerciseCard {...props} />) };
}

describe('ExerciseCard', () => {
  it('affiche nom, schéma, consigne, dernière fois, repos', async () => {
    await renderCard();
    expect(screen.getByText('Presse')).toBeTruthy();
    expect(screen.getByText('3 × 8')).toBeTruthy();
    expect(screen.getByText('Dos plaqué')).toBeTruthy();
    expect(screen.getByText('Dernière fois : 3 × 8 · 95 kg')).toBeTruthy();
    expect(screen.getByText('REPOS 90S')).toBeTruthy();
  });

  it('tap et appui long sur un cercle', async () => {
    const { props } = await renderCard();
    await fireEvent.press(screen.getByTestId('set-presse-1'));
    expect(props.onPressSet).toHaveBeenCalledWith(1);
    await fireEvent(screen.getByTestId('set-presse-2'), 'longPress');
    expect(props.onLongPressSet).toHaveBeenCalledWith(2);
  });

  it('cercles désactivés quand la séance est terminée (appui long toujours possible)', async () => {
    const { props } = await renderCard({ locked: true });
    await fireEvent.press(screen.getByTestId('set-presse-1'));
    expect(props.onPressSet).not.toHaveBeenCalled();
  });

  it('carte complète marquée', async () => {
    await renderCard({ done: [true, true, true] });
    expect(screen.getByTestId('card-presse-complete')).toBeTruthy();
  });

  it('stepper : +/− par pas de 2,5 kg, saisie libre avec virgule, vide = effacé', async () => {
    const { props } = await renderCard();
    await fireEvent.press(screen.getByLabelText('+ 2.5 kg'));
    expect(props.onChangeWeight).toHaveBeenLastCalledWith(102.5);
    await fireEvent.press(screen.getByLabelText('− 2.5 kg'));
    expect(props.onChangeWeight).toHaveBeenLastCalledWith(97.5);
    const input = screen.getByTestId('weight-presse');
    await fireEvent.changeText(input, '102,5');
    await fireEvent(input, 'blur');
    expect(props.onChangeWeight).toHaveBeenLastCalledWith(102.5);
    await fireEvent.changeText(input, '');
    await fireEvent(input, 'blur');
    expect(props.onChangeWeight).toHaveBeenLastCalledWith(null);
  });

  it('échange : bouton présent si alternatives, libellé « remplace » si échangé', async () => {
    const { props } = await renderCard({ exercise: effectiveExercise(base, 'Squat') });
    expect(screen.getByText('Squat')).toBeTruthy();
    expect(screen.getByText('remplace Presse')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Changer d'exercice"));
    expect(props.onSwap).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/today/__tests__/ExerciseCard.test.tsx`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/features/today/SetCircle.tsx` :
```tsx
// Cercle de série — 44 pt, rempli à la couleur d'accent quand coché, bordé en attente
import { Pressable, StyleSheet, Text } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  index: number;
  done: boolean;
  pending: boolean;
  disabled: boolean;
  fill: string;
  testID?: string;
  onPress(): void;
  onLongPress(): void;
}

export function SetCircle({ index, done, pending, disabled, fill, testID, onPress, onLongPress }: Props) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled }}
      accessibilityLabel={t('today_set_title', index + 1)}
      accessibilityHint={t('today_set_hint')}
      onPress={disabled ? undefined : onPress}
      onLongPress={onLongPress}
      style={[
        styles.circle,
        {
          backgroundColor: done ? fill : colors.bgCardSoft,
          borderColor: pending ? fill : done ? fill : colors.border,
          borderWidth: pending ? 3 : 1.5,
        },
      ]}
    >
      <Text style={{ color: done ? '#0a0a0a' : colors.text, fontFamily: fonts.uiBold }}>{index + 1}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: TOUCH_MIN / 2, alignItems: 'center', justifyContent: 'center' },
});
```

`mobile/src/features/today/WeightStepper.tsx` :
```tsx
// Sélecteur de poids [−][valeur][+] — saisie libre validée à la sortie du champ
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Units } from '@/domain/program';
import { formatWeight, parseWeightInput, weightStep } from '@/domain/scheme';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  value: number | null;
  units: Units;
  testID?: string;
  onChange(value: number | null): void;
}

export function WeightStepper({ value, units, testID, onChange }: Props) {
  const { colors, fonts, radius } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const step = weightStep(units);
  const shown = draft ?? (value !== null ? formatWeight(value) : '');

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    onChange(parseWeightInput(draft));
  };
  const bump = (delta: number) => {
    const next = Math.max(0, (value ?? 0) + delta);
    onChange(next > 0 ? next : null);
  };

  const btn = [styles.btn, { backgroundColor: colors.bgCardSoft, borderRadius: radius.sm }];
  const btnText = { color: colors.text, fontFamily: fonts.uiBold, fontSize: 18 };
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`− ${step} ${units}`} onPress={() => bump(-step)} style={btn}>
        <Text style={btnText}>−</Text>
      </Pressable>
      <TextInput
        testID={testID}
        value={shown}
        placeholder="—"
        placeholderTextColor={colors.textDim}
        keyboardType="decimal-pad"
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        style={[styles.input, { color: colors.text, fontFamily: fonts.uiBold, borderColor: colors.border, borderRadius: radius.sm }]}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={`+ ${step} ${units}`} onPress={() => bump(step)} style={btn}>
        <Text style={btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  input: { minWidth: 72, height: TOUCH_MIN, borderWidth: 1, textAlign: 'center', fontSize: 16 },
});
```

`mobile/src/features/today/LastTimeLine.tsx` :
```tsx
// « Dernière fois : 4 × 8 · 100 kg »
import { Text } from 'react-native';
import type { LastPerformance } from '@/db/repos/historyRepo';
import type { Units } from '@/domain/program';
import { formatWeight } from '@/domain/scheme';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function LastTimeLine({ last, units }: { last: LastPerformance | null; units: Units }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  if (!last) return null;
  const sets = last.reps !== null ? `${last.sets} × ${last.reps}` : t('today_sets_count', last.sets);
  const weight = last.maxWeight !== null ? ` · ${formatWeight(last.maxWeight)} ${units}` : '';
  return <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t('today_last_time', `${sets}${weight}`)}</Text>;
}
```

`mobile/src/features/today/ExerciseCard.tsx` :
```tsx
// ============================================================
// Carte d'exercice — nom, schéma, consigne, dernière fois, poids,
// cercles de séries, ligne de repos, échange. Verte quand complète.
// ============================================================
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LastPerformance } from '@/db/repos/historyRepo';
import type { EffectiveExercise } from '@/domain/exerciseView';
import type { Units } from '@/domain/program';
import { formatScheme } from '@/domain/scheme';
import { useI18n } from '@/i18n/I18nProvider';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { LastTimeLine } from './LastTimeLine';
import { SetCircle } from './SetCircle';
import { WeightStepper } from './WeightStepper';

export interface ExerciseCardProps {
  exercise: EffectiveExercise;
  units: Units;
  accent: string | null | undefined;
  done: boolean[];
  weight: number | null;
  restSec: number;
  last: LastPerformance | null;
  locked: boolean;
  pendingSet: number | null;
  onPressSet(index: number): void;
  onLongPressSet(index: number): void;
  onChangeWeight(value: number | null): void;
  onSwap?: () => void;
  onPressRest(): void;
  /** Enveloppe du titre (poignée de glisser-déposer) */
  header?: (title: ReactElement) => ReactElement;
}

export function ExerciseCard(p: ExerciseCardProps) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const ex = p.exercise;
  const fill = accentColors(colors, p.accent).fill;
  const complete = Array.from({ length: ex.sets }, (_, i) => p.done[i] === true).every(Boolean);

  const title = (
    <View style={styles.header}>
      <View style={styles.titleCol}>
        <Text style={[styles.name, { color: colors.text, fontFamily: fonts.uiBold }]}>{ex.name}</Text>
        {ex.performedName ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t('today_replaces', ex.originalName)}</Text> : null}
      </View>
      <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{formatScheme(ex)}</Text>
    </View>
  );

  return (
    <View
      testID={complete ? `card-${ex.id}-complete` : `card-${ex.id}`}
      style={[styles.card, { backgroundColor: complete ? colors.greenDone : colors.bgCard, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}
    >
      <View style={styles.headerRow}>
        <View style={styles.flex}>{p.header ? p.header(title) : title}</View>
        {ex.alternatives.length > 0 && p.onSwap ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('today_swap_title')} onPress={p.onSwap} style={styles.iconBtn}>
            <Ionicons name="swap-horizontal" size={20} color={colors.textDim} />
          </Pressable>
        ) : null}
      </View>
      {ex.cue ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontStyle: 'italic' }}>{ex.cue}</Text> : null}
      <LastTimeLine last={p.last} units={p.units} />
      <View style={styles.weightRow}>
        <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('today_weight').toUpperCase()}</Text>
        <WeightStepper testID={`weight-${ex.id}`} value={p.weight} units={p.units} onChange={p.onChangeWeight} />
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{p.units}</Text>
      </View>
      {ex.load ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{ex.load}</Text> : null}
      <View style={styles.circles}>
        {Array.from({ length: ex.sets }, (_, i) => (
          <SetCircle
            key={i}
            testID={`set-${ex.id}-${i}`}
            index={i}
            done={p.done[i] === true}
            pending={p.pendingSet === i}
            disabled={p.locked}
            fill={fill}
            onPress={() => p.onPressSet(i)}
            onLongPress={() => p.onLongPressSet(i)}
          />
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={p.onPressRest} style={styles.restRow}>
        <Ionicons name="timer-outline" size={14} color={colors.textDim} />
        <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 1 }}>{`${t('timer_rest')} ${p.restSec}S`}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  titleCol: { flex: 1, gap: 2 },
  name: { fontSize: 17 },
  iconBtn: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginRight: -10 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  circles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: TOUCH_MIN },
});
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/today/__tests__/ExerciseCard.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/today/SetCircle.tsx src/features/today/WeightStepper.tsx src/features/today/LastTimeLine.tsx src/features/today/ExerciseCard.tsx src/features/today/__tests__/ExerciseCard.test.tsx
git commit -m "feat(mobile): add exercise card with set circles, weight stepper and last time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Feuilles `SetEditSheet` et `SwapSheet`

**Files:**
- Create: `mobile/src/features/today/BottomSheet.tsx`, `mobile/src/features/today/SetEditSheet.tsx`, `mobile/src/features/today/SwapSheet.tsx`, `mobile/src/features/today/__tests__/sheets.test.tsx`

**Interfaces:**
- Consumes: `EffectiveExercise`, `alternativeName`, `parseWeightInput`, `formatWeight`.
- Produces:
  - `<BottomSheet visible: boolean; title: string; onClose(): void; children />`
  - `<SetEditSheet visible: boolean; setIndex: number; units: Units; initialWeight: number | null; initialReps: number | null; onSave(values: { weight: number | null; reps: number | null }): void; onClose(): void />`
  - `<SwapSheet visible: boolean; exercise: EffectiveExercise | null; onSelect(name: string | null): void; onClose(): void />`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/today/__tests__/sheets.test.tsx` :
```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { effectiveExercise } from '@/domain/exerciseView';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '@/domain/__fixtures__/builders';
import { renderWithProviders } from '@/test/renderWithProviders';
import { SetEditSheet } from '../SetEditSheet';
import { SwapSheet } from '../SwapSheet';

describe('SetEditSheet', () => {
  it('pré-remplit, accepte la virgule, enregistre', async () => {
    const onSave = jest.fn();
    await renderWithProviders(<SetEditSheet visible setIndex={1} units="kg" initialWeight={100} initialReps={8} onSave={onSave} onClose={jest.fn()} />);
    expect(screen.getByText('Série 2')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('set-edit-weight'), '102,5');
    await fireEvent.changeText(screen.getByTestId('set-edit-reps'), '6');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledWith({ weight: 102.5, reps: 6 });
  });

  it('champs vides → null', async () => {
    const onSave = jest.fn();
    await renderWithProviders(<SetEditSheet visible setIndex={0} units="kg" initialWeight={null} initialReps={null} onSave={onSave} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledWith({ weight: null, reps: null });
  });
});

describe('SwapSheet', () => {
  const ex = parseOrThrow(makeProgramInput({}, {
    s: makeSession('S', [makeExercise('presse', 3, { name: 'Presse', alternatives: ['Squat', { name: 'Fentes', sets: 3 }] })]),
  })).sessions.s.exercises[0];

  it('liste l\'original et les alternatives ; choisir l\'original renvoie null', async () => {
    const onSelect = jest.fn();
    await renderWithProviders(<SwapSheet visible exercise={effectiveExercise(ex, 'Squat')} onSelect={onSelect} onClose={jest.fn()} />);
    expect(screen.getByText('Fentes')).toBeTruthy();
    await fireEvent.press(screen.getByText('Fentes'));
    expect(onSelect).toHaveBeenLastCalledWith('Fentes');
    await fireEvent.press(screen.getByText('Presse'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/today/__tests__/sheets.test.tsx`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/features/today/BottomSheet.tsx` :
```tsx
// Feuille modale en bas d'écran (Modal RN : natif et web)
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  visible: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
}

export function BottomSheet({ visible, title, onClose, children }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onClose} style={[styles.flex, styles.backdrop]} />
        <View style={[styles.sheet, { backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md, paddingBottom: spacing.md + insets.bottom }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 24 }}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { gap: 12 },
});
```

`mobile/src/features/today/SetEditSheet.tsx` :
```tsx
// Saisie poids / reps d'une série (appui long sur un cercle)
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Units } from '@/domain/program';
import { formatWeight, parseWeightInput } from '@/domain/scheme';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { BottomSheet } from './BottomSheet';

interface Props {
  visible: boolean;
  setIndex: number;
  units: Units;
  initialWeight: number | null;
  initialReps: number | null;
  onSave(values: { weight: number | null; reps: number | null }): void;
  onClose(): void;
}

function parseReps(text: string): number | null {
  const n = parseInt(text.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function SetEditSheet({ visible, setIndex, units, initialWeight, initialReps, onSave, onClose }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const [weight, setWeight] = useState(initialWeight !== null ? formatWeight(initialWeight) : '');
  const [reps, setReps] = useState(initialReps !== null ? String(initialReps) : '');
  const field = [styles.input, { color: colors.text, fontFamily: fonts.uiBold, borderColor: colors.border, borderRadius: radius.sm }];
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };

  return (
    <BottomSheet visible={visible} title={t('today_set_title', setIndex + 1)} onClose={onClose}>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={label}>{`${t('today_weight').toUpperCase()} (${units})`}</Text>
          <TextInput testID="set-edit-weight" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.textDim} style={field} />
        </View>
        <View style={styles.col}>
          <Text style={label}>{t('today_reps').toUpperCase()}</Text>
          <TextInput testID="set-edit-reps" value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="—" placeholderTextColor={colors.textDim} style={field} />
        </View>
      </View>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onClose} style={[styles.btn, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('today_cancel')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onSave({ weight: parseWeightInput(weight), reps: parseReps(reps) })}
          style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}
        >
          <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('today_save')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1, gap: 6 },
  input: { height: TOUCH_MIN + 4, borderWidth: 1, textAlign: 'center', fontSize: 18 },
  btn: { flex: 1, minHeight: TOUCH_MIN + 4, alignItems: 'center', justifyContent: 'center' },
});
```
Le parent monte la feuille avec une `key` qui change à chaque ouverture (`key={`${exerciseId}-${setIndex}`}`) pour réinitialiser les champs.

`mobile/src/features/today/SwapSheet.tsx` :
```tsx
// Choix de la variante : exercice du programme ou une de ses alternatives
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { EffectiveExercise } from '@/domain/exerciseView';
import { alternativeName } from '@/domain/program';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { BottomSheet } from './BottomSheet';

interface Props {
  visible: boolean;
  exercise: EffectiveExercise | null;
  onSelect(name: string | null): void;
  onClose(): void;
}

export function SwapSheet({ visible, exercise, onSelect, onClose }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  if (!exercise) return null;
  const options: { name: string | null; label: string; meta?: string }[] = [
    { name: null, label: exercise.originalName, meta: t('today_swap_original') },
    ...exercise.alternatives.map((a) => ({ name: alternativeName(a), label: alternativeName(a) })),
  ];

  return (
    <BottomSheet visible={visible} title={t('today_swap_title')} onClose={onClose}>
      {options.map((o) => {
        const current = o.name === exercise.performedName;
        return (
          <Pressable
            key={o.name ?? '__original__'}
            accessibilityRole="button"
            accessibilityState={{ selected: current }}
            onPress={() => onSelect(o.name)}
            style={[styles.option, { backgroundColor: colors.bgCard, borderColor: current ? colors.borderActive : colors.border, borderRadius: radius.md }]}
          >
            <Text style={[styles.flex, { color: colors.text, fontFamily: fonts.uiBold }]}>{o.label}</Text>
            {o.meta ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{o.meta}</Text> : null}
            {current ? <Ionicons name="checkmark" size={18} color={colors.gold} /> : null}
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/today/__tests__/sheets.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/today/BottomSheet.tsx src/features/today/SetEditSheet.tsx src/features/today/SwapSheet.tsx src/features/today/__tests__/sheets.test.tsx
git commit -m "feat(mobile): add per-set edit sheet and exercise swap sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: `ReorderableList` (glisser-déposer + accessibilité)

**Files:**
- Create: `mobile/src/features/today/ReorderableList.tsx`, `mobile/src/features/today/__tests__/ReorderableList.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface ReorderableListProps<T> {
    items: T[];
    keyOf(item: T): string;
    onMove(from: number, to: number): void;
    onDragStateChange?(dragging: boolean): void;
    onItemLayout?(key: string, y: number): void;
    moveUpLabel: string;
    moveDownLabel: string;
    renderItem(item: T, index: number, handle: (title: ReactElement) => ReactElement): ReactElement;
  }
  ```
  Le glisser commence par un appui long (300 ms) sur la poignée (le titre de la carte). Les autres cartes se décalent pendant le glisser. Actions d'accessibilité `moveUp` / `moveDown` sur chaque élément.

Le geste lui-même n'est pas simulable sous Jest (mocks Gesture Handler) : les tests couvrent le rendu, l'ordre et les actions d'accessibilité ; le geste au doigt est vérifié sur appareil (Task 19).

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/today/__tests__/ReorderableList.test.tsx` :
```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ReorderableList } from '../ReorderableList';

async function renderList(onMove = jest.fn()) {
  await renderWithProviders(
    <ReorderableList
      items={['a', 'b', 'c']}
      keyOf={(s) => s}
      onMove={onMove}
      moveUpLabel="Monter"
      moveDownLabel="Descendre"
      renderItem={(s, i, handle) => handle(<Text>{`${i}:${s}`}</Text>)}
    />,
  );
  return onMove;
}

describe('ReorderableList', () => {
  it('rend les éléments dans l\'ordre', async () => {
    await renderList();
    expect(screen.getByText('0:a')).toBeTruthy();
    expect(screen.getByText('2:c')).toBeTruthy();
  });

  it('actions d\'accessibilité monter / descendre, bornées', async () => {
    const onMove = await renderList();
    await fireEvent(screen.getByTestId('reorder-b'), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    expect(onMove).toHaveBeenLastCalledWith(1, 0);
    await fireEvent(screen.getByTestId('reorder-b'), 'accessibilityAction', { nativeEvent: { actionName: 'moveDown' } });
    expect(onMove).toHaveBeenLastCalledWith(1, 2);
    onMove.mockClear();
    await fireEvent(screen.getByTestId('reorder-a'), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    expect(onMove).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/today/__tests__/ReorderableList.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/today/ReorderableList.tsx` :
```tsx
// ============================================================
// Liste réordonnable — appui long sur la poignée puis glisser.
// Hauteurs mesurées par onLayout ; décalage des voisins animé.
// Repli accessible : actions « Monter » / « Descendre ».
// ============================================================
import type { ReactElement } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';

const LONG_PRESS_MS = 300;
const GAP = 12;

export interface ReorderableListProps<T> {
  items: T[];
  keyOf(item: T): string;
  onMove(from: number, to: number): void;
  onDragStateChange?(dragging: boolean): void;
  onItemLayout?(key: string, y: number): void;
  moveUpLabel: string;
  moveDownLabel: string;
  renderItem(item: T, index: number, handle: (title: ReactElement) => ReactElement): ReactElement;
}

/** Index cible : position du centre de l'élément glissé parmi les hauteurs cumulées */
function targetIndex(heights: number[], from: number, dy: number): number {
  'worklet';
  let top = 0;
  for (let i = 0; i < from; i++) top += heights[i] + GAP;
  const center = top + dy + heights[from] / 2;
  let acc = 0;
  for (let i = 0; i < heights.length; i++) {
    const mid = acc + heights[i] / 2;
    if (center < mid) return i <= from ? i : i - 1;
    acc += heights[i] + GAP;
  }
  return heights.length - 1;
}

interface ItemProps {
  index: number;
  count: number;
  itemKey: string;
  heights: SharedValue<number[]>;
  dragIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  props: ReorderableListProps<unknown>;
  item: unknown;
}

function Item({ index, count, itemKey, heights, dragIndex, hoverIndex, dragY, props, item }: ItemProps) {
  const style = useAnimatedStyle(() => {
    const from = dragIndex.value;
    if (from === index) return { transform: [{ translateY: dragY.value }, { scale: 1.02 }], zIndex: 10 };
    if (from < 0) return { transform: [{ translateY: withTiming(0, { duration: 150 }) }], zIndex: 0 };
    const h = (heights.value[from] ?? 0) + GAP;
    const to = hoverIndex.value;
    let shift = 0;
    if (from < index && index <= to) shift = -h;
    else if (to <= index && index < from) shift = h;
    return { transform: [{ translateY: withTiming(shift, { duration: 150 }) }], zIndex: 0 };
  });

  const finish = (from: number, to: number) => {
    props.onDragStateChange?.(false);
    if (from !== to) props.onMove(from, to);
  };
  const begin = () => props.onDragStateChange?.(true);

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      dragIndex.value = index;
      hoverIndex.value = index;
      dragY.value = 0;
      runOnJS(begin)();
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      hoverIndex.value = targetIndex(heights.value, index, e.translationY);
    })
    .onEnd(() => {
      const to = hoverIndex.value;
      dragIndex.value = -1;
      dragY.value = 0;
      runOnJS(finish)(index, to);
    })
    .onFinalize(() => {
      if (dragIndex.value === index) {
        dragIndex.value = -1;
        dragY.value = 0;
        runOnJS(finish)(index, index);
      }
    });

  const onAction = (e: AccessibilityActionEvent) => {
    const to = e.nativeEvent.actionName === 'moveUp' ? index - 1 : index + 1;
    if (to >= 0 && to < count) props.onMove(index, to);
  };

  const handle = (title: ReactElement) => (
    <GestureDetector gesture={pan}>
      <View collapsable={false}>{title}</View>
    </GestureDetector>
  );

  return (
    <Animated.View
      testID={`reorder-${itemKey}`}
      style={style}
      accessible={false}
      accessibilityActions={[{ name: 'moveUp', label: props.moveUpLabel }, { name: 'moveDown', label: props.moveDownLabel }]}
      onAccessibilityAction={onAction}
      onLayout={(e) => {
        const next = [...heights.value];
        next[index] = e.nativeEvent.layout.height;
        heights.value = next;
        props.onItemLayout?.(itemKey, e.nativeEvent.layout.y);
      }}
    >
      {props.renderItem(item, index, handle)}
    </Animated.View>
  );
}

export function ReorderableList<T>(props: ReorderableListProps<T>) {
  const heights = useSharedValue<number[]>([]);
  const dragIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);
  return (
    <View style={styles.list}>
      {props.items.map((item, index) => (
        <Item
          key={props.keyOf(item)}
          index={index}
          count={props.items.length}
          itemKey={props.keyOf(item)}
          heights={heights}
          dragIndex={dragIndex}
          hoverIndex={hoverIndex}
          dragY={dragY}
          props={props as ReorderableListProps<unknown>}
          item={item}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: GAP } });
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/today/__tests__/ReorderableList.test.tsx && npx tsc --noEmit`
Expected: PASS. Si `runOnJS` est signalé comme déprécié par TypeScript, le remplacer par `scheduleOnRN` importé de `react-native-worklets` (même signature : `scheduleOnRN(fn, ...args)`).

- [ ] **Step 5: Commit**

```bash
git add src/features/today/ReorderableList.tsx src/features/today/__tests__/ReorderableList.test.tsx
git commit -m "feat(mobile): add long-press drag-and-drop list with accessible move actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Blocs de séance (progression, note, échauffement, cardio, bonus, règles, conseils, repos)

**Files:**
- Create: `mobile/src/features/today/ProgressBar.tsx`, `SessionNote.tsx`, `WarmupBlock.tsx`, `CardioBlock.tsx`, `BonusBlock.tsx`, `RulesBlock.tsx`, `TipsList.tsx`, `RestDayScreen.tsx` (dans `mobile/src/features/today/`), `mobile/src/features/today/__tests__/blocks.test.tsx`

**Interfaces:**
- Produces:
  - `<ProgressBar done: number; total: number; accent: string | null | undefined />`
  - `<SessionNote text: string />`
  - `<WarmupBlock items: string[] />`
  - `<CardioBlock label: string; detail: string | null | undefined />`
  - `<BonusBlock title: string | null | undefined; children />` (section titrée, les cartes sont passées en enfants)
  - `<RulesBlock rules: string[] />` (repliable)
  - `<TipsList tips: { title: string; body: string }[]; accent: string | null | undefined />`
  - `<RestDayScreen />`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/today/__tests__/blocks.test.tsx` :
```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { BonusBlock } from '../BonusBlock';
import { CardioBlock } from '../CardioBlock';
import { ProgressBar } from '../ProgressBar';
import { RestDayScreen } from '../RestDayScreen';
import { RulesBlock } from '../RulesBlock';
import { TipsList } from '../TipsList';
import { WarmupBlock } from '../WarmupBlock';

describe('blocs Today', () => {
  it('ProgressBar : libellé et compteur', async () => {
    await renderWithProviders(<ProgressBar done={3} total={10} accent="gold" />);
    expect(screen.getByText('SÉRIES FAITES')).toBeTruthy();
    expect(screen.getByText('3 / 10')).toBeTruthy();
  });

  it('échauffement, cardio, bonus', async () => {
    await renderWithProviders(
      <>
        <WarmupBlock items={['Vélo 5 min']} />
        <CardioBlock label="Marche inclinée" detail="15 min" />
        <BonusBlock title={null}><Text>carte</Text></BonusBlock>
      </>,
    );
    expect(screen.getByText('ÉCHAUFFEMENT')).toBeTruthy();
    expect(screen.getByText('Vélo 5 min')).toBeTruthy();
    expect(screen.getByText('Marche inclinée')).toBeTruthy();
    expect(screen.getByText('BONUS')).toBeTruthy();
    expect(screen.getByText('carte')).toBeTruthy();
  });

  it('règles repliées par défaut', async () => {
    await renderWithProviders(<RulesBlock rules={['Garder 1 à 2 reps en réserve']} />);
    expect(screen.queryByText('Garder 1 à 2 reps en réserve')).toBeNull();
    await fireEvent.press(screen.getByText('RÈGLES'));
    expect(screen.getByText('Garder 1 à 2 reps en réserve')).toBeTruthy();
  });

  it('conseils et repos implicite', async () => {
    await renderWithProviders(
      <>
        <TipsList tips={[{ title: 'Cible', body: 'RPE 6-7' }]} accent="blue" />
        <RestDayScreen />
      </>,
    );
    expect(screen.getByText('Cible')).toBeTruthy();
    expect(screen.getByText('RPE 6-7')).toBeTruthy();
    expect(screen.getByTestId('rest-day')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/today/__tests__/blocks.test.tsx`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`ProgressBar.tsx` :
```tsx
// Compteur « SÉRIES FAITES X / N » + barre (N = séries des exercices principaux)
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';

export function ProgressBar({ done, total, accent }: { done: number; total: number; accent: string | null | undefined }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const ratio = total === 0 ? 0 : Math.min(1, done / total);
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('today_sets_done').toUpperCase()}</Text>
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{`${done} / ${total}`}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.bgCardSoft, borderRadius: radius.full }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: accentColors(colors, accent).fill, borderRadius: radius.full }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 6, overflow: 'hidden' },
  fill: { height: 6 },
});
```

`SessionNote.tsx` :
```tsx
// Note de séance affichée en tête de liste
import { Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function SessionNote({ text }: { text: string }) {
  const { colors, fonts, radius, spacing } = useTheme();
  return (
    <View style={{ backgroundColor: colors.bgCardSoft, borderRadius: radius.md, padding: spacing.md }}>
      <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{text}</Text>
    </View>
  );
}
```

`WarmupBlock.tsx` :
```tsx
// Échauffement : affiché, non coché
import { Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function WarmupBlock({ items }: { items: string[] }) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 6, backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }}>
      <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('today_warmup').toUpperCase()}</Text>
      {items.map((item, i) => (
        <Text key={i} style={{ color: colors.text, fontFamily: fonts.ui }}>{`· ${item}`}</Text>
      ))}
    </View>
  );
}
```

`CardioBlock.tsx` :
```tsx
// Cardio de fin de séance
import { Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function CardioBlock({ label, detail }: { label: string; detail: string | null | undefined }) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: 4, backgroundColor: colors.bgCard, borderColor: colors.blue, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }}>
      <Text style={{ color: colors.blue, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('today_cardio').toUpperCase()}</Text>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{label}</Text>
      {detail ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{detail}</Text> : null}
    </View>
  );
}
```

`BonusBlock.tsx` :
```tsx
// Section BONUS : cartes cochables, hors compteur N
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function BonusBlock({ title, children }: { title: string | null | undefined; children: ReactNode }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{(title || t('today_bonus')).toUpperCase()}</Text>
      {children}
    </View>
  );
}
```

`RulesBlock.tsx` :
```tsx
// Règles du programme, repliables
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

export function RulesBlock({ rules }: { rules: string[] }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (rules.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{ minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('today_rules').toUpperCase()}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textDim} />
      </Pressable>
      {open && rules.map((r, i) => <Text key={i} style={{ color: colors.textDim, fontFamily: fonts.ui }}>{`· ${r}`}</Text>)}
    </View>
  );
}
```

`TipsList.tsx` :
```tsx
// Séances cardio / repos : cartes de conseils
import { Text, View } from 'react-native';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';

export function TipsList({ tips, accent }: { tips: { title: string; body: string }[]; accent: string | null | undefined }) {
  const { colors, fonts, radius, spacing } = useTheme();
  const titleColor = accentColors(colors, accent).text;
  return (
    <View style={{ gap: 12 }}>
      {tips.map((tip, i) => (
        <View key={i} style={{ gap: 4, backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }}>
          <Text style={{ color: titleColor, fontFamily: fonts.uiBold }}>{tip.title}</Text>
          <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{tip.body}</Text>
        </View>
      ))}
    </View>
  );
}
```

`RestDayScreen.tsx` :
```tsx
// Jour absent du planning : repos implicite générique
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function RestDayScreen() {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <View testID="rest-day" style={{ alignItems: 'center', gap: 10, paddingVertical: 40 }}>
      <Ionicons name="bed-outline" size={48} color={colors.textDim} />
      <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 32 }}>{t('today_rest_label')}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui, textAlign: 'center' }}>{t('today_rest_sub')}</Text>
    </View>
  );
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/today/__tests__/blocks.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/today/ProgressBar.tsx src/features/today/SessionNote.tsx src/features/today/WarmupBlock.tsx src/features/today/CardioBlock.tsx src/features/today/BonusBlock.tsx src/features/today/RulesBlock.tsx src/features/today/TipsList.tsx src/features/today/RestDayScreen.tsx src/features/today/__tests__/blocks.test.tsx
git commit -m "feat(mobile): add Today session blocks (progress, warm-up, cardio, bonus, rules, tips, rest)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Barre de repos, pied de séance, récapitulatif, bandeau de reprise

**Files:**
- Create: `mobile/src/features/today/RestBar.tsx`, `TodayFooter.tsx`, `CompletedSummary.tsx`, `ResumeBanner.tsx` (dans `mobile/src/features/today/`), `mobile/src/features/today/__tests__/RestBar.test.tsx`, `mobile/src/features/today/__tests__/footer.test.tsx`

**Interfaces:**
- Consumes: `useTimerStore`, `timerPhase`, `timerProgress`, `remainingSec`, `ADJUST_STEP_SEC`, `completeWorkTimer`, `SessionSummary`.
- Produces:
  - `<RestBar exerciseName(exerciseId: string): string; onPressBar(exerciseId: string): void />` (visible si minuteur actif ou flash en cours ; testID `rest-bar`)
  - `<TodayFooter canFinish: boolean; showReset: boolean; onFinish(): void; onReset(): void />`
  - `<CompletedSummary summary: SessionSummary; units: Units; onReopen(): void />`
  - `<ResumeBanner dateLabel: string; canResume: boolean; onResume(): void; onFinish(): void />`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/today/__tests__/RestBar.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { startTimer } from '@/domain/timer';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { RestBar } from '../RestBar';

describe('RestBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-05T10:00:00.000Z'));
    useTimerStore.setState(TIMER_INITIAL);
  });
  afterEach(() => jest.useRealTimers());

  it('masquée sans minuteur ; affiche temps restant, ±15 s, Passer', async () => {
    const ctx = createTestCtx();
    const onPressBar = jest.fn();
    await renderWithProviders(<RestBar exerciseName={() => 'Presse'} onPressBar={onPressBar} />, { ctx });
    expect(screen.queryByTestId('rest-bar')).toBeNull();

    await act(async () => {
      useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs: Date.now(), durationSec: 90, workoutId: 'w', exerciseId: 'x', setIndex: 0 }));
    });
    expect(screen.getByText('Presse')).toBeTruthy();
    expect(screen.getByText('1:30')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '+15 s' }));
    expect(screen.getByText('1:45')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(5_000); });
    expect(screen.getByText('1:40')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('rest-bar'));
    expect(onPressBar).toHaveBeenCalledWith('x');

    await fireEvent.press(screen.getByRole('button', { name: 'Passer' }));
    expect(useTimerStore.getState().timer).toBeNull();
  });
});
```

`mobile/src/features/today/__tests__/footer.test.tsx` :
```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { CompletedSummary } from '../CompletedSummary';
import { ResumeBanner } from '../ResumeBanner';
import { TodayFooter } from '../TodayFooter';

describe('pied de séance', () => {
  it('Terminer visible dès une série cochée, Réinitialiser si une séance existe', async () => {
    const onFinish = jest.fn();
    const onReset = jest.fn();
    await renderWithProviders(<TodayFooter canFinish showReset onFinish={onFinish} onReset={onReset} />);
    await fireEvent.press(screen.getByRole('button', { name: 'TERMINER LA SÉANCE' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Réinitialiser la séance du jour' }));
    expect(onFinish).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
  });

  it('rien quand aucune séance', async () => {
    await renderWithProviders(<TodayFooter canFinish={false} showReset={false} onFinish={jest.fn()} onReset={jest.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('récapitulatif et rouvrir', async () => {
    const onReopen = jest.fn();
    await renderWithProviders(<CompletedSummary summary={{ durationMin: 48, setsDone: 12, volume: 4520 }} units="kg" onReopen={onReopen} />);
    expect(screen.getByText('SÉANCE TERMINÉE')).toBeTruthy();
    expect(screen.getByText('48 min')).toBeTruthy();
    expect(screen.getByText('4520 kg')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Rouvrir la séance' }));
    expect(onReopen).toHaveBeenCalled();
  });

  it('bandeau : Reprendre seulement si possible', async () => {
    await renderWithProviders(<ResumeBanner dateLabel="DIM, 4 OCT" canResume={false} onResume={jest.fn()} onFinish={jest.fn()} />);
    expect(screen.getByText('Séance du DIM, 4 OCT non terminée')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reprendre' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/today/__tests__/RestBar.test.tsx src/features/today/__tests__/footer.test.tsx`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`RestBar.tsx` :
```tsx
// ============================================================
// Barre de repos flottante — temps restant, progression, ±15 s, Passer.
// Rafraîchit son propre affichage (≈ 4 fois/s) sans re-rendre l'écran.
// ============================================================
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { remainingSec } from '@/domain/progress';
import { ADJUST_STEP_SEC, timerPhase, timerProgress } from '@/domain/timer';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { completeWorkTimer } from './actions';

const TICK_MS = 250;

function formatClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

interface Props {
  exerciseName(exerciseId: string): string;
  onPressBar(exerciseId: string): void;
}

export function RestBar({ exerciseName, onPressBar }: Props) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const timer = useTimerStore((s) => s.timer);
  const flash = useTimerStore((s) => s.flash);
  const [now, setNow] = useState(() => Date.now());

  const live = timer !== null || (flash !== null && now < flash.until);
  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [live, timer, flash]);

  if (!timer && !(flash && now < flash.until)) return null;

  const exerciseId = timer?.exerciseId ?? flash!.exerciseId;
  const phase = timer ? timerPhase(timer, now) : 'done';
  const bg = phase === 'done' ? colors.greenDone : phase === 'critical' ? colors.redTimer : colors.bgElevated;
  const label = timer?.mode === 'work' ? t('timer_work') : t('timer_rest');
  const clock = timer ? formatClock(remainingSec(timer.endAt, now)) : t('timer_done');

  const skip = () => {
    if (!timer) return;
    if (timer.mode === 'work') completeWorkTimer(ctx, timer, Date.now(), true);
    else useTimerStore.getState().finish(ctx, null);
    usePrefs.getState().bumpData();
  };
  const adjust = (delta: number) => useTimerStore.getState().adjust(ctx, delta, Date.now());

  const small = [styles.small, { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius.sm }];
  const smallText = { color: colors.text, fontFamily: fonts.uiBold, fontSize: 13 };
  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: colors.border, borderRadius: radius.lg }]}>
      <Pressable testID="rest-bar" accessibilityRole="button" onPress={() => onPressBar(exerciseId)} style={styles.main}>
        <View style={styles.flex}>
          <Text style={{ color: colors.text, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{label}</Text>
          <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.uiMedium }}>{exerciseName(exerciseId)}</Text>
        </View>
        <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 36 }}>{clock}</Text>
      </Pressable>
      {timer ? (
        <>
          <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <View style={[styles.fill, { width: `${timerProgress(timer, now) * 100}%`, backgroundColor: colors.text }]} />
          </View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('timer_minus')} onPress={() => adjust(-ADJUST_STEP_SEC)} style={small}>
              <Text style={smallText}>{t('timer_minus')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('timer_plus')} onPress={() => adjust(ADJUST_STEP_SEC)} style={small}>
              <Text style={smallText}>{t('timer_plus')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('timer_skip')} onPress={skip} style={small}>
              <Text style={smallText}>{t('timer_skip')}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, bottom: 12, borderWidth: 1, padding: 12, gap: 8 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  small: { flex: 1, minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
```

`TodayFooter.tsx` :
```tsx
// « Terminer la séance » + lien « Réinitialiser la séance du jour »
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  canFinish: boolean;
  showReset: boolean;
  onFinish(): void;
  onReset(): void;
}

export function TodayFooter({ canFinish, showReset, onFinish, onReset }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  if (!canFinish && !showReset) return null;
  return (
    <View style={styles.root}>
      {canFinish ? (
        <Pressable accessibilityRole="button" onPress={onFinish} style={[styles.primary, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
          <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('today_finish_session')}</Text>
        </Pressable>
      ) : null}
      {showReset ? (
        <Pressable accessibilityRole="button" onPress={onReset} style={styles.link}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiMedium, textDecorationLine: 'underline' }}>{t('profile_reset_today')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, alignItems: 'stretch' },
  primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
```

`CompletedSummary.tsx` :
```tsx
// Récapitulatif de la séance terminée + « Rouvrir »
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Units } from '@/domain/program';
import type { SessionSummary } from '@/domain/progress';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

export function CompletedSummary({ summary, units, onReopen }: { summary: SessionSummary; units: Units; onReopen(): void }) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const stat = (label: string, value: string) => (
    <View style={styles.stat}>
      <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 26 }}>{value}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{label.toUpperCase()}</Text>
    </View>
  );
  return (
    <View testID="completed-summary" style={{ gap: 12, backgroundColor: colors.greenDone, borderRadius: radius.lg, padding: spacing.md }}>
      <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 28 }}>{t('today_summary_title')}</Text>
      <View style={styles.row}>
        {stat(t('today_summary_duration'), t('today_summary_min', summary.durationMin))}
        {stat(t('today_summary_sets'), String(summary.setsDone))}
        {stat(t('today_summary_volume'), `${Math.round(summary.volume)} ${units}`)}
      </View>
      <Pressable accessibilityRole="button" onPress={onReopen} style={[styles.btn, { borderColor: colors.text, borderRadius: radius.md }]}>
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('today_reopen')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'flex-start', gap: 2 },
  btn: { minHeight: TOUCH_MIN, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
```

`ResumeBanner.tsx` :
```tsx
// Séance d'un jour précédent restée en cours (passage de minuit)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  dateLabel: string;
  canResume: boolean;
  onResume(): void;
  onFinish(): void;
}

export function ResumeBanner({ dateLabel, canResume, onResume, onFinish }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const btn = [styles.btn, { borderRadius: radius.md, borderColor: colors.rust }];
  return (
    <View style={{ gap: 10, borderColor: colors.rust, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.bgCard }}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('today_resume_title', dateLabel)}</Text>
      <View style={styles.row}>
        {canResume ? (
          <Pressable accessibilityRole="button" onPress={onResume} style={btn}>
            <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('today_resume')}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onFinish} style={btn}>
          <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('today_resume_finish')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, minHeight: TOUCH_MIN, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/today/__tests__/RestBar.test.tsx src/features/today/__tests__/footer.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/today/RestBar.tsx src/features/today/TodayFooter.tsx src/features/today/CompletedSummary.tsx src/features/today/ResumeBanner.tsx src/features/today/__tests__/RestBar.test.tsx src/features/today/__tests__/footer.test.tsx
git commit -m "feat(mobile): add floating rest bar, finish footer, workout summary and resume banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Assemblage de l'écran Today, réglage Profil, checklist M2

**Files:**
- Create: `mobile/src/features/today/TodayScreen.tsx`, `mobile/src/features/today/TodaySessionBody.tsx`, `mobile/src/features/common/TabErrorBoundary.tsx`, `mobile/src/features/today/__tests__/TodayFlows.test.tsx`
- Modify: `mobile/src/features/common/Screen.tsx`, `mobile/src/app/(tabs)/today.tsx`, `mobile/src/app/(tabs)/profile.tsx`, `mobile/src/features/today/__tests__/TodayScreen.test.tsx`, `mobile/docs/DEVICE_CHECKLIST.md`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces:
  - `<Screen scrollRef?; scrollEnabled?; overlay?: ReactNode; bottomInset?: number>` (rétrocompatible)
  - `<TodayScreen focused?: boolean />` (défaut `true`) — export nommé dans `features/today/TodayScreen.tsx`
  - `<TodaySessionBody … />` (props internes listées dans le code)
  - `<TabErrorBoundary>` ; route `app/(tabs)/today.tsx` = `useIsFocused()` + boundary + `TodayScreen`.

- [ ] **Step 1: Écrire les tests de parcours**

`mobile/src/features/today/__tests__/TodayFlows.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession, sevenDayLbsInput } from '@/domain/__fixtures__/builders';
import { confirm } from '@/platform/confirm';
import { keepAwake } from '@/platform/keepAwake';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TodayScreen } from '../TodayScreen';

// Lundi 5 octobre 2026, 10 h locale
const MONDAY = new Date(2026, 9, 5, 10, 0, 0);

const input = makeProgramInput({ '1': 'fb' }, {
  fb: makeSession('FULL BODY', [
    makeExercise('presse', 2, { name: 'Presse', scheme: '2×8', load: '100 kg', restSec: 90, alternatives: ['Squat'] }),
    makeExercise('gainage', 1, { name: 'Gainage', scheme: '1×45 sec', restSec: 60 }),
  ], { warmup: ['Vélo 5 min'], cardio: { label: 'Marche', detail: '15 min' }, bonus: { title: 'BONUS', exercises: [makeExercise('abdos', 1, { name: 'Abdos' })] } }),
}, { restDefaultSec: 90 });

async function setup(programInput: unknown = input) {
  const ctx = createTestCtx();
  const p = createProgram(ctx, programInput, 'manual');
  setActiveProgram(ctx, p.id);
  await renderWithProviders(<TodayScreen />, { ctx });
  return ctx;
}

describe('Today — parcours', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useTimerStore.setState(TIMER_INITIAL); });
  });
  afterEach(() => jest.useRealTimers());

  it('séance du jour : blocs, compteur (bonus exclu), échauffement, cardio, bonus', async () => {
    await setup();
    expect(screen.getByText('FULL BODY')).toBeTruthy();
    expect(screen.getByText('0 / 3')).toBeTruthy();
    expect(screen.getByText('Vélo 5 min')).toBeTruthy();
    expect(screen.getByText('Marche')).toBeTruthy();
    expect(screen.getByText('Abdos')).toBeTruthy();
  });

  it('cocher → repos démarré, compteur, carte verte ; Terminer → récapitulatif → Rouvrir', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.getByTestId('rest-bar')).toBeTruthy();
    expect(keepAwake.activate).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('set-presse-1'));
    expect(screen.getByTestId('card-presse-complete')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'TERMINER LA SÉANCE' }));
    expect(confirm).toHaveBeenCalled(); // séries restantes (gainage) → confirmation
    expect(screen.getByTestId('completed-summary')).toBeTruthy();
    expect(screen.queryByTestId('rest-bar')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Rouvrir la séance' }));
    expect(screen.queryByTestId('completed-summary')).toBeNull();
  });

  it('chrono d\'effort : la série est cochée à la fin, puis repos', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('set-gainage-0'));
    expect(screen.getByText('0 / 3')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(45_300); });
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', exerciseId: 'gainage' });
  });

  it('échange persisté (vue relue)', async () => {
    await setup();
    await fireEvent.press(screen.getAllByLabelText("Changer d'exercice")[0]);
    await fireEvent.press(screen.getByText('Squat'));
    expect(screen.getByText('remplace Presse')).toBeTruthy();
  });

  it('jour non planifié → écran repos', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('day-2'));
    expect(screen.getByTestId('rest-day')).toBeTruthy();
  });

  it('extensibilité : 7 jours en lbs, sans changement de code', async () => {
    await setup(sevenDayLbsInput());
    expect(screen.getByText('SÉANCE 1')).toBeTruthy();
    expect(screen.getByText('0 / 4')).toBeTruthy();
    expect(screen.getAllByText('lbs').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('day-6'));
    expect(screen.getByText('SÉANCE 6')).toBeTruthy();
  });
});
```

Mettre à jour `mobile/src/features/today/__tests__/TodayScreen.test.tsx` : remplacer `import TodayScreen from '@/app/(tabs)/today';` par `import { TodayScreen } from '../TodayScreen';`.

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/today/__tests__/TodayFlows.test.tsx`
Expected: FAIL — `../TodayScreen` introuvable.

- [ ] **Step 3: Étendre `Screen`**

`mobile/src/features/common/Screen.tsx` :
```tsx
// Conteneur d'écran : fond du thème, zones de sécurité, défilement, calque flottant optionnel
import type { ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  children: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  scrollEnabled?: boolean;
  /** Élément flottant au-dessus du contenu (barre de repos) */
  overlay?: ReactNode;
  /** Marge basse du contenu pour ne pas être masqué par l'overlay */
  bottomInset?: number;
}

export function Screen({ children, scrollRef, scrollEnabled = true, overlay, bottomInset = 0 }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.md + bottomInset }}
      >
        {children}
      </ScrollView>
      {overlay ? <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>{overlay}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
```

- [ ] **Step 4: Implémenter le corps de séance**

`mobile/src/features/today/TodaySessionBody.tsx` :
```tsx
// ============================================================
// Séance lift / mixed — cartes, compteur, blocs, pied, feuilles.
// Lit tout par useDbQuery(loadTodayView) ; chaque action écrit puis bumpData.
// ============================================================
import { useEffect, useState, type ReactElement } from 'react';
import { View } from 'react-native';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { getSetting } from '@/db/repos/settingsRepo';
import { useRepoCtx } from '@/db/DbContext';
import type { RepoCtx } from '@/db/types';
import type { EffectiveExercise } from '@/domain/exerciseView';
import { weightKey } from '@/domain/exerciseView';
import type { Session } from '@/domain/program';
import { restDurationSec, sessionProgress, sessionSummary } from '@/domain/progress';
import { schemeReps } from '@/domain/scheme';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import { confirm } from '@/platform/confirm';
import { keepAwake } from '@/platform/keepAwake';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';
import { useToastStore } from '@/state/toastStore';
import {
  changeWeight, finishToday, hasCheckedSets, moveExercise, pressSet, reopenToday,
  resetToday, saveSetValues, swapExercise, type TodayEnv,
} from './actions';
import { BonusBlock } from './BonusBlock';
import { CardioBlock } from './CardioBlock';
import { CompletedSummary } from './CompletedSummary';
import { ExerciseCard } from './ExerciseCard';
import { ProgressBar } from './ProgressBar';
import { ReorderableList } from './ReorderableList';
import { RulesBlock } from './RulesBlock';
import { SessionNote } from './SessionNote';
import { SetEditSheet } from './SetEditSheet';
import { SwapSheet } from './SwapSheet';
import { TodayFooter } from './TodayFooter';
import { cardWeight, loadTodayView } from './todayView';
import { WarmupBlock } from './WarmupBlock';

const readKeepAwake = (ctx: RepoCtx) => getSetting(ctx, 'keepAwake') !== false;

export interface TodaySessionBodyProps {
  program: StoredProgram;
  sessionKey: string;
  session: Session;
  /** Date de la séance affichée (jour local) */
  date: string;
  /** true si la séance affichée est celle du jour (pas une reprise) */
  isToday: boolean;
  focused: boolean;
  onDragStateChange(dragging: boolean): void;
  onCardLayout(exerciseId: string, y: number): void;
  /** Noms des exercices affichés, pour la barre de repos */
  onExerciseNames(names: Record<string, string>): void;
}

export function TodaySessionBody(p: TodaySessionBodyProps) {
  const ctx = useRepoCtx();
  const { t } = useI18n();
  const view = useDbQuery(loadTodayView, p.program, p.sessionKey, p.date);
  const keepAwakePref = useDbQuery(readKeepAwake);
  const timer = useTimerStore((s) => s.timer);
  const [editing, setEditing] = useState<{ ex: EffectiveExercise; setIndex: number } | null>(null);
  const [swapping, setSwapping] = useState<EffectiveExercise | null>(null);
  const [listY, setListY] = useState(0);

  const meta = p.program.definition.meta;
  const units = meta.units;
  const accent = p.session.accent;
  const completed = view.workout?.status === 'completed';
  const inProgress = view.workout?.status === 'in_progress';
  const progress = sessionProgress({ ...p.session, exercises: view.exercises }, view.track);

  // Écran allumé : séance en cours + onglet affiché + réglage actif
  const awake = p.focused && inProgress && keepAwakePref;
  useEffect(() => {
    if (!awake) return;
    keepAwake.activate();
    return () => keepAwake.deactivate();
  }, [awake]);

  // Noms pour la barre de repos — dépendre de la fonction (stable) et non de `p` (nouvel objet à chaque rendu → boucle)
  const { onExerciseNames } = p;
  const names = Object.fromEntries([...view.exercises, ...view.bonus].map((e) => [e.id, e.name]));
  const namesKey = JSON.stringify(names);
  useEffect(() => { onExerciseNames(JSON.parse(namesKey) as Record<string, string>); }, [namesKey, onExerciseNames]);

  const env = (): TodayEnv => ({ ctx, nowMs: Date.now(), program: p.program, sessionKey: p.sessionKey, date: p.isToday ? null : p.date });
  const run = (fn: () => void) => {
    try {
      fn();
    } catch {
      useToastStore.getState().show(t('error_not_saved'));
    } finally {
      usePrefs.getState().bumpData();
    }
  };

  const onFinish = async () => {
    if (progress.done < progress.total) {
      const ok = await confirm({ title: t('modal_finish_title'), message: t('modal_finish_body'), confirmLabel: t('modal_finish_confirm'), cancelLabel: t('modal_finish_cancel') });
      if (!ok) return;
    }
    run(() => finishToday(env(), view));
    useToastStore.getState().show(t('today_session_saved_toast'));
  };
  const onReset = async () => {
    const ok = await confirm({ title: t('profile_reset_today'), message: t('today_reset_confirm_body'), confirmLabel: t('today_reset_action'), cancelLabel: t('today_cancel'), destructive: true });
    if (!ok) return;
    run(() => resetToday(env(), view));
    useToastStore.getState().show(t('profile_reset_today_toast'));
  };
  const onSwapSelect = async (name: string | null) => {
    const ex = swapping;
    setSwapping(null);
    if (!ex || name === ex.performedName) return;
    if (hasCheckedSets(view, ex.id)) {
      const ok = await confirm({ title: t('today_swap_confirm_title'), message: t('today_swap_confirm_body'), confirmLabel: t('today_swap_action'), cancelLabel: t('today_cancel') });
      if (!ok) return;
    }
    run(() => swapExercise(env(), view, ex, name));
  };

  const pendingFor = (ex: EffectiveExercise) =>
    timer?.mode === 'work' && timer.exerciseId === ex.id && timer.workoutId === view.workout?.id ? timer.setIndex : null;

  const card = (ex: EffectiveExercise, handle?: (title: ReactElement) => ReactElement) => (
    <ExerciseCard
      exercise={ex}
      units={units}
      accent={accent}
      done={view.track[ex.id] ?? []}
      weight={cardWeight(view, ex)}
      restSec={restDurationSec(ex, meta)}
      last={view.last[weightKey(ex.id, ex.performedName)] ?? null}
      locked={completed}
      pendingSet={pendingFor(ex)}
      onPressSet={(i) => run(() => pressSet(env(), view, ex, i))}
      onLongPressSet={(i) => setEditing({ ex, setIndex: i })}
      onChangeWeight={(v) => run(() => changeWeight(env(), ex, v))}
      onSwap={ex.alternatives.length > 0 && !completed ? () => setSwapping(ex) : undefined}
      onPressRest={() => { if (timer?.exerciseId === ex.id) useTimerStore.getState().clear(ctx); }}
      header={handle}
    />
  );

  const editingEntry = editing ? view.entries.find((e) => e.exerciseId === editing.ex.id && e.setIndex === editing.setIndex) : undefined;

  return (
    <View style={{ gap: 16 }}>
      {completed && view.workout ? (
        <CompletedSummary
          summary={sessionSummary(view.entries, view.workout.startedAt, view.workout.completedAt)}
          units={units}
          onReopen={() => run(() => reopenToday(env(), view))}
        />
      ) : null}
      <ProgressBar done={progress.done} total={progress.total} accent={accent} />
      {p.session.note ? <SessionNote text={p.session.note} /> : null}
      <WarmupBlock items={p.session.warmup} />
      <View onLayout={(e) => setListY(e.nativeEvent.layout.y)}>
        <ReorderableList
          items={view.exercises}
          keyOf={(ex) => ex.id}
          onMove={(from, to) => run(() => moveExercise(env(), view, from, to))}
          onDragStateChange={p.onDragStateChange}
          onItemLayout={(id, y) => p.onCardLayout(id, listY + y)}
          moveUpLabel={t('today_move_up')}
          moveDownLabel={t('today_move_down')}
          renderItem={(ex, _i, handle) => card(ex, completed ? undefined : handle)}
        />
      </View>
      {p.session.cardio?.label ? <CardioBlock label={p.session.cardio.label} detail={p.session.cardio.detail} /> : null}
      {view.bonus.length > 0 ? (
        <BonusBlock title={p.session.bonus?.title}>
          {view.bonus.map((ex) => <View key={ex.id}>{card(ex)}</View>)}
        </BonusBlock>
      ) : null}
      <RulesBlock rules={p.program.definition.rules} />
      <TodayFooter
        canFinish={!completed && progress.done + view.bonus.reduce((n, b) => n + (view.track[b.id] ?? []).filter(Boolean).length, 0) > 0}
        showReset={view.workout !== null}
        onFinish={onFinish}
        onReset={onReset}
      />
      {editing ? (
        <SetEditSheet
          key={`${editing.ex.id}-${editing.setIndex}`}
          visible
          setIndex={editing.setIndex}
          units={units}
          initialWeight={editingEntry?.weight ?? cardWeight(view, editing.ex)}
          initialReps={editingEntry?.reps ?? schemeReps(editing.ex)}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            const target = editing;
            setEditing(null);
            run(() => saveSetValues(env(), view, target.ex, target.setIndex, values));
          }}
        />
      ) : null}
      <SwapSheet visible={swapping !== null} exercise={swapping} onSelect={onSwapSelect} onClose={() => setSwapping(null)} />
    </View>
  );
}
```

- [ ] **Step 5: Implémenter l'écran**

`mobile/src/features/today/TodayScreen.tsx` :
```tsx
// ============================================================
// TODAY — séance du jour (ou du jour choisi), séance d'hier à reprendre,
// barre de repos flottante. Aucune séance ni jour en dur : tout vient du programme.
// ============================================================
import { useRef, useState } from 'react';
import type { ScrollView } from 'react-native';
import example from '@/data/program.example.json';
import { useRepoCtx } from '@/db/DbContext';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { findStaleInProgress } from '@/db/repos/workoutsRepo';
import { localDateKey, resolveDay, weekdayOf, weekStrip, type DayPlan, type Weekday } from '@/domain/schedule';
import { Screen } from '@/features/common/Screen';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';
import { useToastStore } from '@/state/toastStore';
import { finishStale } from './actions';
import { formatShortDate } from './formatDate';
import { NoProgram } from './NoProgram';
import { RestBar } from './RestBar';
import { RestDayScreen } from './RestDayScreen';
import { ResumeBanner } from './ResumeBanner';
import { TimerDriver } from './TimerDriver';
import { TipsList } from './TipsList';
import { TodayHeader } from './TodayHeader';
import { TodaySessionBody } from './TodaySessionBody';
import { useActiveProgram } from './useActiveProgram';
import { WeekStrip } from './WeekStrip';

const REST_BAR_SPACE = 150;

export function TodayScreen({ focused = true }: { focused?: boolean }) {
  const ctx = useRepoCtx();
  const program = useActiveProgram();
  const { t, tList } = useI18n();
  const today = new Date();
  const todayKey = localDateKey(today);
  const [selected, setSelected] = useState<Weekday>(weekdayOf(today));
  const [resumedId, setResumedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef<Record<string, number>>({});
  const stale = useDbQuery(findStaleInProgress, todayKey);
  const timerVisible = useTimerStore((s) => s.timer !== null || s.flash !== null);

  if (!program) {
    const loadExample = () => {
      const created = createProgram(ctx, example, 'example');
      setActiveProgram(ctx, created.id);
      usePrefs.getState().bumpData();
    };
    return (
      <Screen>
        <NoProgram onLoadExample={loadExample} />
      </Screen>
    );
  }

  const def = program.definition;
  const daysShort = tList('days_short');
  const monthsShort = tList('months_short');
  const staleSession = stale && stale.programId === program.id && Object.hasOwn(def.sessions, stale.sessionKey)
    ? def.sessions[stale.sessionKey] : undefined;
  const resumed = stale !== null && resumedId === stale.id && staleSession !== undefined;

  const plan: DayPlan = resumed
    ? { kind: 'session', weekday: selected, sessionKey: stale.sessionKey, session: staleSession }
    : resolveDay(def, selected);
  const date = resumed ? stale.date : todayKey;
  const staleLabel = stale ? formatShortDate(new Date(`${stale.date}T12:00:00`), daysShort, monthsShort) : '';

  const onFinishStale = () => {
    if (!stale) return;
    try {
      finishStale(ctx, stale.id);
      useToastStore.getState().show(t('today_session_saved_toast'));
    } catch {
      useToastStore.getState().show(t('error_not_saved'));
    } finally {
      setResumedId(null);
      usePrefs.getState().bumpData();
    }
  };
  const scrollToCard = (exerciseId: string) => {
    const y = cardY.current[exerciseId];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  };

  return (
    <Screen
      scrollRef={scrollRef}
      scrollEnabled={!dragging}
      bottomInset={timerVisible ? REST_BAR_SPACE : 0}
      overlay={<RestBar exerciseName={(id) => names[id] ?? ''} onPressBar={scrollToCard} />}
    >
      <TimerDriver />
      <TodayHeader programLabel={def.meta.label} dateLabel={formatShortDate(today, daysShort, monthsShort)} plan={plan} />
      <WeekStrip
        days={weekStrip(def, today)}
        selected={selected}
        dayLabels={daysShort.map((d) => d.toUpperCase())}
        onSelect={(d) => { setSelected(d); setResumedId(null); }}
      />
      {stale ? (
        <ResumeBanner
          dateLabel={staleLabel}
          canResume={staleSession !== undefined && !resumed}
          onResume={() => setResumedId(stale.id)}
          onFinish={onFinishStale}
        />
      ) : null}
      {plan.kind === 'implicit-rest' ? <RestDayScreen /> : null}
      {plan.kind === 'session' && (plan.session.type === 'cardio' || plan.session.type === 'rest') ? (
        <TipsList tips={plan.session.tips} accent={plan.session.accent} />
      ) : null}
      {plan.kind === 'session' && (plan.session.type === 'lift' || plan.session.type === 'mixed') ? (
        <TodaySessionBody
          key={`${plan.sessionKey}-${date}`}
          program={program}
          sessionKey={plan.sessionKey}
          session={plan.session}
          date={date}
          isToday={!resumed}
          focused={focused}
          onDragStateChange={setDragging}
          onCardLayout={(id, y) => { cardY.current[id] = y; }}
          onExerciseNames={setNames}
        />
      ) : null}
    </Screen>
  );
}
```

- [ ] **Step 6: Route, boundary, Profil**

`mobile/src/features/common/TabErrorBoundary.tsx` :
```tsx
// Erreur de rendu d'un onglet : message + « Recharger l'onglet »
import { Component, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

function Fallback({ onReload }: { onReload(): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg, padding: 24 }}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('error_tab')}</Text>
      <Pressable accessibilityRole="button" onPress={onReload} style={{ minHeight: TOUCH_MIN, paddingHorizontal: 20, justifyContent: 'center', backgroundColor: colors.gold, borderRadius: radius.md }}>
        <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('error_reload_tab')}</Text>
      </Pressable>
    </View>
  );
}

export class TabErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <Fallback onReload={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))} />;
    return <View key={this.state.attempt} style={{ flex: 1 }}>{this.props.children}</View>;
  }
}
```

`mobile/src/app/(tabs)/today.tsx` (remplacer le contenu) :
```tsx
// Route Today — focus de l'onglet + ErrorBoundary ; l'écran vit dans features/today
import { useIsFocused } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { TodayScreen } from '@/features/today/TodayScreen';

export default function TodayRoute() {
  const focused = useIsFocused();
  return (
    <TabErrorBoundary>
      <TodayScreen focused={focused} />
    </TabErrorBoundary>
  );
}
```

`mobile/src/app/(tabs)/profile.tsx` : ajouter, après le groupe Thème, le réglage « écran allumé » :
```tsx
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { useDbQuery } from '@/features/common/useDbQuery';
// … hors du composant :
const readKeepAwake = (ctx: RepoCtx) => getSetting(ctx, 'keepAwake') !== false;
// … dans ProfileScreen :
  const keepAwakeOn = useDbQuery(readKeepAwake);
// … dans le JSX, après le groupe thème :
      <View style={styles.group}>
        <Text style={label}>{t('profile_keep_awake').toUpperCase()}</Text>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('profile_keep_awake_meta')}</Text>
        <Segmented<'on' | 'off'>
          options={[{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }]}
          value={keepAwakeOn ? 'on' : 'off'}
          onChange={(v) => { setSetting(ctx, 'keepAwake', v === 'on'); usePrefs.getState().bumpData(); }}
        />
      </View>
```

- [ ] **Step 7: Lancer toute la suite**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (toutes les suites, y compris `TodayScreen.test.tsx` et `TodayFlows.test.tsx`). En cas d'échec d'un parcours, corriger l'écran (pas le test) ; si un test dépend d'un détail d'implémentation non spécifié (libellé exact), aligner le test sur les clés i18n de la Task 13.

- [ ] **Step 8: Vérifier l'export web et le lancement**

Run: `npx expo export --platform web --output-dir "$TEMP/m2-web-check"`
Expected: export réussi sans erreur de bundle.

Run (manuel, à faire par l'humain ou l'agent avec un navigateur) : `npx expo start --web` → Today affiche la séance, cocher une série lance la barre de repos, le compteur avance, Terminer affiche le récapitulatif.

- [ ] **Step 9: Checklist appareil M2**

Ajouter à la fin de `mobile/docs/DEVICE_CHECKLIST.md` :
```markdown

## M2 — Today (build development à refaire : expo-haptics, expo-keep-awake, expo-audio)
- [ ] Cocher une série : vibration légère, cercle rempli, compteur X / N, barre de repos en bas.
- [ ] Dernière série d'un exercice : carte verte + vibration « succès ».
- [ ] Barre de repos : −15 s / +15 s / Passer ; rouge et vibration d'alerte sous 10 s ; deux bips + flash vert à 0.
- [ ] Musique en fond : les bips se mêlent sans couper la musique ; mode silencieux iOS : pas de bip.
- [ ] Gainage (chronométré) : tap → chrono d'effort, cercle en attente ; à la fin la série se coche et le repos démarre ; second tap annule.
- [ ] Verrouiller le téléphone pendant un repos, rouvrir après la fin : « terminé » sans son.
- [ ] Tuer l'app pendant un repos, rouvrir avant la fin : le décompte reprend au bon temps.
- [ ] Appui long sur un cercle : saisie poids / reps ; valeurs conservées après fermeture de l'app.
- [ ] Poids de carte −/+ et saisie « 102,5 » ; valeur retrouvée à la séance suivante.
- [ ] Échange vers une alternative : nom + « remplace … », poids propre à la variante ; retour à l'original retrouve son poids.
- [ ] Glisser-déposer : appui long sur le titre d'une carte puis glisser ; le défilement est bloqué pendant le glisser ; ordre conservé.
- [ ] VoiceOver / TalkBack : actions « Monter » / « Descendre » sur une carte.
- [ ] Écran allumé pendant une séance en cours sur l'onglet Today ; se met en veille normalement ailleurs ou si désactivé dans Profil.
- [ ] Terminer : confirmation si séries restantes, récapitulatif (durée, séries, volume), « Rouvrir ».
- [ ] « Dernière fois » affiché à la séance suivante du même exercice.
- [ ] Laisser une séance en cours puis changer de jour (ou avancer l'heure du téléphone après minuit) : bandeau « Séance du … non terminée » avec Reprendre / Terminer.
- [ ] Réinitialiser la séance du jour : séries effacées, poids et ordre conservés.
```

- [ ] **Step 10: Commit**

```bash
git add src/features src/app docs/DEVICE_CHECKLIST.md
git commit -m "feat(mobile): assemble Today screen (M2) with rest bar, resume banner and keep-awake setting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Couverture de la spec (auto-revue)

| Exigence (addendum M2) | Task |
|---|---|
| Cartes, cercles, carte verte, compteur X / N (bonus exclus) | 4, 14, 17, 19 |
| Poids mémorisé, suggestion `load`, stepper, poids par alternative | 2, 3, 7, 11, 14 |
| Poids de carte appliqué aux séries suivantes | 11 |
| Poids / reps par série (appui long) | 6, 11, 15, 19 |
| Note, échauffement, cardio, bonus, règles, conseils, repos implicite | 17, 19 |
| Réordonnancement (glisser-déposer + accessibilité) | 3, 7, 11, 16, 19 |
| Échange (feuille, confirmation, remise à zéro en transaction) | 3, 6, 7, 11, 15, 19 |
| « La dernière fois » | 8, 11, 14 |
| Minuteur unique, chrono d'effort, ±15 s, Passer, rouge < 10 s, son, flash | 5, 10, 11, 12, 18 |
| Retour au premier plan / redémarrage | 5, 10, 12 |
| Terminer (confirmation), récapitulatif, Rouvrir, Réinitialiser | 4, 6, 11, 18, 19 |
| Passage de minuit (bandeau Reprendre / Terminer) | 6, 11, 18, 19 |
| Haptique, écran allumé (+ réglage Profil), points d'extension M6–M8 | 9, 11, 12, 19 |
| Erreurs : toast, ErrorBoundary, alternative orpheline | 3, 10, 19 |
| Extensibilité 7 jours / lbs | 19 |
