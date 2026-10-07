# App native Expo — M4a Profil — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un écran Profil complet — carte programme actif, réglages (dont unité par défaut et Coach IA), export natif v1 via la feuille de partage avec rappel de sauvegarde, accès à l'import, suppression de l'historique, réinitialisation, version.

**Architecture:** `domain/` pur (`backupAge`, `newDraft(units)`), repos synchrones en une transaction (`exportRepo.readBundle`, `resetRepo.deleteHistory/resetAll`), adaptateurs `platform/` (`shareJsonFile`, `appVersion`) simulés dans Jest, écran `features/profile/` découpé en sections, route mince.

**Tech Stack:** Expo SDK 57, TypeScript strict, Expo Router, expo-sqlite + Drizzle (tests : better-sqlite3), Zustand, Jest (jest-expo) + RNTL 14 (render/fireEvent asynchrones), `expo-sharing` (nouveau), `expo-file-system`, `expo-constants`.

**Spec:** `docs/superpowers/specs/2026-10-07-expo-native-m4a-profile-design.md` (+ `docs/superpowers/specs/2026-10-05-expo-native-foundation-design.md` §3.7, §4).

Toutes les commandes se lancent depuis `mobile/`.

## Global Constraints

- Moteur générique : aucun nom de jour, de séance, d'exercice ou de couleur en dur.
- Code et commentaires en français ; chaînes visibles via i18n (fr + en), jamais en dur.
- Cibles tactiles ≥ 44 px (`TOUCH_MIN`) ; boutons destructifs en rouge (`colors.redDanger`), confirmation via `@/platform/confirm`.
- Suppressions **logiques** (`deletedAt`) pour les tables synchronisables ; chaque action d'écriture multi-tables en **une** transaction (`inTransaction`).
- Format natif inchangé : `{ _format: 'workout-native', _version: 1, … }` ; `settings.defaultUnits` optionnel (rétrocompatible).
- « Réinitialiser l'application » conserve **uniquement** les réglages `lang` et `theme`.
- Rappel de sauvegarde : `stale` si **plus de 14 jours** (`days > 14`).
- Nom du fichier exporté : `workout-backup-AAAA-MM-JJ.json` (date locale).
- `expo-sharing` est un module natif → nouveau build EAS (à rappeler dans la checklist).
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ; push uniquement sur `expo-native`.

## Review Focus

