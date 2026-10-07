# App native Expo — Jalon M3b (Onboarding + Import) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Premier lancement guidé (onboarding) et import de trois formats — programme seul, sauvegarde PWA, sauvegarde native — avec aperçu, rapport et restauration en une transaction.

**Architecture:** Une fonction pure détecte le format (`domain/importFormat.ts`) puis convertit le contenu en `ImportBundle` + rapport (`domain/legacyImport.ts`, `domain/nativeBackup.ts`). `features/import/analyzeImport.ts` transforme le texte saisi ou choisi en aperçu ; à la confirmation, `db/repos/importRepo.replaceAll` écrit tout dans **une seule transaction** (ou `importProgram` pour un programme seul). L'onboarding est une route affichée par une garde dans la mise en page des onglets tant qu'il n'y a ni programme ni `onboarded`.

**Tech Stack:** Expo SDK 57 · TypeScript strict · Expo Router · expo-document-picker + expo-file-system (`File`) · Zod · Zustand · Jest (jest-expo) + RNTL 14 · better-sqlite3 (tests).

**Spec:** [docs/superpowers/specs/2026-10-07-expo-native-m3b-onboarding-import-design.md](../specs/2026-10-07-expo-native-m3b-onboarding-import-design.md) (addendum M3b, prioritaire) et [docs/superpowers/specs/2026-10-05-expo-native-foundation-design.md](../specs/2026-10-05-expo-native-foundation-design.md).

## Global Constraints

- Tout le code vit dans `mobile/` ; ne modifier ni `index.html`, ni `api/`, ni les fichiers PWA.
- `src/domain/` n'importe jamais React, React Native, Expo, Drizzle ni SQLite ; `src/db/` peut importer `src/domain/` (types inclus), rien d'autre de `src/`.
- La sauvegarde personnelle `docs/workout-backup-*.json` n'est **jamais** commitée (déjà dans `.gitignore`) ; seule la fixture anonymisée `mobile/src/domain/__fixtures__/pwa-backup.json` l'est.
- Restauration = **remplacement** total en **une seule transaction** ; suppression logique (`deleted_at`) des anciennes lignes, jamais `DELETE` (sauf `settings`).
- Ids natifs régénérés à l'écriture ; les ids d'origine (`prog-…`, refs du bundle) ne servent qu'au remappage.
- Séance entamée (`track:`) importée `abandoned` si sa date est passée, `in_progress` si c'est aujourd'hui (`today` local `YYYY-MM-DD`).
- Taille maximale d'un fichier importé : 5 Mo (`MAX_IMPORT_BYTES = 5 * 1024 * 1024`).
- Toutes les chaînes visibles passent par `t()` ; chaque nouvelle clé existe dans `fr.json` **et** `en.json`.
- Cibles tactiles ≥ 44 pt ; couleurs via `useTheme()`.
- Commentaires en français ; commits conventionnels terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commandes depuis `mobile/` ; RNTL 14 asynchrone (`await`).
- `@/platform/pickJsonFile` est mocké globalement (`src/test/jestSetup.js`) ; `confirm` résout `true` par défaut.
- **Amendement à la spec §3** : après « Créer mon programme » depuis l'onboarding, l'enregistrement sort de l'éditeur par sa sortie standard (`dismissTo('/plan')`) et non vers Today — même parcours que depuis Plan ; `onboarded` est mis à vrai par l'enregistrement.

## Review Focus

1. **Sauvegarde d'une ancienne version de la PWA** (clé `program` au lieu de `programs`, `track:` au format tableau, `log:` sans `programId`) : importée, pas rejetée (Task 3).
2. **Même sauvegarde restaurée deux fois** : la seconde remplace la première, aucun programme ni séance en double (Task 6).
3. **Programme seul contenant un champ `id` PWA et un libellé déjà existant** : ajouté comme nouveau programme et activé, les autres données intactes, le champ `id` d'origine non conservé dans la définition (Task 6).
4. **Fichier JSON enregistré avec un BOM UTF-8 ou entouré d'espaces** (fréquent sous Windows) : analysé normalement, pas « JSON invalide » (Task 8).
5. **Erreur au milieu d'une restauration** : toutes les données d'avant restent intactes (Task 6).

---

## File Structure

```
mobile/
├── package.json                               ← + expo-document-picker, expo-file-system
├── scripts/anonymize-backup.mjs               ← fabrique la fixture anonymisée (Task 2)
├── docs/DEVICE_CHECKLIST.md                   ← + section M3b (Task 10)
└── src/
    ├── app/
    │   ├── _layout.tsx                        ← + écrans onboarding / import dans la pile racine
    │   ├── (tabs)/_layout.tsx                 ← garde de premier lancement
    │   ├── (tabs)/today.tsx, (tabs)/plan.tsx  ← ouverture éditeur / import
    │   ├── onboarding.tsx
    │   └── import.tsx
    ├── domain/
    │   ├── importFormat.ts                    ← detectImportFormat
    │   ├── importBundle.ts                    ← ImportBundle, ImportReport, makeReport
    │   ├── legacyImport.ts                    ← parseLegacyBackup
    │   ├── nativeBackup.ts                    ← NativeBackup, parseNativeBackup, toNativeBackup
    │   └── __fixtures__/pwa-backup.json       ← sauvegarde réelle anonymisée
    ├── db/repos/importRepo.ts                 ← replaceAll, importProgram
    ├── platform/pickJsonFile.ts / .web.ts     ← sélecteur de fichier → texte
    ├── features/
    │   ├── import/analyzeImport.ts, ImportScreen.tsx
    │   ├── onboarding/needsOnboarding.ts, OnboardingScreen.tsx
    │   ├── editor/saveDraft.ts                ← onboarded = vrai à la création
    │   ├── plan/ProgramsView.tsx, PlanScreen.tsx   ← bouton « Importer »
    │   └── today/NoProgram.tsx, TodayScreen.tsx    ← « Créer » / « Importer »
    └── i18n/locales/fr.json, en.json          ← + clés M3b
```

---

### Task 1: Dépendances + sélecteur de fichier (`platform/pickJsonFile`)

**Files:**
- Modify: `mobile/package.json`, `mobile/src/platform/types.ts`, `mobile/src/test/jestSetup.js`
- Create: `mobile/src/platform/pickJsonFile.ts`, `mobile/src/platform/pickJsonFile.web.ts`

**Interfaces:**
- Produces:
  - `type PickedFile = { kind: 'ok'; text: string } | { kind: 'cancel' } | { kind: 'too_large' } | { kind: 'error' }` (dans `platform/types.ts`)
  - `MAX_IMPORT_BYTES = 5 * 1024 * 1024`, `pickJsonFile(): Promise<PickedFile>`
  - mock Jest : `pickJsonFile` = `jest.fn(() => Promise.resolve({ kind: 'cancel' }))`

Adaptateur vérifié à la main sur appareil (Task 10) ; vérification automatique : `tsc` et l'export web.

- [ ] **Step 1: Installer**

```bash
npx expo install expo-document-picker expo-file-system
```
Vérifier `package.json` : `expo-document-picker ~57.0.x`, `expo-file-system ~57.0.x`. Si `app.json` reçoit un plugin, le garder (commit avec la tâche).

- [ ] **Step 2: Type + implémentations**

Ajouter à `mobile/src/platform/types.ts` :
```ts
/** Résultat du choix d'un fichier JSON à importer */
export type PickedFile = { kind: 'ok'; text: string } | { kind: 'cancel' } | { kind: 'too_large' } | { kind: 'error' };
```

`mobile/src/platform/pickJsonFile.ts` :
```ts
// Choix d'un fichier JSON (Fichiers, iCloud, Drive…) puis lecture du texte
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { PickedFile } from './types';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export async function pickJsonFile(): Promise<PickedFile> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
    const asset = result.canceled ? undefined : result.assets?.[0];
    if (!asset) return { kind: 'cancel' };
    if ((asset.size ?? 0) > MAX_IMPORT_BYTES) return { kind: 'too_large' };
    return { kind: 'ok', text: await new File(asset.uri).text() };
  } catch {
    return { kind: 'error' };
  }
}
```

`mobile/src/platform/pickJsonFile.web.ts` :
```ts
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
```

Ajouter à `mobile/src/test/jestSetup.js` :
```js
jest.mock('@/platform/pickJsonFile', () => ({
  MAX_IMPORT_BYTES: 5 * 1024 * 1024,
  pickJsonFile: jest.fn(() => Promise.resolve({ kind: 'cancel' })),
}));
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npx jest`
Expected: aucune erreur TypeScript ; suite verte (273 tests).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app.json src/platform src/test/jestSetup.js
git commit -m "chore(mobile): add document picker and JSON file reading adapter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Fixture anonymisée + détection du format

**Files:**
- Create: `mobile/scripts/anonymize-backup.mjs`, `mobile/src/domain/__fixtures__/pwa-backup.json` (générée), `mobile/src/domain/importFormat.ts`, `mobile/src/domain/__tests__/importFormat.test.ts`

**Interfaces:**
- Produces:
  - `type ImportFormat = 'program' | 'pwa-backup' | 'native-backup' | 'unknown'`
  - `detectImportFormat(value: unknown): ImportFormat`
  - fixture `@/domain/__fixtures__/pwa-backup.json` : sauvegarde réelle du 7 oct. 2026, libellés de programmes remplacés par `PROGRAMME A`, `PROGRAMME B`

- [ ] **Step 1: Générer la fixture**

`mobile/scripts/anonymize-backup.mjs` :
```js
// Copie anonymisée d'une sauvegarde PWA pour les tests : libellés de programmes neutralisés,
// structure, clés, dates et poids conservés.
// Usage : node scripts/anonymize-backup.mjs ../docs/workout-backup-2026-10-07.json
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input] = process.argv;
if (!input) throw new Error('chemin de la sauvegarde manquant');
const backup = JSON.parse(readFileSync(input, 'utf8'));
const programs = JSON.parse(backup.programs);
programs.forEach((p, i) => { p.meta.label = `PROGRAMME ${String.fromCharCode(65 + i)}`; });
backup.programs = JSON.stringify(programs);
writeFileSync('src/domain/__fixtures__/pwa-backup.json', `${JSON.stringify(backup, null, 2)}\n`);
console.log(`fixture écrite (${programs.length} programmes)`);
```
Run: `node scripts/anonymize-backup.mjs ../docs/workout-backup-2026-10-07.json`
Expected: `fixture écrite (2 programmes)`. Vérifier `grep -c "Remise en forme\|Abdos à la maison" src/domain/__fixtures__/pwa-backup.json` → `0`.

- [ ] **Step 2: Écrire le test**

`mobile/src/domain/__tests__/importFormat.test.ts` :
```ts
import { detectImportFormat } from '../importFormat';
import backup from '../__fixtures__/pwa-backup.json';

describe('detectImportFormat', () => {
  it('programme seul', () => {
    expect(detectImportFormat({ meta: { label: 'P' }, sessions: {} })).toBe('program');
  });
  it('sauvegarde PWA : marqueur, programmes, programme actif ou clés préfixées', () => {
    expect(detectImportFormat(backup)).toBe('pwa-backup');
    expect(detectImportFormat({ _backupFormat: 1 })).toBe('pwa-backup');
    expect(detectImportFormat({ programs: '[]' })).toBe('pwa-backup');
    expect(detectImportFormat({ activeProgram: 'x' })).toBe('pwa-backup');
    expect(detectImportFormat({ 'weight:presse': '100' })).toBe('pwa-backup');
    expect(detectImportFormat({ meta: {}, sessions: {}, programs: '[]' })).toBe('pwa-backup');
  });
  it('sauvegarde native', () => {
    expect(detectImportFormat({ _format: 'workout-native', _version: 1 })).toBe('native-backup');
  });
  it('inconnu : tableau, null, texte, objet quelconque', () => {
    expect(detectImportFormat([])).toBe('unknown');
    expect(detectImportFormat(null)).toBe('unknown');
    expect(detectImportFormat('x')).toBe('unknown');
    expect(detectImportFormat({ foo: 1 })).toBe('unknown');
  });
});
```

