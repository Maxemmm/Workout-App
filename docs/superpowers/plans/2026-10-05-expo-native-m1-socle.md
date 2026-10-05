# App native Expo — Jalon M1 (Socle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer l'app Expo dans `mobile/` avec son socle complet (domaine pur testé, base SQLite + migrations, thème, i18n, navigation par onglets) et un écran Today minimal qui affiche la séance du jour depuis la base, installable sur iPhone via un development build EAS.

**Architecture:** Couches à dépendances descendantes : `app/` (écrans Expo Router) → `src/features/` → `src/db/` (repositories Drizzle sur SQLite) → `src/domain/` (logique pure : schéma Zod du programme, planning, progression). Le thème et l'i18n sont fournis par des contextes React alimentés par un petit store Zustand persistant dans la table `settings`. Les repositories reçoivent un contexte `RepoCtx` (`db`, `newId`, `now`) injecté : l'app branche `expo-sqlite`, les tests branchent `better-sqlite3` en mémoire avec les mêmes migrations.

**Tech Stack:** Expo (dernier SDK stable) · TypeScript strict · Expo Router · expo-sqlite + Drizzle ORM / drizzle-kit · Zod 4 · Zustand · expo-crypto · @expo-google-fonts (Barlow Condensed, DM Sans) · Jest (jest-expo) · React Native Testing Library · better-sqlite3 (tests uniquement) · EAS Build.

**Spec:** [docs/superpowers/specs/2026-10-05-expo-native-foundation-design.md](../specs/2026-10-05-expo-native-foundation-design.md)

## Global Constraints

- Tout le code de l'app vit dans `mobile/` ; ne modifier ni `index.html`, ni `api/`, ni les fichiers PWA (la PWA reste en ligne jusqu'à M9).
- `src/domain/` n'importe jamais React, React Native, Expo, Drizzle ni SQLite.
- `src/db/` est le seul module qui touche SQLite ; il peut importer `src/domain/` (types inclus), rien d'autre de `src/`.
- Aucun nom de jour, de séance, d'exercice, de couleur de séance ou de durée de repos en dur dans la logique : tout vient du programme (`CLAUDE.md` §2). La couleur de séance passe par `accentColors()`.
- Jours de la semaine indexés comme `Date.getDay()` : 0 = dimanche … 6 = samedi ; clés de `schedule` = chaînes `"0"`…`"6"` ; jour absent ou `null` = repos implicite.
- Dates de suivi = jour **local** `YYYY-MM-DD` ; horodatages = ISO 8601 UTC (`toISOString()`).
- Colonnes de sync sur toutes les tables sauf `settings` : `id` (UUID v7), `created_at`, `updated_at`, `deleted_at`, `user_id`. Suppression = logique (`deleted_at`), jamais `DELETE`.
- Les requêtes Drizzle utilisent explicitement `.all()`, `.get()`, `.run()` (drivers synchrones).
- Thème par défaut : `dark` (identité de la PWA). Langue par défaut : `fr`.
- Palette, polices, rayons, espacements : valeurs exactes de la PWA (`index.html` §1 et §1b), reprises en Task 6.
- Cibles tactiles ≥ 44 pt.
- Commentaires de code en français, sections délimitées (`CLAUDE.md` §10).
- Installer les paquets Expo avec `npx expo install` (versions alignées sur le SDK), les autres avec `npm i`.
- Commits : messages conventionnels (`feat(mobile): …`, `test(mobile): …`, `chore(mobile): …`), terminés par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Toutes les commandes s'exécutent depuis `mobile/` sauf mention contraire.

## Review Focus

1. **Programme de l'IA ou d'un import avec des types lâches** (`"sets": "4"`, `"scheme": 45`, `tips: null`) : doit être accepté et normalisé, pas rejeté (Task 2).
2. **Séance commencée tard le soir / fuseau horaire** : la clé de jour doit être le jour local, jamais celui de `toISOString()` (Task 3).
3. **Ligne `programs` corrompue en base** (JSON invalide ou programme devenu invalide) : la liste l'ignore au lieu de faire planter Today (Task 8).
4. **`activeProgramId` qui pointe vers un programme supprimé** : retomber sur le premier programme disponible, ou sur « pas de programme », sans erreur (Task 8).
5. **Valeur de réglage inattendue en base** (`lang: "de"`, `theme: 42`) : retomber sur les valeurs par défaut au lieu de propager une valeur invalide au thème ou à l'i18n (Task 9).

---

## File Structure

```
mobile/
├── app.json                         ← config Expo (nom, identifiants, plugins)
├── eas.json                         ← profils EAS (Task 11)
├── babel.config.js                  ← inline-import des .sql (migrations)
├── metro.config.js                  ← .sql en source, .wasm en asset, en-têtes COOP/COEP web
├── drizzle.config.ts                ← drizzle-kit (dialect sqlite, driver expo)
├── drizzle/                         ← migrations générées (ne pas éditer à la main)
├── scripts/extract-translations.mjs ← extraction unique des dictionnaires de la PWA
├── app/
│   ├── _layout.tsx                  ← polices, splash, DbProvider, PrefsGate (thème + i18n), Stack
│   ├── index.tsx                    ← redirection vers /today
│   └── (tabs)/
│       ├── _layout.tsx              ← barre d'onglets
│       ├── today.tsx
│       ├── plan.tsx                 ← écran « à venir »
│       ├── stats.tsx                ← écran « à venir »
│       └── profile.tsx              ← langue + thème
└── src/
    ├── config.ts                    ← APP_NAME
    ├── data/program.example.json    ← programme exemple (copie de la racine)
    ├── domain/
    │   ├── program.ts               ← ProgramSchema (Zod), types, parseProgram
    │   ├── schedule.ts              ← resolveDay, weekStrip, localDateKey, weekdayOf
    │   ├── progress.ts              ← totalSets, sessionProgress, minuteur (endAt)
    │   ├── prefs.ts                 ← Lang, ThemePref + gardes de type
    │   ├── __fixtures__/builders.ts ← fabriques de programmes de test
    │   └── __tests__/…
    ├── i18n/
    │   ├── locales/fr.json, en.json ← dictionnaires (source de vérité après extraction)
    │   ├── translate.ts             ← translate, translateList
    │   ├── I18nProvider.tsx         ← contexte + useI18n
    │   └── __tests__/…
    ├── theme/
    │   ├── tokens.ts                ← palettes sombre/claire, espacements, rayons, polices
    │   ├── resolve.ts               ← resolveScheme, accentColors
    │   ├── ThemeProvider.tsx        ← contexte + useTheme
    │   └── __tests__/…
    ├── db/
    │   ├── schema.ts                ← tables Drizzle
    │   ├── types.ts                 ← AppDb, RepoCtx
    │   ├── ids.ts                   ← createIdGenerator (UUID v7)
    │   ├── client.ts                ← ouverture expo-sqlite + appCtx + dumpRawTables
    │   ├── DbProvider.tsx           ← migrations au démarrage + contexte RepoCtx
    │   ├── repos/settingsRepo.ts
    │   ├── repos/programsRepo.ts
    │   ├── testing/createTestCtx.ts ← better-sqlite3 en mémoire (tests seulement)
    │   └── __tests__/…
    ├── state/prefsStore.ts          ← Zustand : lang, theme, dataVersion
    ├── features/
    │   ├── common/Screen.tsx        ← conteneur safe-area + fond
    │   ├── common/ComingSoon.tsx
    │   ├── common/MigrationErrorScreen.tsx
    │   └── today/…                  ← formatDate, WeekStrip, TodayHeader, NoProgram, useActiveProgram
    └── test/renderWithProviders.tsx
```

---

### Task 1: Scaffold Expo + outillage de test

**Files:**
- Create: `mobile/` (générée par `create-expo-app`), `mobile/babel.config.js`, `mobile/metro.config.js`, `mobile/src/config.ts`, `mobile/src/__tests__/alias.test.ts`
- Modify: `mobile/package.json`, `mobile/tsconfig.json`, `mobile/app.json`

**Interfaces:**
- Produces: alias d'import `@/…` → `mobile/src/…` (TypeScript, Metro et Jest) ; scripts npm `test`, `typecheck`, `db:generate` ; `APP_NAME` dans `@/config`.

- [ ] **Step 1: Générer le projet**

Depuis la racine du dépôt :
```bash
npx create-expo-app@latest mobile --template default --yes
cd mobile
echo n | npm run reset-project
```
`reset-project` vide `app/` et propose de déplacer l'exemple dans `app-example/` ; `n` le supprime. Si un dossier `app-example/` existe malgré tout, le supprimer (`rm -rf app-example`). Supprimer aussi les dossiers d'exemple restants s'ils existent : `components/`, `hooks/`, `constants/`, `scripts/reset-project.js` (et retirer le script `reset-project` de `package.json`).

- [ ] **Step 2: Installer les dépendances**

```bash
npx expo install expo-sqlite expo-crypto expo-font expo-splash-screen expo-status-bar expo-dev-client @expo-google-fonts/barlow-condensed @expo-google-fonts/dm-sans
npm i drizzle-orm zod@^4 zustand
npm i -D drizzle-kit babel-plugin-inline-import better-sqlite3 @types/better-sqlite3 @testing-library/react-native
npx expo install jest-expo jest @types/jest -- --save-dev
```
Si `@testing-library/react-native` signale un peer `react-test-renderer` manquant, installer la version identique à `react` : `npm i -D react-test-renderer@$(node -p "require('react/package.json').version")`.

- [ ] **Step 3: Configurer TypeScript, Babel, Metro, Jest**

`mobile/tsconfig.json` :
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "resolveJsonModule": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

`mobile/babel.config.js` :
```js
// Babel — inline-import permet d'importer les migrations .sql générées par drizzle-kit
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
```

`mobile/metro.config.js` :
```js
// Metro — .sql pour les migrations Drizzle, .wasm + en-têtes COOP/COEP pour expo-sqlite sur le web
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql');
config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
```

Dans `mobile/package.json`, ajouter/remplacer :
```json
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web",
  "test": "jest",
  "typecheck": "tsc --noEmit",
  "db:generate": "drizzle-kit generate"
},
"jest": {
  "preset": "jest-expo",
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/src/$1" },
  "testPathIgnorePatterns": ["/node_modules/", "/drizzle/"]
}
```
(conserver les autres scripts éventuels du template, comme `lint`).

Dans `mobile/app.json`, sous `expo` : `"name": "Workout"`, `"slug": "workout-app"`, `"scheme": "workout"`, `"userInterfaceStyle": "automatic"`, `"ios": { "bundleIdentifier": "com.maximeaubert.workout", "supportsTablet": false }`, `"android": { "package": "com.maximeaubert.workout" }`, et ajouter `"expo-sqlite"` au tableau `plugins` (garder `expo-router`, `expo-splash-screen` et les autres plugins du template ; régler la couleur de fond du splash à `#0a0a0a`). L'identifiant `com.maximeaubert.workout` reste modifiable jusqu'à la première soumission store.

- [ ] **Step 4: Écrire le test d'alias (échoue)**

`mobile/src/__tests__/alias.test.ts` :
```ts
import { APP_NAME } from '@/config';

describe('alias @/', () => {
  it('résout les imports depuis src/', () => {
    expect(APP_NAME).toBe('WORKOUT');
  });
});
```

- [ ] **Step 5: Lancer le test, vérifier l'échec**

Run: `npm test -- src/__tests__/alias.test.ts`
Expected: FAIL — `Cannot find module '@/config'`

- [ ] **Step 6: Créer `src/config.ts`**

```ts
// Configuration globale de l'app — nom provisoire, remplaçable (REFONTE_V2 §4.1)
export const APP_NAME = 'WORKOUT';
```

- [ ] **Step 7: Vérifier tests, types et démarrage**

Run: `npm test -- src/__tests__/alias.test.ts` → PASS
Run: `npm run typecheck` → aucune erreur
Run: `npx expo start --web` → la page se charge sans erreur dans le navigateur (écran vide du template réinitialisé), puis arrêter le serveur.

- [ ] **Step 8: Commit**

```bash
git add mobile
git commit -m "chore(mobile): scaffold Expo app with TS, Jest and Drizzle tooling"
```

---

### Task 2: Schéma du programme (Zod)

**Files:**
- Create: `mobile/src/data/program.example.json` (copie de `program.example.json` à la racine), `mobile/src/domain/program.ts`, `mobile/src/domain/__fixtures__/builders.ts`, `mobile/src/domain/__tests__/program.test.ts`

**Interfaces:**
- Produces:
  - `ProgramSchema` (Zod), types `Program`, `Session`, `Exercise`, `SessionType = 'lift' | 'cardio' | 'rest' | 'mixed'`, `Units = 'kg' | 'lbs'`
  - `parseProgram(input: unknown): ProgramParseResult` avec `ProgramParseResult = { ok: true; program: Program } | { ok: false; errors: string[] }`
  - Fabriques de test : `makeExercise(id, sets?, extra?)`, `makeSession(name, exercises?, extra?)`, `makeProgramInput(schedule, sessions, meta?)`, `sevenDayLbsInput()`, `parseOrThrow(input): Program`

- [ ] **Step 1: Copier le programme exemple**