1. **Double tap sur « Exporter »** : un seul partage ouvert, pas deux (Task 9 — bouton désactivé pendant l'export, test).
2. **Programme dont la définition stockée est devenue invalide** : l'export ne plante pas et ne produit pas de séances orphelines (Task 3 — test).
3. **Échec SQL au milieu de « Réinitialiser »** : aucune donnée perdue (Task 4 — test par trigger SQLite).
4. **Minuteur de repos en cours pendant « Supprimer l'historique »** : il s'arrête, la barre de repos disparaît, l'extension est notifiée (Task 9 — `useTimerStore.clear`, test).
5. **Bascule `?tab=programs` répétée** : « Gérer » ouvre « Mes programmes » même si l'utilisateur était revenu sur « Cette semaine » (Task 7 — test).

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/domain/backupAge.ts` (créé) | Ancienneté de la dernière sauvegarde |
| `src/domain/draft.ts` | `newDraft(units)` |
| `src/domain/importBundle.ts` | `BundleSettings.defaultUnits` |
| `src/domain/nativeBackup.ts` | Lecture de `settings.defaultUnits` |
| `src/db/repos/settingsRepo.ts` | Clés `defaultUnits`, `lastExportAt` |
| `src/db/repos/importRepo.ts` | `replaceAll` applique `defaultUnits` |
| `src/features/editor/openEditor.ts` | Nouveau brouillon dans l'unité par défaut |
| `src/db/repos/exportRepo.ts` (créé) | `readBundle(ctx)` |
| `src/db/repos/resetRepo.ts` (créé) | `deleteHistory`, `resetAll` |
| `src/platform/shareJsonFile.ts` / `.web.ts` (créés) | Partage / téléchargement |
| `src/platform/appVersion.ts` (créé) | Version de l'app |
| `src/platform/types.ts`, `src/test/jestSetup.js` | Type `ShareResult`, mocks |
| `src/i18n/locales/fr.json`, `en.json` | Chaînes M4a |
| `src/features/plan/PlanScreen.tsx`, `src/app/(tabs)/plan.tsx` | Ouverture sur « Mes programmes » |
| `src/features/profile/ActiveProgramCard.tsx` (créé) | Carte programme actif |
| `src/features/profile/SettingsSection.tsx` (créé) | Réglages |
| `src/features/profile/actions.ts` (créé) | `exportData`, `runReset` |
| `src/features/profile/DataSection.tsx` (créé) | Export + rappel, import |
| `src/features/profile/DangerSection.tsx` (créé) | Supprimer l'historique, réinitialiser |
| `src/features/profile/ProfileScreen.tsx` (créé) | Assemblage + À propos |
| `src/app/(tabs)/profile.tsx` | Route mince |
| `docs/DEVICE_CHECKLIST.md` | Section M4a |

---

### Task 1: Domaine — `backupAge`, `newDraft(units)`, `defaultUnits` dans le format natif

**Files:**
- Create: `mobile/src/domain/backupAge.ts`, `mobile/src/domain/__tests__/backupAge.test.ts`
- Modify: `mobile/src/domain/draft.ts:39-45`, `mobile/src/domain/importBundle.ts:22`, `mobile/src/domain/nativeBackup.ts` (bloc `settings` de `parseNativeBackup`)
- Test: `mobile/src/domain/__tests__/draftNew.test.ts` (créé), `mobile/src/domain/__tests__/nativeBackup.test.ts` (ajout)

**Interfaces:**
- Produces: `backupAge(lastExportAt: string | undefined, today: string): BackupAge` ; `type BackupAge = { kind: 'never' } | { kind: 'recent'; days: number } | { kind: 'stale'; days: number }` ; `STALE_AFTER_DAYS = 14` ; `newDraft(units?: Units): Draft` ; `BundleSettings.defaultUnits?: Units`.

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/__tests__/backupAge.test.ts` :
```ts
import { backupAge } from '../backupAge';

const TODAY = '2026-10-07';
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe('backupAge', () => {
  it('jamais exporté ou valeur illisible → never', () => {
    expect(backupAge(undefined, TODAY)).toEqual({ kind: 'never' });
    expect(backupAge('pas une date', TODAY)).toEqual({ kind: 'never' });
  });

  it('jours calendaires locaux : aujourd\'hui, hier (même tard le soir)', () => {
    expect(backupAge(at(2026, 10, 7, 0), TODAY)).toEqual({ kind: 'recent', days: 0 });
    expect(backupAge(at(2026, 10, 6, 23), TODAY)).toEqual({ kind: 'recent', days: 1 });
  });

  it('14 jours → recent ; 15 jours → stale', () => {
    expect(backupAge(at(2026, 9, 23), TODAY)).toEqual({ kind: 'recent', days: 14 });
    expect(backupAge(at(2026, 9, 22), TODAY)).toEqual({ kind: 'stale', days: 15 });
  });

  it('date future (horloge changée) → 0 jour', () => {
    expect(backupAge(at(2026, 10, 9), TODAY)).toEqual({ kind: 'recent', days: 0 });
  });
});
```

`mobile/src/domain/__tests__/draftNew.test.ts` :
```ts
import { newDraft } from '../draft';

describe('newDraft', () => {
  it('unité kg par défaut, lbs sur demande', () => {
    expect(newDraft().program.meta.units).toBe('kg');
    expect(newDraft('lbs').program.meta.units).toBe('lbs');
  });
});
```

Ajouter dans `mobile/src/domain/__tests__/nativeBackup.test.ts`, avant `it('sans programme valide → refus'` :
```ts
  it('réglage defaultUnits : lu s\'il est valide, ignoré sinon', () => {
    const ok = JSON.parse(JSON.stringify(toNativeBackup({ ...legacy.bundle, settings: { defaultUnits: 'lbs' } }, 'x')));
    const r1 = parseNativeBackup(ok);
    if (!r1.ok) throw new Error('attendu ok');
    expect(r1.bundle.settings.defaultUnits).toBe('lbs');
    const bad = { ...ok, settings: { defaultUnits: 'stone' } };
    const r2 = parseNativeBackup(bad);
    if (!r2.ok) throw new Error('attendu ok');
    expect(r2.bundle.settings).not.toHaveProperty('defaultUnits');
  });
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/domain/__tests__/backupAge.test.ts src/domain/__tests__/draftNew.test.ts src/domain/__tests__/nativeBackup.test.ts`
Expected: FAIL — module `../backupAge` introuvable ; `newDraft('lbs')` renvoie `kg` ; `defaultUnits` absent.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/backupAge.ts` :
```ts
// Ancienneté de la dernière sauvegarde exportée (rappel dans Profil) — jours calendaires locaux
import { localDateKey } from './schedule';

export type BackupAge = { kind: 'never' } | { kind: 'recent'; days: number } | { kind: 'stale'; days: number };

/** Au-delà de ce nombre de jours, le rappel passe en alerte */
export const STALE_AFTER_DAYS = 14;

const dayNumber = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000;

export function backupAge(lastExportAt: string | undefined, today: string): BackupAge {
  if (typeof lastExportAt !== 'string') return { kind: 'never' };
  const ms = Date.parse(lastExportAt);
  if (Number.isNaN(ms)) return { kind: 'never' };
  const days = Math.max(0, dayNumber(today) - dayNumber(localDateKey(new Date(ms))));
  return days > STALE_AFTER_DAYS ? { kind: 'stale', days } : { kind: 'recent', days };
}
```

`mobile/src/domain/draft.ts` — remplacer `newDraft` (vérifier que `Units` est importé depuis `./program`, l'ajouter sinon) :
```ts
export function newDraft(units: Units = 'kg'): Draft {
  return {
    sourceProgramId: null,
    program: { meta: { label: '', units, restDefaultSec: 90 }, sessions: {}, schedule: {}, rules: [] } as Program,
    manualAccents: [],
  };
}
```

`mobile/src/domain/importBundle.ts:22` :
```ts
export type BundleSettings = { lang?: Lang; theme?: ThemePref; aiEnabled?: boolean; keepAwake?: boolean; defaultUnits?: Units };
```

`mobile/src/domain/nativeBackup.ts` — après la ligne `if (typeof raw.keepAwake === 'boolean') settings.keepAwake = raw.keepAwake;` :
```ts
  if (raw.defaultUnits === 'kg' || raw.defaultUnits === 'lbs') settings.defaultUnits = raw.defaultUnits;
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/domain`
Expected: PASS (toute la couche domaine).

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat(mobile): add backup age, default units for new drafts and in native backups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Réglages `defaultUnits` / `lastExportAt`, brouillon neuf et restauration

**Files:**
- Modify: `mobile/src/db/repos/settingsRepo.ts:11-21`, `mobile/src/features/editor/openEditor.ts:20`, `mobile/src/db/repos/importRepo.ts` (bloc réglages de `replaceAll`)
- Test: `mobile/src/features/editor/__tests__/openEditor.test.ts`, `mobile/src/db/__tests__/importRepo.test.ts`

**Interfaces:**
- Consumes: `newDraft(units?: Units)` (Task 1), `BundleSettings.defaultUnits` (Task 1).
- Produces: `SettingsMap.defaultUnits: Units`, `SettingsMap.lastExportAt: string`.

- [ ] **Step 1: Écrire les tests**

Dans `openEditor.test.ts`, importer `setSetting` depuis `@/db/repos/settingsRepo` et ajouter :
```ts
  it('nouveau programme : unité du réglage defaultUnits (kg par défaut)', async () => {
    const ctx = createTestCtx();
    await prepareEditor(ctx, { kind: 'new' }, jest.fn());
    expect(useDraftStore.getState().draft?.program.meta.units).toBe('kg');
    useDraftStore.setState(DRAFT_INITIAL);
    setSetting(ctx, 'defaultUnits', 'lbs');
    await prepareEditor(ctx, { kind: 'new' }, jest.fn());
    expect(useDraftStore.getState().draft?.program.meta.units).toBe('lbs');
  });
```

Dans `importRepo.test.ts`, dans `describe('importRepo.replaceAll'` :
```ts
  it('applique defaultUnits de la sauvegarde', () => {
    const ctx = createTestCtx();
    replaceAll(ctx, { ...bundle(), settings: { defaultUnits: 'lbs' } });
    expect(getSetting(ctx, 'defaultUnits')).toBe('lbs');
  });
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/editor/__tests__/openEditor.test.ts src/db/__tests__/importRepo.test.ts`
Expected: FAIL — erreur de type / `'defaultUnits'` n'est pas une clé (ts-jest ne type-check pas : l'échec attendu est l'assertion `'kg'` ≠ `'lbs'` et `undefined` ≠ `'lbs'`).

- [ ] **Step 3: Implémenter**

`settingsRepo.ts` — importer `import type { Units } from '@/domain/program';` et compléter `SettingsMap` :
```ts
  /** Unité proposée à la création d'un programme */
  defaultUnits: Units;
  /** Horodatage ISO du dernier export réussi */
  lastExportAt: string;
```

`openEditor.ts` — importer `getSetting` depuis `@/db/repos/settingsRepo` et remplacer la ligne `store.start(...)` :
```ts
  const units = getSetting(ctx, 'defaultUnits') === 'lbs' ? 'lbs' : 'kg';
  store.start(ctx, program ? draftFromProgram(program.id, program.definition) : newDraft(units));
```

`importRepo.ts` — après `if (s.keepAwake !== undefined) setSetting(tx, 'keepAwake', s.keepAwake);` :
```ts
    if (s.defaultUnits) setSetting(tx, 'defaultUnits', s.defaultUnits);
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/editor src/db && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/db src/features/editor
git commit -m "feat(mobile): store default units and last export date; new drafts use the default unit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `exportRepo.readBundle` — relire toute la base

**Files:**
- Create: `mobile/src/db/repos/exportRepo.ts`, `mobile/src/db/__tests__/exportRepo.test.ts`

**Interfaces:**
- Consumes: `listPrograms`, `getActiveProgram` (programsRepo), `getAllWeights` (weightsRepo), `getLayout` (layoutsRepo), `getSetting`, `makeReport`, `isLang`, `isThemePref`.
- Produces: `readBundle(ctx: RepoCtx): ImportBundle` — `sourceId` = id natif, `ref` = id natif de la séance, rapport sans éléments ignorés.

- [ ] **Step 1: Écrire les tests**

`mobile/src/db/__tests__/exportRepo.test.ts` :
```ts
/** @jest-environment node */
import { eq, isNull } from 'drizzle-orm';
import example from '@/data/program.example.json';
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { parseNativeBackup, toNativeBackup } from '@/domain/nativeBackup';
import { readBundle } from '../repos/exportRepo';
import { replaceAll } from '../repos/importRepo';
import { createProgram, getActiveProgram, setActiveProgram, softDeleteProgram } from '../repos/programsRepo';
import { getSetting, setSetting } from '../repos/settingsRepo';
import { ensureWorkout, upsertSet } from '../repos/workoutsRepo';
import { programs, setEntries, workouts } from '../schema';
import { createTestCtx } from '../testing/createTestCtx';

function restored() {
  const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
  if (!r.ok) throw new Error('fixture invalide');
  const ctx = createTestCtx();
  replaceAll(ctx, r.bundle);
  return { ctx, original: r.bundle };
}

describe('exportRepo.readBundle', () => {
  it('aller-retour sur la vraie sauvegarde : restaurer → exporter → réimporter dans une base vide', () => {
    const { ctx, original } = restored();
    setSetting(ctx, 'defaultUnits', 'lbs');
    const json = JSON.parse(JSON.stringify(toNativeBackup(readBundle(ctx), '2026-10-07T20:00:00.000Z')));
    const back = parseNativeBackup(json);
    if (!back.ok) throw new Error('export illisible');
    expect(back.bundle.report).toMatchObject({ programs: 2, workouts: 8, sets: 115, weights: 10, layouts: original.report.layouts, ignored: [] });

    const fresh = createTestCtx();
    replaceAll(fresh, back.bundle);
    expect(getActiveProgram(fresh)?.definition.meta.label).toBe(getActiveProgram(ctx)?.definition.meta.label);
    expect(fresh.db.select().from(workouts).where(isNull(workouts.deletedAt)).all()).toHaveLength(8);
    expect(fresh.db.select().from(setEntries).where(isNull(setEntries.deletedAt)).all()).toHaveLength(115);
    expect(getSetting(fresh, 'theme')).toBe('light');
    expect(getSetting(fresh, 'defaultUnits')).toBe('lbs');
  });

  it('ignore les lignes supprimées et les séances d\'un programme supprimé', () => {
    const ctx = createTestCtx();
    const keep = createProgram(ctx, example, 'example');
    const gone = createProgram(ctx, { ...example, meta: { ...example.meta, label: 'GONE' } }, 'manual');
    setActiveProgram(ctx, keep.id);
    const w = ensureWorkout(ctx, { programId: gone.id, sessionKey: 'full-body', date: '2026-10-06' });
    upsertSet(ctx, w.id, 'presse-cuisses', 0, { done: true });
    softDeleteProgram(ctx, gone.id);
    const b = readBundle(ctx);
    expect(b.programs.map((p) => p.sourceId)).toEqual([keep.id]);
    expect(b.activeProgramRef).toBe(keep.id);
    expect(b.workouts).toEqual([]);
    expect(b.sets).toEqual([]);
  });

  it('Review Focus 2 : programme stocké illisible → exclu, ses séances aussi, pas d\'exception', () => {
    const ctx = createTestCtx();
    const ok = createProgram(ctx, example, 'example');
    const broken = createProgram(ctx, example, 'manual');
    setActiveProgram(ctx, ok.id);
    ensureWorkout(ctx, { programId: broken.id, sessionKey: 'full-body', date: '2026-10-06' });
    ctx.db.update(programs).set({ definition: '{pas du json' }).where(eq(programs.id, broken.id)).run();
    const b = readBundle(ctx);
    expect(b.programs.map((p) => p.sourceId)).toEqual([ok.id]);
    expect(b.workouts).toEqual([]);
  });

  it('base vide : aucun programme, actif null, réglages vides', () => {
    expect(readBundle(createTestCtx())).toMatchObject({ programs: [], activeProgramRef: null, workouts: [], sets: [], settings: {} });
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/db/__tests__/exportRepo.test.ts`
Expected: FAIL — module `../repos/exportRepo` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/db/repos/exportRepo.ts` :
```ts
// ============================================================
// Export — relit toute la base (lignes non supprimées) en ImportBundle,
// l'inverse de importRepo.replaceAll. Les ids natifs servent de références.
// ============================================================
import { asc, isNull } from 'drizzle-orm';
import { makeReport, type BundleSettings, type ImportBundle } from '@/domain/importBundle';
import { isLang, isThemePref } from '@/domain/prefs';
import { sessionLayouts, setEntries, workouts } from '../schema';
import type { RepoCtx } from '../types';
import { getLayout } from './layoutsRepo';
import { getActiveProgram, listPrograms } from './programsRepo';
import { getSetting } from './settingsRepo';
import { getAllWeights } from './weightsRepo';

function readSettings(ctx: RepoCtx): BundleSettings {
  const s: BundleSettings = {};
  const lang = getSetting(ctx, 'lang');
  const theme = getSetting(ctx, 'theme');
  const aiEnabled = getSetting(ctx, 'aiEnabled');
  const keepAwake = getSetting(ctx, 'keepAwake');
  const defaultUnits = getSetting(ctx, 'defaultUnits');
  if (isLang(lang)) s.lang = lang;
  if (isThemePref(theme)) s.theme = theme;
  if (typeof aiEnabled === 'boolean') s.aiEnabled = aiEnabled;
  if (typeof keepAwake === 'boolean') s.keepAwake = keepAwake;
  if (defaultUnits === 'kg' || defaultUnits === 'lbs') s.defaultUnits = defaultUnits;
  return s;
}

export function readBundle(ctx: RepoCtx): ImportBundle {
  // listPrograms écarte déjà les programmes supprimés ou illisibles
  const progs = listPrograms(ctx);
  const programIds = new Set(progs.map((p) => p.id));

  const ws = ctx.db.select().from(workouts).where(isNull(workouts.deletedAt))
    .orderBy(asc(workouts.date), asc(workouts.id)).all()
    .filter((w) => programIds.has(w.programId));
  const workoutIds = new Set(ws.map((w) => w.id));

  const ss = ctx.db.select().from(setEntries).where(isNull(setEntries.deletedAt))
    .orderBy(asc(setEntries.workoutId), asc(setEntries.exerciseId), asc(setEntries.setIndex)).all()
    .filter((s) => workoutIds.has(s.workoutId));

  const layouts = ctx.db.select().from(sessionLayouts).where(isNull(sessionLayouts.deletedAt)).all()
    .filter((l) => programIds.has(l.programId))
    .map((l) => ({ programRef: l.programId, sessionKey: l.sessionKey, ...getLayout(ctx, l.programId, l.sessionKey) }));

  const body = {
    programs: progs.map((p) => ({ sourceId: p.id, definition: p.definition, source: p.source })),
    activeProgramRef: getActiveProgram(ctx)?.id ?? null,
    workouts: ws.map((w) => ({
      ref: w.id, programRef: w.programId, sessionKey: w.sessionKey, date: w.date,
      status: w.status, startedAt: w.startedAt, completedAt: w.completedAt,
    })),
    sets: ss.map((s) => ({
      workoutRef: s.workoutId, exerciseId: s.exerciseId, setIndex: s.setIndex, done: s.done,
      weight: s.weight, reps: s.reps, performedName: s.performedName, doneAt: s.doneAt,
    })),
    weights: Object.entries(getAllWeights(ctx)).map(([key, w]) => ({ key, weight: w.weight, unit: w.unit })),
    layouts,
    settings: readSettings(ctx),
  };
  return { ...body, report: makeReport(body, []) };
}
```

Si `getActiveProgram` renvoie un programme quand la base est vide (il ne devrait pas), le dernier test le révélera.

- [ ] **Step 4: Relancer**

Run: `npx jest src/db && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/db/repos/exportRepo.ts src/db/__tests__/exportRepo.test.ts
git commit -m "feat(mobile): read the whole database back into an export bundle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `resetRepo` — supprimer l'historique, réinitialiser l'application

**Files:**
- Create: `mobile/src/db/repos/resetRepo.ts`, `mobile/src/db/__tests__/resetRepo.test.ts`

**Interfaces:**
- Produces: `deleteHistory(ctx: RepoCtx): void` ; `resetAll(ctx: RepoCtx): void` ; `KEPT_ON_RESET: readonly SettingKey[]` (= `['lang', 'theme']`).

- [ ] **Step 1: Écrire les tests**

`mobile/src/db/__tests__/resetRepo.test.ts` :
```ts
/** @jest-environment node */
import { isNull } from 'drizzle-orm';
import example from '@/data/program.example.json';
import { newDraft } from '@/domain/draft';
import { needsOnboarding } from '@/features/onboarding/needsOnboarding';
import { setOrder } from '../repos/layoutsRepo';
import { createProgram, getActiveProgram, listPrograms, setActiveProgram } from '../repos/programsRepo';
import { deleteHistory, resetAll } from '../repos/resetRepo';
import { getSetting, setSetting } from '../repos/settingsRepo';
import { getAllWeights, setWeight } from '../repos/weightsRepo';
import { ensureWorkout, upsertSet } from '../repos/workoutsRepo';
import { sessionLayouts, setEntries, settings, workouts } from '../schema';
import { createTestCtx } from '../testing/createTestCtx';

function seeded() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, example, 'example');
  setActiveProgram(ctx, p.id);
  const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 'full-body', date: '2026-10-06' });
  upsertSet(ctx, w.id, 'presse-cuisses', 0, { done: true, weight: 100 });
  setWeight(ctx, 'presse-cuisses', 100, 'kg');
  setOrder(ctx, p.id, 'full-body', ['presse-cuisses']);
  setSetting(ctx, 'lang', 'en');
  setSetting(ctx, 'theme', 'light');
  setSetting(ctx, 'onboarded', true);
  setSetting(ctx, 'aiEnabled', true);
  setSetting(ctx, 'defaultUnits', 'lbs');
  setSetting(ctx, 'lastExportAt', '2026-10-01T10:00:00.000Z');
  setSetting(ctx, 'programDraft', newDraft());
  setSetting(ctx, 'activeRest', { mode: 'rest', startedAt: 0, endAt: 1, workoutId: w.id, exerciseId: 'presse-cuisses', setIndex: 0, pending: null });
  return { ctx, p };
}
const liveCount = (ctx: ReturnType<typeof createTestCtx>) => ({
  workouts: ctx.db.select().from(workouts).where(isNull(workouts.deletedAt)).all().length,
  sets: ctx.db.select().from(setEntries).where(isNull(setEntries.deletedAt)).all().length,
  layouts: ctx.db.select().from(sessionLayouts).where(isNull(sessionLayouts.deletedAt)).all().length,
});

describe('resetRepo.deleteHistory', () => {
  it('efface séances, séries et minuteur ; garde programmes, poids, organisation, brouillon, réglages', () => {
    const { ctx, p } = seeded();
    deleteHistory(ctx);
    expect(liveCount(ctx)).toEqual({ workouts: 0, sets: 0, layouts: 1 });
    expect(getActiveProgram(ctx)?.id).toBe(p.id);
    expect(getAllWeights(ctx)).toHaveProperty('presse-cuisses');
    expect(getSetting(ctx, 'activeRest')).toBeUndefined();
    expect(getSetting(ctx, 'programDraft')).toBeDefined();
    expect(getSetting(ctx, 'lastExportAt')).toBe('2026-10-01T10:00:00.000Z');
  });
});

describe('resetRepo.resetAll', () => {
  it('vide tout sauf langue et thème → onboarding requis', () => {
    const { ctx } = seeded();
    resetAll(ctx);
    expect(listPrograms(ctx)).toEqual([]);
    expect(liveCount(ctx)).toEqual({ workouts: 0, sets: 0, layouts: 0 });
    expect(getAllWeights(ctx)).toEqual({});
    expect(ctx.db.select({ key: settings.key }).from(settings).all().map((r) => r.key).sort()).toEqual(['lang', 'theme']);
    expect(getSetting(ctx, 'lang')).toBe('en');
    expect(needsOnboarding(ctx)).toBe(true);
  });

  it('Review Focus 3 : échec au milieu → rien n\'est effacé', () => {
    const { ctx } = seeded();
    ctx.sqlite.exec("CREATE TRIGGER boom BEFORE UPDATE ON programs BEGIN SELECT RAISE(ABORT, 'boom'); END");
    expect(() => resetAll(ctx)).toThrow();
    expect(liveCount(ctx)).toEqual({ workouts: 1, sets: 1, layouts: 1 });
    expect(listPrograms(ctx)).toHaveLength(1);
    expect(getSetting(ctx, 'onboarded')).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/db/__tests__/resetRepo.test.ts`
Expected: FAIL — module `../repos/resetRepo` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/db/repos/resetRepo.ts` :
```ts
// ============================================================
// Zone de danger de Profil — chaque action en UNE transaction.
// Suppressions logiques (deletedAt) pour les tables synchronisables.
// ============================================================
import { isNull, notInArray } from 'drizzle-orm';
import { exerciseWeights, programs, sessionLayouts, setEntries, settings, workouts } from '../schema';
import { inTransaction } from '../transaction';
import type { RepoCtx } from '../types';
import { deleteSetting, type SettingKey } from './settingsRepo';

/** Réglages conservés par « Réinitialiser l'application » */
export const KEPT_ON_RESET: readonly SettingKey[] = ['lang', 'theme'];

function retireHistory(tx: RepoCtx, now: string) {
  const retire = { deletedAt: now, updatedAt: now };
  tx.db.update(setEntries).set(retire).where(isNull(setEntries.deletedAt)).run();
  tx.db.update(workouts).set(retire).where(isNull(workouts.deletedAt)).run();
}

/** Séances et séries (y compris en cours) + minuteur ; le reste est conservé */
export function deleteHistory(ctx: RepoCtx): void {
  inTransaction(ctx, (tx) => {
    retireHistory(tx, tx.now());
    deleteSetting(tx, 'activeRest');
  });
}

/** Tout, sauf la langue et le thème */
export function resetAll(ctx: RepoCtx): void {
  inTransaction(ctx, (tx) => {
    const now = tx.now();
    const retire = { deletedAt: now, updatedAt: now };
    retireHistory(tx, now);
    tx.db.update(exerciseWeights).set(retire).where(isNull(exerciseWeights.deletedAt)).run();
    tx.db.update(sessionLayouts).set(retire).where(isNull(sessionLayouts.deletedAt)).run();
    tx.db.update(programs).set(retire).where(isNull(programs.deletedAt)).run();
    tx.db.delete(settings).where(notInArray(settings.key, [...KEPT_ON_RESET])).run();
  });
}
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/db && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/db/repos/resetRepo.ts src/db/__tests__/resetRepo.test.ts
git commit -m "feat(mobile): delete history or reset all data in one transaction

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Adaptateurs `shareJsonFile` et `appVersion`

**Files:**
- Create: `mobile/src/platform/shareJsonFile.ts`, `mobile/src/platform/shareJsonFile.web.ts`, `mobile/src/platform/appVersion.ts`
- Modify: `mobile/src/platform/types.ts`, `mobile/src/test/jestSetup.js`, `mobile/package.json` (via `expo install`)

**Interfaces:**
- Produces: `type ShareResult = 'shared' | 'cancelled'` ; `shareJsonFile(fileName: string, text: string): Promise<ShareResult>` (lève en cas d'erreur) ; `appVersion(): string`. Mocks Jest : `shareJsonFile` → `Promise.resolve('shared')`, `appVersion` → `'1.0.0'`.

Les adaptateurs ne sont pas testés unitairement (convention du projet : `jestSetup.js` les simule, la checklist appareil les vérifie). La vérification de cette tâche est `tsc` + la suite complète.

- [ ] **Step 1: Installer la dépendance**

Run: `npx expo install expo-sharing`
Expected: `expo-sharing ~57.0.x` ajouté à `package.json`.

- [ ] **Step 2: Écrire les adaptateurs**

`mobile/src/platform/types.ts` — ajouter à la fin :
```ts
/** Issue d'un partage de fichier. iOS/Android ne signalent pas l'annulation : 'shared' dès que la feuille se ferme sans erreur */
export type ShareResult = 'shared' | 'cancelled';
```

`mobile/src/platform/shareJsonFile.ts` :
```ts
// Partage d'un fichier JSON : écrit dans le cache puis feuille de partage système
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ShareResult } from './types';

export async function shareJsonFile(fileName: string, text: string): Promise<ShareResult> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: fileName });
  return 'shared';
}
```

`mobile/src/platform/shareJsonFile.web.ts` :
```ts
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
```

`mobile/src/platform/appVersion.ts` :
```ts
// Version affichée dans Profil › À propos (app.json → expo.version)
import Constants from 'expo-constants';

export function appVersion(): string {
  return Constants.expoConfig?.version ?? '?';
}
```

`mobile/src/test/jestSetup.js` — ajouter après le mock de `pickJsonFile` :
```js
jest.mock('@/platform/shareJsonFile', () => ({ shareJsonFile: jest.fn(() => Promise.resolve('shared')) }));
jest.mock('@/platform/appVersion', () => ({ appVersion: () => '1.0.0' }));
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc propre (signatures `File.create({ overwrite })` / `write(string)` de expo-file-system 57 ; si une signature diffère, l'adapter et ledger la ruling), suite verte.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/platform src/test/jestSetup.js
git commit -m "feat(mobile): add share-file and app-version platform adapters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Chaînes M4a (fr/en)

**Files:**
- Modify: `mobile/src/i18n/locales/fr.json`, `mobile/src/i18n/locales/en.json`
- Test: `mobile/src/i18n/__tests__/translate.test.ts` (« fr et en ont exactement les mêmes clés »)

**Interfaces:**
- Produces: les clés ci-dessous (utilisées par les Tasks 8 et 9).

- [ ] **Step 1: Ajouter les clés** (avant `"coming_soon"`, dans les deux fichiers)

fr :
```json
  "profile_settings": "Réglages",
  "profile_default_units": "Unité par défaut",
  "profile_default_units_meta": "Pour les nouveaux programmes",
  "profile_sessions_week_one": "1 séance / semaine",
  "profile_sessions_week": "%s séances / semaine",
  "profile_backup_never": "Jamais sauvegardé",
  "profile_backup_today": "Dernière sauvegarde : aujourd'hui",
  "profile_backup_one": "Dernière sauvegarde : il y a 1 jour",
  "profile_backup_days": "Dernière sauvegarde : il y a %s jours",
  "profile_export_done": "Sauvegarde exportée ✓",
  "profile_export_failed": "Export impossible",
  "profile_import_label": "Importer",
  "profile_import_sub": "Sauvegarde ou programme (JSON)",
  "profile_delete_history": "Supprimer l'historique",
  "profile_delete_history_meta": "Séances et séries ; programmes, poids et réglages conservés",
  "profile_confirm_history_title": "Supprimer tout l'historique ?",
  "profile_confirm_history_body": "Toutes les séances et séries seront effacées. Pense à exporter tes données avant.",
  "profile_history_deleted": "Historique supprimé",
  "profile_reset_meta": "Efface tout sauf la langue et le thème",
  "profile_confirm_reset_title": "Réinitialiser l'application ?",
  "profile_confirm_reset_body": "Programmes, historique, poids et réglages seront effacés. Pense à exporter tes données avant.",
  "profile_delete_btn": "Supprimer",
  "profile_reset_btn": "Réinitialiser",
  "profile_version_fmt": "Version %s",
```

en :
```json
  "profile_settings": "Settings",
  "profile_default_units": "Default unit",
  "profile_default_units_meta": "For new programs",
  "profile_sessions_week_one": "1 session / week",
  "profile_sessions_week": "%s sessions / week",
  "profile_backup_never": "Never backed up",
  "profile_backup_today": "Last backup: today",
  "profile_backup_one": "Last backup: 1 day ago",
  "profile_backup_days": "Last backup: %s days ago",
  "profile_export_done": "Backup exported ✓",
  "profile_export_failed": "Export failed",
  "profile_import_label": "Import",
  "profile_import_sub": "Backup or program (JSON)",
  "profile_delete_history": "Delete history",
  "profile_delete_history_meta": "Sessions and sets; programs, weights and settings are kept",
  "profile_confirm_history_title": "Delete all history?",
  "profile_confirm_history_body": "All sessions and sets will be erased. Consider exporting your data first.",
  "profile_history_deleted": "History deleted",
  "profile_reset_meta": "Erases everything except language and theme",
  "profile_confirm_reset_title": "Reset the app?",
  "profile_confirm_reset_body": "Programs, history, weights and settings will be erased. Consider exporting your data first.",
  "profile_delete_btn": "Delete",
  "profile_reset_btn": "Reset",
  "profile_version_fmt": "Version %s",
```

Clés existantes réutilisées : `profile_title`, `profile_active_program`, `profile_no_active`, `profile_manage`, `profile_data`, `profile_export`, `profile_danger`, `profile_reset_app`, `profile_ai_label`, `profile_ai_desc`, `profile_about`, `profile_language`, `profile_theme*`, `profile_keep_awake*`, `today_create_program`, `onboarding_import`, `editor_cancel`, `error_not_saved`.

- [ ] **Step 2: Vérifier**

Run: `npx jest src/i18n && npx tsc --noEmit`
Expected: PASS (parité fr/en), tsc propre.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales
git commit -m "feat(mobile): add M4a profile strings (fr/en)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Plan s'ouvre sur « Mes programmes » à la demande

**Files:**
- Modify: `mobile/src/features/plan/PlanScreen.tsx:41-48`, `mobile/src/app/(tabs)/plan.tsx`
- Test: `mobile/src/features/plan/__tests__/PlanScreen.test.tsx`

**Interfaces:**
- Produces: `PlanScreen` prop optionnelle `tabRequest?: { tab: PlanTab; at: string }` — à chaque nouvel `at`, l'onglet demandé s'affiche. Route : paramètres `tab` et `at` (`router.navigate({ pathname: '/plan', params: { tab: 'programs', at: String(Date.now()) } })`).

- [ ] **Step 1: Écrire le test**

Dans `PlanScreen.test.tsx`, ajouter (en dehors de `setup`, qui ne passe pas la prop) :
```ts
  it('Review Focus 5 : tabRequest ouvre « Mes programmes », à chaque nouvelle demande', async () => {
    const ctx = createTestCtx();
    setActiveProgram(ctx, createProgram(ctx, example, 'example').id);
    const props = { onOpenEditor: jest.fn(), onOpenImport: jest.fn() };
    const { rerender } = await renderWithProviders(<PlanScreen {...props} tabRequest={{ tab: 'programs', at: '1' }} />, { ctx });
    expect(screen.getByText('CRÉER UN NOUVEAU PROGRAMME')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Cette semaine' }));
    expect(screen.queryByText('CRÉER UN NOUVEAU PROGRAMME')).toBeNull();
    await rerender(<PlanScreen {...props} tabRequest={{ tab: 'programs', at: '2' }} />);
    expect(screen.getByText('CRÉER UN NOUVEAU PROGRAMME')).toBeTruthy();
  });
```

Le `rerender` de RNTL remplace tout l'arbre (les providers seraient perdus) : `renderWithProviders` doit renvoyer un `rerender` qui ré-enveloppe. Dans `mobile/src/test/renderWithProviders.tsx`, remplacer le corps par :
```tsx
export function renderWithProviders(ui: ReactElement, opts: { lang?: Lang; theme?: ThemePref; ctx?: RepoCtx } = {}) {
  const wrap = (node: ReactElement) => {
    const tree = (
      <SafeAreaProvider initialMetrics={METRICS}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider pref={opts.theme ?? 'dark'}>
            <I18nProvider lang={opts.lang ?? 'fr'}>{node}</I18nProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
    return opts.ctx ? <DbTestProvider value={opts.ctx}>{tree}</DbTestProvider> : tree;
  };
  const result = render(wrap(ui));
  return Object.assign(result, { rerender: (next: ReactElement) => result.rerender(wrap(next)) });
}
```
(`render` est asynchrone en RNTL 14 : si `render(...)` renvoie une promesse, faire de `renderWithProviders` une fonction `async` qui `await render(...)` puis ré-enveloppe `rerender` de la même façon ; tous les appelants font déjà `await renderWithProviders(...)`.) L'onglet « Cette semaine » est la clé `plan_this_week`.

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/plan/__tests__/PlanScreen.test.tsx`
Expected: FAIL — « CRÉER UN NOUVEAU PROGRAMME » introuvable au premier rendu (onglet « Cette semaine » par défaut).

- [ ] **Step 3: Implémenter**

`PlanScreen.tsx` — signature et état :
```tsx
interface Props {
  onOpenEditor(step: EditorStep): void;
  onOpenImport(): void;
  /** Demande d'onglet venue d'ailleurs (Profil › Gérer) ; chaque nouvel `at` l'applique */
  tabRequest?: { tab: PlanTab; at: string };
}

export function PlanScreen({ onOpenEditor, onOpenImport, tabRequest }: Props) {
```
puis, à la place de `const [tab, setTab] = useState<PlanTab>('week');` :
```tsx
  const [tab, setTab] = useState<PlanTab>(tabRequest?.tab ?? 'week');
  const requestTab = tabRequest?.tab;
  const requestAt = tabRequest?.at;
  useEffect(() => {
    if (requestTab) setTab(requestTab);
  }, [requestTab, requestAt]);
```

`mobile/src/app/(tabs)/plan.tsx` :
```tsx
// Route Plan — ErrorBoundary + ouverture de l'éditeur (pile plein écran) ; ?tab=programs&at=… ouvre « Mes programmes »
import { router, useLocalSearchParams } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { PlanScreen } from '@/features/plan/PlanScreen';

const STEP_ROUTES = { 1: '/editor/meta', 2: '/editor/sessions', 3: '/editor/schedule' } as const;

export default function PlanRoute() {
  const { tab, at } = useLocalSearchParams<{ tab?: string; at?: string }>();
  const tabRequest = tab === 'programs' || tab === 'week' ? { tab, at: at ?? '' } : undefined;
  return (
    <TabErrorBoundary>
      <PlanScreen
        onOpenEditor={(step) => router.push(STEP_ROUTES[step])}
        onOpenImport={() => router.push('/import')}
        tabRequest={tabRequest}
      />
    </TabErrorBoundary>
  );
}
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/plan && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/features/plan "src/app/(tabs)/plan.tsx" src/test
git commit -m "feat(mobile): let Plan open on My programs on request

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Carte « Programme actif » et section Réglages

**Files:**
- Create: `mobile/src/features/profile/ActiveProgramCard.tsx`, `mobile/src/features/profile/SettingsSection.tsx`, `mobile/src/features/profile/__tests__/profileSections.test.tsx`

**Interfaces:**
- Consumes: `programSummary(p): { days, exercises }` (`@/features/plan/planStats`), `Segmented`, `getSetting`/`setSetting` (`defaultUnits`, `aiEnabled`, `keepAwake`), `usePrefs` (`setLang`, `setTheme`, `bumpData`), `prepareEditor`.
- Produces:
  - `ActiveProgramCard({ program, onManage, onCreate, onImport }: { program: Program | null; onManage(): void; onCreate(): void; onImport(): void })`
  - `SettingsSection()` (lit/écrit les réglages elle-même via `useRepoCtx` + `useDbQuery`).

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/profile/__tests__/profileSections.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { getSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { parseProgram } from '@/domain/program';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ActiveProgramCard } from '../ActiveProgramCard';
import { SettingsSection } from '../SettingsSection';

const program = (() => {
  const r = parseProgram(example);
  if (!r.ok) throw new Error('exemple invalide');
  return r.program;
})();

describe('ActiveProgramCard', () => {
  it('avec programme : nom, séances par semaine, unité, Gérer', async () => {
    const onManage = jest.fn();
    await renderWithProviders(<ActiveProgramCard program={program} onManage={onManage} onCreate={jest.fn()} onImport={jest.fn()} />);
    expect(screen.getByText(program.meta.label)).toBeTruthy();
    expect(screen.getByText(`3 séances / semaine · ${program.meta.units}`)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Gérer mes programmes' }));
    expect(onManage).toHaveBeenCalled();
  });

  it('sans programme : Créer et Importer', async () => {
    const onCreate = jest.fn();
    const onImport = jest.fn();
    await renderWithProviders(<ActiveProgramCard program={null} onManage={jest.fn()} onCreate={onCreate} onImport={onImport} />);
    expect(screen.getByText('Aucun programme actif')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER MON PROGRAMME' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Importer un fichier JSON' }));
    expect(onCreate).toHaveBeenCalled();
    expect(onImport).toHaveBeenCalled();
  });
});

describe('SettingsSection', () => {
  beforeEach(async () => {
    await act(async () => { usePrefs.setState(PREFS_INITIAL); });
  });

  it('unité par défaut : kg sélectionné, lbs enregistré', async () => {
    const ctx = createTestCtx();
    await renderWithProviders(<SettingsSection />, { ctx });
    expect(screen.getByRole('button', { name: 'kg' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('button', { name: 'lbs' }));
    expect(getSetting(ctx, 'defaultUnits')).toBe('lbs');
    expect(screen.getByRole('button', { name: 'lbs' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('Coach IA : désactivé par défaut, interrupteur enregistré', async () => {
    const ctx = createTestCtx();
    await renderWithProviders(<SettingsSection />, { ctx });
    const sw = screen.getByTestId('ai-switch');
    expect(sw.props.value).toBe(false);
    await fireEvent(sw, 'valueChange', true);
    expect(getSetting(ctx, 'aiEnabled')).toBe(true);
  });

  it('langue et thème toujours présents', async () => {
    await renderWithProviders(<SettingsSection />, { ctx: createTestCtx() });
    expect(screen.getByRole('button', { name: 'EN' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clair' })).toBeTruthy();
  });
});
```

Vérifier que l'exemple compte 3 jours planifiés (`programSummary(program).days`) ; sinon adapter l'attendu à la valeur réelle.

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/profile`
Expected: FAIL — modules `../ActiveProgramCard` et `../SettingsSection` introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/features/profile/ActiveProgramCard.tsx` :
```tsx
// Profil · carte « Programme actif » — ou Créer / Importer s'il n'y en a pas
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Program } from '@/domain/program';
import { programSummary } from '@/features/plan/planStats';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  program: Program | null;
  onManage(): void;
  onCreate(): void;
  onImport(): void;
}

export function ActiveProgramCard({ program, onManage, onCreate, onImport }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const card = [styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.lg }];
  const label = [styles.label, { color: colors.textDim, fontFamily: fonts.uiBold }];
  if (!program) {
    return (
      <View style={card}>
        <Text style={label}>{t('profile_active_program').toUpperCase()}</Text>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('profile_no_active')}</Text>
        <Pressable accessibilityRole="button" onPress={onCreate} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
          <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('today_create_program')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onImport} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('onboarding_import')}</Text>
        </Pressable>
      </View>
    );
  }
  const { days } = programSummary(program);
  const perWeek = days === 1 ? t('profile_sessions_week_one') : t('profile_sessions_week', days);
  return (
    <View style={card}>
      <Text style={label}>{t('profile_active_program').toUpperCase()}</Text>
      <Text style={[styles.name, { color: colors.text, fontFamily: fonts.display }]}>{program.meta.label}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{`${perWeek} · ${program.meta.units}`}</Text>
      <Pressable accessibilityRole="button" onPress={onManage} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('profile_manage')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 16, gap: 8 },
  label: { fontSize: 11, letterSpacing: 1.5 },
  name: { fontSize: 28 },
  btn: { minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
```

`mobile/src/features/profile/SettingsSection.tsx` :
```tsx
// Profil · Réglages — langue, thème, unité par défaut, écran allumé, Coach IA
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import type { Lang, ThemePref } from '@/domain/prefs';
import type { Units } from '@/domain/program';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Segmented } from './Segmented';

const readSettings = (ctx: RepoCtx) => ({
  keepAwake: getSetting(ctx, 'keepAwake') !== false,
  aiEnabled: getSetting(ctx, 'aiEnabled') === true,
  units: (getSetting(ctx, 'defaultUnits') === 'lbs' ? 'lbs' : 'kg') as Units,
});

export function SettingsSection() {
  const ctx = useRepoCtx();
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const lang = usePrefs((s) => s.lang);
  const theme = usePrefs((s) => s.theme);
  const s = useDbQuery(readSettings);
  const label = [styles.label, { color: colors.textDim, fontFamily: fonts.uiBold }];
  const meta = { color: colors.textDim, fontFamily: fonts.ui };

  const write = (fn: () => void) => {
    try {
      fn();
    } catch {
      useToastStore.getState().show(t('error_not_saved'));
    }
    usePrefs.getState().bumpData();
  };

  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('profile_settings').toUpperCase()}</Text>
      <View style={styles.group}>
        <Text style={label}>{t('profile_language').toUpperCase()}</Text>
        <Segmented<Lang> options={[{ value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }]} value={lang} onChange={(v) => usePrefs.getState().setLang(ctx, v)} />
      </View>
      <View style={styles.group}>
        <Text style={label}>{t('profile_theme').toUpperCase()}</Text>
        <Segmented<ThemePref>
          options={[
            { value: 'dark', label: t('profile_theme_dark') },
            { value: 'light', label: t('profile_theme_light') },
            { value: 'system', label: t('profile_theme_system') },
          ]}
          value={theme}
          onChange={(v) => usePrefs.getState().setTheme(ctx, v)}
        />
      </View>
      <View style={styles.group}>
        <Text style={label}>{t('profile_default_units').toUpperCase()}</Text>
        <Text style={meta}>{t('profile_default_units_meta')}</Text>
        <Segmented<Units> options={[{ value: 'kg', label: 'kg' }, { value: 'lbs', label: 'lbs' }]} value={s.units} onChange={(v) => write(() => setSetting(ctx, 'defaultUnits', v))} />
      </View>
      <View style={styles.group}>
        <Text style={label}>{t('profile_keep_awake').toUpperCase()}</Text>
        <Text style={meta}>{t('profile_keep_awake_meta')}</Text>
        <Segmented<'on' | 'off'>
          options={[{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }]}
          value={s.keepAwake ? 'on' : 'off'}
          onChange={(v) => write(() => setSetting(ctx, 'keepAwake', v === 'on'))}
        />
      </View>
      <View style={[styles.group, styles.row]}>
        <View style={styles.flex}>
          <Text style={label}>{t('profile_ai_label').toUpperCase()}</Text>
          <Text style={meta}>{t('profile_ai_desc')}</Text>
        </View>
        <Switch testID="ai-switch" accessibilityLabel={t('profile_ai_label')} value={s.aiEnabled} onValueChange={(v) => write(() => setSetting(ctx, 'aiEnabled', v))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  group: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 4 },
  label: { fontSize: 11, letterSpacing: 1.5 },
});
```

`radius.lg` = 16 (`src/theme/tokens.ts`), le rayon des cartes.

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/profile && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile
git commit -m "feat(mobile): add active-program card and settings section to Profile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Données, zone de danger, assemblage de l'écran Profil

**Files:**
- Create: `mobile/src/features/profile/actions.ts`, `mobile/src/features/profile/DataSection.tsx`, `mobile/src/features/profile/DangerSection.tsx`, `mobile/src/features/profile/ProfileScreen.tsx`, `mobile/src/features/profile/__tests__/ProfileScreen.test.tsx`
- Modify: `mobile/src/app/(tabs)/profile.tsx` (remplacement complet)

**Interfaces:**
- Consumes: `readBundle` (Task 3), `toNativeBackup`, `deleteHistory`/`resetAll` (Task 4), `shareJsonFile`, `appVersion` (Task 5), `backupAge` (Task 1), `ActiveProgramCard`, `SettingsSection` (Task 8), `prepareEditor`, `confirm`, stores.
- Produces:
  - `exportData(ctx: RepoCtx, now: Date): Promise<'shared' | 'cancelled' | 'failed'>` — écrit `lastExportAt` seulement si `'shared'`.
  - `runReset(ctx: RepoCtx, write: (ctx: RepoCtx) => void): boolean` — écriture, puis relecture des stores (`usePrefs.hydrate`, `useTimerStore.clear`, `useDraftStore.hydrate`) et `bumpData()` ; `false` si l'écriture lève.
  - `ProfileScreen({ onManagePrograms, onOpenEditor, onImport }: { onManagePrograms(): void; onOpenEditor(): void; onImport(): void })` — la spec nomme `onCreate` la prop d'ouverture de l'éditeur ; elle s'appelle `onOpenEditor` comme dans Today (la préparation du brouillon reste dans l'écran).

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/profile/__tests__/ProfileScreen.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { isNull } from 'drizzle-orm';
import example from '@/data/program.example.json';
import { createProgram, listPrograms, setActiveProgram } from '@/db/repos/programsRepo';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { ensureWorkout, upsertSet } from '@/db/repos/workoutsRepo';
import { workouts } from '@/db/schema';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { localDateKey } from '@/domain/schedule';
import { needsOnboarding } from '@/features/onboarding/needsOnboarding';
import { confirm } from '@/platform/confirm';
import { shareJsonFile } from '@/platform/shareJsonFile';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { TOAST_INITIAL, useToastStore } from '@/state/toastStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ProfileScreen } from '../ProfileScreen';

async function setup(opts: { program?: boolean } = { program: true }) {
  const ctx = createTestCtx();
  if (opts.program) {
    const p = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, p.id);
    const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 'full-body', date: '2026-10-06' });
    upsertSet(ctx, w.id, 'presse-cuisses', 0, { done: true });
  }
  setSetting(ctx, 'onboarded', true);
  const props = { onManagePrograms: jest.fn(), onOpenEditor: jest.fn(), onImport: jest.fn() };
  await renderWithProviders(<ProfileScreen {...props} />, { ctx });
  return { ctx, props };
}
const liveWorkouts = (ctx: ReturnType<typeof createTestCtx>) => ctx.db.select().from(workouts).where(isNull(workouts.deletedAt)).all();

describe('ProfileScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => {
      usePrefs.setState(PREFS_INITIAL); useDraftStore.setState(DRAFT_INITIAL);
      useTimerStore.setState(TIMER_INITIAL); useToastStore.setState(TOAST_INITIAL);
    });
  });

  it('exporter : partage du fichier du jour, date mémorisée, rappel mis à jour', async () => {
    const { ctx } = await setup();
    expect(screen.getByText('Jamais sauvegardé')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Exporter mes données' }));
    const [name, text] = jest.mocked(shareJsonFile).mock.calls[0];
    expect(name).toBe(`workout-backup-${localDateKey(new Date())}.json`);
    expect(JSON.parse(text)).toMatchObject({ _format: 'workout-native', _version: 1 });
    expect(JSON.parse(text).workouts).toHaveLength(1);
    expect(getSetting(ctx, 'lastExportAt')).toEqual(expect.any(String));
    expect(screen.getByText("Dernière sauvegarde : aujourd'hui")).toBeTruthy();
    expect(useToastStore.getState().message).toBe('Sauvegarde exportée ✓');
  });

  it('export annulé → rien enregistré ; export en erreur → toast, rien enregistré', async () => {
    const { ctx } = await setup();
    jest.mocked(shareJsonFile).mockResolvedValueOnce('cancelled');
    await fireEvent.press(screen.getByRole('button', { name: 'Exporter mes données' }));
    expect(getSetting(ctx, 'lastExportAt')).toBeUndefined();
    jest.mocked(shareJsonFile).mockRejectedValueOnce(new Error('sharing_unavailable'));
    await fireEvent.press(screen.getByRole('button', { name: 'Exporter mes données' }));
    expect(getSetting(ctx, 'lastExportAt')).toBeUndefined();
    expect(useToastStore.getState().message).toBe('Export impossible');
  });

  it('Review Focus 1 : double tap sur Exporter → un seul partage', async () => {
    await setup();
    let release: (v: 'shared') => void = () => {};
    jest.mocked(shareJsonFile).mockImplementationOnce(() => new Promise((r) => { release = r; }));
    const btn = screen.getByRole('button', { name: 'Exporter mes données' });
    await fireEvent.press(btn);
    await fireEvent.press(btn);
    await act(async () => { release('shared'); });
    expect(shareJsonFile).toHaveBeenCalledTimes(1);
  });

  it('rappel en alerte après 15 jours', async () => {
    const ctx = createTestCtx();
    const old = new Date();
    old.setDate(old.getDate() - 15);
    setSetting(ctx, 'lastExportAt', old.toISOString());
    await renderWithProviders(<ProfileScreen onManagePrograms={jest.fn()} onOpenEditor={jest.fn()} onImport={jest.fn()} />, { ctx });
    expect(screen.getByText('Dernière sauvegarde : il y a 15 jours')).toBeTruthy();
  });

  it('supprimer l\'historique : confirmation refusée → rien ; acceptée → séances effacées, programme gardé', async () => {
    const { ctx } = await setup();
    jest.mocked(confirm).mockResolvedValueOnce(false);
    await fireEvent.press(screen.getByRole('button', { name: "Supprimer l'historique" }));
    expect(liveWorkouts(ctx)).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: "Supprimer l'historique" }));
    expect(liveWorkouts(ctx)).toHaveLength(0);
    expect(listPrograms(ctx)).toHaveLength(1);
    expect(useToastStore.getState().message).toBe('Historique supprimé');
  });

  it('Review Focus 4 : supprimer l\'historique arrête le minuteur en cours', async () => {
    await setup();
    await act(async () => {
      useTimerStore.setState({ ...TIMER_INITIAL, timer: { mode: 'rest', startedAt: 0, endAt: Date.now() + 60_000, workoutId: 'w', exerciseId: 'x', setIndex: 0, pending: null } });
    });
    await fireEvent.press(screen.getByRole('button', { name: "Supprimer l'historique" }));
    expect(useTimerStore.getState().timer).toBeNull();
  });

  it('réinitialiser : tout est vidé, langue gardée, onboarding requis', async () => {
    const { ctx } = await setup();
    setSetting(ctx, 'lang', 'fr');
    await fireEvent.press(screen.getByRole('button', { name: "Réinitialiser l'application" }));
    expect(listPrograms(ctx)).toEqual([]);
    expect(getSetting(ctx, 'lang')).toBe('fr');
    expect(needsOnboarding(ctx)).toBe(true);
  });

  it('carte programme : Gérer → onManagePrograms ; Importer → onImport ; version affichée', async () => {
    const { props } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Gérer mes programmes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Importer' }));
    expect(props.onManagePrograms).toHaveBeenCalled();
    expect(props.onImport).toHaveBeenCalled();
    expect(screen.getByText('Version 1.0.0')).toBeTruthy();
  });

  it('sans programme : Créer prépare un brouillon dans l\'unité par défaut puis ouvre l\'éditeur', async () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'defaultUnits', 'lbs');
    const onOpenEditor = jest.fn();
    await renderWithProviders(<ProfileScreen onManagePrograms={jest.fn()} onOpenEditor={onOpenEditor} onImport={jest.fn()} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER MON PROGRAMME' }));
    expect(useDraftStore.getState().draft?.program.meta.units).toBe('lbs');
    expect(onOpenEditor).toHaveBeenCalled();
  });
});
```

Vérifier la forme exacte de `TimerState` (`src/domain/timer.ts`) et de `TIMER_INITIAL` ; adapter l'objet `timer` du test Review Focus 4 aux champs réels.

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/profile/__tests__/ProfileScreen.test.tsx`
Expected: FAIL — module `../ProfileScreen` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/profile/actions.ts` :
```ts
// Actions de Profil (fonctions de module : compatibles React Compiler)
import { readBundle } from '@/db/repos/exportRepo';
import { setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { toNativeBackup } from '@/domain/nativeBackup';
import { localDateKey } from '@/domain/schedule';
import { shareJsonFile } from '@/platform/shareJsonFile';
import { useDraftStore } from '@/state/draftStore';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';

export type ExportOutcome = 'shared' | 'cancelled' | 'failed';

/** Export natif v1 → feuille de partage ; lastExportAt écrit seulement si le partage aboutit */
export async function exportData(ctx: RepoCtx, now: Date): Promise<ExportOutcome> {
  try {
    const text = JSON.stringify(toNativeBackup(readBundle(ctx), now.toISOString()), null, 2);
    const result = await shareJsonFile(`workout-backup-${localDateKey(now)}.json`, text);
    if (result === 'shared') setSetting(ctx, 'lastExportAt', now.toISOString());
    return result;
  } catch {
    return 'failed';
  }
}

/** Suppression (une transaction) puis relecture des stores ; false si l'écriture échoue */
export function runReset(ctx: RepoCtx, write: (ctx: RepoCtx) => void): boolean {
  try {
    write(ctx);
  } catch {
    return false;
  }
  usePrefs.getState().hydrate(ctx);
  useTimerStore.getState().clear(ctx);
  useDraftStore.getState().hydrate(ctx);
  usePrefs.getState().bumpData();
  return true;
}
```

`mobile/src/features/profile/DataSection.tsx` :
```tsx
// Profil · Données — exporter (+ rappel de sauvegarde), importer
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { getSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { backupAge, type BackupAge } from '@/domain/backupAge';
import { localDateKey } from '@/domain/schedule';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { exportData } from './actions';

const readLastExport = (ctx: RepoCtx) => getSetting(ctx, 'lastExportAt');

function reminder(age: BackupAge, t: (k: StringKey, ...a: (string | number)[]) => string): string {
  if (age.kind === 'never') return t('profile_backup_never');
  if (age.days === 0) return t('profile_backup_today');
  return age.days === 1 ? t('profile_backup_one') : t('profile_backup_days', age.days);
}

export function DataSection({ onImport }: { onImport(): void }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const lastExportAt = useDbQuery(readLastExport);
  const [busy, setBusy] = useState(false);
  const age = backupAge(lastExportAt, localDateKey(new Date()));
  const alert = age.kind !== 'recent';

  const onExport = async () => {
    if (busy) return;
    setBusy(true);
    const outcome = await exportData(ctx, new Date());
    setBusy(false);
    if (outcome === 'shared') useToastStore.getState().show(t('profile_export_done'));
    else if (outcome === 'failed') useToastStore.getState().show(t('profile_export_failed'));
    usePrefs.getState().bumpData();
  };

  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('profile_data').toUpperCase()}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile_export')}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => void onExport()}
        style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md, opacity: busy ? 0.6 : 1 }]}
      >
        <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('profile_export')}</Text>
      </Pressable>
      <Text style={{ color: alert ? colors.rust : colors.textDim, fontFamily: fonts.ui }}>{reminder(age, t)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('profile_import_label')} onPress={onImport} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('profile_import_label')}</Text>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t('profile_import_sub')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  btn: { minHeight: TOUCH_MIN + 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
```

Le `disabled` d'un `Pressable` empêche le deuxième `onPress` dès que l'état est rendu ; la garde `if (busy) return` couvre le cas où les deux taps précèdent le rendu. Si le test Review Focus 1 échoue parce que `busy` (état React) n'est pas encore à jour au second tap, remplacer la garde par un `useRef<boolean>` et ledger la ruling.

`mobile/src/features/profile/DangerSection.tsx` :
```tsx
// Profil · Zone de danger — supprimer l'historique, réinitialiser l'application (confirmation destructive)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { deleteHistory, resetAll } from '@/db/repos/resetRepo';
import type { RepoCtx } from '@/db/types';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { confirm } from '@/platform/confirm';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { runReset } from './actions';

export function DangerSection() {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();

  const ask = async (title: StringKey, body: StringKey, button: StringKey, write: (c: RepoCtx) => void, done: StringKey | null) => {
    const ok = await confirm({ title: t(title), message: t(body), confirmLabel: t(button), cancelLabel: t('editor_cancel'), destructive: true });
    if (!ok) return;
    if (!runReset(ctx, write)) useToastStore.getState().show(t('error_not_saved'));
    else if (done) useToastStore.getState().show(t(done));
  };

  const item = (labelKey: StringKey, metaKey: StringKey, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={t(labelKey)} onPress={onPress} style={[styles.btn, { borderColor: colors.redDanger, borderWidth: 1, borderRadius: radius.md }]}>
      <Text style={{ color: colors.redDanger, fontFamily: fonts.uiBold }}>{t(labelKey)}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t(metaKey)}</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.redDanger, fontFamily: fonts.uiBold }]}>{t('profile_danger').toUpperCase()}</Text>
      {item('profile_delete_history', 'profile_delete_history_meta', () =>
        void ask('profile_confirm_history_title', 'profile_confirm_history_body', 'profile_delete_btn', deleteHistory, 'profile_history_deleted'))}
      {item('profile_reset_app', 'profile_reset_meta', () =>
        void ask('profile_confirm_reset_title', 'profile_confirm_reset_body', 'profile_reset_btn', resetAll, null))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  btn: { minHeight: TOUCH_MIN + 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
```

Couleurs du thème : `colors.redDanger` (destructif), `colors.rust` (rappel en alerte) — `src/theme/tokens.ts`.

`mobile/src/features/profile/ProfileScreen.tsx` :
```tsx
// ============================================================
// PROFIL — programme actif, réglages, données, zone de danger, à propos.
// ============================================================
import { StyleSheet, Text } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { getActiveProgram } from '@/db/repos/programsRepo';
import type { RepoCtx } from '@/db/types';
import { Screen } from '@/features/common/Screen';
import { useDbQuery } from '@/features/common/useDbQuery';
import { prepareEditor } from '@/features/editor/openEditor';
import { useI18n } from '@/i18n/I18nProvider';
import { appVersion } from '@/platform/appVersion';
import { confirm } from '@/platform/confirm';
import { useTheme } from '@/theme/ThemeProvider';
import { ActiveProgramCard } from './ActiveProgramCard';
import { DangerSection } from './DangerSection';
import { DataSection } from './DataSection';
import { SettingsSection } from './SettingsSection';

const readActive = (ctx: RepoCtx) => getActiveProgram(ctx)?.definition ?? null;

interface Props {
  onManagePrograms(): void;
  onOpenEditor(): void;
  onImport(): void;
}

export function ProfileScreen({ onManagePrograms, onOpenEditor, onImport }: Props) {
  const ctx = useRepoCtx();
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const active = useDbQuery(readActive);

  const create = async () => {
    const ok = await prepareEditor(ctx, { kind: 'new' }, () =>
      confirm({ title: t('editor_replace_draft_title'), confirmLabel: t('editor_discard'), cancelLabel: t('editor_keep'), destructive: true }));
    if (ok) onOpenEditor();
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('profile_title')}</Text>
      <ActiveProgramCard program={active} onManage={onManagePrograms} onCreate={() => void create()} onImport={onImport} />
      <SettingsSection />
      <DataSection onImport={onImport} />
      <DangerSection />
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('profile_about').toUpperCase()}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('profile_version_fmt', appVersion())}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 44, letterSpacing: -0.5 },
  section: { fontSize: 13, letterSpacing: 1.5 },
});
```

`mobile/src/app/(tabs)/profile.tsx` (remplacement complet) :
```tsx
// Route Profil — ErrorBoundary ; « Gérer » ouvre Plan › Mes programmes
import { router } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { ProfileScreen } from '@/features/profile/ProfileScreen';