- [ ] **Step 3: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/importFormat.test.ts`
Expected: FAIL — `Cannot find module '../importFormat'`.

- [ ] **Step 4: Implémenter**

`mobile/src/domain/importFormat.ts` :
```ts
// Détection du contenu importé — règle isBackupSnapshot de la PWA + format natif
export type ImportFormat = 'program' | 'pwa-backup' | 'native-backup' | 'unknown';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function detectImportFormat(value: unknown): ImportFormat {
  if (!isObj(value)) return 'unknown';
  if (value._format === 'workout-native') return 'native-backup';
  if (isObj(value.meta) && isObj(value.sessions) && !('programs' in value)) return 'program';
  if (value._backupFormat === 1 || 'programs' in value || 'activeProgram' in value) return 'pwa-backup';
  if (Object.keys(value).some((k) => /^(weight|log|track|layout):/.test(k))) return 'pwa-backup';
  return 'unknown';
}
```

- [ ] **Step 5: Vérifier le succès**

Run: `npx jest src/domain/__tests__/importFormat.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/anonymize-backup.mjs src/domain/__fixtures__/pwa-backup.json src/domain/importFormat.ts src/domain/__tests__/importFormat.test.ts
git commit -m "feat(mobile): detect import formats and add anonymized PWA backup fixture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `ImportBundle` + `parseLegacyBackup` (cas construits)

**Files:**
- Create: `mobile/src/domain/importBundle.ts`, `mobile/src/domain/legacyImport.ts`, `mobile/src/domain/__tests__/legacyImport.test.ts`

**Interfaces:**
- Consumes: `parseProgram`, `Program`, `Units`, `Lang`, `ThemePref`, `isLang`, `isThemePref`, `parseWeightInput`, `schemeReps`.
- Produces (`importBundle.ts`):
  ```ts
  type BundleSource = 'manual' | 'ai' | 'import' | 'example';
  type BundleProgram = { sourceId: string; definition: Program; source: BundleSource };
  type WorkoutStatus = 'in_progress' | 'completed' | 'abandoned';
  type BundleWorkout = { ref: string; programRef: string; sessionKey: string; date: string; status: WorkoutStatus; startedAt: string; completedAt: string | null };
  type BundleSet = { workoutRef: string; exerciseId: string; setIndex: number; done: boolean; weight: number | null; reps: number | null; performedName: string | null; doneAt: string | null };
  type BundleWeight = { key: string; weight: number; unit: Units };
  type BundleLayout = { programRef: string; sessionKey: string; order: string[]; swaps: Record<string, string> };
  type BundleSettings = { lang?: Lang; theme?: ThemePref; aiEnabled?: boolean; keepAwake?: boolean };
  type IgnoreReason = 'unknown_key' | 'invalid_program' | 'unknown_program' | 'unknown_session' | 'no_checked_set' | 'already_logged' | 'duplicate' | 'invalid_value';
  type IgnoredItem = { key: string; reason: IgnoreReason };
  type ImportReport = { programs: number; workouts: number; sets: number; weights: number; layouts: number; ignored: IgnoredItem[] };
  type ImportBundle = { programs: BundleProgram[]; activeProgramRef: string | null; workouts: BundleWorkout[]; sets: BundleSet[]; weights: BundleWeight[]; layouts: BundleLayout[]; settings: BundleSettings; report: ImportReport };
  type ParseResult = { ok: true; bundle: ImportBundle } | { ok: false; error: 'invalid' | 'no_valid_program' };
  function makeReport(b: Omit<ImportBundle, 'report'>, ignored: IgnoredItem[]): ImportReport;
  ```
- Produces (`legacyImport.ts`): `parseLegacyBackup(raw: Record<string, unknown>, today: string): ParseResult`

- [ ] **Step 1: Écrire les tests (cas construits)**

`mobile/src/domain/__tests__/legacyImport.test.ts` :
```ts
import { parseLegacyBackup } from '../legacyImport';
import { makeExercise, makeProgramInput, makeSession } from '../__fixtures__/builders';

const prog = (id: string, label = 'P') => ({
  id,
  ...makeProgramInput({ '1': 'fb' }, {
    fb: makeSession('FULL', [makeExercise('presse', 2, { scheme: '2×8' }), makeExercise('gainage', 2, { scheme: '2×45 sec' })]),
  }, { label }),
});
const log = (o: Record<string, unknown>) => JSON.stringify({
  sessionKey: 'fb', programId: 'prog-1', date: '2026-06-01', finishedAt: '2026-06-01T10:00:00.000Z',
  exercises: [{ id: 'presse', sets: 2, weight: '100' }], ...o,
});
const TODAY = '2026-10-07';

describe('parseLegacyBackup — cas construits', () => {
  it('séance terminée : séries cochées, poids du log, reps du schéma, ids remappables', () => {
    const r = parseLegacyBackup({ programs: JSON.stringify([prog('prog-1')]), activeProgram: 'prog-1', 'log:2026-06-01': log({}) }, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bundle.activeProgramRef).toBe('prog-1');
    expect(r.bundle.programs[0].definition).not.toHaveProperty('id');
    expect(r.bundle.workouts).toEqual([{ ref: 'log:2026-06-01:fb', programRef: 'prog-1', sessionKey: 'fb', date: '2026-06-01', status: 'completed', startedAt: '2026-06-01T10:00:00.000Z', completedAt: '2026-06-01T10:00:00.000Z' }]);
    expect(r.bundle.sets.map((s) => [s.exerciseId, s.setIndex, s.done, s.weight, s.reps])).toEqual([['presse', 0, true, 100, 8], ['presse', 1, true, 100, 8]]);
  });

  it('Review Focus 1 : ancienne clé `program`, log sans programId, track en tableau', () => {
    const r = parseLegacyBackup({
      program: JSON.stringify(prog('old')),
      'log:2026-06-01': log({ programId: undefined }),
      'track:2026-06-02:fb': JSON.stringify([[true, false], [false, false]]),
    }, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bundle.workouts.map((w) => [w.date, w.status, w.programRef])).toEqual([['2026-06-01', 'completed', 'old'], ['2026-06-02', 'abandoned', 'old']]);
    expect(r.bundle.sets.filter((s) => s.workoutRef === 'track:2026-06-02:fb').map((s) => [s.exerciseId, s.setIndex])).toEqual([['presse', 0]]);
  });

  it('séance entamée aujourd\'hui → en cours ; poids mémorisé repris', () => {
    const r = parseLegacyBackup({
      programs: JSON.stringify([prog('prog-1')]), activeProgram: 'prog-1', 'weight:presse': '102,5',
      [`track:${TODAY}:fb`]: JSON.stringify({ v: 2, presse: [true, true] }),
    }, TODAY);
    if (!r.ok) throw new Error('attendu ok');
    expect(r.bundle.workouts[0]).toMatchObject({ status: 'in_progress', date: TODAY });
    expect(r.bundle.sets.map((s) => s.weight)).toEqual([102.5, 102.5]);
    expect(r.bundle.weights).toEqual([{ key: 'presse', weight: 102.5, unit: 'kg' }]);
  });

  it('ignorés : programme invalide, doublon, séance inconnue, aucune série, poids vide, clé inconnue', () => {
    const r = parseLegacyBackup({
      programs: JSON.stringify([prog('prog-1'), { id: 'bad', meta: {} }]), activeProgram: 'prog-1',
      'log:2026-06-01': log({}),
      'log:2026-06-01b': log({}),
      'track:2026-06-03:ghost': JSON.stringify({ v: 2, x: [true] }),
      'track:2026-06-04:fb': JSON.stringify({ v: 2, presse: [false, false] }),
      'weight:gainage': '',
      logWeightRepair_v2: '1',
      'program-draft': '{}',
      _exportedAt: '2026-10-07T00:00:00Z',
    }, TODAY);
    if (!r.ok) throw new Error('attendu ok');
    expect(r.bundle.report.ignored).toEqual(expect.arrayContaining([
      { key: 'programs[1]', reason: 'invalid_program' },
      { key: 'log:2026-06-01b', reason: 'duplicate' },
      { key: 'track:2026-06-03:ghost', reason: 'unknown_session' },
      { key: 'track:2026-06-04:fb', reason: 'no_checked_set' },
      { key: 'weight:gainage', reason: 'invalid_value' },
      { key: 'logWeightRepair_v2', reason: 'unknown_key' },
    ]));
    expect(r.bundle.report.ignored.map((i) => i.key)).not.toContain('program-draft');
    expect(r.bundle.report.ignored.map((i) => i.key)).not.toContain('_exportedAt');
  });

  it('séance entamée le même jour qu\'un log de la même séance → déjà enregistrée', () => {
    const r = parseLegacyBackup({
      programs: JSON.stringify([prog('prog-1')]), activeProgram: 'prog-1',
      'log:2026-06-01': log({}), 'track:2026-06-01:fb': JSON.stringify({ v: 2, presse: [true] }),
    }, TODAY);
    if (!r.ok) throw new Error('attendu ok');
    expect(r.bundle.report.ignored).toContainEqual({ key: 'track:2026-06-01:fb', reason: 'already_logged' });
  });

  it('réglages : thème, langue, IA, écran allumé', () => {
    const r = parseLegacyBackup({
      programs: JSON.stringify([prog('prog-1')]), lang: 'en', theme: 'light', aiEnabled: 'false', 'pref-timer-wakelock': 'true',
    }, TODAY);
    if (!r.ok) throw new Error('attendu ok');
    expect(r.bundle.settings).toEqual({ lang: 'en', theme: 'light', aiEnabled: false, keepAwake: true });
  });

  it('aucun programme valide → refus', () => {
    expect(parseLegacyBackup({ programs: JSON.stringify([{ meta: {} }]), 'weight:x': '10' }, TODAY)).toEqual({ ok: false, error: 'no_valid_program' });
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/legacyImport.test.ts`
Expected: FAIL — `Cannot find module '../legacyImport'`.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/importBundle.ts` :
```ts
// ============================================================
// Paquet d'import — contenu normalisé, indépendant du format source,
// écrit ensuite en une seule transaction (db/repos/importRepo).
// Les ids (sourceId, ref) ne servent qu'au remappage.
// ============================================================
import type { Lang, ThemePref } from './prefs';
import type { Program, Units } from './program';

export type BundleSource = 'manual' | 'ai' | 'import' | 'example';
export type BundleProgram = { sourceId: string; definition: Program; source: BundleSource };
export type WorkoutStatus = 'in_progress' | 'completed' | 'abandoned';
export type BundleWorkout = {
  ref: string; programRef: string; sessionKey: string; date: string;
  status: WorkoutStatus; startedAt: string; completedAt: string | null;
};
export type BundleSet = {
  workoutRef: string; exerciseId: string; setIndex: number; done: boolean;
  weight: number | null; reps: number | null; performedName: string | null; doneAt: string | null;
};
export type BundleWeight = { key: string; weight: number; unit: Units };
export type BundleLayout = { programRef: string; sessionKey: string; order: string[]; swaps: Record<string, string> };
export type BundleSettings = { lang?: Lang; theme?: ThemePref; aiEnabled?: boolean; keepAwake?: boolean };