Run (depuis la racine) : `mkdir -p mobile/src/data && cp program.example.json mobile/src/data/program.example.json`

- [ ] **Step 2: Écrire les fabriques de test**

`mobile/src/domain/__fixtures__/builders.ts` :
```ts
// Fabriques de programmes pour les tests du domaine
import { parseProgram, type Program } from '../program';

export function makeExercise(id: string, sets = 3, extra: Record<string, unknown> = {}) {
  return {
    id, name: id.toUpperCase(), scheme: `${sets}×10`, sets,
    load: null, restSec: 90, cue: null, alternatives: [], ...extra,
  };
}

export function makeSession(name: string, exercises: unknown[] = [makeExercise(`${name}-a`)], extra: Record<string, unknown> = {}) {
  return { type: 'lift', name, accent: 'gold', subtitle: null, note: null, warmup: [], exercises, ...extra };
}

export function makeProgramInput(
  schedule: Record<string, string | null>,
  sessions: Record<string, unknown>,
  meta: Record<string, unknown> = {},
) {
  return { meta: { label: 'TEST', units: 'kg', restDefaultSec: 90, ...meta }, sessions, schedule, rules: [] };
}

/** Programme 7 jours en lbs : critère d'extensibilité du CLAUDE.md */
export function sevenDayLbsInput() {
  const sessions: Record<string, unknown> = {};
  const schedule: Record<string, string> = {};
  for (let d = 0; d < 7; d++) {
    sessions[`s${d}`] = makeSession(`SÉANCE ${d}`, [makeExercise(`ex-${d}`, 4)]);
    schedule[String(d)] = `s${d}`;
  }
  return makeProgramInput(schedule, sessions, { units: 'lbs' });
}

export function parseOrThrow(input: unknown): Program {
  const r = parseProgram(input);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.program;
}
```

- [ ] **Step 3: Écrire les tests (échouent)**

`mobile/src/domain/__tests__/program.test.ts` :
```ts
import example from '@/data/program.example.json';
import { parseProgram } from '../program';
import { makeExercise, makeProgramInput, makeSession, sevenDayLbsInput } from '../__fixtures__/builders';

describe('parseProgram', () => {
  it('accepte le programme exemple de la PWA', () => {
    const r = parseProgram(example);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.program.sessions)).toHaveLength(3);
    expect(r.program.meta.units).toBe('kg');
    expect(r.program.schedule['1']).toBe('full-body');
  });

  it('accepte un programme 7 jours en lbs', () => {
    const r = parseProgram(sevenDayLbsInput());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.program.meta.units).toBe('lbs');
  });

  it('normalise les types lâches produits par une IA ou un import', () => {
    const input = makeProgramInput({ '1': 'a' }, {
      a: makeSession('A', [makeExercise('x', 3, { sets: '4', scheme: 45, restSec: '60' })], { tips: null, warmup: null }),
    });
    const r = parseProgram(input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ex = r.program.sessions.a.exercises[0];
    expect(ex.sets).toBe(4);
    expect(ex.scheme).toBe('45');
    expect(ex.restSec).toBe(60);
    expect(r.program.sessions.a.tips).toEqual([]);
    expect(r.program.sessions.a.warmup).toEqual([]);
  });

  it('applique les valeurs par défaut de meta', () => {
    const r = parseProgram({ meta: {}, sessions: { a: makeSession('A') }, schedule: {} });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.program.meta).toMatchObject({ units: 'kg', restDefaultSec: 90, label: '' });
  });

  it('conserve les champs inconnus (ex. id PWA du programme)', () => {
    const r = parseProgram({ ...makeProgramInput({}, { a: makeSession('A') }), id: 'prog-123' });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.program as Record<string, unknown>).id).toBe('prog-123');
  });

  it('accepte un planning vide et des jours à null (repos)', () => {
    expect(parseProgram(makeProgramInput({}, { a: makeSession('A') })).ok).toBe(true);
    expect(parseProgram(makeProgramInput({ '2': null }, { a: makeSession('A') })).ok).toBe(true);
  });

  it('rejette un programme sans meta', () => {
    const r = parseProgram({ sessions: { a: makeSession('A') }, schedule: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('meta');
  });

  it('rejette des sessions vides', () => {
    const r = parseProgram(makeProgramInput({}, {}));
    expect(r.ok).toBe(false);
  });

  it('rejette un jour de planning hors 0-6', () => {
    const r = parseProgram(makeProgramInput({ '7': 'a' }, { a: makeSession('A') }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('0-6');
  });

  it('rejette un planning qui référence une séance inconnue', () => {
    const r = parseProgram(makeProgramInput({ '1': 'absente' }, { a: makeSession('A') }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('absente');
  });

  it('rejette sets < 1 et un exercice sans id', () => {
    expect(parseProgram(makeProgramInput({}, { a: makeSession('A', [makeExercise('x', 0)]) })).ok).toBe(false);
    expect(parseProgram(makeProgramInput({}, { a: makeSession('A', [makeExercise('', 3)]) })).ok).toBe(false);
  });

  it('rejette un type de séance inconnu', () => {
    expect(parseProgram(makeProgramInput({}, { a: makeSession('A', [], { type: 'yoga' }) })).ok).toBe(false);
  });

  it("rejette un id d'exercice dupliqué dans une même séance, l'accepte entre deux séances", () => {
    const dupInSession = makeProgramInput({}, { a: makeSession('A', [makeExercise('x'), makeExercise('x')]) });
    expect(parseProgram(dupInSession).ok).toBe(false);
    const shared = makeProgramInput({}, { a: makeSession('A', [makeExercise('x')]), b: makeSession('B', [makeExercise('x')]) });
    expect(parseProgram(shared).ok).toBe(true);
  });
});
```

- [ ] **Step 4: Lancer les tests, vérifier l'échec**

Run: `npm test -- src/domain/__tests__/program.test.ts`
Expected: FAIL — `Cannot find module '../program'`

- [ ] **Step 5: Implémenter `program.ts`**

`mobile/src/domain/program.ts` :
```ts
// ============================================================
// Programme d'entraînement — schéma, types et validation
// Format identique à celui de la PWA et des fonctions api/.
// Les champs inconnus sont conservés (looseObject) pour ne rien perdre.
// ============================================================
import { z } from 'zod';

/** Chaîne optionnelle pouvant valoir null */
const optText = z.string().nullish();
/** Tableau optionnel : null/undefined → [] */
const listOf = <T extends z.ZodType>(item: T) => z.array(item).nullish().transform((v) => v ?? []);

export const ExerciseSchema = z.looseObject({
  id: z.string().trim().min(1, "id d'exercice manquant"),
  name: z.string().trim().min(1, "nom d'exercice manquant"),
  scheme: z.union([z.string(), z.number()]).transform(String).default(''),
  sets: z.coerce.number().int().min(1, 'sets doit être un entier ≥ 1'),
  timed: z.boolean().optional(),
  load: optText,
  restSec: z.coerce.number().int().positive().nullish(),
  cue: optText,
  alternatives: listOf(z.string()),
});

export const SessionTypeSchema = z.enum(['lift', 'cardio', 'rest', 'mixed']);

export const SessionSchema = z.looseObject({
  type: SessionTypeSchema,
  name: z.string().trim().min(1, 'nom de séance manquant'),
  accent: optText,
  subtitle: optText,
  note: optText,
  warmup: listOf(z.string()),
  exercises: listOf(ExerciseSchema),
  cardio: z.looseObject({ label: z.string(), detail: optText }).nullish(),
  bonus: z.looseObject({ title: optText, exercises: listOf(ExerciseSchema) }).nullish(),
  tips: listOf(z.looseObject({ title: z.string(), body: z.string() })),
});

export const MetaSchema = z.looseObject({
  label: z.string().default(''),
  units: z.enum(['kg', 'lbs']).default('kg'),
  restDefaultSec: z.coerce.number().int().positive().default(90),
  repsInReserve: optText,
});

export const ProgramSchema = z
  .looseObject({
    meta: MetaSchema,
    sessions: z
      .record(z.string(), SessionSchema)
      .refine((s) => Object.keys(s).length > 0, { message: 'sessions est vide' }),
    schedule: z.record(z.string(), z.string().nullable()).default({}),
    rules: listOf(z.string()),
  })
  .superRefine((p, ctx) => {
    // Planning : clés 0-6, références vers des séances existantes
    for (const [day, key] of Object.entries(p.schedule)) {
      if (!/^[0-6]$/.test(day)) {
        ctx.addIssue({ code: 'custom', path: ['schedule', day], message: `jour "${day}" invalide (0-6 attendu)` });
      } else if (key !== null && !(key in p.sessions)) {
        ctx.addIssue({ code: 'custom', path: ['schedule', day], message: `le jour ${day} référence la séance inconnue "${key}"` });
      }
    }
    // Ids d'exercice uniques au sein d'une séance (le suivi est indexé par id)
    for (const [sessionKey, s] of Object.entries(p.sessions)) {
      const seen = new Set<string>();
      for (const ex of [...s.exercises, ...(s.bonus?.exercises ?? [])]) {
        if (seen.has(ex.id)) {
          ctx.addIssue({ code: 'custom', path: ['sessions', sessionKey], message: `id d'exercice dupliqué "${ex.id}"` });
        }
        seen.add(ex.id);
      }
    }
  });

export type Program = z.output<typeof ProgramSchema>;
export type Session = z.output<typeof SessionSchema>;
export type Exercise = z.output<typeof ExerciseSchema>;
export type SessionType = z.output<typeof SessionTypeSchema>;
export type Units = Program['meta']['units'];

export type ProgramParseResult = { ok: true; program: Program } | { ok: false; errors: string[] };

/** Valide et normalise un programme ; ne lève jamais d'exception. */
export function parseProgram(input: unknown): ProgramParseResult {
  const r = ProgramSchema.safeParse(input);
  if (r.success) return { ok: true, program: r.data };
  return {
    ok: false,
    errors: r.error.issues.map((i) => `${i.path.map(String).join('.') || '(racine)'} : ${i.message}`),
  };
}
```

- [ ] **Step 6: Lancer les tests, vérifier le succès**

Run: `npm test -- src/domain/__tests__/program.test.ts` → PASS (13 tests)
Run: `npm run typecheck` → aucune erreur

- [ ] **Step 7: Commit**

```bash
git add mobile/src/data mobile/src/domain
git commit -m "feat(mobile): add Zod program schema compatible with PWA format"
```

---

### Task 3: Planning (jour → séance)

**Files:**
- Create: `mobile/src/domain/schedule.ts`, `mobile/src/domain/__tests__/schedule.test.ts`

**Interfaces:**
- Consumes: `Program`, `Session` (Task 2) ; fabriques de test (Task 2)
- Produces:
  - `type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6`, `WEEKDAYS: readonly Weekday[]`
  - `type DayPlan = { kind: 'session'; weekday: Weekday; sessionKey: string; session: Session } | { kind: 'implicit-rest'; weekday: Weekday }`
  - `resolveDay(program: Program, weekday: Weekday): DayPlan`
  - `type WeekStripDay = { weekday: Weekday; isToday: boolean; plan: DayPlan }`
  - `weekStrip(program: Program, today: Date): WeekStripDay[]` (toujours 7 entrées, dimanche → samedi)
  - `weekdayOf(date: Date): Weekday`, `localDateKey(date: Date): string`

- [ ] **Step 1: Écrire les tests (échouent)**

`mobile/src/domain/__tests__/schedule.test.ts` :
```ts
import example from '@/data/program.example.json';
import { localDateKey, resolveDay, weekdayOf, WEEKDAYS, weekStrip } from '../schedule';
import { makeProgramInput, makeSession, parseOrThrow, sevenDayLbsInput } from '../__fixtures__/builders';

const program = parseOrThrow(example);

describe('resolveDay', () => {
  it('retourne la séance planifiée', () => {
    const plan = resolveDay(program, 1);
    expect(plan.kind).toBe('session');
    if (plan.kind === 'session') {
      expect(plan.sessionKey).toBe('full-body');
      expect(plan.session.name).toBe('FULL BODY');
    }
  });

  it('retourne un repos implicite pour un jour absent du planning', () => {
    expect(resolveDay(program, 2)).toEqual({ kind: 'implicit-rest', weekday: 2 });
  });

  it('retourne un repos implicite pour un jour à null', () => {
    const p = parseOrThrow(makeProgramInput({ '4': null }, { a: makeSession('A') }));
    expect(resolveDay(p, 4).kind).toBe('implicit-rest');
  });

  it("affiche un 4e jour ajouté au planning sans changer le code (critère d'extensibilité)", () => {
    const input = structuredClone(example) as { schedule: Record<string, string> };
    input.schedule['6'] = 'full-body';
    const plan = resolveDay(parseOrThrow(input), 6);
    expect(plan.kind).toBe('session');
  });

  it('gère un programme de 7 jours', () => {
    const p = parseOrThrow(sevenDayLbsInput());
    for (const d of WEEKDAYS) expect(resolveDay(p, d).kind).toBe('session');
  });
});