export default function ProfileRoute() {
  return (
    <TabErrorBoundary>
      <ProfileScreen
        onManagePrograms={() => router.navigate({ pathname: '/plan', params: { tab: 'programs', at: String(Date.now()) } })}
        onOpenEditor={() => router.push('/editor/meta')}
        onImport={() => router.push('/import')}
      />
    </TabErrorBoundary>
  );
}
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/profile && npx tsc --noEmit`
Expected: PASS, tsc propre. (Le rappel en rouille n'est pas assertable proprement en RNTL ; il est sur la checklist appareil.)

- [ ] **Step 5: Commit**

```bash
git add src/features/profile "src/app/(tabs)/profile.tsx"
git commit -m "feat(mobile): complete Profile with data export, import, danger zone and about

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Checklist appareil M4a et vérification complète

**Files:**
- Modify: `mobile/docs/DEVICE_CHECKLIST.md`

- [ ] **Step 1: Checklist appareil M4a**

Ajouter à `mobile/docs/DEVICE_CHECKLIST.md` :
```markdown

## M4a — Profil (build development à refaire : expo-sharing)
- [ ] Profil affiche la carte du programme actif (nom, séances / semaine, unité) ; « Gérer mes programmes » ouvre Plan sur « Mes programmes », même après être revenu sur « Cette semaine ».
- [ ] Unité par défaut sur lbs → Plan › « Créer un nouveau programme » : l'éditeur propose lbs.
- [ ] Coach IA : l'interrupteur garde sa position après redémarrage de l'app.
- [ ] « Exporter mes données » → feuille de partage iOS (Fichiers, iCloud Drive, AirDrop) / Android ; fichier `workout-backup-AAAA-MM-JJ.json` ; le rappel passe à « aujourd'hui ».
- [ ] Le fichier exporté se réimporte via Profil › Importer : mêmes programmes, séances et poids.
- [ ] Web : « Exporter mes données » télécharge le fichier.
- [ ] Sans export depuis plus de 14 jours (ou jamais) : rappel en rouille.
- [ ] Minuteur de repos lancé → « Supprimer l'historique » → minuteur arrêté, Today sans séries cochées, programme et poids conservés.
- [ ] « Réinitialiser l'application » → onboarding ; langue et thème conservés.
- [ ] « À propos » affiche la version de `app.json`.
```