export type IgnoreReason =
  | 'unknown_key' | 'invalid_program' | 'unknown_program' | 'unknown_session'
  | 'no_checked_set' | 'already_logged' | 'duplicate' | 'invalid_value';
export type IgnoredItem = { key: string; reason: IgnoreReason };
export type ImportReport = { programs: number; workouts: number; sets: number; weights: number; layouts: number; ignored: IgnoredItem[] };

export type ImportBundle = {
  programs: BundleProgram[];
  activeProgramRef: string | null;
  workouts: BundleWorkout[];
  sets: BundleSet[];
  weights: BundleWeight[];
  layouts: BundleLayout[];
  settings: BundleSettings;
  report: ImportReport;
};

export type ParseResult = { ok: true; bundle: ImportBundle } | { ok: false; error: 'invalid' | 'no_valid_program' };

export function makeReport(b: Omit<ImportBundle, 'report'>, ignored: IgnoredItem[]): ImportReport {
  return {
    programs: b.programs.length, workouts: b.workouts.length, sets: b.sets.length,
    weights: b.weights.length, layouts: b.layouts.length, ignored,
  };
}
```

`mobile/src/domain/legacyImport.ts` :
```ts
// ============================================================
// Sauvegarde de la PWA (instantané du localStorage, valeurs en chaînes)
// → ImportBundle. Règles : addendum M3b §2. Fonction pure.
// ============================================================
import {
  makeReport, type BundleLayout, type BundleProgram, type BundleSet, type BundleSettings,
  type BundleWeight, type BundleWorkout, type IgnoredItem, type ParseResult,
} from './importBundle';
import { isLang, isThemePref } from './prefs';
import { parseProgram, type Exercise, type Program } from './program';
import { parseWeightInput, schemeReps } from './scheme';

/** Clés de la PWA volontairement ignorées sans être signalées */
const SILENT = new Set(['_backupFormat', '_exportedAt', 'program-draft', 'workout-active-timer']);
/** Clés traitées ailleurs dans ce module */
const HANDLED = new Set(['programs', 'program', 'activeProgram', 'lang', 'theme', 'aiEnabled', 'pref-timer-wakelock', 'onboarded']);
const PREFIXED = /^(weight|log|track|layout):/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valeur du localStorage : JSON si possible, sinon la chaîne brute */
function decode(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

const bool = (v: unknown): boolean | undefined => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined);
const noonIso = (date: string) => new Date(`${date}T12:00:00`).toISOString();
const allExercises = (p: Program, sessionKey: string): Exercise[] => {
  const s = p.sessions[sessionKey];
  return s ? [...s.exercises, ...(s.bonus?.exercises ?? [])] : [];
};