describe('weekStrip', () => {
  it('retourne 7 jours, dimanche → samedi, avec un seul jour courant', () => {
    const monday = new Date(2026, 9, 5, 9, 0); // lundi 5 octobre 2026, heure locale
    const strip = weekStrip(program, monday);
    expect(strip.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(strip.filter((d) => d.isToday).map((d) => d.weekday)).toEqual([1]);
    expect(strip[1].plan.kind).toBe('session');
    expect(strip[2].plan.kind).toBe('implicit-rest');
  });
});

describe('dates locales', () => {
  it('weekdayOf suit Date.getDay()', () => {
    expect(weekdayOf(new Date(2026, 9, 4))).toBe(0); // dimanche
  });

  it('localDateKey utilise le jour local, même tard le soir', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- src/domain/__tests__/schedule.test.ts`
Expected: FAIL — `Cannot find module '../schedule'`

- [ ] **Step 3: Implémenter `schedule.ts`**

`mobile/src/domain/schedule.ts` :
```ts
// ============================================================
// Planning — associe un jour de la semaine à une séance
// Indices alignés sur Date.getDay() : 0 = dimanche … 6 = samedi.
// Jour absent ou null => repos implicite. Aucun jour en dur.
// ============================================================
import type { Program, Session } from './program';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export type DayPlan =
  | { kind: 'session'; weekday: Weekday; sessionKey: string; session: Session }
  | { kind: 'implicit-rest'; weekday: Weekday };

export type WeekStripDay = { weekday: Weekday; isToday: boolean; plan: DayPlan };

export function resolveDay(program: Program, weekday: Weekday): DayPlan {
  const key = program.schedule[String(weekday)];
  const session = key != null ? program.sessions[key] : undefined;
  if (key == null || !session) return { kind: 'implicit-rest', weekday };
  return { kind: 'session', weekday, sessionKey: key, session };
}

export function weekdayOf(date: Date): Weekday {
  return date.getDay() as Weekday;
}

export function weekStrip(program: Program, today: Date): WeekStripDay[] {
  const current = weekdayOf(today);
  return WEEKDAYS.map((weekday) => ({ weekday, isToday: weekday === current, plan: resolveDay(program, weekday) }));
}

/** Jour local au format YYYY-MM-DD (jamais toISOString, qui est en UTC) */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npm test -- src/domain/__tests__/schedule.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/domain
git commit -m "feat(mobile): add data-driven schedule resolution and local date keys"
```

---

### Task 4: Progression de séance et calculs du minuteur

**Files:**
- Create: `mobile/src/domain/progress.ts`, `mobile/src/domain/__tests__/progress.test.ts`

**Interfaces:**
- Consumes: `Program`, `Session`, `Exercise` (Task 2)
- Produces:
  - `type SetTrack = Record<string, boolean[]>` (id d'exercice → séries cochées)
  - `orderExercises(exercises: Exercise[], order?: readonly string[] | null): Exercise[]`
  - `totalSets(session: Session): number` — exercices principaux uniquement, bonus exclus (parité PWA)
  - `isExerciseComplete(exercise: Exercise, track: SetTrack): boolean`
  - `type SessionProgress = { done: number; total: number; ratio: number; completeIds: string[] }`
  - `sessionProgress(session: Session, track: SetTrack): SessionProgress`
  - `restDurationSec(exercise: Exercise, meta: Program['meta']): number`
  - `restEndAt(nowMs: number, durationSec: number): number`
  - `remainingSec(endAtMs: number, nowMs: number): number`
  - `isRestCritical(remaining: number): boolean` — vrai si 0 < remaining ≤ 10

- [ ] **Step 1: Écrire les tests (échouent)**

`mobile/src/domain/__tests__/progress.test.ts` :
```ts
import {
  isExerciseComplete, isRestCritical, orderExercises, remainingSec,
  restDurationSec, restEndAt, sessionProgress, totalSets,
} from '../progress';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '../__fixtures__/builders';

const program = parseOrThrow(makeProgramInput({ '1': 'a' }, {
  a: makeSession('A', [makeExercise('x', 4), makeExercise('y', 3, { restSec: null })], {
    bonus: { title: 'BONUS', exercises: [makeExercise('z', 2)] },
  }),
}, { restDefaultSec: 75 }));
const session = program.sessions.a;
const [x, y] = session.exercises;

describe('totalSets / sessionProgress', () => {
  it('somme les séries des exercices principaux, bonus exclus', () => {
    expect(totalSets(session)).toBe(7);
  });

  it('compte les séries cochées et les exercices complets', () => {
    const p = sessionProgress(session, { x: [true, true, true, true], y: [true, false, false] });
    expect(p).toEqual({ done: 5, total: 7, ratio: 5 / 7, completeIds: ['x'] });
  });

  it('ignore les cases au-delà du nombre de séries et les ids inconnus', () => {
    const p = sessionProgress(session, { x: [true, true, true, true, true, true], inconnu: [true] });
    expect(p.done).toBe(4);
  });

  it('ratio = 0 pour une séance sans exercice', () => {
    const rest = parseOrThrow(makeProgramInput({}, { r: makeSession('R', [], { type: 'rest' }) })).sessions.r;
    expect(sessionProgress(rest, {})).toEqual({ done: 0, total: 0, ratio: 0, completeIds: [] });
  });

  it('isExerciseComplete', () => {
    expect(isExerciseComplete(y, { y: [true, true, true] })).toBe(true);
    expect(isExerciseComplete(y, { y: [true, true] })).toBe(false);
    expect(isExerciseComplete(y, {})).toBe(false);
  });
});

describe('orderExercises', () => {
  it("applique l'ordre mémorisé, ajoute les nouveaux exercices à la fin, ignore les ids disparus", () => {
    const exercises = parseOrThrow(makeProgramInput({}, {
      a: makeSession('A', [makeExercise('a'), makeExercise('b'), makeExercise('c')]),
    })).sessions.a.exercises;
    expect(orderExercises(exercises, ['c', 'disparu', 'a']).map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });

  it("garde l'ordre du programme sans layout", () => {
    expect(orderExercises(session.exercises, null).map((e) => e.id)).toEqual(['x', 'y']);
  });
});

describe('minuteur de repos', () => {
  it("utilise restSec de l'exercice, sinon meta.restDefaultSec", () => {
    expect(restDurationSec(x, program.meta)).toBe(90);
    expect(restDurationSec(y, program.meta)).toBe(75);
  });

  it("calcule l'heure de fin et le temps restant arrondi au supérieur, jamais négatif", () => {
    const end = restEndAt(1_000_000, 90);
    expect(end).toBe(1_090_000);
    expect(remainingSec(end, 1_000_001)).toBe(90);
    expect(remainingSec(end, 1_089_500)).toBe(1);
    expect(remainingSec(end, 2_000_000)).toBe(0);
  });

  it('passe en critique sous 10 s, pas à 0', () => {
    expect(isRestCritical(11)).toBe(false);
    expect(isRestCritical(10)).toBe(true);
    expect(isRestCritical(1)).toBe(true);
    expect(isRestCritical(0)).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- src/domain/__tests__/progress.test.ts`
Expected: FAIL — `Cannot find module '../progress'`

- [ ] **Step 3: Implémenter `progress.ts`**

`mobile/src/domain/progress.ts` :
```ts
// ============================================================
// Progression d'une séance + calculs du minuteur de repos
// Le minuteur repose sur une heure de fin (endAt) et non sur un
// décompte : le JS est suspendu quand l'app passe en arrière-plan.
// ============================================================
import type { Exercise, Program, Session } from './program';

/** id d'exercice → séries cochées */
export type SetTrack = Record<string, boolean[]>;

export type SessionProgress = { done: number; total: number; ratio: number; completeIds: string[] };

const CRITICAL_REST_SEC = 10;

/* ── Ordre des exercices ─────────────────────────────── */
export function orderExercises(exercises: Exercise[], order?: readonly string[] | null): Exercise[] {
  if (!order || order.length === 0) return exercises;
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const ordered = order.map((id) => byId.get(id)).filter((e): e is Exercise => e !== undefined);
  const placed = new Set(ordered.map((e) => e.id));
  return [...ordered, ...exercises.filter((e) => !placed.has(e.id))];
}

/* ── Séries ──────────────────────────────────────────── */
function doneCount(exercise: Exercise, track: SetTrack): number {
  return (track[exercise.id] ?? []).slice(0, exercise.sets).filter(Boolean).length;
}

export function totalSets(session: Session): number {
  return session.exercises.reduce((sum, e) => sum + e.sets, 0);
}

export function isExerciseComplete(exercise: Exercise, track: SetTrack): boolean {
  return doneCount(exercise, track) === exercise.sets;
}

export function sessionProgress(session: Session, track: SetTrack): SessionProgress {
  const total = totalSets(session);
  const done = session.exercises.reduce((sum, e) => sum + doneCount(e, track), 0);
  return {
    done,
    total,
    ratio: total === 0 ? 0 : done / total,
    completeIds: session.exercises.filter((e) => isExerciseComplete(e, track)).map((e) => e.id),
  };
}

/* ── Minuteur ────────────────────────────────────────── */
export function restDurationSec(exercise: Exercise, meta: Program['meta']): number {
  return exercise.restSec ?? meta.restDefaultSec;
}

export function restEndAt(nowMs: number, durationSec: number): number {
  return nowMs + durationSec * 1000;
}

export function remainingSec(endAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endAtMs - nowMs) / 1000));
}

export function isRestCritical(remaining: number): boolean {
  return remaining > 0 && remaining <= CRITICAL_REST_SEC;
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npm test -- src/domain/__tests__/progress.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/domain
git commit -m "feat(mobile): add session progress and rest timer computations"
```

---

### Task 5: Préférences + i18n (dictionnaires de la PWA)

**Files:**
- Create: `mobile/src/domain/prefs.ts`, `mobile/scripts/extract-translations.mjs`, `mobile/src/i18n/locales/fr.json`, `mobile/src/i18n/locales/en.json` (générés), `mobile/src/i18n/translate.ts`, `mobile/src/i18n/I18nProvider.tsx`, `mobile/src/i18n/__tests__/translate.test.ts`, `mobile/src/domain/__tests__/prefs.test.ts`

**Interfaces:**
- Produces:
  - `src/domain/prefs.ts` : `type Lang = 'fr' | 'en'`, `LANGS`, `isLang(v: unknown): v is Lang`, `type ColorScheme = 'dark' | 'light'`, `type ThemePref = 'system' | ColorScheme`, `THEME_PREFS`, `isThemePref(v: unknown): v is ThemePref`, `DEFAULT_LANG: Lang = 'fr'`, `DEFAULT_THEME: ThemePref = 'dark'`
  - `src/i18n/translate.ts` : `type StringKey`, `type ListKey`, `translate(lang: Lang, key: StringKey, ...args: (string | number)[]): string`, `translateList(lang: Lang, key: ListKey): string[]`
  - `src/i18n/I18nProvider.tsx` : `<I18nProvider lang>` et `useI18n(): { lang: Lang; t: typeof translate sans lang; tList: … }`

- [ ] **Step 1: Écrire et lancer le script d'extraction**

`mobile/scripts/extract-translations.mjs` :
```js
// Extraction UNIQUE des dictionnaires fr/en depuis la PWA (index.html → TRANSLATIONS).
// Après extraction, src/i18n/locales/*.json devient la source de vérité :
// ne pas relancer après avoir modifié les JSON à la main.
// Le HTML est converti : <br/> → saut de ligne, autres balises supprimées.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.resolve(here, '../../index.html'), 'utf8');
const outDir = path.resolve(here, '../src/i18n/locales');

const start = html.indexOf('var TRANSLATIONS = {');
if (start < 0) throw new Error('TRANSLATIONS introuvable dans index.html');
const endMarker = '\n    };';
const end = html.indexOf(endMarker, start) + endMarker.length;

const ctx = {};
vm.runInNewContext(html.slice(start, end).replace('var TRANSLATIONS', 'this.T'), ctx);

const clean = (v) => v.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
mkdirSync(outDir, { recursive: true });
for (const lang of ['fr', 'en']) {
  const dict = Object.fromEntries(
    Object.entries(ctx.T[lang]).map(([k, v]) => [k, Array.isArray(v) ? v.map(clean) : clean(v)]),
  );
  writeFileSync(path.join(outDir, `${lang}.json`), JSON.stringify(dict, null, 2) + '\n');
  console.log(`${lang} : ${Object.keys(dict).length} clés`);
}
```

Run: `node scripts/extract-translations.mjs`
Expected: `fr : 204 clés` puis `en : 204 clés`.

Puis ajouter à la main, **dans les deux fichiers**, les clés nouvelles de M1 (à la fin de chaque objet JSON) :

`fr.json` :
```json
"profile_theme": "Thème",
"profile_theme_dark": "Sombre",
"profile_theme_light": "Clair",
"profile_theme_system": "Système",
"dev_load_example": "CHARGER LE PROGRAMME EXEMPLE",
"coming_soon": "Bientôt disponible"
```
`en.json` :
```json
"profile_theme": "Theme",
"profile_theme_dark": "Dark",
"profile_theme_light": "Light",
"profile_theme_system": "System",
"dev_load_example": "LOAD EXAMPLE PROGRAM",
"coming_soon": "Coming soon"
```

- [ ] **Step 2: Écrire les tests (échouent)**

`mobile/src/domain/__tests__/prefs.test.ts` :
```ts
import { isLang, isThemePref } from '../prefs';

describe('prefs', () => {
  it('isLang', () => {
    expect(isLang('fr')).toBe(true);
    expect(isLang('en')).toBe(true);
    expect(isLang('de')).toBe(false);
    expect(isLang(42)).toBe(false);
  });

  it('isThemePref', () => {
    expect(isThemePref('system')).toBe(true);
    expect(isThemePref('dark')).toBe(true);
    expect(isThemePref('light')).toBe(true);
    expect(isThemePref('blue')).toBe(false);
    expect(isThemePref(null)).toBe(false);
  });
});
```

`mobile/src/i18n/__tests__/translate.test.ts` :
```ts
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { translate, translateList, type StringKey } from '../translate';

describe('dictionnaires', () => {
  it('fr et en ont exactement les mêmes clés', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it('ne contiennent plus de HTML', () => {
    const values = [...Object.values(fr), ...Object.values(en)].flat();
    expect(values.filter((v) => /<[a-z/]/i.test(String(v)))).toEqual([]);
  });
});

describe('translate', () => {
  it('traduit selon la langue', () => {
    expect(translate('fr', 'today_sets_done')).toBe('Séries faites');
    expect(translate('fr', 'profile_theme')).toBe('Thème');
    expect(translate('en', 'profile_theme')).toBe('Theme');
  });

  it('substitue %s dans l’ordre', () => {
    expect(translate('fr', 'exo_load_label_fmt', 'kg')).toBe('Poids (kg)');
  });

  it('retourne la clé si elle est inconnue', () => {
    expect(translate('en', 'nope' as StringKey)).toBe('nope');
  });

  it('traduit les listes (jours, mois)', () => {
    expect(translateList('fr', 'days_short')).toHaveLength(7);
    expect(translateList('fr', 'days_short')[1]).toBe('Lun');
    expect(translateList('fr', 'months_short')).toHaveLength(12);
  });
});
```

- [ ] **Step 3: Lancer les tests, vérifier l'échec**

Run: `npm test -- src/i18n src/domain/__tests__/prefs.test.ts`
Expected: FAIL — `Cannot find module '../translate'` et `Cannot find module '../prefs'`

- [ ] **Step 4: Implémenter `prefs.ts`, `translate.ts`, `I18nProvider.tsx`**

`mobile/src/domain/prefs.ts` :
```ts
// ============================================================
// Préférences utilisateur — valeurs autorisées et gardes de type
// ============================================================
export type Lang = 'fr' | 'en';
export const LANGS: readonly Lang[] = ['fr', 'en'];
export const DEFAULT_LANG: Lang = 'fr';

export type ColorScheme = 'dark' | 'light';
export type ThemePref = 'system' | ColorScheme;
export const THEME_PREFS: readonly ThemePref[] = ['dark', 'light', 'system'];
/** Identité de l'app : sombre par défaut, comme la PWA */
export const DEFAULT_THEME: ThemePref = 'dark';

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

export function isThemePref(v: unknown): v is ThemePref {
  return typeof v === 'string' && (THEME_PREFS as readonly string[]).includes(v);
}
```

`mobile/src/i18n/translate.ts` :
```ts
// ============================================================
// Traduction — dictionnaires fr/en repris de la PWA
// Langue manquante → fr ; clé inconnue → la clé elle-même.
// ============================================================
import type { Lang } from '@/domain/prefs';
import en from './locales/en.json';
import fr from './locales/fr.json';

type Dict = typeof fr;
export type StringKey = { [K in keyof Dict]: Dict[K] extends string ? K : never }[keyof Dict];
export type ListKey = { [K in keyof Dict]: Dict[K] extends readonly string[] ? K : never }[keyof Dict];

const DICTS: Record<Lang, Record<string, unknown>> = { fr, en };

export function translate(lang: Lang, key: StringKey, ...args: (string | number)[]): string {
  const raw = DICTS[lang][key] ?? DICTS.fr[key];
  if (typeof raw !== 'string') return key;
  let i = 0;
  return raw.replace(/%s/g, () => (i < args.length ? String(args[i++]) : '%s'));
}

export function translateList(lang: Lang, key: ListKey): string[] {
  const raw = DICTS[lang][key] ?? DICTS.fr[key];
  return Array.isArray(raw) ? raw.map(String) : [];
}
```

`mobile/src/i18n/I18nProvider.tsx` :
```tsx
// Contexte de langue — fournit t() et tList() aux écrans
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LANG, type Lang } from '@/domain/prefs';
import { translate, translateList, type ListKey, type StringKey } from './translate';

const I18nContext = createContext<Lang>(DEFAULT_LANG);

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <I18nContext.Provider value={lang}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const lang = useContext(I18nContext);
  return useMemo(
    () => ({
      lang,
      t: (key: StringKey, ...args: (string | number)[]) => translate(lang, key, ...args),
      tList: (key: ListKey) => translateList(lang, key),
    }),
    [lang],
  );
}
```

- [ ] **Step 5: Lancer les tests, vérifier le succès**

Run: `npm test -- src/i18n src/domain/__tests__/prefs.test.ts` → PASS
Run: `npm run typecheck` → aucune erreur

- [ ] **Step 6: Commit**

```bash
git add mobile/scripts mobile/src/i18n mobile/src/domain/prefs.ts mobile/src/domain/__tests__/prefs.test.ts
git commit -m "feat(mobile): port fr/en dictionaries from PWA and add i18n provider"
```

---

### Task 6: Thème (design system)

**Files:**
- Create: `mobile/src/theme/tokens.ts`, `mobile/src/theme/resolve.ts`, `mobile/src/theme/ThemeProvider.tsx`, `mobile/src/theme/__tests__/resolve.test.ts`

**Interfaces:**
- Consumes: `ColorScheme`, `ThemePref`, `DEFAULT_THEME` (Task 5)
- Produces:
  - `interface Palette` (clés : `bg, bgCard, bgCardSoft, bgElevated, text, textDim, textFaint, gold, goldDim, rust, blue, greenDone, redTimer, redDanger, border, borderActive, goldFill, rustFill, blueFill`), `palettes: Record<ColorScheme, Palette>`, `spacing`, `radius`, `fonts`, `duration`, `TOUCH_MIN = 44`
  - `resolveScheme(pref: ThemePref, system: string | null | undefined): ColorScheme`
  - `accentColors(palette: Palette, accent: string | null | undefined): { text: string; fill: string }`
  - `interface Theme { scheme; colors: Palette; spacing; radius; fonts; duration }`, `buildTheme(scheme): Theme`, `<ThemeProvider pref>`, `useTheme(): Theme`

- [ ] **Step 1: Écrire les tests (échouent)**

`mobile/src/theme/__tests__/resolve.test.ts` :
```ts
import { accentColors, resolveScheme } from '../resolve';
import { palettes } from '../tokens';

describe('resolveScheme', () => {
  it('respecte un choix explicite', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('suit le système en mode system, sombre si le système est inconnu', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('system', 'unspecified')).toBe('dark');
  });
});

describe('accentColors', () => {
  const p = palettes.dark;

  it('mappe les clés connues', () => {
    expect(accentColors(p, 'rust')).toEqual({ text: p.rust, fill: p.rustFill });
    expect(accentColors(p, 'blue')).toEqual({ text: p.blue, fill: p.blueFill });
    expect(accentColors(p, 'gray')).toEqual({ text: p.textDim, fill: p.textDim });
  });

  it('retombe sur gold pour une clé inconnue ou absente', () => {
    expect(accentColors(p, 'violet')).toEqual({ text: p.gold, fill: p.goldFill });
    expect(accentColors(p, null)).toEqual({ text: p.gold, fill: p.goldFill });
  });

  it('utilise les teintes assombries du thème clair', () => {
    expect(accentColors(palettes.light, 'gold').text).toBe('#9a6b08');
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- src/theme`
Expected: FAIL — `Cannot find module '../resolve'`

- [ ] **Step 3: Implémenter `tokens.ts`, `resolve.ts`, `ThemeProvider.tsx`**

`mobile/src/theme/tokens.ts` :
```ts
// ============================================================
// Design tokens — valeurs exactes de la PWA (index.html §1 / §1b)
// ============================================================
import type { ColorScheme } from '@/domain/prefs';

export interface Palette {
  bg: string; bgCard: string; bgCardSoft: string; bgElevated: string;
  text: string; textDim: string; textFaint: string;
  gold: string; goldDim: string; rust: string; blue: string;
  greenDone: string; redTimer: string; redDanger: string;
  border: string; borderActive: string;
  goldFill: string; rustFill: string; blueFill: string;
}

export const palettes: Record<ColorScheme, Palette> = {
  dark: {
    bg: '#0a0a0a', bgCard: '#161616', bgCardSoft: '#1e1e1e', bgElevated: '#222222',
    text: '#f5f5f5', textDim: '#8a8a8a', textFaint: '#444444',
    gold: '#d4a23c', goldDim: '#8a6520', rust: '#c4561f', blue: '#5b9bd5',
    greenDone: '#2e7d4f', redTimer: '#d23a3a', redDanger: '#a02020',
    border: '#2a2a2a', borderActive: '#d4a23c',
    goldFill: '#d4a23c', rustFill: '#c4561f', blueFill: '#5b9bd5',
  },
  light: {
    bg: '#f4f1ec', bgCard: '#ffffff', bgCardSoft: '#ede9e2', bgElevated: '#e5e0d8',
    text: '#1c1a17', textDim: '#6b6560', textFaint: '#b5aea5',
    gold: '#9a6b08', goldDim: '#c9a852', rust: '#b54518', blue: '#2e6fa8',
    greenDone: '#3a8a52', redTimer: '#c02828', redDanger: '#a01818',
    border: '#ddd8d0', borderActive: '#a07010',
    goldFill: '#d4920c', rustFill: '#c84018', blueFill: '#4a88c8',
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 20, xl: 28, xxl: 40 } as const;
export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;
export const duration = { fast: 150, normal: 250, slow: 300 } as const;
/** Noms de police tels qu'enregistrés par useFonts (app/_layout.tsx) */
export const fonts = {
  display: 'BarlowCondensed_800ExtraBold',
  ui: 'DMSans_400Regular',
  uiMedium: 'DMSans_500Medium',
  uiBold: 'DMSans_700Bold',
} as const;
/** Cible tactile minimale (pt) */
export const TOUCH_MIN = 44;
```

`mobile/src/theme/resolve.ts` :
```ts
// Résolution du schéma de couleurs et des accents de séance (pilotés par les données)
import type { ColorScheme, ThemePref } from '@/domain/prefs';
import type { Palette } from './tokens';

export function resolveScheme(pref: ThemePref, system: string | null | undefined): ColorScheme {
  if (pref !== 'system') return pref;
  return system === 'light' || system === 'dark' ? system : 'dark';
}

/** Clé d'accent du programme → couleurs ; clé inconnue → gold */
export function accentColors(palette: Palette, accent: string | null | undefined): { text: string; fill: string } {
  switch (accent) {
    case 'rust': return { text: palette.rust, fill: palette.rustFill };
    case 'blue': return { text: palette.blue, fill: palette.blueFill };
    case 'gray': return { text: palette.textDim, fill: palette.textDim };
    default: return { text: palette.gold, fill: palette.goldFill };
  }
}
```

`mobile/src/theme/ThemeProvider.tsx` :
```tsx
// Contexte de thème — palette résolue selon la préférence et le système
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { DEFAULT_THEME, type ColorScheme, type ThemePref } from '@/domain/prefs';
import { resolveScheme } from './resolve';
import { duration, fonts, palettes, radius, spacing, type Palette } from './tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  fonts: typeof fonts;
  duration: typeof duration;
}

export function buildTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: palettes[scheme], spacing, radius, fonts, duration };
}

const ThemeContext = createContext<Theme>(buildTheme(resolveScheme(DEFAULT_THEME, null)));

export function ThemeProvider({ pref, children }: { pref: ThemePref; children: ReactNode }) {
  const system = useColorScheme();
  const scheme = resolveScheme(pref, system);
  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npm test -- src/theme` → PASS
Run: `npm run typecheck` → aucune erreur

- [ ] **Step 5: Commit**

```bash
git add mobile/src/theme
git commit -m "feat(mobile): add design tokens and theme provider"
```

---

### Task 7: Schéma SQLite, migrations, identifiants

**Files:**
- Create: `mobile/drizzle.config.ts`, `mobile/src/db/schema.ts`, `mobile/src/db/types.ts`, `mobile/src/db/ids.ts`, `mobile/src/db/testing/createTestCtx.ts`, `mobile/src/db/__tests__/ids.test.ts`, `mobile/src/db/__tests__/schema.test.ts`, `mobile/drizzle/*` (générés)

**Interfaces:**
- Produces:
  - Tables Drizzle : `programs`, `workouts`, `setEntries`, `exerciseWeights`, `sessionLayouts`, `settings` (colonnes : spec §3.3, avec `exercise_order` et `performed_name`)
  - `type AppDb = BaseSQLiteDatabase<'sync', any, typeof schema>`
  - `interface RepoCtx { db: AppDb; newId: () => string; now: () => string }`
  - `createIdGenerator(randomBytes: (n: number) => Uint8Array, nowMs?: () => number): () => string` (UUID v7)
  - `createTestCtx(startIso?: string): RepoCtx & { sqlite: Database.Database; advance(ms: number): void }` (tests uniquement)

- [ ] **Step 1: Écrire les tests (échouent)**

`mobile/src/db/__tests__/ids.test.ts` :
```ts
/** @jest-environment node */
import { randomBytes } from 'node:crypto';
import { createIdGenerator } from '../ids';

const rnd = (n: number) => new Uint8Array(randomBytes(n));
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createIdGenerator (UUID v7)', () => {
  it('produit un UUID v7 valide', () => {
    expect(createIdGenerator(rnd)()).toMatch(UUID_V7);
  });

  it('encode le timestamp en tête (48 bits, big-endian)', () => {
    const ts = 1_790_000_000_123;
    const id = createIdGenerator(rnd, () => ts)();
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(ts);
  });

  it('est triable chronologiquement', () => {
    let t = 1_790_000_000_000;
    const gen = createIdGenerator(rnd, () => t);
    const a = gen();
    t += 1;
    const b = gen();
    expect(a < b).toBe(true);
  });

  it('ne modifie pas le tableau fourni par la source aléatoire', () => {
    const fixed = new Uint8Array(16);
    createIdGenerator(() => fixed, () => 1)();
    expect(Array.from(fixed)).toEqual(new Array(16).fill(0));
  });
});
```

`mobile/src/db/__tests__/schema.test.ts` :
```ts
/** @jest-environment node */
import { createTestCtx } from '../testing/createTestCtx';
import { programs, workouts } from '../schema';

const NOW = '2026-01-01T00:00:00.000Z';
const base = (id: string) => ({ id, createdAt: NOW, updatedAt: NOW });

describe('migrations', () => {
  it('créent toutes les tables', () => {
    const { sqlite } = createTestCtx();
    const names = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => (r as { name: string }).name);
    expect(names).toEqual(expect.arrayContaining(['programs', 'workouts', 'set_entries', 'exercise_weights', 'session_layouts', 'settings']));
  });

  it('interdisent deux séances actives identiques le même jour, mais pas après suppression logique', () => {
    const { db } = createTestCtx();
    db.insert(programs).values({ ...base('p1'), definition: '{}', source: 'example' }).run();
    const w = { programId: 'p1', sessionKey: 'a', date: '2026-01-05', status: 'in_progress' as const, startedAt: NOW };
    db.insert(workouts).values({ ...base('w1'), ...w }).run();
    expect(() => db.insert(workouts).values({ ...base('w2'), ...w }).run()).toThrow(/UNIQUE/);
    db.update(workouts).set({ deletedAt: NOW }).run();
    expect(() => db.insert(workouts).values({ ...base('w3'), ...w }).run()).not.toThrow();
  });

  it('applique les clés étrangères', () => {
    const { db } = createTestCtx();
    expect(() =>
      db.insert(workouts).values({ ...base('w1'), programId: 'absent', sessionKey: 'a', date: '2026-01-05', status: 'in_progress', startedAt: NOW }).run(),
    ).toThrow(/FOREIGN KEY/);
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- src/db`
Expected: FAIL — `Cannot find module '../ids'` et `Cannot find module '../testing/createTestCtx'`

- [ ] **Step 3: Implémenter `ids.ts`, `schema.ts`, `types.ts`, `drizzle.config.ts`**

`mobile/src/db/ids.ts` :
```ts
// ============================================================
// Identifiants UUID v7 — générés sur l'appareil, triables par date
// (48 bits de timestamp ms + aléa). La source d'aléa est injectée :
// expo-crypto dans l'app, node:crypto dans les tests.
// ============================================================
export function createIdGenerator(
  randomBytes: (n: number) => Uint8Array,
  nowMs: () => number = Date.now,
): () => string {
  return () => {
    const b = Uint8Array.from(randomBytes(16));
    const ts = nowMs();
    b[0] = Math.floor(ts / 2 ** 40) & 0xff;
    b[1] = Math.floor(ts / 2 ** 32) & 0xff;
    b[2] = (ts >>> 24) & 0xff;
    b[3] = (ts >>> 16) & 0xff;
    b[4] = (ts >>> 8) & 0xff;
    b[5] = ts & 0xff;
    b[6] = 0x70 | (b[6] & 0x0f); // version 7
    b[8] = 0x80 | (b[8] & 0x3f); // variante RFC 4122
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}
```

`mobile/src/db/schema.ts` :
```ts
// ============================================================
// Schéma SQLite (Drizzle) — spec §3
// Le programme est un document JSON validé ; le suivi est relationnel.
// Toutes les tables sauf settings portent les colonnes de sync.
// ============================================================
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Colonnes de synchronisation (spec §3.2) — fonction : instances propres à chaque table */
const syncColumns = () => ({
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  userId: text('user_id'),
});

const notDeleted = sql`deleted_at IS NULL`;

export const programs = sqliteTable('programs', {
  ...syncColumns(),
  definition: text('definition').notNull(),
  source: text('source', { enum: ['manual', 'ai', 'import', 'example'] }).notNull(),
});

export const workouts = sqliteTable(
  'workouts',
  {
    ...syncColumns(),
    programId: text('program_id').notNull().references(() => programs.id),
    sessionKey: text('session_key').notNull(),
    date: text('date').notNull(),
    status: text('status', { enum: ['in_progress', 'completed', 'abandoned'] }).notNull(),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    healthSyncedAt: text('health_synced_at'),
  },
  (t) => [
    uniqueIndex('workouts_program_session_date_uq').on(t.programId, t.sessionKey, t.date).where(notDeleted),
    index('workouts_date_idx').on(t.date),
  ],
);

export const setEntries = sqliteTable(
  'set_entries',
  {
    ...syncColumns(),
    workoutId: text('workout_id').notNull().references(() => workouts.id),
    exerciseId: text('exercise_id').notNull(),
    performedName: text('performed_name'),
    setIndex: integer('set_index').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    weight: real('weight'),
    reps: integer('reps'),
    doneAt: text('done_at'),
  },
  (t) => [
    uniqueIndex('set_entries_workout_exercise_set_uq').on(t.workoutId, t.exerciseId, t.setIndex).where(notDeleted),
    index('set_entries_exercise_idx').on(t.exerciseId),
  ],
);

export const exerciseWeights = sqliteTable(
  'exercise_weights',
  {
    ...syncColumns(),
    exerciseId: text('exercise_id').notNull(),
    weight: real('weight').notNull(),
    unit: text('unit', { enum: ['kg', 'lbs'] }).notNull(),
  },
  (t) => [uniqueIndex('exercise_weights_exercise_uq').on(t.exerciseId).where(notDeleted)],
);

export const sessionLayouts = sqliteTable(
  'session_layouts',
  {
    ...syncColumns(),
    programId: text('program_id').notNull().references(() => programs.id),
    sessionKey: text('session_key').notNull(),
    exerciseOrder: text('exercise_order').notNull().default('[]'),
    swaps: text('swaps').notNull().default('{}'),
  },
  (t) => [uniqueIndex('session_layouts_program_session_uq').on(t.programId, t.sessionKey).where(notDeleted)],
);

/** Réglages propres à l'appareil (non synchronisés) — valeurs JSON */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

`mobile/src/db/types.ts` :
```ts
// Types partagés par les repositories : base Drizzle synchrone + horloge et ids injectés
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- type de résultat différent entre expo-sqlite et better-sqlite3
export type AppDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export interface RepoCtx {
  db: AppDb;
  newId: () => string;
  /** Horodatage ISO 8601 UTC */
  now: () => string;
}
```

`mobile/drizzle.config.ts` :
```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
```

- [ ] **Step 4: Générer la migration initiale**

Run: `npx drizzle-kit generate --name init`
Expected: création de `drizzle/0000_init.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0000_snapshot.json` et `drizzle/migrations.js`.
Vérifier dans `0000_init.sql` que les index partiels contiennent bien `WHERE deleted_at IS NULL`.

- [ ] **Step 5: Implémenter `createTestCtx.ts`**

`mobile/src/db/testing/createTestCtx.ts` :
```ts
// ============================================================
// Base de test — better-sqlite3 en mémoire + mêmes migrations que l'app.
// À n'importer que depuis les tests (environnement node).
// ============================================================
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { createIdGenerator } from '../ids';
import * as schema from '../schema';
import type { RepoCtx } from '../types';

export function createTestCtx(startIso = '2026-01-01T00:00:00.000Z') {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../drizzle') });

  let t = Date.parse(startIso);
  const ctx: RepoCtx & { sqlite: Database.Database; advance(ms: number): void } = {
    sqlite,
    db,
    newId: createIdGenerator((n) => new Uint8Array(randomBytes(n)), () => t),
    now: () => new Date(t).toISOString(),
    advance: (ms) => { t += ms; },
  };
  return ctx;
}
```

- [ ] **Step 6: Lancer les tests, vérifier le succès**

Run: `npm test -- src/db` → PASS (7 tests)
Run: `npm run typecheck` → aucune erreur
Si `better-sqlite3` échoue à charger son binaire natif, lancer `npm rebuild better-sqlite3` puis relancer les tests.

- [ ] **Step 7: Commit**

```bash
git add mobile/drizzle.config.ts mobile/drizzle mobile/src/db
git commit -m "feat(mobile): add sync-ready SQLite schema, migrations and UUIDv7 ids"
```

---

### Task 8: Repositories `settings` et `programs`

**Files:**
- Create: `mobile/src/db/repos/settingsRepo.ts`, `mobile/src/db/repos/programsRepo.ts`, `mobile/src/db/__tests__/settingsRepo.test.ts`, `mobile/src/db/__tests__/programsRepo.test.ts`

**Interfaces:**
- Consumes: `RepoCtx`, tables `settings` et `programs`, `createTestCtx` (Task 7) ; `parseProgram`, `Program` (Task 2) ; `Lang`, `ThemePref` (Task 5)
- Produces:
  - `interface SettingsMap { activeProgramId: string; lang: Lang; theme: ThemePref; aiEnabled: boolean; keepAwake: boolean; onboarded: boolean; healthEnabled: boolean; programDraft: unknown; activeRest: { workoutId: string; exerciseId: string; endAt: number } }`
  - `getSetting<K extends keyof SettingsMap>(ctx, key: K): SettingsMap[K] | undefined` (JSON illisible → `undefined`)
  - `setSetting<K>(ctx, key: K, value: SettingsMap[K]): void`, `deleteSetting(ctx, key): void`
  - `type ProgramSource = 'manual' | 'ai' | 'import' | 'example'`
  - `interface StoredProgram { id: string; definition: Program; source: ProgramSource; createdAt: string; updatedAt: string }`
  - `class ProgramValidationError extends Error { errors: string[] }`
  - `createProgram(ctx, input: unknown, source: ProgramSource): StoredProgram` (lève `ProgramValidationError`)
  - `listPrograms(ctx): StoredProgram[]` (non supprimés, par date de création, lignes invalides ignorées)
  - `getProgram(ctx, id): StoredProgram | null`
  - `softDeleteProgram(ctx, id): void`
  - `getActiveProgram(ctx): StoredProgram | null` (repli sur le premier programme, et met à jour le réglage)
  - `setActiveProgram(ctx, id: string): void`

- [ ] **Step 1: Écrire les tests (échouent)**

`mobile/src/db/__tests__/settingsRepo.test.ts` :
```ts
/** @jest-environment node */
import { settings } from '../schema';
import { deleteSetting, getSetting, setSetting } from '../repos/settingsRepo';
import { createTestCtx } from '../testing/createTestCtx';

describe('settingsRepo', () => {
  it('lit undefined pour une clé absente', () => {
    expect(getSetting(createTestCtx(), 'lang')).toBeUndefined();
  });

  it('écrit puis relit des valeurs typées (upsert)', () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'lang', 'en');
    setSetting(ctx, 'lang', 'fr');
    setSetting(ctx, 'aiEnabled', true);
    setSetting(ctx, 'activeRest', { workoutId: 'w', exerciseId: 'x', endAt: 123 });
    expect(getSetting(ctx, 'lang')).toBe('fr');
    expect(getSetting(ctx, 'aiEnabled')).toBe(true);
    expect(getSetting(ctx, 'activeRest')).toEqual({ workoutId: 'w', exerciseId: 'x', endAt: 123 });
  });

  it('retourne undefined pour une valeur JSON corrompue', () => {
    const ctx = createTestCtx();
    ctx.db.insert(settings).values({ key: 'lang', value: '{pas du json', updatedAt: ctx.now() }).run();
    expect(getSetting(ctx, 'lang')).toBeUndefined();
  });

  it('supprime une clé', () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'onboarded', true);
    deleteSetting(ctx, 'onboarded');
    expect(getSetting(ctx, 'onboarded')).toBeUndefined();
  });
});
```

`mobile/src/db/__tests__/programsRepo.test.ts` :
```ts
/** @jest-environment node */
import example from '@/data/program.example.json';
import { programs } from '../schema';
import {
  createProgram, getActiveProgram, getProgram, listPrograms,
  ProgramValidationError, setActiveProgram, softDeleteProgram,
} from '../repos/programsRepo';
import { getSetting } from '../repos/settingsRepo';
import { createTestCtx } from '../testing/createTestCtx';

describe('programsRepo', () => {
  it('crée et relit un programme validé', () => {
    const ctx = createTestCtx();
    const created = createProgram(ctx, example, 'example');
    expect(created.definition.meta.label).toBe('PROGRAMME SALLE');
    expect(getProgram(ctx, created.id)).toEqual(created);
  });

  it('refuse un programme invalide sans rien écrire', () => {
    const ctx = createTestCtx();
    expect(() => createProgram(ctx, { meta: {} }, 'manual')).toThrow(ProgramValidationError);
    expect(listPrograms(ctx)).toEqual([]);
  });

  it('liste par date de création et exclut les supprimés', () => {
    const ctx = createTestCtx();
    const a = createProgram(ctx, example, 'example');
    ctx.advance(1000);
    const b = createProgram(ctx, example, 'import');
    expect(listPrograms(ctx).map((p) => p.id)).toEqual([a.id, b.id]);
    softDeleteProgram(ctx, a.id);
    expect(listPrograms(ctx).map((p) => p.id)).toEqual([b.id]);
    expect(getProgram(ctx, a.id)).toBeNull();
  });

  it('suppression logique : met à jour deleted_at et updated_at', () => {
    const ctx = createTestCtx();
    const a = createProgram(ctx, example, 'example');
    ctx.advance(5000);
    softDeleteProgram(ctx, a.id);
    const row = ctx.sqlite.prepare('SELECT deleted_at, updated_at FROM programs WHERE id = ?').get(a.id) as { deleted_at: string; updated_at: string };
    expect(row.deleted_at).toBe(ctx.now());
    expect(row.updated_at).toBe(ctx.now());
  });

  it('ignore une ligne corrompue au lieu de planter', () => {
    const ctx = createTestCtx();
    const now = ctx.now();
    ctx.db.insert(programs).values({ id: 'bad', createdAt: now, updatedAt: now, definition: '{oups', source: 'manual' }).run();
    ctx.db.insert(programs).values({ id: 'invalid', createdAt: now, updatedAt: now, definition: '{"meta":{}}', source: 'manual' }).run();
    const ok = createProgram(ctx, example, 'example');
    expect(listPrograms(ctx).map((p) => p.id)).toEqual([ok.id]);
    expect(getProgram(ctx, 'bad')).toBeNull();
  });

  describe('programme actif', () => {
    it('retourne null sans programme', () => {
      expect(getActiveProgram(createTestCtx())).toBeNull();
    });

    it('retourne le programme désigné', () => {
      const ctx = createTestCtx();
      createProgram(ctx, example, 'example');
      const b = createProgram(ctx, example, 'import');
      setActiveProgram(ctx, b.id);
      expect(getActiveProgram(ctx)?.id).toBe(b.id);
    });

    it('retombe sur le premier programme si le programme actif a été supprimé, et le mémorise', () => {
      const ctx = createTestCtx();
      const a = createProgram(ctx, example, 'example');
      ctx.advance(1000);
      const b = createProgram(ctx, example, 'import');
      setActiveProgram(ctx, b.id);
      softDeleteProgram(ctx, b.id);
      expect(getActiveProgram(ctx)?.id).toBe(a.id);
      expect(getSetting(ctx, 'activeProgramId')).toBe(a.id);
    });

    it("efface le réglage s'il ne reste aucun programme", () => {
      const ctx = createTestCtx();
      const a = createProgram(ctx, example, 'example');
      setActiveProgram(ctx, a.id);
      softDeleteProgram(ctx, a.id);
      expect(getActiveProgram(ctx)).toBeNull();
      expect(getSetting(ctx, 'activeProgramId')).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- src/db/__tests__/settingsRepo.test.ts src/db/__tests__/programsRepo.test.ts`
Expected: FAIL — `Cannot find module '../repos/settingsRepo'`

- [ ] **Step 3: Implémenter les repositories**

`mobile/src/db/repos/settingsRepo.ts` :
```ts
// ============================================================
// Réglages de l'appareil — clé/valeur JSON typée
// ============================================================
import { eq } from 'drizzle-orm';
import type { Lang, ThemePref } from '@/domain/prefs';
import { settings } from '../schema';
import type { RepoCtx } from '../types';

export interface SettingsMap {
  activeProgramId: string;
  lang: Lang;
  theme: ThemePref;
  aiEnabled: boolean;
  keepAwake: boolean;
  onboarded: boolean;
  healthEnabled: boolean;
  programDraft: unknown;
  activeRest: { workoutId: string; exerciseId: string; endAt: number };
}
export type SettingKey = keyof SettingsMap;

/** Valeur brute décodée ; le typage n'est pas vérifié ici (voir les gardes de prefs.ts) */
export function getSetting<K extends SettingKey>(ctx: RepoCtx, key: K): SettingsMap[K] | undefined {
  const row = ctx.db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as SettingsMap[K];
  } catch {
    return undefined;
  }
}

export function setSetting<K extends SettingKey>(ctx: RepoCtx, key: K, value: SettingsMap[K]): void {
  const now = ctx.now();
  const json = JSON.stringify(value);
  ctx.db
    .insert(settings)
    .values({ key, value: json, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: now } })
    .run();
}

export function deleteSetting(ctx: RepoCtx, key: SettingKey): void {
  ctx.db.delete(settings).where(eq(settings.key, key)).run();
}
```
(`settings` n'est pas synchronisé : la suppression physique y est permise.)

`mobile/src/db/repos/programsRepo.ts` :
```ts
// ============================================================
// Programmes — documents JSON validés par ProgramSchema
// ============================================================
import { and, asc, eq, isNull } from 'drizzle-orm';
import { parseProgram, type Program } from '@/domain/program';
import { programs } from '../schema';
import type { RepoCtx } from '../types';
import { deleteSetting, getSetting, setSetting } from './settingsRepo';

export type ProgramSource = 'manual' | 'ai' | 'import' | 'example';

export interface StoredProgram {
  id: string;
  definition: Program;
  source: ProgramSource;
  createdAt: string;
  updatedAt: string;
}

export class ProgramValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join('\n'));
    this.name = 'ProgramValidationError';
  }
}

type ProgramRow = typeof programs.$inferSelect;

/** Ligne → programme validé ; null si JSON illisible ou programme invalide */
function toStored(row: ProgramRow): StoredProgram | null {
  let raw: unknown;
  try {
    raw = JSON.parse(row.definition);
  } catch {
    return null;
  }
  const parsed = parseProgram(raw);
  if (!parsed.ok) return null;
  return { id: row.id, definition: parsed.program, source: row.source, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export function createProgram(ctx: RepoCtx, input: unknown, source: ProgramSource): StoredProgram {
  const parsed = parseProgram(input);
  if (!parsed.ok) throw new ProgramValidationError(parsed.errors);
  const now = ctx.now();
  const id = ctx.newId();
  ctx.db.insert(programs).values({ id, createdAt: now, updatedAt: now, definition: JSON.stringify(parsed.program), source }).run();
  return { id, definition: parsed.program, source, createdAt: now, updatedAt: now };
}

export function listPrograms(ctx: RepoCtx): StoredProgram[] {
  return ctx.db
    .select().from(programs)
    .where(isNull(programs.deletedAt))
    .orderBy(asc(programs.createdAt), asc(programs.id))
    .all()
    .map(toStored)
    .filter((p): p is StoredProgram => p !== null);
}

export function getProgram(ctx: RepoCtx, id: string): StoredProgram | null {
  const row = ctx.db.select().from(programs).where(and(eq(programs.id, id), isNull(programs.deletedAt))).get();
  return row ? toStored(row) : null;
}

export function softDeleteProgram(ctx: RepoCtx, id: string): void {
  const now = ctx.now();
  ctx.db.update(programs).set({ deletedAt: now, updatedAt: now }).where(eq(programs.id, id)).run();
}

export function setActiveProgram(ctx: RepoCtx, id: string): void {
  setSetting(ctx, 'activeProgramId', id);
}

/** Programme actif ; s'il a disparu, repli sur le premier programme disponible */
export function getActiveProgram(ctx: RepoCtx): StoredProgram | null {
  const id = getSetting(ctx, 'activeProgramId');
  const active = typeof id === 'string' ? getProgram(ctx, id) : null;
  if (active) return active;
  const first = listPrograms(ctx)[0] ?? null;
  if (first) setActiveProgram(ctx, first.id);
  else if (id !== undefined) deleteSetting(ctx, 'activeProgramId');
  return first;
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npm test -- src/db` → PASS
Run: `npm run typecheck` → aucune erreur

- [ ] **Step 5: Commit**

```bash
git add mobile/src/db
git commit -m "feat(mobile): add settings and programs repositories"
```

---

### Task 9: Coquille de l'app (base, préférences, onglets)

**Files:**
- Create: `mobile/src/db/client.ts`, `mobile/src/db/DbContext.ts`, `mobile/src/db/DbProvider.tsx`, `mobile/src/state/prefsStore.ts`, `mobile/src/state/__tests__/prefsStore.test.ts`, `mobile/src/features/common/Screen.tsx`, `mobile/src/features/common/ComingSoon.tsx`, `mobile/src/features/common/MigrationErrorScreen.tsx`, `mobile/src/test/renderWithProviders.tsx`, `mobile/app/_layout.tsx`, `mobile/app/index.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/plan.tsx`, `mobile/app/(tabs)/stats.tsx`
- Modify: aucun

**Interfaces:**
- Consumes: `RepoCtx`, `createIdGenerator`, `schema` (Task 7) ; `getSetting`, `setSetting` (Task 8) ; `isLang`, `isThemePref`, `DEFAULT_LANG`, `DEFAULT_THEME` (Task 5) ; `ThemeProvider`, `useTheme` (Task 6) ; `I18nProvider`, `useI18n` (Task 5)
- Produces:
  - `appCtx: RepoCtx`, `dumpRawTables(): string` (`src/db/client.ts`)
  - `useRepoCtx(): RepoCtx` et `DbTestProvider` (`src/db/DbContext.ts`, sans dépendance native : importable dans les tests)
  - `<DbProvider>` (`src/db/DbProvider.tsx` : migrations + fournisseur)
  - `usePrefs` (Zustand) : état `{ lang: Lang; theme: ThemePref; dataVersion: number }`, actions `hydrate(ctx)`, `setLang(ctx, lang)`, `setTheme(ctx, pref)`, `bumpData()` ; `PREFS_INITIAL`
  - `<Screen>` (fond + safe area + défilement), `<ComingSoon titleKey>`
  - `renderWithProviders(ui, { lang?, theme?, ctx? })` pour les tests de composants

- [ ] **Step 1: Écrire le test du store (échoue)**

`mobile/src/state/__tests__/prefsStore.test.ts` :
```ts
/** @jest-environment node */
import { settings } from '@/db/schema';
import { getSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { PREFS_INITIAL, usePrefs } from '../prefsStore';

beforeEach(() => usePrefs.setState(PREFS_INITIAL));

describe('prefsStore', () => {
  it('hydrate avec les valeurs par défaut sur une base vide', () => {
    usePrefs.getState().hydrate(createTestCtx());
    expect(usePrefs.getState()).toMatchObject({ lang: 'fr', theme: 'dark' });
  });

  it('persiste langue et thème, puis les relit', () => {
    const ctx = createTestCtx();
    usePrefs.getState().setLang(ctx, 'en');
    usePrefs.getState().setTheme(ctx, 'light');
    expect(getSetting(ctx, 'lang')).toBe('en');
    usePrefs.setState(PREFS_INITIAL);
    usePrefs.getState().hydrate(ctx);
    expect(usePrefs.getState()).toMatchObject({ lang: 'en', theme: 'light' });
  });

  it('ignore des valeurs invalides en base', () => {
    const ctx = createTestCtx();
    const now = ctx.now();
    ctx.db.insert(settings).values([
      { key: 'lang', value: '"de"', updatedAt: now },
      { key: 'theme', value: '42', updatedAt: now },
    ]).run();
    usePrefs.getState().hydrate(ctx);
    expect(usePrefs.getState()).toMatchObject({ lang: 'fr', theme: 'dark' });
  });

  it('bumpData incrémente la version des données', () => {
    usePrefs.getState().bumpData();
    expect(usePrefs.getState().dataVersion).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- src/state`
Expected: FAIL — `Cannot find module '../prefsStore'`

- [ ] **Step 3: Implémenter `prefsStore.ts`**

`mobile/src/state/prefsStore.ts` :
```ts
// ============================================================
// Store des préférences (Zustand) — persistées dans settings
// dataVersion : incrémenté après une écriture pour rafraîchir les écrans
// ============================================================
import { create } from 'zustand';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { DEFAULT_LANG, DEFAULT_THEME, isLang, isThemePref, type Lang, type ThemePref } from '@/domain/prefs';

interface PrefsData {
  lang: Lang;
  theme: ThemePref;
  dataVersion: number;
}

interface PrefsActions {
  hydrate(ctx: RepoCtx): void;
  setLang(ctx: RepoCtx, lang: Lang): void;
  setTheme(ctx: RepoCtx, theme: ThemePref): void;
  bumpData(): void;
}

export const PREFS_INITIAL: PrefsData = { lang: DEFAULT_LANG, theme: DEFAULT_THEME, dataVersion: 0 };

export const usePrefs = create<PrefsData & PrefsActions>((set) => ({
  ...PREFS_INITIAL,
  hydrate: (ctx) => {
    const lang = getSetting(ctx, 'lang');
    const theme = getSetting(ctx, 'theme');
    set({ lang: isLang(lang) ? lang : DEFAULT_LANG, theme: isThemePref(theme) ? theme : DEFAULT_THEME });
  },
  setLang: (ctx, lang) => {
    setSetting(ctx, 'lang', lang);
    set({ lang });
  },
  setTheme: (ctx, theme) => {
    setSetting(ctx, 'theme', theme);
    set({ theme });
  },
  bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
```

Run: `npm test -- src/state` → PASS

- [ ] **Step 4: Implémenter le client SQLite et le DbProvider**

`mobile/src/db/client.ts` :
```ts
// ============================================================
// Base SQLite de l'app (expo-sqlite) — instance unique
// ============================================================
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { getRandomBytes } from 'expo-crypto';
import { openDatabaseSync } from 'expo-sqlite';
import { createIdGenerator } from './ids';
import * as schema from './schema';
import type { RepoCtx } from './types';

const expoDb = openDatabaseSync('workout.db');
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });

export const appCtx: RepoCtx = {
  db,
  newId: createIdGenerator(getRandomBytes),
  now: () => new Date().toISOString(),
};

/** Copie brute de toutes les tables en JSON — secours si une migration échoue */
export function dumpRawTables(): string {
  const tables = expoDb.getAllSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const dump: Record<string, unknown[]> = {};
  for (const { name } of tables) dump[name] = expoDb.getAllSync(`SELECT * FROM "${name}"`);
  return JSON.stringify(dump, null, 2);
}
```

`mobile/src/features/common/Screen.tsx` :
```tsx
// Conteneur d'écran : fond du thème, zones de sécurité, défilement
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

export function Screen({ children }: { children: ReactNode }) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
```

`mobile/src/features/common/MigrationErrorScreen.tsx` :
```tsx
// Écran bloquant si une migration SQLite échoue : aucune perte, export brut possible
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { dumpRawTables } from '@/db/client';

export function MigrationErrorScreen({ error }: { error: Error }) {
  const exportRaw = () => {
    Share.share({ message: dumpRawTables() }).catch(() => {});
  };
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Mise à jour des données impossible</Text>
        <Text style={styles.body}>
          Vos données sont intactes. Exportez-les avant de réinstaller ou de contacter le support.
        </Text>
        <Text selectable style={styles.code}>{error.message}</Text>
        <Pressable accessibilityRole="button" onPress={exportRaw} style={styles.button}>
          <Text style={styles.buttonText}>EXPORTER LES DONNÉES BRUTES</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// Couleurs fixes : le thème n'est pas encore disponible à ce stade
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 80, gap: 16 },
  title: { color: '#f5f5f5', fontSize: 22, fontWeight: '800' },
  body: { color: '#8a8a8a', fontSize: 15 },
  code: { color: '#d23a3a', fontSize: 12, fontFamily: 'monospace' },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: '#d4a23c', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#0a0a0a', fontWeight: '700' },
});
```

`mobile/src/db/DbContext.ts` :
```ts
// Contexte RepoCtx — volontairement sans import natif (utilisable dans les tests)
import { createContext, useContext } from 'react';
import type { RepoCtx } from './types';

export const DbContext = createContext<RepoCtx | null>(null);

/** Pour les tests : fournit un RepoCtx arbitraire (base en mémoire) */
export const DbTestProvider = DbContext.Provider;

export function useRepoCtx(): RepoCtx {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useRepoCtx doit être utilisé sous <DbProvider>');
  return ctx;
}
```

`mobile/src/db/DbProvider.tsx` :
```tsx
// Applique les migrations au démarrage puis fournit le RepoCtx aux écrans
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { ReactNode } from 'react';
import migrations from '../../drizzle/migrations';
import { MigrationErrorScreen } from '@/features/common/MigrationErrorScreen';
import { appCtx, db } from './client';
import { DbContext } from './DbContext';

export function DbProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  if (error) return <MigrationErrorScreen error={error} />;
  if (!success) return null;
  return <DbContext.Provider value={appCtx}>{children}</DbContext.Provider>;
}
```

- [ ] **Step 5: Implémenter les routes de la coquille**

`mobile/app/_layout.tsx` :
```tsx
// ============================================================
// Racine : polices → base (migrations) → préférences → thème + i18n
// ============================================================
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useRepoCtx } from '@/db/DbContext';
import { DbProvider } from '@/db/DbProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ BarlowCondensed_800ExtraBold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const ready = fontsLoaded || fontError != null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return (
    <DbProvider>
      <PrefsGate />
    </DbProvider>
  );
}

function PrefsGate() {
  const ctx = useRepoCtx();
  const [hydrated, setHydrated] = useState(false);
  const lang = usePrefs((s) => s.lang);
  const theme = usePrefs((s) => s.theme);

  useEffect(() => {
    usePrefs.getState().hydrate(ctx);
    setHydrated(true);
  }, [ctx]);

  if (!hydrated) return null;
  return (
    <ThemeProvider pref={theme}>
      <I18nProvider lang={lang}>
        <ThemedStack />
      </I18nProvider>
    </ThemeProvider>
  );
}

function ThemedStack() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}
```

`mobile/app/index.tsx` :
```tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/today" />;
}
```

`mobile/app/(tabs)/_layout.tsx` :
```tsx
// Barre d'onglets : Today · Plan · Stats · Profil (REFONTE_V2 §3)
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.bgCard, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.uiMedium },
      }}
    >
      <Tabs.Screen name="today" options={{ title: t('nav_today'), tabBarIcon: icon('barbell') }} />
      <Tabs.Screen name="plan" options={{ title: t('nav_plan'), tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="stats" options={{ title: t('nav_stats'), tabBarIcon: icon('stats-chart') }} />
      <Tabs.Screen name="profile" options={{ title: t('nav_profile'), tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
```

`mobile/src/features/common/ComingSoon.tsx` :
```tsx
// Écran provisoire pour les onglets livrés aux jalons suivants
import { StyleSheet, Text } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { useTheme } from '@/theme/ThemeProvider';
import { Screen } from './Screen';

export function ComingSoon({ titleKey }: { titleKey: StringKey }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t(titleKey).toUpperCase()}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('coming_soon')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { fontSize: 40, letterSpacing: -0.5 } });
```

`mobile/app/(tabs)/plan.tsx` :
```tsx
import { ComingSoon } from '@/features/common/ComingSoon';

export default function PlanScreen() {
  return <ComingSoon titleKey="nav_plan" />;
}
```

`mobile/app/(tabs)/stats.tsx` :
```tsx
import { ComingSoon } from '@/features/common/ComingSoon';

export default function StatsScreen() {
  return <ComingSoon titleKey="nav_stats" />;
}
```

Créer temporairement `mobile/app/(tabs)/today.tsx` et `mobile/app/(tabs)/profile.tsx` sur le même modèle (`<ComingSoon titleKey="nav_today" />` / `"nav_profile"`) ; ils sont remplacés en Task 10.

`mobile/src/test/renderWithProviders.tsx` :
```tsx
// Rendu de test avec thème, i18n et (optionnellement) une base en mémoire
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { DbTestProvider } from '@/db/DbContext';
import type { RepoCtx } from '@/db/types';
import type { Lang, ThemePref } from '@/domain/prefs';
import { I18nProvider } from '@/i18n/I18nProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

export function renderWithProviders(ui: ReactElement, opts: { lang?: Lang; theme?: ThemePref; ctx?: RepoCtx } = {}) {
  const tree = (
    <ThemeProvider pref={opts.theme ?? 'dark'}>
      <I18nProvider lang={opts.lang ?? 'fr'}>{ui}</I18nProvider>
    </ThemeProvider>
  );
  return render(opts.ctx ? <DbTestProvider value={opts.ctx}>{tree}</DbTestProvider> : tree);
}
```

- [ ] **Step 6: Vérifier**

Run: `npm test` → tous les tests passent
Run: `npm run typecheck` → aucune erreur
Run: `npx expo start --web` → l'app s'ouvre sur l'onglet Today (écran provisoire), les 4 onglets sont navigables, fond `#0a0a0a`. Vérifier dans la console du navigateur qu'aucune erreur SQLite n'apparaît. **Si expo-sqlite échoue sur le web** (wasm / en-têtes), le noter dans le rapport de la tâche sans bloquer : le web est vérifié à nouveau en Task 11 (risque identifié en spec §9).

- [ ] **Step 7: Commit**

```bash
git add mobile
git commit -m "feat(mobile): add app shell with DB provider, prefs store and tab bar"
```

---

### Task 10: Écran Today minimal + réglages Profil

**Files:**
- Create: `mobile/src/features/today/formatDate.ts`, `mobile/src/features/today/WeekStrip.tsx`, `mobile/src/features/today/TodayHeader.tsx`, `mobile/src/features/today/NoProgram.tsx`, `mobile/src/features/today/useActiveProgram.ts`, `mobile/src/features/today/__tests__/formatDate.test.ts`, `mobile/src/features/today/__tests__/WeekStrip.test.tsx`, `mobile/src/features/today/__tests__/TodayHeader.test.tsx`, `mobile/src/features/profile/Segmented.tsx`
- Modify: `mobile/app/(tabs)/today.tsx`, `mobile/app/(tabs)/profile.tsx` (remplacent les écrans provisoires de Task 9)

**Interfaces:**
- Consumes: `resolveDay`, `weekStrip`, `weekdayOf`, `DayPlan`, `WeekStripDay`, `Weekday` (Task 3) ; `accentColors`, `useTheme`, `TOUCH_MIN` (Task 6) ; `useI18n` (Task 5) ; `getActiveProgram`, `createProgram`, `setActiveProgram`, `StoredProgram` (Task 8) ; `useRepoCtx` (`@/db/DbContext`), `usePrefs`, `Screen`, `renderWithProviders` (Task 9)
- Produces:
  - `formatShortDate(date: Date, daysShort: string[], monthsShort: string[]): string` → `"LUN, 5 OCT"`
  - `<WeekStrip days: WeekStripDay[]; selected: Weekday; dayLabels: string[]; onSelect(weekday) />` (testID `day-<n>`, point `today-dot`)
  - `<TodayHeader programLabel: string; dateLabel: string; plan: DayPlan />`
  - `<NoProgram onLoadExample() />`
  - `useActiveProgram(): StoredProgram | null`
  - `<Segmented<T extends string> options: { value: T; label: string }[]; value: T; onChange(v: T) />`

- [ ] **Step 1: Écrire les tests (échouent)**

`mobile/src/features/today/__tests__/formatDate.test.ts` :
```ts
import { formatShortDate } from '../formatDate';

const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

describe('formatShortDate', () => {
  it('formate le jour, la date et le mois en majuscules', () => {
    expect(formatShortDate(new Date(2026, 9, 5), days, months)).toBe('LUN, 5 OCT');
    expect(formatShortDate(new Date(2026, 7, 16), days, months)).toBe('DIM, 16 AOÛT');
  });
});
```

`mobile/src/features/today/__tests__/WeekStrip.test.tsx` :
```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { parseOrThrow } from '@/domain/__fixtures__/builders';
import { weekStrip } from '@/domain/schedule';
import { renderWithProviders } from '@/test/renderWithProviders';
import { WeekStrip } from '../WeekStrip';

const days = weekStrip(parseOrThrow(example), new Date(2026, 9, 5)); // lundi
const labels = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

describe('WeekStrip', () => {
  it('affiche les 7 jours et un seul point « aujourd’hui »', () => {
    renderWithProviders(<WeekStrip days={days} selected={1} dayLabels={labels} onSelect={() => {}} />);
    for (let d = 0; d < 7; d++) expect(screen.getByTestId(`day-${d}`)).toBeTruthy();
    expect(screen.getAllByTestId('today-dot')).toHaveLength(1);
  });

  it('marque le jour sélectionné et notifie la sélection, y compris un jour de repos', () => {
    const onSelect = jest.fn();
    renderWithProviders(<WeekStrip days={days} selected={1} dayLabels={labels} onSelect={onSelect} />);
    expect(screen.getByTestId('day-1').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByTestId('day-2'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
```

`mobile/src/features/today/__tests__/TodayHeader.test.tsx` :
```tsx
import { screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { parseOrThrow } from '@/domain/__fixtures__/builders';
import { resolveDay } from '@/domain/schedule';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TodayHeader } from '../TodayHeader';

const program = parseOrThrow(example);

describe('TodayHeader', () => {
  it('affiche la séance planifiée et ses groupes musculaires', () => {
    renderWithProviders(<TodayHeader programLabel="PROGRAMME SALLE" dateLabel="LUN, 5 OCT" plan={resolveDay(program, 1)} />);
    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(screen.getByText('FULL BODY')).toBeTruthy();
    expect(screen.getByText(program.sessions['full-body'].subtitle!)).toBeTruthy();
    expect(screen.getByText('LUN, 5 OCT')).toBeTruthy();
  });

  it('affiche REPOS pour un jour hors planning', () => {
    renderWithProviders(<TodayHeader programLabel="X" dateLabel="MAR, 6 OCT" plan={resolveDay(program, 2)} />);
    expect(screen.getByText('REPOS')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- src/features/today`
Expected: FAIL — `Cannot find module '../formatDate'` (et `../WeekStrip`, `../TodayHeader`)

- [ ] **Step 3: Implémenter les composants Today**

`mobile/src/features/today/formatDate.ts` :
```ts
// Date courte du bandeau : « LUN, 5 OCT » (libellés fournis par l'i18n)
export function formatShortDate(date: Date, daysShort: string[], monthsShort: string[]): string {
  return `${daysShort[date.getDay()]}, ${date.getDate()} ${monthsShort[date.getMonth()]}`.toUpperCase();
}
```

`mobile/src/features/today/WeekStrip.tsx` :
```tsx
// Pilules des 7 jours : point = aujourd'hui, bordure = jour affiché,
// jours sans séance atténués mais cliquables (CLAUDE.md §5)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Weekday, WeekStripDay } from '@/domain/schedule';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  days: WeekStripDay[];
  selected: Weekday;
  dayLabels: string[];
  onSelect: (weekday: Weekday) => void;
}

export function WeekStrip({ days, selected, dayLabels, onSelect }: Props) {
  const { colors, fonts, radius } = useTheme();
  return (
    <View style={styles.row}>
      {days.map(({ weekday, isToday, plan }) => {
        const isSelected = weekday === selected;
        const isRest = plan.kind === 'implicit-rest';
        const accent = plan.kind === 'session' ? accentColors(colors, plan.session.accent).text : colors.textDim;
        return (
          <Pressable
            key={weekday}
            testID={`day-${weekday}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(weekday)}
            style={[
              styles.pill,
              {
                borderRadius: radius.full,
                backgroundColor: colors.bgCard,
                borderColor: isSelected ? accent : colors.border,
                opacity: isRest && !isSelected ? 0.5 : 1,
              },
            ]}
          >
            <Text style={{ color: isSelected ? accent : colors.text, fontFamily: fonts.uiBold, fontSize: 11 }}>
              {dayLabels[weekday]}
            </Text>
            {isToday && <View testID="today-dot" style={[styles.dot, { backgroundColor: accent }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  pill: { flex: 1, minHeight: TOUCH_MIN, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
```

`mobile/src/features/today/TodayHeader.tsx` :
```tsx
// En-tête de Today : bandeau, « TODAY », séance colorée selon son accent
import { StyleSheet, Text, View } from 'react-native';
import type { DayPlan } from '@/domain/schedule';
import { useI18n } from '@/i18n/I18nProvider';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  programLabel: string;
  dateLabel: string;
  plan: DayPlan;
}

export function TodayHeader({ programLabel, dateLabel, plan }: Props) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const isSession = plan.kind === 'session';
  const title = isSession ? plan.session.name : t('today_rest_label');
  const titleColor = isSession ? accentColors(colors, plan.session.accent).text : colors.textDim;
  const subtitle = isSession ? plan.session.subtitle : t('today_rest_sub');

  return (
    <View style={styles.root}>
      <View style={styles.banner}>
        <Text style={[styles.small, { color: colors.textDim, fontFamily: fonts.uiBold }]}>{programLabel}</Text>
        <Text style={[styles.small, { color: colors.textDim, fontFamily: fonts.uiBold }]}>{dateLabel}</Text>
      </View>
      <Text style={[styles.display, { color: colors.text, fontFamily: fonts.display }]}>{t('today_word')}</Text>
      <Text style={[styles.display, { color: titleColor, fontFamily: fonts.display }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textDim, fontFamily: fonts.uiMedium }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 2 },
  banner: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  small: { fontSize: 11, letterSpacing: 1.5 },
  display: { fontSize: 44, lineHeight: 46, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, letterSpacing: 1.5, marginTop: 4 },
});
```

`mobile/src/features/today/NoProgram.tsx` :
```tsx
// État vide de Today : pas encore de programme (l'onboarding complet arrive en M3)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function NoProgram({ onLoadExample }: { onLoadExample: () => void }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('today_no_program_title')}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('today_no_program_sub')}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onLoadExample}
        style={[styles.button, { backgroundColor: colors.gold, borderRadius: radius.md }]}
      >
        <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('dev_load_example')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingTop: 40 },
  title: { fontSize: 40, letterSpacing: -0.5 },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
```

`mobile/src/features/today/useActiveProgram.ts` :
```ts
// Programme actif, relu à chaque changement de données (dataVersion)
import { useMemo } from 'react';
import { useRepoCtx } from '@/db/DbContext';
import { getActiveProgram, type StoredProgram } from '@/db/repos/programsRepo';
import { usePrefs } from '@/state/prefsStore';

export function useActiveProgram(): StoredProgram | null {
  const ctx = useRepoCtx();
  const dataVersion = usePrefs((s) => s.dataVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion force la relecture
  return useMemo(() => getActiveProgram(ctx), [ctx, dataVersion]);
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npm test -- src/features/today` → PASS

- [ ] **Step 5: Assembler les écrans Today et Profil**

`mobile/app/(tabs)/today.tsx` :
```tsx
// ============================================================
// TODAY (M1) — séance du jour depuis la base, navigation par jour.
// Les cartes d'exercices, séries et minuteur arrivent en M2.
// ============================================================
import { useState } from 'react';
import { Text, View } from 'react-native';
import example from '@/data/program.example.json';
import { useRepoCtx } from '@/db/DbContext';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { resolveDay, weekdayOf, weekStrip, type Weekday } from '@/domain/schedule';
import { Screen } from '@/features/common/Screen';
import { formatShortDate } from '@/features/today/formatDate';
import { NoProgram } from '@/features/today/NoProgram';
import { TodayHeader } from '@/features/today/TodayHeader';
import { useActiveProgram } from '@/features/today/useActiveProgram';
import { WeekStrip } from '@/features/today/WeekStrip';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function TodayScreen() {
  const ctx = useRepoCtx();
  const program = useActiveProgram();
  const bumpData = usePrefs((s) => s.bumpData);
  const { colors, fonts } = useTheme();
  const { tList } = useI18n();
  const today = new Date();
  const [selected, setSelected] = useState<Weekday>(weekdayOf(today));

  if (!program) {
    const loadExample = () => {
      const created = createProgram(ctx, example, 'example');
      setActiveProgram(ctx, created.id);
      bumpData();
    };
    return (
      <Screen>
        <NoProgram onLoadExample={loadExample} />
      </Screen>
    );
  }

  const def = program.definition;
  const daysShort = tList('days_short');
  const plan = resolveDay(def, selected);

  return (
    <Screen>
      <TodayHeader
        programLabel={def.meta.label}
        dateLabel={formatShortDate(today, daysShort, tList('months_short'))}
        plan={plan}
      />
      <WeekStrip
        days={weekStrip(def, today)}
        selected={selected}
        dayLabels={daysShort.map((d) => d.toUpperCase())}
        onSelect={setSelected}
      />
      {plan.kind === 'session' && (
        <View style={{ gap: 8 }}>
          {plan.session.exercises.map((ex) => (
            <Text key={ex.id} style={{ color: colors.text, fontFamily: fonts.ui }}>
              {ex.name} · {ex.scheme}
            </Text>
          ))}
        </View>
      )}
    </Screen>
  );
}
```

`mobile/src/features/profile/Segmented.tsx` :
```tsx
// Contrôle segmenté simple (cibles ≥ 44 pt)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors, fonts, radius } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.item, { borderRadius: radius.md, backgroundColor: active ? colors.gold : 'transparent' }]}
          >
            <Text style={{ color: active ? '#0a0a0a' : colors.text, fontFamily: fonts.uiBold }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4, gap: 4 },
  item: { flex: 1, minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
```

`mobile/app/(tabs)/profile.tsx` :
```tsx
// ============================================================
// PROFIL (M1) — langue et thème. Le reste arrive en M4.
// ============================================================
import { StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import type { Lang, ThemePref } from '@/domain/prefs';
import { Screen } from '@/features/common/Screen';
import { Segmented } from '@/features/profile/Segmented';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileScreen() {
  const ctx = useRepoCtx();
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const lang = usePrefs((s) => s.lang);
  const theme = usePrefs((s) => s.theme);
  const label = [styles.label, { color: colors.textDim, fontFamily: fonts.uiBold }];

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('profile_title')}</Text>
      <View style={styles.group}>
        <Text style={label}>{t('profile_language').toUpperCase()}</Text>
        <Segmented<Lang>
          options={[{ value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }]}
          value={lang}
          onChange={(v) => usePrefs.getState().setLang(ctx, v)}
        />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 44, letterSpacing: -0.5 },
  group: { gap: 8 },
  label: { fontSize: 11, letterSpacing: 1.5 },
});
```

- [ ] **Step 6: Vérifier**

Run: `npm test` → tous les tests passent
Run: `npm run typecheck` → aucune erreur
Run: `npx expo start --web`, puis vérifier à la main :
1. Premier lancement : « PAS DE PROGRAMME » + bouton « CHARGER LE PROGRAMME EXEMPLE ».
2. Tap sur le bouton : Today affiche le jour courant (séance ou REPOS), 7 pilules avec un point sur aujourd'hui.
3. Tap sur LUN : « FULL BODY » en doré + liste des exercices ; tap sur MAR : « REPOS ».
4. Profil → EN : les libellés des onglets passent en anglais ; Clair : fond crème `#f4f1ec`.
5. Recharger la page : langue, thème et programme sont conservés.

- [ ] **Step 7: Commit**

```bash
git add mobile
git commit -m "feat(mobile): add minimal Today screen and profile language/theme settings"
```

---

### Task 11: Development build EAS et vérification sur téléphone

**Files:**
- Create: `mobile/eas.json`, `mobile/docs/DEVICE_CHECKLIST.md`
- Modify: `mobile/app.json` (identifiant de projet EAS ajouté par la CLI)

**Interfaces:**
- Consumes: l'app complète des Tasks 1-10
- Produces: profils EAS `development`, `preview`, `production` ; checklist manuelle réutilisée aux jalons suivants

Les étapes marquées **[UTILISATEUR]** demandent un compte ou une action interactive : l'agent les prépare, les signale et attend la confirmation de l'utilisateur sans tenter de contourner.

- [ ] **Step 1: Écrire `eas.json`**

`mobile/eas.json` :
```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "preview": { "distribution": "internal" },
    "production": { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```

- [ ] **Step 2: Écrire la checklist de vérification sur appareil**

`mobile/docs/DEVICE_CHECKLIST.md` :
```markdown
# Checklist de vérification sur appareil

À dérouler sur un iPhone réel et un Android réel à chaque jalon.

## M1 — Socle
- [ ] L'app s'installe depuis le build `development` et s'ouvre sans écran rouge.
- [ ] Polices : titres en Barlow Condensed (condensé, très gras), texte en DM Sans.
- [ ] Zones de sécurité : rien sous l'encoche / la Dynamic Island ni sous la barre d'accueil.
- [ ] « Charger le programme exemple » → la séance du jour s'affiche.
- [ ] Pilules des jours : tap sur chaque jour, jours sans séance atténués mais cliquables.
- [ ] Profil : FR/EN et Sombre/Clair/Système s'appliquent immédiatement.
- [ ] Mode Système : changer le mode sombre du téléphone met l'app à jour.
- [ ] Tuer l'app puis la rouvrir : programme, langue et thème sont conservés.
```

- [ ] **Step 3: [UTILISATEUR] Connexion et liaison du projet EAS**

Commandes à lancer par l'utilisateur dans `mobile/` (interactives) :
```bash
npx eas-cli@latest login
npx eas-cli@latest init
```
`eas init` ajoute `extra.eas.projectId` (et `owner`) dans `app.json`. Prérequis pour iOS : compte Apple Developer actif.

- [ ] **Step 4: [UTILISATEUR] Enregistrer l'iPhone et lancer les builds**

```bash
npx eas-cli@latest device:create
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
```
`device:create` fournit un lien/QR à ouvrir sur l'iPhone pour installer le profil d'enregistrement. Les builds tournent dans le cloud EAS (aucun Mac requis) ; installer chaque build via le lien ou QR fourni en fin de build.

- [ ] **Step 5: [UTILISATEUR] Démarrer le serveur de dev et dérouler la checklist**

Run : `npx expo start --dev-client`, ouvrir l'app installée sur le téléphone (même réseau Wi-Fi, ou `npx expo start --dev-client --tunnel`), puis dérouler `mobile/docs/DEVICE_CHECKLIST.md` § M1.

- [ ] **Step 6: Vérifier le web**

Run: `npx expo export --platform web` → le dossier `dist/` est produit sans erreur.
Run: `npx expo start --web` → rejouer les 5 vérifications de la Task 10 Step 6.
Si expo-sqlite ne fonctionne pas sur le web, consigner le message exact dans `mobile/docs/DEVICE_CHECKLIST.md` sous une section « Web — problèmes connus » : la décision (correctif ou report au sous-projet 2, spec §9) revient à l'utilisateur.

- [ ] **Step 7: Commit**

```bash
git add mobile/eas.json mobile/app.json mobile/docs
git commit -m "chore(mobile): add EAS build profiles and device checklist"
```