- [ ] **Step 2: Vérification complète**

Run: `npx jest && npx tsc --noEmit && npx expo export --platform web --output-dir "$TEMP/m4a-web" && npx expo export --platform ios --output-dir "$TEMP/m4a-ios"`
Expected: suite verte, `tsc` propre, deux bundles exportés.

- [ ] **Step 3: Commit**

```bash
git add docs/DEVICE_CHECKLIST.md
git commit -m "docs(mobile): add the M4a device checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Couverture de la spec (auto-revue)

| Exigence (addendum M4a) | Task |
|---|---|
| `backupAge` (never / recent / stale > 14 j, valeur illisible) | 1 |
| `newDraft(units)`, unité par défaut utilisée par « Créer » partout | 1, 2 |
| `BundleSettings.defaultUnits` lu/écrit par le format natif | 1, 2, 3 |
| Clés `defaultUnits`, `lastExportAt` | 2 |
| `readBundle` + aller-retour sur la vraie sauvegarde | 3 |
| `deleteHistory` / `resetAll` en une transaction, `lang` + `theme` gardés, onboarding | 4, 9 |
| `shareJsonFile` (natif + web), `appVersion`, mocks | 5 |
| Chaînes fr/en | 6 |
| Plan `?tab=programs` | 7 |
| Carte programme actif (avec / sans programme) | 8 |
| Réglages : langue, thème, unité, écran allumé, Coach IA | 8 |
| Export : nom du fichier, `lastExportAt` seulement si partagé, toasts, annulation, erreur | 9 |
| Rappel de sauvegarde (aujourd'hui / 1 jour / N jours / jamais, rouille) | 1, 9, 10 |
| Importer → écran du M3b | 9 |
| Confirmation destructive, refus → rien | 9 |
| Relecture des stores après suppression | 9 |
| Version | 9 |
| Checklist appareil | 10 |