export function parseLegacyBackup(raw: Record<string, unknown>, today: string): ParseResult {
  const ignored: IgnoredItem[] = [];
  const keys = Object.keys(raw).sort();

  /* ── Programmes ── */
  const decodedList = decode(raw.programs ?? raw.program);
  const items = Array.isArray(decodedList) ? decodedList : decodedList ? [decodedList] : [];
  const programs: BundleProgram[] = [];
  items.forEach((item, i) => {
    const parsed = parseProgram(item);
    if (!parsed.ok) {
      ignored.push({ key: `programs[${i}]`, reason: 'invalid_program' });
      return;
    }
    const { id: _pwaId, ...definition } = parsed.program as Program & { id?: unknown };
    const sourceId = isObj(item) && typeof item.id === 'string' ? item.id : `program-${i}`;
    programs.push({ sourceId, definition: definition as Program, source: 'import' });
  });
  if (programs.length === 0) return { ok: false, error: 'no_valid_program' };

  const byId = new Map(programs.map((p) => [p.sourceId, p]));
  const activeId = decode(raw.activeProgram);
  const active = (typeof activeId === 'string' && byId.get(activeId)) || programs[0];
  const hasSession = (p: BundleProgram, key: string) => Object.hasOwn(p.definition.sessions, key);

  /* ── Poids mémorisés ── */
  const weightOf = new Map<string, number>();
  const weights: BundleWeight[] = [];
  const unitOf = (exerciseId: string) => {
    const owner = programs.find((p) => Object.keys(p.definition.sessions).some((k) => allExercises(p.definition, k).some((e) => e.id === exerciseId)));
    return (owner ?? active).definition.meta.units;
  };
  for (const key of keys.filter((k) => k.startsWith('weight:'))) {
    const w = parseWeightInput(String(raw[key] ?? ''));
    if (w === null) {
      ignored.push({ key, reason: 'invalid_value' });
      continue;
    }
    const exerciseId = key.slice('weight:'.length);
    weightOf.set(exerciseId, w);
    weights.push({ key: exerciseId, weight: w, unit: unitOf(exerciseId) });
  }

  /* ── Séances terminées (log:) ── */
  const workouts: BundleWorkout[] = [];
  const sets: BundleSet[] = [];
  const seen = new Set<string>();
  const logged = new Set<string>();
  for (const key of keys.filter((k) => k.startsWith('log:'))) {
    const entry = decode(raw[key]);
    if (!isObj(entry) || typeof entry.sessionKey !== 'string') {
      ignored.push({ key, reason: 'invalid_value' });
      continue;
    }
    const sessionKey = entry.sessionKey;
    const date = typeof entry.date === 'string' ? entry.date : key.slice('log:'.length, 'log:'.length + 10);
    const byProgramId = typeof entry.programId === 'string' ? byId.get(entry.programId) : undefined;
    const program = byProgramId ?? (hasSession(active, sessionKey) ? active : undefined);
    if (!program) {
      ignored.push({ key, reason: 'unknown_program' });
      continue;
    }
    if (!hasSession(program, sessionKey)) {
      ignored.push({ key, reason: 'unknown_session' });
      continue;
    }
    const unique = `${program.sourceId}|${sessionKey}|${date}`;
    if (seen.has(unique)) {
      ignored.push({ key, reason: 'duplicate' });
      continue;
    }
    seen.add(unique);
    logged.add(`${date}:${sessionKey}`);
    const finished = typeof entry.finishedAt === 'string' ? entry.finishedAt : noonIso(date);
    const ref = `log:${date}:${sessionKey}`;
    workouts.push({ ref, programRef: program.sourceId, sessionKey, date, status: 'completed', startedAt: finished, completedAt: finished });
    const defs = allExercises(program.definition, sessionKey);
    for (const ex of Array.isArray(entry.exercises) ? entry.exercises : []) {
      if (!isObj(ex) || typeof ex.id !== 'string') continue;
      const count = Math.max(0, Math.floor(Number(ex.sets) || 0));
      const weight = ex.weight == null ? null : parseWeightInput(String(ex.weight));
      const def = defs.find((d) => d.id === ex.id);
      const reps = def ? schemeReps(def) : null;
      for (let i = 0; i < count; i++) {
        sets.push({ workoutRef: ref, exerciseId: ex.id, setIndex: i, done: true, weight, reps, performedName: null, doneAt: finished });
      }
    }
  }

  /* ── Séances entamées (track:) — la PWA ne suivait que le programme actif ── */
  for (const key of keys.filter((k) => k.startsWith('track:'))) {
    const date = key.slice('track:'.length, 'track:'.length + 10);
    const sessionKey = key.slice('track:'.length + 11);
    if (!hasSession(active, sessionKey)) {
      ignored.push({ key, reason: 'unknown_session' });
      continue;
    }
    const data = decode(raw[key]);
    const defs = allExercises(active.definition, sessionKey);
    const checked: [string, number][] = [];
    if (Array.isArray(data)) {
      data.forEach((row, i) => {
        const id = active.definition.sessions[sessionKey].exercises[i]?.id;
        if (id && Array.isArray(row)) row.forEach((v, j) => { if (v === true) checked.push([id, j]); });
      });
    } else if (isObj(data)) {
      for (const [id, row] of Object.entries(data)) {
        if (id !== 'v' && Array.isArray(row)) row.forEach((v, j) => { if (v === true) checked.push([id, j]); });
      }
    }
    if (checked.length === 0) {
      ignored.push({ key, reason: 'no_checked_set' });
      continue;
    }
    if (logged.has(`${date}:${sessionKey}`)) {
      ignored.push({ key, reason: 'already_logged' });
      continue;
    }
    const unique = `${active.sourceId}|${sessionKey}|${date}`;
    if (seen.has(unique)) {
      ignored.push({ key, reason: 'duplicate' });
      continue;
    }
    seen.add(unique);
    const at = noonIso(date);
    const ref = `track:${date}:${sessionKey}`;
    workouts.push({ ref, programRef: active.sourceId, sessionKey, date, status: date === today ? 'in_progress' : 'abandoned', startedAt: at, completedAt: null });
    for (const [exerciseId, setIndex] of checked) {
      const def = defs.find((d) => d.id === exerciseId);
      sets.push({ workoutRef: ref, exerciseId, setIndex, done: true, weight: weightOf.get(exerciseId) ?? null, reps: def ? schemeReps(def) : null, performedName: null, doneAt: at });
    }
  }

  /* ── Organisation (layout:) ── */
  const layouts: BundleLayout[] = [];
  for (const key of keys.filter((k) => k.startsWith('layout:'))) {
    const sessionKey = key.slice('layout:'.length);
    const data = decode(raw[key]);
    if (!hasSession(active, sessionKey)) {
      ignored.push({ key, reason: 'unknown_session' });
      continue;
    }
    const order = isObj(data) && Array.isArray(data.order) ? data.order.filter((x): x is string => typeof x === 'string') : null;
    const swaps = isObj(data) && isObj(data.swaps) ? Object.fromEntries(Object.entries(data.swaps).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {};
    if (!order) {
      ignored.push({ key, reason: 'invalid_value' });
      continue;
    }
    layouts.push({ programRef: active.sourceId, sessionKey, order, swaps });
  }

  /* ── Réglages ── */
  const settings: BundleSettings = {};
  if (isLang(raw.lang)) settings.lang = raw.lang;
  if (isThemePref(raw.theme)) settings.theme = raw.theme;
  const ai = bool(raw.aiEnabled);
  if (ai !== undefined) settings.aiEnabled = ai;
  const awake = bool(raw['pref-timer-wakelock']);
  if (awake !== undefined) settings.keepAwake = awake;

  /* ── Clés inconnues ── */
  for (const key of keys) {
    if (SILENT.has(key) || HANDLED.has(key) || PREFIXED.test(key)) continue;
    ignored.push({ key, reason: 'unknown_key' });
  }

  const body = { programs, activeProgramRef: active.sourceId, workouts, sets, weights, layouts, settings };
  return { ok: true, bundle: { ...body, report: makeReport(body, ignored) } };
}
```
Note : le test « doublon » utilise une clé `log:2026-06-01b` dont le `date` interne vaut `2026-06-01` : c'est le `date` du log qui fait foi.

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/domain/__tests__/legacyImport.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/importBundle.ts src/domain/legacyImport.ts src/domain/__tests__/legacyImport.test.ts
git commit -m "feat(mobile): convert PWA backups into a normalized import bundle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `parseLegacyBackup` sur la sauvegarde réelle

**Files:**
- Create: `mobile/src/domain/__tests__/legacyImportFixture.test.ts`

**Interfaces:**
- Consumes: `parseLegacyBackup`, fixture `pwa-backup.json`.

- [ ] **Step 1: Écrire le test (attendus de l'addendum §2)**

`mobile/src/domain/__tests__/legacyImportFixture.test.ts` :
```ts
import { parseLegacyBackup } from '../legacyImport';
import backup from '../__fixtures__/pwa-backup.json';

const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');

describe('sauvegarde PWA réelle (anonymisée) du 7 oct. 2026', () => {
  if (!r.ok) throw new Error('la fixture doit être importable');
  const b = r.bundle;

  it('2 programmes ; programme actif = PROGRAMME A', () => {
    expect(b.programs.map((p) => p.definition.meta.label)).toEqual(['PROGRAMME A', 'PROGRAMME B']);
    expect(b.activeProgramRef).toBe('prog-1780651900282');
  });

  it('7 séances terminées (114 séries) + 1 séance abandonnée (15 juin, bas du corps, 1 série)', () => {
    expect(b.workouts.filter((w) => w.status === 'completed')).toHaveLength(7);
    expect(b.workouts.filter((w) => w.status === 'abandoned').map((w) => [w.date, w.sessionKey])).toEqual([['2026-06-15', 'bas-du-corps']]);
    expect(b.workouts.filter((w) => w.status === 'in_progress')).toHaveLength(0);
    expect(b.sets).toHaveLength(115);
    expect(b.sets.filter((s) => s.workoutRef === 'track:2026-06-15:bas-du-corps').map((s) => s.exerciseId)).toEqual(['gainage-vend']);
  });

  it('10 poids importés sur 11 (1 vide)', () => {
    expect(b.weights).toHaveLength(10);
    expect(b.report.ignored).toContainEqual({ key: 'weight:gainage-vend', reason: 'invalid_value' });
  });

  it('entrées track ignorées : 4 sans série cochée, 2 séances introuvables', () => {
    const reasons = b.report.ignored.filter((i) => i.key.startsWith('track:')).map((i) => i.reason).sort();
    expect(reasons).toEqual(['no_checked_set', 'no_checked_set', 'no_checked_set', 'no_checked_set', 'unknown_session', 'unknown_session']);
  });

  it('réglages et clé inconnue', () => {
    expect(b.settings).toEqual({ theme: 'light', aiEnabled: false });
    expect(b.report.ignored).toContainEqual({ key: 'logWeightRepair_v2', reason: 'unknown_key' });
    expect(b.report).toMatchObject({ programs: 2, workouts: 8, sets: 115, weights: 10, layouts: 0 });
    expect(b.report.ignored).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/domain/__tests__/legacyImportFixture.test.ts`
Expected: PASS si la Task 3 est correcte (test d'assemblage sur données réelles). Un écart révèle soit un défaut du parseur (corriger le code via systematic-debugging), soit un attendu mal compté (vérifier la fixture avec `node -e` et consigner).

- [ ] **Step 3: Commit**

```bash
git add src/domain/__tests__/legacyImportFixture.test.ts
git commit -m "test(mobile): pin PWA backup conversion on the real anonymized backup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Format natif `workout-native` v1

**Files:**
- Create: `mobile/src/domain/nativeBackup.ts`, `mobile/src/domain/__tests__/nativeBackup.test.ts`

**Interfaces:**
- Consumes: `ImportBundle`, `ParseResult`, `makeReport`, `parseProgram`.
- Produces:
  ```ts
  type NativeBackup = {
    _format: 'workout-native'; _version: 1; exportedAt: string;
    programs: { id: string; source: BundleSource; definition: Program }[];
    activeProgramId: string | null;
    workouts: { id: string; programId: string; sessionKey: string; date: string; status: WorkoutStatus; startedAt: string; completedAt: string | null }[];
    setEntries: { workoutId: string; exerciseId: string; setIndex: number; done: boolean; weight: number | null; reps: number | null; performedName: string | null; doneAt: string | null }[];
    weights: BundleWeight[];
    layouts: { programId: string; sessionKey: string; order: string[]; swaps: Record<string, string> }[];
    settings: BundleSettings;
  };
  toNativeBackup(bundle: ImportBundle, exportedAt: string): NativeBackup;
  parseNativeBackup(value: unknown): ParseResult;
  ```

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/__tests__/nativeBackup.test.ts` :
```ts
import { parseLegacyBackup } from '../legacyImport';
import { parseNativeBackup, toNativeBackup } from '../nativeBackup';
import backup from '../__fixtures__/pwa-backup.json';

describe('format natif workout-native v1', () => {
  const legacy = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
  if (!legacy.ok) throw new Error('fixture invalide');

  it('aller-retour bundle → JSON → bundle sans perte', () => {
    const json = JSON.parse(JSON.stringify(toNativeBackup(legacy.bundle, '2026-10-07T20:00:00.000Z')));
    expect(json).toMatchObject({ _format: 'workout-native', _version: 1, exportedAt: '2026-10-07T20:00:00.000Z' });
    const back = parseNativeBackup(json);
    if (!back.ok) throw new Error('attendu ok');
    const { report: r1, ...a } = legacy.bundle;
    const { report: r2, ...b } = back.bundle;
    expect(b).toEqual(a);
    expect(r2).toMatchObject({ programs: r1.programs, workouts: r1.workouts, sets: r1.sets, weights: r1.weights, ignored: [] });
  });

  it('refuse un autre format ou une autre version', () => {
    expect(parseNativeBackup({ _format: 'autre' })).toEqual({ ok: false, error: 'invalid' });
    expect(parseNativeBackup({ _format: 'workout-native', _version: 2 })).toEqual({ ok: false, error: 'invalid' });
  });

  it('écarte les éléments invalides et les séances d\'un programme inconnu', () => {
    const json = toNativeBackup(legacy.bundle, 'x') as unknown as Record<string, unknown[]>;
    (json.programs as unknown[]).push({ id: 'bad', source: 'import', definition: { meta: {} } });
    (json.workouts as unknown[]).push({ id: 'w-ghost', programId: 'ghost', sessionKey: 's', date: '2026-01-01', status: 'completed', startedAt: 'x', completedAt: 'x' });
    const r = parseNativeBackup(json);
    if (!r.ok) throw new Error('attendu ok');
    expect(r.bundle.programs).toHaveLength(2);
    expect(r.bundle.report.ignored).toEqual(expect.arrayContaining([
      { key: 'programs[2]', reason: 'invalid_program' },
      { key: 'workouts[8]', reason: 'unknown_program' },
    ]));
  });

  it('sans programme valide → refus', () => {
    expect(parseNativeBackup({ _format: 'workout-native', _version: 1, programs: [], workouts: [], setEntries: [], weights: [], layouts: [], settings: {} }))
      .toEqual({ ok: false, error: 'no_valid_program' });
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/nativeBackup.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/nativeBackup.ts` :
```ts
// ============================================================
// Sauvegarde native « workout-native » v1 (spec §3.7).
// Lecture au M3b ; l'export du M4 utilisera toNativeBackup.
// ============================================================
import {
  makeReport, type BundleLayout, type BundleProgram, type BundleSet, type BundleSettings, type BundleSource,
  type BundleWeight, type BundleWorkout, type IgnoredItem, type ImportBundle, type ParseResult, type WorkoutStatus,
} from './importBundle';
import { isLang, isThemePref } from './prefs';
import { parseProgram, type Program } from './program';

export type NativeBackup = {
  _format: 'workout-native';
  _version: 1;
  exportedAt: string;
  programs: { id: string; source: BundleSource; definition: Program }[];
  activeProgramId: string | null;
  workouts: { id: string; programId: string; sessionKey: string; date: string; status: WorkoutStatus; startedAt: string; completedAt: string | null }[];
  setEntries: {
    workoutId: string; exerciseId: string; setIndex: number; done: boolean;
    weight: number | null; reps: number | null; performedName: string | null; doneAt: string | null;
  }[];
  weights: BundleWeight[];
  layouts: { programId: string; sessionKey: string; order: string[]; swaps: Record<string, string> }[];
  settings: BundleSettings;
};

const SOURCES: BundleSource[] = ['manual', 'ai', 'import', 'example'];
const STATUSES: WorkoutStatus[] = ['in_progress', 'completed', 'abandoned'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function toNativeBackup(bundle: ImportBundle, exportedAt: string): NativeBackup {
  return {
    _format: 'workout-native',
    _version: 1,
    exportedAt,
    programs: bundle.programs.map((p) => ({ id: p.sourceId, source: p.source, definition: p.definition })),
    activeProgramId: bundle.activeProgramRef,
    workouts: bundle.workouts.map((w) => ({
      id: w.ref, programId: w.programRef, sessionKey: w.sessionKey, date: w.date,
      status: w.status, startedAt: w.startedAt, completedAt: w.completedAt,
    })),
    setEntries: bundle.sets.map(({ workoutRef, ...rest }) => ({ workoutId: workoutRef, ...rest })),
    weights: bundle.weights,
    layouts: bundle.layouts.map(({ programRef, ...rest }) => ({ programId: programRef, ...rest })),
    settings: bundle.settings,
  };
}

export function parseNativeBackup(value: unknown): ParseResult {
  if (!isObj(value) || value._format !== 'workout-native' || value._version !== 1) return { ok: false, error: 'invalid' };
  const ignored: IgnoredItem[] = [];

  const programs: BundleProgram[] = [];
  list(value.programs).forEach((p, i) => {
    const parsed = isObj(p) ? parseProgram(p.definition) : null;
    if (!isObj(p) || !str(p.id) || !parsed?.ok) {
      ignored.push({ key: `programs[${i}]`, reason: 'invalid_program' });
      return;
    }
    const source = SOURCES.includes(p.source as BundleSource) ? (p.source as BundleSource) : 'import';
    programs.push({ sourceId: p.id, source, definition: parsed.program });
  });
  if (programs.length === 0) return { ok: false, error: 'no_valid_program' };
  const programIds = new Set(programs.map((p) => p.sourceId));

  const workouts: BundleWorkout[] = [];
  list(value.workouts).forEach((w, i) => {
    if (!isObj(w) || !str(w.id) || !str(w.programId) || !str(w.sessionKey) || !str(w.date) || !str(w.startedAt) || !STATUSES.includes(w.status as WorkoutStatus)) {
      ignored.push({ key: `workouts[${i}]`, reason: 'invalid_value' });
      return;
    }
    if (!programIds.has(w.programId)) {
      ignored.push({ key: `workouts[${i}]`, reason: 'unknown_program' });
      return;
    }
    workouts.push({ ref: w.id, programRef: w.programId, sessionKey: w.sessionKey, date: w.date, status: w.status as WorkoutStatus, startedAt: w.startedAt, completedAt: strOrNull(w.completedAt) });
  });
  const workoutIds = new Set(workouts.map((w) => w.ref));

  const sets: BundleSet[] = [];
  list(value.setEntries).forEach((s, i) => {
    if (!isObj(s) || !str(s.workoutId) || !str(s.exerciseId) || typeof s.setIndex !== 'number' || !workoutIds.has(s.workoutId)) {
      ignored.push({ key: `setEntries[${i}]`, reason: 'invalid_value' });
      return;
    }
    sets.push({
      workoutRef: s.workoutId, exerciseId: s.exerciseId, setIndex: s.setIndex, done: s.done === true,
      weight: numOrNull(s.weight), reps: numOrNull(s.reps), performedName: strOrNull(s.performedName), doneAt: strOrNull(s.doneAt),
    });
  });

  const weights: BundleWeight[] = [];
  list(value.weights).forEach((w, i) => {
    if (!isObj(w) || !str(w.key) || typeof w.weight !== 'number' || !(w.weight > 0) || (w.unit !== 'kg' && w.unit !== 'lbs')) {
      ignored.push({ key: `weights[${i}]`, reason: 'invalid_value' });
      return;
    }
    weights.push({ key: w.key, weight: w.weight, unit: w.unit });
  });

  const layouts: BundleLayout[] = [];
  list(value.layouts).forEach((l, i) => {
    if (!isObj(l) || !str(l.programId) || !str(l.sessionKey) || !Array.isArray(l.order) || !programIds.has(l.programId)) {
      ignored.push({ key: `layouts[${i}]`, reason: 'invalid_value' });
      return;
    }
    const swaps = isObj(l.swaps) ? Object.fromEntries(Object.entries(l.swaps).filter(([, v]) => str(v))) as Record<string, string> : {};
    layouts.push({ programRef: l.programId, sessionKey: l.sessionKey, order: l.order.filter(str), swaps });
  });

  const raw = isObj(value.settings) ? value.settings : {};
  const settings: BundleSettings = {};
  if (isLang(raw.lang)) settings.lang = raw.lang;
  if (isThemePref(raw.theme)) settings.theme = raw.theme;
  if (typeof raw.aiEnabled === 'boolean') settings.aiEnabled = raw.aiEnabled;
  if (typeof raw.keepAwake === 'boolean') settings.keepAwake = raw.keepAwake;

  const active = str(value.activeProgramId) && programIds.has(value.activeProgramId) ? value.activeProgramId : programs[0].sourceId;
  const body = { programs, activeProgramRef: active, workouts, sets, weights, layouts, settings };
  return { ok: true, bundle: { ...body, report: makeReport(body, ignored) } };
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/domain && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/nativeBackup.ts src/domain/__tests__/nativeBackup.test.ts
git commit -m "feat(mobile): define the native backup format and its parser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `importRepo` — restauration en une transaction, import d'un programme

**Files:**
- Create: `mobile/src/db/repos/importRepo.ts`, `mobile/src/db/__tests__/importRepo.test.ts`

**Interfaces:**
- Consumes: `ImportBundle`, `inTransaction`, `createProgram`, `setActiveProgram`, `setWeight`, `setSetting`, `deleteSetting`, tables `programs`, `workouts`, `setEntries`, `exerciseWeights`, `sessionLayouts`.
- Produces:
  - `replaceAll(ctx: RepoCtx, bundle: ImportBundle): { activeProgramId: string }`
  - `importProgram(ctx: RepoCtx, input: unknown): StoredProgram` (source `import`, activé, `onboarded` = vrai ; le champ `id` d'origine est retiré)

- [ ] **Step 1: Écrire les tests**

`mobile/src/db/__tests__/importRepo.test.ts` :
```ts
/** @jest-environment node */
import { and, eq, isNull } from 'drizzle-orm';
import example from '@/data/program.example.json';
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { getAllWeights } from '../repos/weightsRepo';
import { importProgram, replaceAll } from '../repos/importRepo';
import { createProgram, getActiveProgram, listPrograms, setActiveProgram } from '../repos/programsRepo';
import { getSetting, setSetting } from '../repos/settingsRepo';
import { ensureWorkout, upsertSet } from '../repos/workoutsRepo';
import { setEntries, workouts } from '../schema';
import { createTestCtx } from '../testing/createTestCtx';

function bundle() {
  const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
  if (!r.ok) throw new Error('fixture invalide');
  return r.bundle;
}
const live = (ctx: ReturnType<typeof createTestCtx>) => ({
  workouts: ctx.db.select().from(workouts).where(isNull(workouts.deletedAt)).all(),
  sets: ctx.db.select().from(setEntries).where(isNull(setEntries.deletedAt)).all(),
});

describe('importRepo.replaceAll', () => {
  it('remplace toutes les données ; références remappées ; actif et réglages appliqués', () => {
    const ctx = createTestCtx();
    const old = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, old.id);
    const w = ensureWorkout(ctx, { programId: old.id, sessionKey: 'full-body', date: '2026-10-06' });
    upsertSet(ctx, w.id, 'presse-cuisses', 0, { done: true });
    setSetting(ctx, 'activeRest', { mode: 'rest', startedAt: 0, endAt: 1, workoutId: w.id, exerciseId: 'x', setIndex: 0, pending: null });

    const { activeProgramId } = replaceAll(ctx, bundle());

    expect(listPrograms(ctx).map((p) => p.definition.meta.label)).toEqual(['PROGRAMME A', 'PROGRAMME B']);
    expect(getActiveProgram(ctx)?.id).toBe(activeProgramId);
    expect(getActiveProgram(ctx)?.definition.meta.label).toBe('PROGRAMME A');
    const { workouts: ws, sets } = live(ctx);
    expect(ws).toHaveLength(8);
    expect(ws.every((x) => x.programId !== old.id && !x.programId.startsWith('prog-'))).toBe(true);
    expect(sets).toHaveLength(115);
    expect(Object.keys(getAllWeights(ctx))).toHaveLength(10);
    expect(getSetting(ctx, 'theme')).toBe('light');
    expect(getSetting(ctx, 'aiEnabled')).toBe(false);
    expect(getSetting(ctx, 'onboarded')).toBe(true);
    expect(getSetting(ctx, 'activeRest')).toBeUndefined();
  });

  it('Review Focus 2 : restaurer deux fois ne crée aucun doublon', () => {
    const ctx = createTestCtx();
    replaceAll(ctx, bundle());
    ctx.advance(1000);
    replaceAll(ctx, bundle());
    expect(listPrograms(ctx)).toHaveLength(2);
    expect(live(ctx).workouts).toHaveLength(8);
    expect(live(ctx).sets).toHaveLength(115);
  });

  it('Review Focus 5 : une erreur en cours de restauration laisse les données intactes', () => {
    const ctx = createTestCtx();
    const old = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, old.id);
    const b = bundle();
    const broken = { ...b, programs: [...b.programs, { sourceId: 'bad', source: 'import' as const, definition: { meta: {} } as never }] };
    expect(() => replaceAll(ctx, broken)).toThrow();
    expect(listPrograms(ctx).map((p) => p.id)).toEqual([old.id]);
    expect(getActiveProgram(ctx)?.id).toBe(old.id);
  });

  it('séance terminée importée : statut, date, séries', () => {
    const ctx = createTestCtx();
    replaceAll(ctx, bundle());
    const w = ctx.db.select().from(workouts).where(and(eq(workouts.date, '2026-06-15'), isNull(workouts.deletedAt))).all();
    expect(w.map((x) => [x.sessionKey, x.status])).toEqual([['bas-du-corps', 'abandoned']]);
  });
});

describe('importRepo.importProgram', () => {
  it('Review Focus 3 : programme seul (id PWA, libellé existant) ajouté et activé, rien d\'autre touché', () => {
    const ctx = createTestCtx();
    const existing = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, existing.id);
    const w = ensureWorkout(ctx, { programId: existing.id, sessionKey: 'full-body', date: '2026-10-06' });
    const imported = importProgram(ctx, { ...example, id: 'prog-123' });
    expect(imported.source).toBe('import');
    expect(imported.definition).not.toHaveProperty('id');
    expect(listPrograms(ctx)).toHaveLength(2);
    expect(getActiveProgram(ctx)?.id).toBe(imported.id);
    expect(getSetting(ctx, 'onboarded')).toBe(true);
    expect(live(ctx).workouts.map((x) => x.id)).toEqual([w.id]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/db/__tests__/importRepo.test.ts`
Expected: FAIL — `Cannot find module '../repos/importRepo'`.

- [ ] **Step 3: Implémenter**

`mobile/src/db/repos/importRepo.ts` :
```ts
// ============================================================
// Import — restauration complète (remplacement) en UNE transaction,
// ou ajout d'un programme seul. Les ids du paquet ne servent qu'au remappage.
// ============================================================
import { isNull } from 'drizzle-orm';
import type { ImportBundle } from '@/domain/importBundle';
import { exerciseWeights, programs, sessionLayouts, setEntries, workouts } from '../schema';
import { inTransaction } from '../transaction';
import type { RepoCtx } from '../types';
import { createProgram, setActiveProgram, type StoredProgram } from './programsRepo';
import { deleteSetting, setSetting } from './settingsRepo';
import { setWeight } from './weightsRepo';

export function replaceAll(ctx: RepoCtx, bundle: ImportBundle): { activeProgramId: string } {
  return inTransaction(ctx, (tx) => {
    const now = tx.now();
    const retire = { deletedAt: now, updatedAt: now };
    tx.db.update(setEntries).set(retire).where(isNull(setEntries.deletedAt)).run();
    tx.db.update(workouts).set(retire).where(isNull(workouts.deletedAt)).run();
    tx.db.update(exerciseWeights).set(retire).where(isNull(exerciseWeights.deletedAt)).run();
    tx.db.update(sessionLayouts).set(retire).where(isNull(sessionLayouts.deletedAt)).run();
    tx.db.update(programs).set(retire).where(isNull(programs.deletedAt)).run();

    const programIds = new Map<string, string>();
    for (const p of bundle.programs) programIds.set(p.sourceId, createProgram(tx, p.definition, p.source).id);

    const workoutIds = new Map<string, string>();
    for (const w of bundle.workouts) {
      const programId = programIds.get(w.programRef);
      if (!programId) continue;
      const id = tx.newId();
      tx.db.insert(workouts).values({
        id, createdAt: now, updatedAt: now, programId, sessionKey: w.sessionKey, date: w.date,
        status: w.status, startedAt: w.startedAt, completedAt: w.completedAt,
      }).run();
      workoutIds.set(w.ref, id);
    }

    for (const s of bundle.sets) {
      const workoutId = workoutIds.get(s.workoutRef);
      if (!workoutId) continue;
      tx.db.insert(setEntries).values({
        id: tx.newId(), createdAt: now, updatedAt: now, workoutId, exerciseId: s.exerciseId, setIndex: s.setIndex,
        done: s.done, weight: s.weight, reps: s.reps, performedName: s.performedName, doneAt: s.doneAt,
      }).run();
    }

    for (const w of bundle.weights) setWeight(tx, w.key, w.weight, w.unit);

    for (const l of bundle.layouts) {
      const programId = programIds.get(l.programRef);
      if (!programId) continue;
      tx.db.insert(sessionLayouts).values({
        id: tx.newId(), createdAt: now, updatedAt: now, programId, sessionKey: l.sessionKey,
        exerciseOrder: JSON.stringify(l.order), swaps: JSON.stringify(l.swaps),
      }).run();
    }

    const s = bundle.settings;
    if (s.lang) setSetting(tx, 'lang', s.lang);
    if (s.theme) setSetting(tx, 'theme', s.theme);
    if (s.aiEnabled !== undefined) setSetting(tx, 'aiEnabled', s.aiEnabled);
    if (s.keepAwake !== undefined) setSetting(tx, 'keepAwake', s.keepAwake);
    setSetting(tx, 'onboarded', true);
    deleteSetting(tx, 'programDraft');
    deleteSetting(tx, 'activeRest');

    const activeProgramId = (bundle.activeProgramRef && programIds.get(bundle.activeProgramRef)) || [...programIds.values()][0];
    setActiveProgram(tx, activeProgramId);
    return { activeProgramId };
  });
}

/** Programme seul : ajouté (source import), activé ; l'id d'origine éventuel est retiré */
export function importProgram(ctx: RepoCtx, input: unknown): StoredProgram {
  const { id: _origin, ...definition } = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const created = createProgram(ctx, definition, 'import');
  setActiveProgram(ctx, created.id);
  setSetting(ctx, 'onboarded', true);
  return created;
}
```
Si `createProgram` conserve le champ `id` d'une définition déjà parsée (programmes du paquet), c'est sans effet : `parseLegacyBackup` l'a déjà retiré.

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/db && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repos/importRepo.ts src/db/__tests__/importRepo.test.ts
git commit -m "feat(mobile): restore backups in a single transaction and import single programs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Chaînes i18n M3b

**Files:**
- Modify: `mobile/src/i18n/locales/fr.json`, `mobile/src/i18n/locales/en.json`

**Interfaces:**
- Produces les clés ci-dessous. Clés PWA réutilisées : `onboarding_tagline`, `onboarding_create`, `onboarding_import`, `import_file_btn`, `import_auto_ph`, `import_confirm_btn`, `import_backup_confirm_btn`, `editor_import_err`, `editor_imported`, `profile_import_toast`, `today_create_program`.

- [ ] **Step 1: Ajouter les clés** (avant `"coming_soon"`, script Node comme aux jalons précédents)

| Clé | fr | en |
|---|---|---|
| `onboarding_example` | `Essayer avec le programme exemple` | `Try the sample program` |
| `import_title` | `IMPORTER` | `IMPORT` |
| `import_paste_label` | `Ou collez le JSON` | `Or paste the JSON` |
| `import_err_unknown` | `Format non reconnu : programme ou sauvegarde attendu.` | `Unrecognized format: program or backup expected.` |
| `import_err_program` | `Programme invalide :` | `Invalid program:` |
| `import_err_no_program` | `Aucun programme valide dans la sauvegarde.` | `No valid program in the backup.` |
| `import_err_too_large` | `Fichier trop volumineux (5 Mo max).` | `File too large (5 MB max).` |
| `import_err_read` | `Impossible de lire ce fichier.` | `Could not read this file.` |
| `import_preview_program` | `Programme : %s · %s séances · %s jours` | `Program: %s · %s sessions · %s days` |
| `import_preview_backup` | `Sauvegarde : %s programmes, %s séances, %s séries, %s poids` | `Backup: %s programs, %s workouts, %s sets, %s weights` |
| `import_ignored` | `Ignorés (%s) : %s` | `Ignored (%s): %s` |
| `import_confirm_replace_title` | `Restaurer cette sauvegarde ?` | `Restore this backup?` |
| `import_replace_body` | `Toutes les données actuelles seront remplacées.` | `All current data will be replaced.` |
| `import_reason_unknown_key` | `clé inconnue` | `unknown key` |
| `import_reason_invalid_program` | `programme invalide` | `invalid program` |
| `import_reason_unknown_program` | `programme introuvable` | `program not found` |
| `import_reason_unknown_session` | `séance introuvable` | `session not found` |
| `import_reason_no_checked_set` | `aucune série cochée` | `no checked set` |
| `import_reason_already_logged` | `déjà enregistrée` | `already logged` |
| `import_reason_duplicate` | `doublon` | `duplicate` |
| `import_reason_invalid_value` | `valeur invalide` | `invalid value` |
| `plan_import` | `Importer` | `Import` |

- [ ] **Step 2: Vérifier**

Run: `npx jest src/i18n && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales
git commit -m "feat(mobile): add M3b onboarding and import strings (fr/en)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Analyse du contenu + écran d'import

**Files:**
- Create: `mobile/src/features/import/analyzeImport.ts`, `mobile/src/features/import/ImportScreen.tsx`, `mobile/src/app/import.tsx`, `mobile/src/features/import/__tests__/analyzeImport.test.ts`, `mobile/src/features/import/__tests__/ImportScreen.test.tsx`

**Interfaces:**
- Consumes: `detectImportFormat`, `parseLegacyBackup`, `parseNativeBackup`, `parseProgram`, `programSummary`, `replaceAll`, `importProgram`, `pickJsonFile`, `confirm`, stores (`usePrefs`, `useTimerStore`, `useDraftStore`, `useToastStore`), `localDateKey`.
- Produces:
  - `type Analysis = { kind: 'empty' } | { kind: 'error'; message: StringKey; details?: string[] } | { kind: 'program'; program: Program; raw: unknown } | { kind: 'backup'; bundle: ImportBundle }`
  - `analyzeImport(text: string, today: string): Analysis` (retire un BOM et les espaces)
  - `<ImportScreen onDone(kind: 'program' | 'backup'): void; onCancel(): void />`
  - route `/import`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/import/__tests__/analyzeImport.test.ts` :
```ts
import example from '@/data/program.example.json';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { analyzeImport } from '../analyzeImport';

const TODAY = '2026-10-07';

describe('analyzeImport', () => {
  it('vide → empty', () => {
    expect(analyzeImport('   ', TODAY)).toEqual({ kind: 'empty' });
  });
  it('JSON invalide → message dédié', () => {
    expect(analyzeImport('{oops', TODAY)).toEqual({ kind: 'error', message: 'editor_import_err' });
  });
  it('Review Focus 4 : BOM UTF-8 et espaces autour sont tolérés', () => {
    expect(analyzeImport(`﻿  ${JSON.stringify(example)}\n`, TODAY).kind).toBe('program');
  });
  it('programme seul valide / invalide', () => {
    expect(analyzeImport(JSON.stringify(example), TODAY)).toMatchObject({ kind: 'program', program: { meta: { label: 'PROGRAMME SALLE' } } });
    const bad = analyzeImport(JSON.stringify({ meta: { label: 'X' }, sessions: { a: { type: 'nope', name: 'A' } } }), TODAY);
    expect(bad).toMatchObject({ kind: 'error', message: 'import_err_program' });
    if (bad.kind === 'error') expect(bad.details?.length).toBeGreaterThan(0);
  });
  it('sauvegarde PWA → paquet', () => {
    const r = analyzeImport(JSON.stringify(backup), TODAY);
    expect(r.kind).toBe('backup');
    if (r.kind === 'backup') expect(r.bundle.report).toMatchObject({ programs: 2, workouts: 8 });
  });
  it('sauvegarde sans programme valide / format inconnu', () => {
    expect(analyzeImport(JSON.stringify({ programs: '[]', 'weight:x': '1' }), TODAY)).toEqual({ kind: 'error', message: 'import_err_no_program' });
    expect(analyzeImport(JSON.stringify({ foo: 1 }), TODAY)).toEqual({ kind: 'error', message: 'import_err_unknown' });
    expect(analyzeImport('[1,2]', TODAY)).toEqual({ kind: 'error', message: 'import_err_unknown' });
  });
});
```

`mobile/src/features/import/__tests__/ImportScreen.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { createProgram, getActiveProgram, listPrograms, setActiveProgram } from '@/db/repos/programsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { confirm } from '@/platform/confirm';
import { pickJsonFile } from '@/platform/pickJsonFile';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TOAST_INITIAL, useToastStore } from '@/state/toastStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ImportScreen } from '../ImportScreen';

async function setup() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, example, 'example');
  setActiveProgram(ctx, p.id);
  const onDone = jest.fn();
  await renderWithProviders(<ImportScreen onDone={onDone} onCancel={jest.fn()} />, { ctx });
  return { ctx, onDone };
}

describe('ImportScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useToastStore.setState(TOAST_INITIAL); });
  });

  it('coller un programme → aperçu → importer et activer', async () => {
    const { ctx, onDone } = await setup();
    await fireEvent.changeText(screen.getByTestId('import-text'), JSON.stringify({ ...example, meta: { ...example.meta, label: 'NOUVEAU' } }));
    expect(screen.getByText('Programme : NOUVEAU · 3 séances · 3 jours')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'IMPORTER CE PROGRAMME' }));
    expect(getActiveProgram(ctx)?.definition.meta.label).toBe('NOUVEAU');
    expect(listPrograms(ctx)).toHaveLength(2);
    expect(useToastStore.getState().message).toBe('Programme importé ✓');
    expect(onDone).toHaveBeenCalledWith('program');
  });

  it('choisir un fichier de sauvegarde → aperçu + ignorés → restauration confirmée, thème appliqué', async () => {
    jest.mocked(pickJsonFile).mockResolvedValueOnce({ kind: 'ok', text: JSON.stringify(backup) });
    const { ctx, onDone } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Choisir un fichier .json' }));
    expect(screen.getByText('Sauvegarde : 2 programmes, 8 séances, 115 séries, 10 poids')).toBeTruthy();
    expect(screen.getByText(/Ignorés \(8\)/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'RESTAURER CETTE SAUVEGARDE' }));
    expect(confirm).toHaveBeenCalled();
    expect(listPrograms(ctx).map((p) => p.definition.meta.label)).toEqual(['PROGRAMME A', 'PROGRAMME B']);
    expect(usePrefs.getState().theme).toBe('light');
    expect(useToastStore.getState().message).toBe('Sauvegarde restaurée ✓');
    expect(onDone).toHaveBeenCalledWith('backup');
  });

  it('restauration refusée : rien ne change', async () => {
    jest.mocked(confirm).mockResolvedValueOnce(false);
    const { ctx, onDone } = await setup();
    await fireEvent.changeText(screen.getByTestId('import-text'), JSON.stringify(backup));
    await fireEvent.press(screen.getByRole('button', { name: 'RESTAURER CETTE SAUVEGARDE' }));
    expect(listPrograms(ctx).map((p) => p.definition.meta.label)).toEqual(['PROGRAMME SALLE']);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('erreurs : JSON invalide, fichier trop gros ; pas de bouton de confirmation', async () => {
    jest.mocked(pickJsonFile).mockResolvedValueOnce({ kind: 'too_large' });
    await setup();
    await fireEvent.changeText(screen.getByTestId('import-text'), '{oops');
    expect(screen.getByText('JSON invalide — vérifiez la syntaxe.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'IMPORTER CE PROGRAMME' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Choisir un fichier .json' }));
    expect(screen.getByText('Fichier trop volumineux (5 Mo max).')).toBeTruthy();
  });
});
```
Le programme exemple (`src/data/program.example.json`) a 3 séances et 3 jours planifiés.

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/import`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/features/import/analyzeImport.ts` :
```ts
// Texte collé ou fichier choisi → aperçu de l'import (fonction pure)
import type { ImportBundle } from '@/domain/importBundle';
import { detectImportFormat } from '@/domain/importFormat';
import { parseLegacyBackup } from '@/domain/legacyImport';
import { parseNativeBackup } from '@/domain/nativeBackup';
import { parseProgram, type Program } from '@/domain/program';
import type { StringKey } from '@/i18n/translate';

export type Analysis =
  | { kind: 'empty' }
  | { kind: 'error'; message: StringKey; details?: string[] }
  | { kind: 'program'; program: Program; raw: unknown }
  | { kind: 'backup'; bundle: ImportBundle };

export function analyzeImport(text: string, today: string): Analysis {
  const cleaned = text.replace(/^﻿/, '').trim();
  if (!cleaned) return { kind: 'empty' };
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    return { kind: 'error', message: 'editor_import_err' };
  }
  switch (detectImportFormat(value)) {
    case 'program': {
      const r = parseProgram(value);
      return r.ok ? { kind: 'program', program: r.program, raw: value } : { kind: 'error', message: 'import_err_program', details: r.errors };
    }
    case 'pwa-backup': {
      const r = parseLegacyBackup(value as Record<string, unknown>, today);
      return r.ok ? { kind: 'backup', bundle: r.bundle } : { kind: 'error', message: r.error === 'no_valid_program' ? 'import_err_no_program' : 'import_err_unknown' };
    }
    case 'native-backup': {
      const r = parseNativeBackup(value);
      return r.ok ? { kind: 'backup', bundle: r.bundle } : { kind: 'error', message: r.error === 'no_valid_program' ? 'import_err_no_program' : 'import_err_unknown' };
    }
    default:
      return { kind: 'error', message: 'import_err_unknown' };
  }
}
```

`mobile/src/features/import/ImportScreen.tsx` :
```tsx
// ============================================================
// IMPORT — fichier ou JSON collé → aperçu (type + rapport) → confirmation.
// Sauvegarde : remplacement total en une transaction, après confirmation.
// ============================================================
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { importProgram, replaceAll } from '@/db/repos/importRepo';
import type { RepoCtx } from '@/db/types';
import type { ImportBundle } from '@/domain/importBundle';
import { localDateKey } from '@/domain/schedule';
import { Screen } from '@/features/common/Screen';
import { programSummary } from '@/features/plan/planStats';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { confirm } from '@/platform/confirm';
import { pickJsonFile } from '@/platform/pickJsonFile';
import { useDraftStore } from '@/state/draftStore';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { analyzeImport } from './analyzeImport';

/** Écriture puis relecture des stores ; false si elle échoue (hors composant : compatible React Compiler) */
function attempt(ctx: RepoCtx, write: () => void): boolean {
  try {
    write();
  } catch {
    return false;
  }
  usePrefs.getState().hydrate(ctx);
  useTimerStore.getState().hydrate(ctx, Date.now());
  useDraftStore.getState().hydrate(ctx);
  usePrefs.getState().bumpData();
  return true;
}

export function ImportScreen({ onDone, onCancel }: { onDone(kind: 'program' | 'backup'): void; onCancel(): void }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [pickError, setPickError] = useState<StringKey | null>(null);
  const analysis = analyzeImport(text, localDateKey(new Date()));

  const pick = async () => {
    const r = await pickJsonFile();
    if (r.kind === 'ok') {
      setPickError(null);
      setText(r.text);
    } else if (r.kind === 'too_large') setPickError('import_err_too_large');
    else if (r.kind === 'error') setPickError('import_err_read');
  };

  const ignoredLine = (bundle: ImportBundle) => {
    const items = bundle.report.ignored.map((i) => `${i.key} (${t(`import_reason_${i.reason}` as StringKey)})`);
    return items.length ? t('import_ignored', items.length, items.join(', ')) : null;
  };

  const confirmProgram = () => {
    if (analysis.kind !== 'program') return;
    if (attempt(ctx, () => { importProgram(ctx, analysis.raw); })) {
      useToastStore.getState().show(t('editor_imported'));
      onDone('program');
    } else useToastStore.getState().show(t('error_not_saved'));
  };
  const confirmBackup = async () => {
    if (analysis.kind !== 'backup') return;
    const ok = await confirm({ title: t('import_confirm_replace_title'), message: t('import_replace_body'), confirmLabel: t('import_backup_confirm_btn'), cancelLabel: t('editor_cancel'), destructive: true });
    if (!ok) return;
    if (attempt(ctx, () => { replaceAll(ctx, analysis.bundle); })) {
      useToastStore.getState().show(t('profile_import_toast'));
      onDone('backup');
    } else useToastStore.getState().show(t('error_not_saved'));
  };

  const primary = [styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }];
  const message = (body: string) => <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{body}</Text>;
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.back}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('editor_cancel')}</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('import_title')}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('import_auto_body')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void pick()} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('import_file_btn')}</Text>
      </Pressable>
      {pickError ? <Text style={{ color: colors.redDanger, fontFamily: fonts.ui }}>{t(pickError)}</Text> : null}
      <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('import_paste_label').toUpperCase()}</Text>
      <TextInput
        testID="import-text"
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={t('import_auto_ph')}
        placeholderTextColor={colors.textDim}
        style={[styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }]}
      />
      {analysis.kind === 'error' ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.redDanger, fontFamily: fonts.uiBold }}>{t(analysis.message)}</Text>
          {analysis.details?.map((d, i) => <Text key={i} style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{d}</Text>)}
        </View>
      ) : null}
      {analysis.kind === 'program' ? (
        <View style={{ gap: 12 }}>
          {message(t('import_preview_program', analysis.program.meta.label, Object.keys(analysis.program.sessions).length, programSummary(analysis.program).days))}
          <Pressable accessibilityRole="button" onPress={confirmProgram} style={primary}>
            <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('import_confirm_btn')}</Text>
          </Pressable>
        </View>
      ) : null}
      {analysis.kind === 'backup' ? (
        <View style={{ gap: 12 }}>
          {message(t('import_preview_backup', analysis.bundle.report.programs, analysis.bundle.report.workouts, analysis.bundle.report.sets, analysis.bundle.report.weights))}
          {ignoredLine(analysis.bundle) ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{ignoredLine(analysis.bundle)}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => void confirmBackup()} style={primary}>
            <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('import_backup_confirm_btn')}</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  back: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  title: { fontSize: 40, letterSpacing: -0.5 },
  btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 140, borderWidth: 1, padding: 12, textAlignVertical: 'top' },
});
```
Le libellé d'accessibilité du bouton fichier est son texte (`Choisir un fichier .json`).

`mobile/src/app/import.tsx` :
```tsx
// Route Import — programme : retour à Plan ; sauvegarde : Today
import { router } from 'expo-router';
import { ImportScreen } from '@/features/import/ImportScreen';

export default function ImportRoute() {
  return (
    <ImportScreen
      onCancel={() => router.back()}
      onDone={(kind) => router.replace(kind === 'program' ? '/plan' : '/today')}
    />
  );
}
```
Dans `mobile/src/app/_layout.tsx` (`ThemedStack`), ajouter `<Stack.Screen name="import" options={{ presentation: 'modal' }} />` et `<Stack.Screen name="onboarding" />` à la pile racine. Régénérer les types de routes avant `tsc` : `npx expo export --platform web --output-dir "$TEMP/m3b-web"`.

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/import && npx expo export --platform web --output-dir "$TEMP/m3b-web" && npx tsc --noEmit`
Expected: PASS ; export réussi ; `tsc` propre.

- [ ] **Step 5: Commit**

```bash
git add src/features/import src/app/import.tsx src/app/_layout.tsx
git commit -m "feat(mobile): add import screen with file picking, preview and restore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Onboarding, garde de premier lancement, points d'entrée

**Files:**
- Create: `mobile/src/features/onboarding/needsOnboarding.ts`, `mobile/src/features/onboarding/OnboardingScreen.tsx`, `mobile/src/app/onboarding.tsx`, `mobile/src/features/onboarding/__tests__/onboarding.test.tsx`
- Modify: `mobile/src/app/(tabs)/_layout.tsx`, `mobile/src/features/editor/saveDraft.ts`, `mobile/src/features/today/NoProgram.tsx`, `mobile/src/features/today/TodayScreen.tsx`, `mobile/src/app/(tabs)/today.tsx`, `mobile/src/features/plan/ProgramsView.tsx`, `mobile/src/features/plan/PlanScreen.tsx`, `mobile/src/app/(tabs)/plan.tsx`, `mobile/src/features/today/__tests__/TodayScreen.test.tsx`, `mobile/src/features/editor/__tests__/saveDraft.test.ts`

**Interfaces:**
- Produces:
  - `needsOnboarding(ctx: RepoCtx): boolean` (aucun programme **et** `onboarded` non vrai)
  - `<OnboardingScreen onCreate(): void; onImport(): void; onStarted(): void />` (le bouton « Créer » prépare un brouillon neuf via `prepareEditor` avant `onCreate`)
  - `NoProgram` : props `{ onCreate(): void; onImport(): void }`
  - `TodayScreen` : props `{ focused?: boolean; onOpenEditor?(): void; onOpenImport?(): void }`
  - `ProgramsView` / `PlanScreen` : prop supplémentaire `onImport()` / `onOpenImport()`
  - `saveDraft` met `onboarded` à vrai lors d'une création

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/onboarding/__tests__/onboarding.test.tsx` :
```tsx
/** Garde + écran d'onboarding */
import { act, fireEvent, screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { createProgram, getActiveProgram } from '@/db/repos/programsRepo';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { needsOnboarding } from '../needsOnboarding';
import { OnboardingScreen } from '../OnboardingScreen';

describe('needsOnboarding', () => {
  it('vrai seulement sans programme et sans onboarded', () => {
    const ctx = createTestCtx();
    expect(needsOnboarding(ctx)).toBe(true);
    setSetting(ctx, 'onboarded', true);
    expect(needsOnboarding(ctx)).toBe(false);
    const other = createTestCtx();
    createProgram(other, example, 'example');
    expect(needsOnboarding(other)).toBe(false);
  });
});

describe('OnboardingScreen', () => {
  beforeEach(async () => {
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useDraftStore.setState(DRAFT_INITIAL); });
  });

  async function setup() {
    const ctx = createTestCtx();
    const props = { onCreate: jest.fn(), onImport: jest.fn(), onStarted: jest.fn() };
    await renderWithProviders(<OnboardingScreen {...props} />, { ctx });
    return { ctx, props };
  }

  it('créer : brouillon neuf puis éditeur', async () => {
    const { props } = await setup();
    expect(screen.getByText('Entraîne-toi avec intention.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER MON PROGRAMME' }));
    expect(useDraftStore.getState().draft?.sourceProgramId).toBeNull();
    expect(props.onCreate).toHaveBeenCalled();
  });

  it('importer', async () => {
    const { props } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Importer un fichier JSON' }));
    expect(props.onImport).toHaveBeenCalled();
  });

  it('programme exemple : chargé, actif, onboarded', async () => {
    const { ctx, props } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Essayer avec le programme exemple' }));
    expect(getActiveProgram(ctx)?.definition.meta.label).toBe('PROGRAMME SALLE');
    expect(getSetting(ctx, 'onboarded')).toBe(true);
    expect(props.onStarted).toHaveBeenCalled();
  });

  it('langue appliquée immédiatement', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByText('CREATE MY PROGRAM')).toBeTruthy();
  });
});
```

Remplacer le contenu de `mobile/src/features/today/__tests__/TodayScreen.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TodayScreen } from '../TodayScreen';

describe('TodayScreen — pas de programme', () => {
  beforeEach(async () => {
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useDraftStore.setState(DRAFT_INITIAL); });
  });

  it('propose Créer (brouillon neuf + éditeur) et Importer', async () => {
    const ctx = createTestCtx();
    const onOpenEditor = jest.fn();
    const onOpenImport = jest.fn();
    await renderWithProviders(<TodayScreen onOpenEditor={onOpenEditor} onOpenImport={onOpenImport} />, { ctx });
    expect(screen.queryByText('CHARGER LE PROGRAMME EXEMPLE')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER MON PROGRAMME' }));
    expect(useDraftStore.getState().draft).not.toBeNull();
    expect(onOpenEditor).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Importer un fichier JSON' }));
    expect(onOpenImport).toHaveBeenCalled();
  });
});
```

Ajouter à `mobile/src/features/editor/__tests__/saveDraft.test.ts`, dans le test « nouveau programme » : `expect(getSetting(ctx, 'onboarded')).toBe(true);` (importer `getSetting` depuis `@/db/repos/settingsRepo`).

Ajouter à `mobile/src/features/plan/__tests__/planViews.test.tsx`, dans `ProgramsView` : passer `onImport: jest.fn()` dans `handlers`, puis `await fireEvent.press(screen.getByRole('button', { name: 'Importer' })); expect(handlers.onImport).toHaveBeenCalled();`.

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/onboarding src/features/today/__tests__/TodayScreen.test.tsx src/features/editor/__tests__/saveDraft.test.ts src/features/plan`
Expected: FAIL — modules introuvables / bouton absent / `onboarded` non défini.

- [ ] **Step 3: Implémenter**

`mobile/src/features/onboarding/needsOnboarding.ts` :
```ts
// Premier lancement : aucun programme et onboarding jamais terminé
import { listPrograms } from '@/db/repos/programsRepo';
import { getSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';

export function needsOnboarding(ctx: RepoCtx): boolean {
  return listPrograms(ctx).length === 0 && getSetting(ctx, 'onboarded') !== true;
}
```

`mobile/src/features/onboarding/OnboardingScreen.tsx` :
```tsx
// ============================================================
// ONBOARDING — créer, importer, ou essayer le programme exemple ; langue.
// ============================================================
import { Pressable, StyleSheet, Text, View } from 'react-native';
import example from '@/data/program.example.json';
import { useRepoCtx } from '@/db/DbContext';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { setSetting } from '@/db/repos/settingsRepo';
import type { Lang } from '@/domain/prefs';
import { Screen } from '@/features/common/Screen';
import { prepareEditor } from '@/features/editor/openEditor';
import { Segmented } from '@/features/profile/Segmented';
import { useI18n } from '@/i18n/I18nProvider';
import { APP_NAME } from '@/config';
import { usePrefs } from '@/state/prefsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  onCreate(): void;
  onImport(): void;
  onStarted(): void;
}

export function OnboardingScreen({ onCreate, onImport, onStarted }: Props) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const lang = usePrefs((s) => s.lang);

  const create = async () => {
    if (await prepareEditor(ctx, { kind: 'new' }, async () => true)) onCreate();
  };
  const tryExample = () => {
    const p = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, p.id);
    setSetting(ctx, 'onboarded', true);
    usePrefs.getState().bumpData();
    onStarted();
  };

  return (
    <Screen>
      <View style={styles.root}>
        <Text style={[styles.title, { color: colors.gold, fontFamily: fonts.display }]}>{APP_NAME.toUpperCase()}</Text>
        <Text style={{ color: colors.text, fontFamily: fonts.uiMedium, fontSize: 18 }}>{t('onboarding_tagline')}</Text>
        <Segmented<Lang>
          options={[{ value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }]}
          value={lang}
          onChange={(v) => usePrefs.getState().setLang(ctx, v)}
        />
        <Pressable accessibilityRole="button" onPress={() => void create()} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
          <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('onboarding_create')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onImport} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('onboarding_import')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={tryExample} style={styles.link}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiMedium, textDecorationLine: 'underline' }}>{t('onboarding_example')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16, paddingTop: 48 },
  title: { fontSize: 56, letterSpacing: -1 },
  btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
```
`APP_NAME` (`'WORKOUT'`) est exporté par `src/config.ts` (M1).

`mobile/src/app/onboarding.tsx` :
```tsx
// Route Onboarding
import { router } from 'expo-router';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  return (
    <OnboardingScreen
      onCreate={() => router.push('/editor/meta')}
      onImport={() => router.push('/import')}
      onStarted={() => router.replace('/today')}
    />
  );
}
```

`mobile/src/app/(tabs)/_layout.tsx` : en tête de `TabsLayout`, avant le `return <Tabs …>` :
```tsx
import { Redirect } from 'expo-router';
import { useDbQuery } from '@/features/common/useDbQuery';
import { needsOnboarding } from '@/features/onboarding/needsOnboarding';
// …
  const firstLaunch = useDbQuery(needsOnboarding);
  if (firstLaunch) return <Redirect href="/onboarding" />;
```

`mobile/src/features/editor/saveDraft.ts` : dans la branche de création, après `setActiveProgram(ctx, created.id);` ajouter `setSetting(ctx, 'onboarded', true);` (import de `setSetting`).

`mobile/src/features/today/NoProgram.tsx` (remplacer) :
```tsx
// État vide de Today : pas de programme → créer ou importer
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function NoProgram({ onCreate, onImport }: { onCreate(): void; onImport(): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('today_no_program_title')}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('today_no_program_sub')}</Text>
      <Pressable accessibilityRole="button" onPress={onCreate} style={[styles.button, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
        <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('today_create_program')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onImport} style={[styles.button, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('onboarding_import')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingTop: 40 },
  title: { fontSize: 40, letterSpacing: -0.5 },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
});
```

`mobile/src/features/today/TodayScreen.tsx` :
- signature : `export function TodayScreen({ focused = true, onOpenEditor, onOpenImport }: { focused?: boolean; onOpenEditor?(): void; onOpenImport?(): void })`
- remplacer le bloc `if (!program) { … loadExample … }` par :
```tsx
  if (!program) {
    const create = async () => {
      if (await prepareEditor(ctx, { kind: 'new' }, () =>
        confirm({ title: t('editor_replace_draft_title'), confirmLabel: t('editor_discard'), cancelLabel: t('editor_keep'), destructive: true }))) {
        onOpenEditor?.();
      }
    };
    return (
      <Screen>
        <NoProgram onCreate={() => void create()} onImport={() => onOpenImport?.()} />
      </Screen>
    );
  }
```
- imports : retirer `example`, `createProgram`, `setActiveProgram` s'ils ne servent plus ; ajouter `prepareEditor` (`@/features/editor/openEditor`) et `confirm` (`@/platform/confirm`).

`mobile/src/app/(tabs)/today.tsx` : passer `onOpenEditor={() => router.push('/editor/meta')}` et `onOpenImport={() => router.push('/import')}` (import de `router` depuis `expo-router`).

`mobile/src/features/plan/ProgramsView.tsx` : prop `onImport(): void` ; après le bouton « Créer un nouveau programme » :
```tsx
      <Pressable accessibilityRole="button" onPress={onImport} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('plan_import')}</Text>
      </Pressable>
```
`mobile/src/features/plan/PlanScreen.tsx` : prop `onOpenImport(): void` transmise à `ProgramsView` (`onImport={onOpenImport}`) ; mettre à jour `PlanScreen.test.tsx` (`<PlanScreen onOpenEditor={…} onOpenImport={jest.fn()} />`). `mobile/src/app/(tabs)/plan.tsx` : `onOpenImport={() => router.push('/import')}`.

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest && npx expo export --platform web --output-dir "$TEMP/m3b-web" && npx tsc --noEmit`
Expected: toute la suite verte ; `tsc` propre.

- [ ] **Step 5: Commit**

```bash
git add src/features src/app
git commit -m "feat(mobile): add onboarding with first-launch guard and import entry points

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Bout en bout sur la vraie sauvegarde, checklist M3b

**Files:**
- Create: `mobile/src/features/import/__tests__/restoreFlow.test.tsx`
- Modify: `mobile/docs/DEVICE_CHECKLIST.md`

- [ ] **Step 1: Écrire le test de bout en bout**

`mobile/src/features/import/__tests__/restoreFlow.test.tsx` :
```tsx
import { act, screen } from '@testing-library/react-native';
import { replaceAll } from '@/db/repos/importRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { TodayScreen } from '@/features/today/TodayScreen';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { renderWithProviders } from '@/test/renderWithProviders';

describe('restauration de la vraie sauvegarde → Today', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 7, 10)); // mercredi 7 oct. 2026
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useTimerStore.setState(TIMER_INITIAL); });
  });
  afterEach(() => jest.useRealTimers());

  it('séance du mercredi du programme importé + « Dernière fois » alimenté par l\'historique', async () => {
    const ctx = createTestCtx();
    const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
    if (!r.ok) throw new Error('fixture invalide');
    replaceAll(ctx, r.bundle);
    await renderWithProviders(<TodayScreen />, { ctx });
    expect(screen.getAllByText('HAUT DU CORPS').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Dernière fois/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/non terminée/)).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/import/__tests__/restoreFlow.test.tsx`
Expected: PASS (assemblage). La séance abandonnée de juin ne doit pas afficher le bandeau de reprise (dernière assertion).

- [ ] **Step 3: Checklist appareil M3b**

Ajouter à `mobile/docs/DEVICE_CHECKLIST.md` :
```markdown

## M3b — Onboarding + Import (build development à refaire : expo-document-picker)
- [ ] Réinstaller l'app (ou effacer ses données) : l'onboarding s'affiche ; FR/EN s'applique immédiatement.
- [ ] « Essayer avec le programme exemple » → Today avec le programme exemple.
- [ ] « Créer mon programme » → éditeur ; Annuler → retour à l'onboarding ; Enregistrer → onglets.
- [ ] « Importer un fichier JSON » → sélecteur iOS (Fichiers, iCloud Drive) / Android (Téléchargements, Drive) ; annuler ne fait rien.
- [ ] Choisir `workout-backup-2026-10-07.json` : aperçu « 2 programmes, 8 séances, 115 séries, 10 poids » + ignorés (8).
- [ ] « Restaurer » → confirmation → thème clair appliqué, Today affiche la séance du jour, « Dernière fois » présent, aucun bandeau « non terminée ».
- [ ] Coller un programme JSON dans la zone de texte → aperçu → importé et activé (Plan → Mes programmes).
- [ ] Plan → Mes programmes → « Importer » ouvre l'écran d'import.
- [ ] Supprimer tous les programmes : Today propose « Créer » et « Importer » (pas d'onboarding).
```

- [ ] **Step 4: Vérification complète**

Run: `npx jest && npx tsc --noEmit && npx expo export --platform web --output-dir "$TEMP/m3b-web" && npx expo export --platform ios --output-dir "$TEMP/m3b-ios"`
Expected: suite verte, `tsc` propre, deux bundles exportés.

- [ ] **Step 5: Commit**

```bash
git add src/features/import/__tests__/restoreFlow.test.tsx docs/DEVICE_CHECKLIST.md
git commit -m "test(mobile): restore the real backup end to end and add the M3b device checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Couverture de la spec (auto-revue)

| Exigence (addendum M3b) | Task |
|---|---|
| Détection des trois formats (règle PWA + natif) | 2 |
| Conversion PWA : programmes, actif, logs, tracks (abandonnée / en cours), poids, organisation, réglages, ignorés | 3, 4 |
| Attendus sur la vraie sauvegarde | 4, 6, 10 |
| Format natif v1 (lecture + écriture) | 5 |
| Restauration en une transaction, remappage, stores relus | 6, 8 |
| Programme seul ajouté + activé | 6, 8 |
| Sélecteur de fichier + zone « coller », 5 Mo max | 1, 8 |
| Aperçu, rapport, confirmation, erreurs | 8 |
| Onboarding (créer, importer, exemple, langue) + garde | 9 |
| Today sans programme : Créer / Importer ; Plan : Importer | 9 |
| Fixture anonymisée, sauvegarde personnelle jamais commitée | 2 (+ `.gitignore` déjà en place) |
| Checklist appareil | 10 |
