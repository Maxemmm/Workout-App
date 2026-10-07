# App native Expo — Jalon M3a (Plan + Éditeur) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gérer ses programmes (onglet Plan) et les éditer (éditeur en 4 étapes avec brouillon), avec la parité PWA et quatre améliorations natives : réordonnancement, couleur au choix, duplication, steppers numériques.

**Architecture:** Le brouillon est un document unique `Draft = { sourceProgramId, program, manualAccents }` modifié uniquement par des **fonctions pures** (`src/domain/draft.ts`), conservé dans un store Zustand (`src/state/draftStore.ts`) et recopié dans `settings.programDraft` à chaque modification. La base n'est écrite qu'à « Enregistrer » (`features/editor/saveDraft.ts`, validation `validateDraft` + `ProgramSchema`). Les écrans de l'éditeur sont des composants de `features/editor/` qui reçoivent un objet de navigation `EditorNav` ; les fichiers de route `app/editor/*` ne font que brancher Expo Router.

**Tech Stack:** Expo SDK 57 · TypeScript strict · Expo Router (pile `editor` en `fullScreenModal`) · Zustand · Zod 4 · Reanimated 4 (onglets animés, glisser-déposer réutilisé) · Jest (jest-expo) + React Native Testing Library 14 · better-sqlite3 (tests).

**Spec:** [docs/superpowers/specs/2026-10-07-expo-native-m3a-plan-editor-design.md](../specs/2026-10-07-expo-native-m3a-plan-editor-design.md) (addendum M3a, prioritaire) et [docs/superpowers/specs/2026-10-05-expo-native-foundation-design.md](../specs/2026-10-05-expo-native-foundation-design.md).

## Global Constraints

- Tout le code vit dans `mobile/` ; ne modifier ni `index.html`, ni `api/`, ni les fichiers PWA.
- `src/domain/` n'importe jamais React, React Native, Expo, Drizzle ni SQLite.
- `src/db/` est le seul module qui touche SQLite ; il peut importer `src/domain/`, rien d'autre de `src/`.
- Les écrans ne testent jamais `Platform.OS`.
- Aucun nom de jour, de séance, d'exercice, de couleur ou de durée de repos en dur dans la logique (`CLAUDE.md` §2). Couleur de séance via `accentColors()`.
- Jours indexés comme `Date.getDay()` (0 = dimanche) ; clés de `schedule` = `"0"`…`"6"` ; jour absent = repos implicite. Affichage lundi → dimanche (`WEEK_ORDER`).
- Un id d'exercice ou de séance est créé une fois (`makeEntityId`) et **jamais modifié**, même au renommage.
- La base n'est modifiée qu'à « Enregistrer », « Activer », « Dupliquer » ou « Supprimer » ; toute autre action de l'éditeur ne touche que le brouillon.
- Bornes de saisie (PWA) : noms 100 car., sous-titre 150, note 500, consigne 300, charge 100, schéma 50, titre de conseil 100, texte de conseil 300, échauffement / règles 200 car. par élément ; échauffement, règles, conseils ≤ 20 éléments ; séries 1–20 ; repos 0–600 s par pas de 15 ; repos par défaut 10–600 s ; alternatives ≤ 10.
- Toutes les chaînes visibles passent par `t()` ; chaque nouvelle clé existe dans `fr.json` **et** `en.json`.
- Cibles tactiles ≥ 44 pt (`TOUCH_MIN`) ; couleurs via `useTheme()` (seul littéral admis : `'#0a0a0a'` pour du texte sur fond doré).
- Commentaires en français, sections délimitées.
- Commits conventionnels terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commandes depuis `mobile/`. Tests RNTL 14 : `render`, `fireEvent.*`, `act` sont asynchrones (`await`).
- Les plateformes `confirm`, `haptics`, `sound`, `keepAwake` sont mockées globalement (`src/test/jestSetup.js`) ; `confirm` résout `true` par défaut (`jest.mocked(confirm).mockResolvedValueOnce(false)` pour refuser).

## Review Focus

1. **Brouillon corrompu ou d'un format antérieur** (JSON valide mais champs manquants, `sessions` qui n'est pas un objet) : Plan s'ouvre normalement, le brouillon est effacé et l'utilisateur est prévenu — jamais d'écran rouge (Task 6).
2. **Séance planifiée sur plusieurs jours puis supprimée** : tous ces jours redeviennent « repos » et l'enregistrement reste possible si un autre jour est planifié (Task 2).
3. **Programme source supprimé pendant qu'un brouillon le vise** : « Enregistrer » crée un nouveau programme et l'active au lieu d'échouer (Task 11).
4. **Noms exotiques pour les ids** (accents, emoji, vide, très long, collisions) : id non vide, ASCII, ≤ 35 caractères, unique dans le programme (Task 1).
5. **Exercice renommé dans un programme existant** : même id après enregistrement, poids mémorisé et « dernière fois » conservés (Task 17).

---

## File Structure

```
mobile/
├── docs/DEVICE_CHECKLIST.md                 ← + section M3a (Task 17)
└── src/
    ├── app/
    │   ├── _layout.tsx                      ← + Stack.Screen editor (fullScreenModal), hydratation du brouillon
    │   ├── (tabs)/plan.tsx                  ← route mince → features/plan/PlanScreen
    │   └── editor/
    │       ├── _layout.tsx                  ← pile de l'éditeur
    │       ├── index.tsx                    ← étape 1
    │       ├── sessions.tsx                 ← étape 2
    │       ├── schedule.tsx                 ← étape 3
    │       └── session/[key].tsx            ← étape 4
    ├── domain/
    │   ├── entityIds.ts                     ← slugify, makeEntityId
    │   ├── accents.ts                       ← AccentKey, defaultAccent
    │   ├── draft.ts                         ← Draft + opérations pures + restoreDraft
    │   ├── programRules.ts                  ← validateDraft
    │   └── schedule.ts                      ← + WEEK_ORDER
    ├── db/repos/programsRepo.ts             ← + updateProgram, duplicateProgram
    ├── entitlements/index.ts                ← useEntitlements (v1 : tout débloqué)
    ├── state/draftStore.ts
    ├── features/
    │   ├── common/BottomSheet.tsx           ← déplacé depuis features/today
    │   ├── common/NumberStepper.tsx
    │   ├── common/ListEditor.tsx
    │   ├── plan/                            ← planStats, WeekView, ProgramCard, ProgramsView, PlanTabs, DraftBanner, PlanScreen
    │   └── editor/                          ← nav, openEditor, saveDraft, useEditorActions, useRouterNav, EditorHeader,
    │                                           SaveErrorsSheet, AccentPicker, MetaStep, SessionCard, SessionsStep,
    │                                           DayPicker, ScheduleStep, AlternativeEditor, ExerciseSheet, ExerciseRow,
    │                                           TipsEditor, SessionStep
    └── i18n/locales/fr.json, en.json        ← + clés M3a
```

---

### Task 1: `entityIds` + `accents`

**Files:**
- Create: `mobile/src/domain/entityIds.ts`, `mobile/src/domain/accents.ts`, `mobile/src/domain/__tests__/entityIds.test.ts`, `mobile/src/domain/__tests__/accents.test.ts`

**Interfaces:**
- Produces:
  - `type RandomSuffix = () => string`
  - `slugify(name: string): string` (ASCII `[a-z0-9-]`, ≤ 30 car., `'item'` si vide)
  - `makeEntityId(name: string, existing: Iterable<string>, suffix?: RandomSuffix): string` → `${slugify(name)}-${suffix()}`, unique parmi `existing`
  - `type AccentKey = 'gold' | 'rust' | 'blue' | 'gray'`, `ACCENT_KEYS: readonly AccentKey[]`
  - `defaultAccent(type: SessionType, others: readonly { type: SessionType }[]): AccentKey`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/__tests__/entityIds.test.ts` :
```ts
import { makeEntityId, slugify } from '../entityIds';

const seq = (...values: string[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

describe('slugify', () => {
  it('minuscules ASCII, accents retirés, séparateurs normalisés', () => {
    expect(slugify('Développé machine')).toBe('developpe-machine');
    expect(slugify('  Tirage — horizontal !! ')).toBe('tirage-horizontal');
  });
  it('Review Focus 4 : vide, emoji, très long', () => {
    expect(slugify('')).toBe('item');
    expect(slugify('💪🔥')).toBe('item');
    const long = slugify('a'.repeat(80));
    expect(long.length).toBeLessThanOrEqual(30);
    expect(slugify(`${'b'.repeat(29)} c`)).not.toMatch(/-$/);
  });
});

describe('makeEntityId', () => {
  it('slug + suffixe', () => {
    expect(makeEntityId('Presse à cuisses', [], seq('k3f9'))).toBe('presse-a-cuisses-k3f9');
  });
  it('évite les collisions avec les ids existants', () => {
    expect(makeEntityId('X', ['x-aaaa'], seq('aaaa', 'aaaa', 'bbbb'))).toBe('x-bbbb');
  });
  it('repli numérique si le suffixe est toujours pris', () => {
    expect(makeEntityId('X', ['x-aaaa', 'x-2'], seq('aaaa'))).toBe('x-3');
  });
  it('suffixe par défaut : 4 caractères base 36', () => {
    expect(makeEntityId('Gainage', [])).toMatch(/^gainage-[a-z0-9]{4}$/);
  });
});
```

`mobile/src/domain/__tests__/accents.test.ts` :
```ts
import { ACCENT_KEYS, defaultAccent } from '../accents';

describe('defaultAccent', () => {
  it('cycle or → rouille → bleu sur les séances non-repos', () => {
    expect(defaultAccent('lift', [])).toBe('gold');
    expect(defaultAccent('lift', [{ type: 'lift' }])).toBe('rust');
    expect(defaultAccent('cardio', [{ type: 'lift' }, { type: 'rest' }, { type: 'mixed' }])).toBe('blue');
    expect(defaultAccent('lift', [{ type: 'lift' }, { type: 'lift' }, { type: 'lift' }])).toBe('gold');
  });
  it('gris pour une séance de repos', () => {
    expect(defaultAccent('rest', [{ type: 'lift' }])).toBe('gray');
  });
  it('liste des couleurs', () => {
    expect(ACCENT_KEYS).toEqual(['gold', 'rust', 'blue', 'gray']);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/entityIds.test.ts src/domain/__tests__/accents.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/entityIds.ts` :
```ts
// ============================================================
// Identifiants d'exercices et de séances — lisibles et stables.
// Créés une seule fois ; jamais modifiés (clé des poids et de l'historique).
// ============================================================
export type RandomSuffix = () => string;

const MAX_SLUG = 30;
const ATTEMPTS = 50;

const defaultSuffix: RandomSuffix = () => Math.random().toString(36).slice(2, 6).padEnd(4, '0');

export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '');
  return slug || 'item';
}

export function makeEntityId(name: string, existing: Iterable<string>, suffix: RandomSuffix = defaultSuffix): string {
  const taken = new Set(existing);
  const base = slugify(name);
  for (let i = 0; i < ATTEMPTS; i++) {
    const id = `${base}-${suffix()}`;
    if (!taken.has(id)) return id;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
```

`mobile/src/domain/accents.ts` :
```ts
// Couleur par défaut d'une séance : or → rouille → bleu (reboucle), gris pour le repos (règle PWA)
import type { SessionType } from './program';

export type AccentKey = 'gold' | 'rust' | 'blue' | 'gray';
export const ACCENT_KEYS: readonly AccentKey[] = ['gold', 'rust', 'blue', 'gray'];
const CYCLE: readonly AccentKey[] = ['gold', 'rust', 'blue'];

export function defaultAccent(type: SessionType, others: readonly { type: SessionType }[]): AccentKey {
  if (type === 'rest') return 'gray';
  const count = others.filter((s) => s.type !== 'rest').length;
  return CYCLE[count % CYCLE.length];
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/entityIds.ts src/domain/accents.ts src/domain/__tests__/entityIds.test.ts src/domain/__tests__/accents.test.ts
git commit -m "feat(mobile): add stable readable entity ids and default session accents

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Brouillon — métadonnées, séances, planning

**Files:**
- Create: `mobile/src/domain/draft.ts`, `mobile/src/domain/__tests__/draftSessions.test.ts`
- Modify: `mobile/src/domain/schedule.ts` (+ `WEEK_ORDER`)

**Interfaces:**
- Consumes: `makeEntityId`, `RandomSuffix`, `defaultAccent`, `AccentKey`, `moveId` (`@/domain/reorder`), `Program`, `Session`, `SessionType`, `Weekday`.
- Produces:
  - `WEEK_ORDER: readonly Weekday[]` = `[1, 2, 3, 4, 5, 6, 0]` (dans `schedule.ts`)
  - `type Draft = { sourceProgramId: string | null; program: Program; manualAccents: string[] }`
  - `newDraft(): Draft`, `draftFromProgram(id: string, program: Program): Draft`
  - `setMeta(d, patch: Partial<{ label: string; units: Units; restDefaultSec: number }>): Draft`
  - `setRules(d, rules: string[]): Draft`
  - `addSession(d, type?: SessionType, suffix?: RandomSuffix): { draft: Draft; key: string }`
  - `type SessionPatch = Partial<Pick<Session, 'name' | 'subtitle' | 'note' | 'type' | 'warmup' | 'cardio' | 'tips'>>`
  - `updateSession(d, key, patch: SessionPatch): Draft` (changement de type → couleur par défaut si non choisie à la main)
  - `setSessionAccent(d, key, accent: AccentKey): Draft`
  - `isScheduled(d, key): boolean`
  - `deleteSession(d, key): Draft` (retire aussi la séance du planning)
  - `duplicateSession(d, key, copySuffix: string, suffix?: RandomSuffix): { draft: Draft; key: string }` (ids d'exercices conservés, insérée après l'originale)
  - `moveSession(d, from: number, to: number): Draft`
  - `setSchedule(d, weekday: Weekday, key: string | null): Draft`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/__tests__/draftSessions.test.ts` :
```ts
import {
  addSession, deleteSession, draftFromProgram, duplicateSession, isScheduled, moveSession,
  newDraft, setMeta, setRules, setSchedule, setSessionAccent, updateSession,
} from '../draft';
import { WEEK_ORDER } from '../schedule';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '../__fixtures__/builders';

const seq = (...values: string[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

describe('brouillon — programme et séances', () => {
  it('nouveau brouillon vide', () => {
    expect(newDraft()).toEqual({
      sourceProgramId: null,
      program: { meta: { label: '', units: 'kg', restDefaultSec: 90 }, sessions: {}, schedule: {}, rules: [] },
      manualAccents: [],
    });
  });

  it('brouillon depuis un programme : copie profonde, couleurs existantes considérées comme choisies', () => {
    const program = parseOrThrow(makeProgramInput({ '1': 'a' }, { a: makeSession('A') }));
    const d = draftFromProgram('p1', program);
    d.program.sessions.a.name = 'MODIFIÉ';
    expect(program.sessions.a.name).toBe('A');
    expect(d).toMatchObject({ sourceProgramId: 'p1', manualAccents: ['a'] });
  });

  it('métadonnées et règles', () => {
    const d = setRules(setMeta(newDraft(), { label: 'PROG', units: 'lbs' }), ['r1']);
    expect(d.program.meta).toMatchObject({ label: 'PROG', units: 'lbs', restDefaultSec: 90 });
    expect(d.program.rules).toEqual(['r1']);
  });

  it('ajout de séances : id lisible, couleur par défaut en cycle', () => {
    const a = addSession(newDraft(), 'lift', seq('aaaa'));
    const b = addSession(a.draft, 'lift', seq('bbbb'));
    expect(a.key).toBe('lift-aaaa');
    expect(b.draft.program.sessions[a.key]).toMatchObject({ type: 'lift', name: '', accent: 'gold', exercises: [], warmup: [], tips: [] });
    expect(b.draft.program.sessions[b.key].accent).toBe('rust');
  });

  it('changement de type : couleur recalculée sauf si choisie à la main', () => {
    const { draft, key } = addSession(newDraft(), 'lift', seq('aaaa'));
    expect(updateSession(draft, key, { type: 'rest' }).program.sessions[key].accent).toBe('gray');
    const chosen = setSessionAccent(draft, key, 'blue');
    expect(updateSession(chosen, key, { type: 'rest' }).program.sessions[key].accent).toBe('blue');
    expect(chosen.manualAccents).toEqual([key]);
  });

  it('Review Focus 2 : supprimer une séance planifiée sur plusieurs jours la retire du planning', () => {
    let { draft, key } = addSession(newDraft(), 'lift', seq('aaaa'));
    const other = addSession(draft, 'lift', seq('bbbb'));
    draft = setSchedule(setSchedule(setSchedule(other.draft, 1, key), 3, key), 5, other.key);
    expect(isScheduled(draft, key)).toBe(true);
    draft = deleteSession(draft, key);
    expect(draft.program.sessions[key]).toBeUndefined();
    expect(draft.program.schedule).toEqual({ '5': other.key });
    expect(isScheduled(draft, other.key)).toBe(true);
  });

  it('dupliquer une séance : nouvelle clé, ids d\'exercices conservés, insérée après l\'originale', () => {
    const program = parseOrThrow(makeProgramInput({ '1': 'a' }, {
      a: makeSession('HAUT A', [makeExercise('dc', 3)]),
      z: makeSession('BAS'),
    }));
    const { draft, key } = duplicateSession(draftFromProgram('p', program), 'a', ' (copie)', seq('cccc'));
    expect(Object.keys(draft.program.sessions)).toEqual(['a', key, 'z']);
    expect(draft.program.sessions[key]).toMatchObject({ name: 'HAUT A (copie)' });
    expect(draft.program.sessions[key].exercises.map((e) => e.id)).toEqual(['dc']);
    expect(draft.program.schedule).toEqual({ '1': 'a' });
  });

  it('déplacer une séance change l\'ordre des clés', () => {
    const program = parseOrThrow(makeProgramInput({}, { a: makeSession('A'), b: makeSession('B'), c: makeSession('C') }));
    expect(Object.keys(moveSession(draftFromProgram('p', program), 2, 0).program.sessions)).toEqual(['c', 'a', 'b']);
  });

  it('planning : affecter puis remettre en repos', () => {
    const { draft, key } = addSession(newDraft(), 'lift', seq('aaaa'));
    const planned = setSchedule(draft, 0, key);
    expect(planned.program.schedule).toEqual({ '0': key });
    expect(setSchedule(planned, 0, null).program.schedule).toEqual({});
  });

  it('les champs inconnus du programme sont conservés', () => {
    const program = parseOrThrow({ ...makeProgramInput({ '1': 'a' }, { a: makeSession('A', [], { custom: 42 }) }), extra: 'x' });
    const d = updateSession(draftFromProgram('p', program), 'a', { name: 'B' });
    expect((d.program as Record<string, unknown>).extra).toBe('x');
    expect((d.program.sessions.a as Record<string, unknown>).custom).toBe(42);
  });

  it('ordre d\'affichage de la semaine : lundi → dimanche', () => {
    expect(WEEK_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/draftSessions.test.ts`
Expected: FAIL — `Cannot find module '../draft'`.

- [ ] **Step 3: Implémenter**

Dans `mobile/src/domain/schedule.ts`, après `WEEKDAYS` :
```ts
/** Ordre d'affichage lundi → dimanche (PWA) */
export const WEEK_ORDER: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0];
```

`mobile/src/domain/draft.ts` :
```ts
// ============================================================
// Brouillon de l'éditeur — document unique, opérations PURES.
// Rien ici ne touche la base : l'enregistrement valide puis écrit.
// ============================================================
import { defaultAccent, type AccentKey } from './accents';
import { makeEntityId, type RandomSuffix } from './entityIds';
import type { Program, Session, SessionType, Units } from './program';
import { moveId } from './reorder';
import type { Weekday } from './schedule';

export type Draft = {
  /** Programme modifié ; null = nouveau programme */
  sourceProgramId: string | null;
  program: Program;
  /** Séances dont la couleur a été choisie à la main (jamais recalculée) */
  manualAccents: string[];
};

export type SessionPatch = Partial<Pick<Session, 'name' | 'subtitle' | 'note' | 'type' | 'warmup' | 'cardio' | 'tips'>>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const withProgram = (d: Draft, program: Program): Draft => ({ ...d, program });

const withSessions = (d: Draft, sessions: Record<string, Session>): Draft =>
  withProgram(d, { ...d.program, sessions });

/** Recrée un objet en insérant `key` juste après `afterKey` (l'ordre des clés = ordre d'affichage) */
function insertAfter<T>(record: Record<string, T>, afterKey: string, key: string, value: T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) {
    out[k] = v;
    if (k === afterKey) out[key] = value;
  }
  return out;
}

/* ── Création ─────────────────────────────────────────── */
export function newDraft(): Draft {
  return {
    sourceProgramId: null,
    program: { meta: { label: '', units: 'kg', restDefaultSec: 90 }, sessions: {}, schedule: {}, rules: [] } as Program,
    manualAccents: [],
  };
}

export function draftFromProgram(id: string, program: Program): Draft {
  return { sourceProgramId: id, program: clone(program), manualAccents: Object.keys(program.sessions) };
}

/* ── Programme ────────────────────────────────────────── */
export function setMeta(d: Draft, patch: Partial<{ label: string; units: Units; restDefaultSec: number }>): Draft {
  return withProgram(d, { ...d.program, meta: { ...d.program.meta, ...patch } });
}

export function setRules(d: Draft, rules: string[]): Draft {
  return withProgram(d, { ...d.program, rules: [...rules] });
}

/* ── Séances ──────────────────────────────────────────── */
function emptySession(type: SessionType, accent: AccentKey): Session {
  return { type, name: '', accent, subtitle: null, note: null, warmup: [], exercises: [], cardio: null, bonus: null, tips: [] } as Session;
}

export function addSession(d: Draft, type: SessionType = 'lift', suffix?: RandomSuffix): { draft: Draft; key: string } {
  const sessions = d.program.sessions;
  const key = makeEntityId(type, Object.keys(sessions), suffix);
  const accent = defaultAccent(type, Object.values(sessions));
  return { draft: withSessions(d, { ...sessions, [key]: emptySession(type, accent) }), key };
}

export function updateSession(d: Draft, key: string, patch: SessionPatch): Draft {
  const current = d.program.sessions[key];
  if (!current) return d;
  const next: Session = { ...current, ...patch };
  if (patch.type && patch.type !== current.type && !d.manualAccents.includes(key)) {
    const others = Object.entries(d.program.sessions).filter(([k]) => k !== key).map(([, s]) => s);
    next.accent = defaultAccent(patch.type, others);
  }
  return withSessions(d, { ...d.program.sessions, [key]: next });
}

export function setSessionAccent(d: Draft, key: string, accent: AccentKey): Draft {
  const current = d.program.sessions[key];
  if (!current) return d;
  const manualAccents = d.manualAccents.includes(key) ? d.manualAccents : [...d.manualAccents, key];
  return { ...withSessions(d, { ...d.program.sessions, [key]: { ...current, accent } }), manualAccents };
}

export function isScheduled(d: Draft, key: string): boolean {
  return Object.values(d.program.schedule).includes(key);
}

export function deleteSession(d: Draft, key: string): Draft {
  const { [key]: _removed, ...sessions } = d.program.sessions;
  const schedule = Object.fromEntries(Object.entries(d.program.schedule).filter(([, k]) => k !== key));
  return {
    ...withProgram(d, { ...d.program, sessions, schedule }),
    manualAccents: d.manualAccents.filter((k) => k !== key),
  };
}

export function duplicateSession(d: Draft, key: string, copySuffix: string, suffix?: RandomSuffix): { draft: Draft; key: string } {
  const source = d.program.sessions[key];
  if (!source) return { draft: d, key };
  const newKey = makeEntityId(source.type, Object.keys(d.program.sessions), suffix);
  const copy: Session = { ...clone(source), name: `${source.name}${copySuffix}` };
  const draft = withSessions(d, insertAfter(d.program.sessions, key, newKey, copy));
  return {
    draft: d.manualAccents.includes(key) ? { ...draft, manualAccents: [...draft.manualAccents, newKey] } : draft,
    key: newKey,
  };
}

export function moveSession(d: Draft, from: number, to: number): Draft {
  const order = moveId(Object.keys(d.program.sessions), from, to);
  return withSessions(d, Object.fromEntries(order.map((k) => [k, d.program.sessions[k]])));
}

/* ── Planning ─────────────────────────────────────────── */
export function setSchedule(d: Draft, weekday: Weekday, key: string | null): Draft {
  const schedule = { ...d.program.schedule };
  if (key === null) delete schedule[String(weekday)];
  else schedule[String(weekday)] = key;
  return withProgram(d, { ...d.program, schedule });
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/domain && npx tsc --noEmit`
Expected: PASS, aucune erreur TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/domain/draft.ts src/domain/schedule.ts src/domain/__tests__/draftSessions.test.ts
git commit -m "feat(mobile): add pure draft operations for program meta, sessions and schedule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Brouillon — exercices (principaux et bonus)

**Files:**
- Modify: `mobile/src/domain/draft.ts`
- Create: `mobile/src/domain/__tests__/draftExercises.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `type ExerciseSection = 'main' | 'bonus'`
  - `type ExerciseInput = Omit<Exercise, 'id'>`
  - `sectionExercises(session: Session, section: ExerciseSection): Exercise[]`
  - `addExercise(d, key, section, input: ExerciseInput, suffix?: RandomSuffix): { draft: Draft; id: string }`
  - `updateExercise(d, key, section, id, input: ExerciseInput): Draft` (id conservé)
  - `deleteExercise(d, key, section, id): Draft`
  - `duplicateExercise(d, key, section, id, suffix?: RandomSuffix): { draft: Draft; id: string }` (nouvel id, inséré après)
  - `moveExercise(d, key, section, from, to): Draft`
  - `setBonusTitle(d, key, title: string | null): Draft`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/__tests__/draftExercises.test.ts` :
```ts
import {
  addExercise, deleteExercise, draftFromProgram, duplicateExercise, moveExercise,
  sectionExercises, setBonusTitle, updateExercise, type ExerciseInput,
} from '../draft';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '../__fixtures__/builders';

const seq = (...values: string[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

const input = (name: string, extra: Partial<ExerciseInput> = {}): ExerciseInput =>
  ({ name, scheme: '3×10', sets: 3, timed: false, load: null, restSec: 90, cue: null, alternatives: [], ...extra }) as ExerciseInput;

function base() {
  const program = parseOrThrow(makeProgramInput({ '1': 's' }, {
    s: makeSession('S', [makeExercise('dc', 3, { name: 'Développé couché' }), makeExercise('curl', 3)]),
  }));
  return draftFromProgram('p', program);
}

describe('brouillon — exercices', () => {
  it('ajout : id lisible, unique dans tout le programme', () => {
    const { draft, id } = addExercise(base(), 's', 'main', input('Développé couché'), seq('k3f9'));
    expect(id).toBe('developpe-couche-k3f9');
    expect(sectionExercises(draft.program.sessions.s, 'main').map((e) => e.id)).toEqual(['dc', 'curl', id]);
  });

  it('Review Focus 5 : modifier (renommer) garde l\'id', () => {
    const d = updateExercise(base(), 's', 'main', 'dc', input('Développé incliné', { sets: 4 }));
    expect(d.program.sessions.s.exercises[0]).toMatchObject({ id: 'dc', name: 'Développé incliné', sets: 4 });
  });

  it('modifier conserve les champs inconnus de l\'exercice', () => {
    const program = parseOrThrow(makeProgramInput({}, { s: makeSession('S', [makeExercise('dc', 3, { custom: 'x' })]) }));
    const d = updateExercise(draftFromProgram('p', program), 's', 'main', 'dc', input('DC'));
    expect((d.program.sessions.s.exercises[0] as Record<string, unknown>).custom).toBe('x');
  });

  it('supprimer, dupliquer (nouvel id après l\'original), déplacer', () => {
    const dup = duplicateExercise(base(), 's', 'main', 'dc', seq('zzzz'));
    expect(dup.id).toBe('developpe-couche-zzzz');
    expect(dup.draft.program.sessions.s.exercises.map((e) => e.id)).toEqual(['dc', dup.id, 'curl']);
    expect(dup.draft.program.sessions.s.exercises[1].name).toBe('Développé couché');
    const moved = moveExercise(dup.draft, 's', 'main', 2, 0);
    expect(moved.program.sessions.s.exercises.map((e) => e.id)).toEqual(['curl', 'dc', dup.id]);
    expect(deleteExercise(moved, 's', 'main', 'dc').program.sessions.s.exercises.map((e) => e.id)).toEqual(['curl', dup.id]);
  });

  it('bonus : ajout crée la section, titre optionnel, vidée → null', () => {
    const { draft, id } = addExercise(base(), 's', 'bonus', input('Abdos'), seq('bbbb'));
    expect(draft.program.sessions.s.bonus).toMatchObject({ title: null, exercises: [{ id, name: 'Abdos' }] });
    const titled = setBonusTitle(draft, 's', 'FINISHER');
    expect(titled.program.sessions.s.bonus?.title).toBe('FINISHER');
    expect(deleteExercise(draft, 's', 'bonus', id).program.sessions.s.bonus).toBeNull();
    expect(deleteExercise(titled, 's', 'bonus', id).program.sessions.s.bonus).toEqual({ title: 'FINISHER', exercises: [] });
  });

  it('un id de bonus ne peut pas reprendre un id principal', () => {
    const { id } = addExercise(base(), 's', 'bonus', input('Développé couché'), seq('k3f9'));
    expect(id).not.toBe('dc');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/draftExercises.test.ts`
Expected: FAIL — `addExercise is not a function` (ou export manquant).

- [ ] **Step 3: Implémenter** (ajouter à la fin de `draft.ts`, et `Exercise` à l'import de types)

```ts
/* ── Exercices (principaux et bonus) ──────────────────── */
export type ExerciseSection = 'main' | 'bonus';
export type ExerciseInput = Omit<Exercise, 'id'>;

export function sectionExercises(session: Session, section: ExerciseSection): Exercise[] {
  return section === 'main' ? session.exercises : session.bonus?.exercises ?? [];
}

function withSectionExercises(session: Session, section: ExerciseSection, list: Exercise[]): Session {
  if (section === 'main') return { ...session, exercises: list };
  const title = session.bonus?.title ?? null;
  if (list.length === 0 && !title) return { ...session, bonus: null };
  return { ...session, bonus: { ...(session.bonus ?? {}), title, exercises: list } };
}

function updateSectionList(d: Draft, key: string, section: ExerciseSection, fn: (list: Exercise[]) => Exercise[]): Draft {
  const session = d.program.sessions[key];
  if (!session) return d;
  const next = withSectionExercises(session, section, fn(sectionExercises(session, section)));
  return withSessions(d, { ...d.program.sessions, [key]: next });
}

function allExerciseIds(program: Program): string[] {
  return Object.values(program.sessions).flatMap((s) => [...s.exercises, ...(s.bonus?.exercises ?? [])].map((e) => e.id));
}

export function addExercise(d: Draft, key: string, section: ExerciseSection, input: ExerciseInput, suffix?: RandomSuffix): { draft: Draft; id: string } {
  const id = makeEntityId(input.name, allExerciseIds(d.program), suffix);
  return { draft: updateSectionList(d, key, section, (list) => [...list, { ...input, id } as Exercise]), id };
}

export function updateExercise(d: Draft, key: string, section: ExerciseSection, id: string, input: ExerciseInput): Draft {
  return updateSectionList(d, key, section, (list) => list.map((e) => (e.id === id ? ({ ...e, ...input, id } as Exercise) : e)));
}

export function deleteExercise(d: Draft, key: string, section: ExerciseSection, id: string): Draft {
  return updateSectionList(d, key, section, (list) => list.filter((e) => e.id !== id));
}

export function duplicateExercise(d: Draft, key: string, section: ExerciseSection, id: string, suffix?: RandomSuffix): { draft: Draft; id: string } {
  const session = d.program.sessions[key];
  const source = session ? sectionExercises(session, section).find((e) => e.id === id) : undefined;
  if (!source) return { draft: d, id };
  const newId = makeEntityId(source.name, allExerciseIds(d.program), suffix);
  const draft = updateSectionList(d, key, section, (list) => {
    const i = list.findIndex((e) => e.id === id);
    return [...list.slice(0, i + 1), { ...clone(source), id: newId }, ...list.slice(i + 1)];
  });
  return { draft, id: newId };
}

export function moveExercise(d: Draft, key: string, section: ExerciseSection, from: number, to: number): Draft {
  return updateSectionList(d, key, section, (list) => {
    const order = moveId(list.map((e) => e.id), from, to);
    return order.map((id) => list.find((e) => e.id === id)!);
  });
}

export function setBonusTitle(d: Draft, key: string, title: string | null): Draft {
  const session = d.program.sessions[key];
  if (!session) return d;
  const exercises = session.bonus?.exercises ?? [];
  const bonus = exercises.length === 0 && !title ? null : { ...(session.bonus ?? {}), title, exercises };
  return withSessions(d, { ...d.program.sessions, [key]: { ...session, bonus } });
}
```
Mettre à jour l'import : `import type { Exercise, Program, Session, SessionType, Units } from './program';`

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/domain && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/draft.ts src/domain/__tests__/draftExercises.test.ts
git commit -m "feat(mobile): add pure draft operations for main and bonus exercises

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `validateDraft` (règles de l'éditeur + `ProgramSchema`)

**Files:**
- Create: `mobile/src/domain/programRules.ts`, `mobile/src/domain/__tests__/programRules.test.ts`

**Interfaces:**
- Consumes: `Draft`, `parseProgram`, `Program`.
- Produces:
  - `type DraftErrorCode = 'name_required' | 'no_session' | 'no_schedule' | 'session_name_required' | 'schema'`
  - `type DraftError = { step: 1 | 2 | 3 | 4; code: DraftErrorCode; sessionKey?: string; detail?: string }`
  - `type DraftValidation = { ok: true; program: Program } | { ok: false; errors: DraftError[] }`
  - `validateDraft(d: Draft): DraftValidation`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/__tests__/programRules.test.ts` :
```ts
import { addExercise, addSession, newDraft, setMeta, setSchedule, updateSession, type ExerciseInput } from '../draft';
import { validateDraft } from '../programRules';

const seq = (v: string) => () => v;
const exo = (name: string): ExerciseInput =>
  ({ name, scheme: '3×10', sets: 3, timed: false, load: null, restSec: 90, cue: null, alternatives: [] }) as ExerciseInput;

function validDraft() {
  const { draft, key } = addSession(setMeta(newDraft(), { label: 'PROG' }), 'lift', seq('aaaa'));
  return { draft: setSchedule(updateSession(draft, key, { name: 'FULL' }), 1, key), key };
}

describe('validateDraft', () => {
  it('brouillon vide : nom, séance et planning manquants, avec leur étape', () => {
    const r = validateDraft(newDraft());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => [e.step, e.code])).toEqual([[1, 'name_required'], [2, 'no_session'], [3, 'no_schedule']]);
  });

  it('séance sans nom → étape 4 avec sa clé', () => {
    const { draft, key } = validDraft();
    const r = validateDraft(updateSession(draft, key, { name: '  ' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual([{ step: 4, code: 'session_name_required', sessionKey: key }]);
  });

  it('brouillon valide → programme normalisé', () => {
    const { draft, key } = validDraft();
    const r = validateDraft(addExercise(draft, key, 'main', exo('Squat'), seq('bbbb')).draft);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.program.sessions[key].exercises[0]).toMatchObject({ id: 'squat-bbbb', name: 'Squat' });
  });

  it('erreur de schéma dans un exercice → étape 4 de la séance concernée', () => {
    const { draft, key } = validDraft();
    const withBad = addExercise(draft, key, 'main', exo('   '), seq('cccc')).draft;
    const r = validateDraft(withBad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({ step: 4, code: 'schema', sessionKey: key });
      expect(r.errors[0].detail).toContain('exercises');
    }
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/programRules.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/programRules.ts` :
```ts
// ============================================================
// Validation du brouillon avant enregistrement : règles de l'éditeur
// (PWA) puis ProgramSchema. Chaque erreur indique l'étape à rouvrir.
// ============================================================
import type { Draft } from './draft';
import { parseProgram, type Program } from './program';

export type DraftErrorCode = 'name_required' | 'no_session' | 'no_schedule' | 'session_name_required' | 'schema';
export type DraftError = { step: 1 | 2 | 3 | 4; code: DraftErrorCode; sessionKey?: string; detail?: string };
export type DraftValidation = { ok: true; program: Program } | { ok: false; errors: DraftError[] };

/** Erreur Zod « chemin : message » → étape (et séance) concernée */
function schemaError(detail: string, sessionKeys: string[]): DraftError {
  const m = detail.match(/^sessions\.([^.\s]+)/);
  if (m && sessionKeys.includes(m[1])) return { step: 4, code: 'schema', sessionKey: m[1], detail };
  if (detail.startsWith('schedule')) return { step: 3, code: 'schema', detail };
  return { step: 1, code: 'schema', detail };
}

export function validateDraft(d: Draft): DraftValidation {
  const p = d.program;
  const keys = Object.keys(p.sessions);
  const errors: DraftError[] = [];

  if (!p.meta.label.trim()) errors.push({ step: 1, code: 'name_required' });
  if (keys.length === 0) errors.push({ step: 2, code: 'no_session' });
  for (const key of keys) {
    if (!p.sessions[key].name.trim()) errors.push({ step: 4, code: 'session_name_required', sessionKey: key });
  }
  const scheduled = Object.values(p.schedule).filter((k) => k != null && Object.hasOwn(p.sessions, k));
  if (scheduled.length === 0) errors.push({ step: 3, code: 'no_schedule' });
  errors.sort((a, b) => a.step - b.step);
  if (errors.length > 0) return { ok: false, errors };

  const parsed = parseProgram(p);
  if (parsed.ok) return { ok: true, program: parsed.program };
  return { ok: false, errors: parsed.errors.map((detail) => schemaError(detail, keys)) };
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/domain/__tests__/programRules.test.ts`
Expected: PASS. (L'ordre attendu du premier test est `1, 2, 3` grâce au tri par étape.)

- [ ] **Step 5: Commit**

```bash
git add src/domain/programRules.ts src/domain/__tests__/programRules.test.ts
git commit -m "feat(mobile): validate drafts with editor rules and map errors to steps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `updateProgram` + `duplicateProgram`

**Files:**
- Modify: `mobile/src/db/repos/programsRepo.ts`
- Test: `mobile/src/db/__tests__/programsRepo.test.ts` (ajout d'un `describe`)

**Interfaces:**
- Produces:
  - `updateProgram(ctx: RepoCtx, id: string, input: unknown): StoredProgram` (lève `ProgramValidationError` si invalide, `Error('programme introuvable')` si supprimé)
  - `duplicateProgram(ctx: RepoCtx, id: string, copySuffix: string): StoredProgram | null` (non activé)

- [ ] **Step 1: Écrire les tests** (à la fin de `programsRepo.test.ts` ; importer `duplicateProgram, updateProgram`)

```ts
describe('updateProgram / duplicateProgram', () => {
  it('updateProgram remplace la définition validée, sans changer le programme actif', () => {
    const ctx = createTestCtx();
    const a = createProgram(ctx, example, 'example');
    const b = createProgram(ctx, example, 'import');
    setActiveProgram(ctx, a.id);
    ctx.advance(1000);
    const updated = updateProgram(ctx, b.id, { ...example, meta: { ...example.meta, label: 'NOUVEAU' } });
    expect(updated.definition.meta.label).toBe('NOUVEAU');
    expect(updated.updatedAt).not.toBe(b.updatedAt);
    expect(getProgram(ctx, b.id)?.definition.meta.label).toBe('NOUVEAU');
    expect(getActiveProgram(ctx)?.id).toBe(a.id);
  });

  it('updateProgram refuse un programme invalide ou supprimé', () => {
    const ctx = createTestCtx();
    const a = createProgram(ctx, example, 'example');
    expect(() => updateProgram(ctx, a.id, { meta: {} })).toThrow(ProgramValidationError);
    expect(getProgram(ctx, a.id)?.definition.meta.label).toBe('PROGRAMME SALLE');
    softDeleteProgram(ctx, a.id);
    expect(() => updateProgram(ctx, a.id, example)).toThrow('programme introuvable');
  });

  it('duplicateProgram : libellé « (copie) » une seule fois, ids conservés, non activé', () => {
    const ctx = createTestCtx();
    const a = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, a.id);
    const copy = duplicateProgram(ctx, a.id, ' (copie)')!;
    expect(copy.definition.meta.label).toBe('PROGRAMME SALLE (copie)');
    expect(copy.definition.sessions).toEqual(a.definition.sessions);
    expect(copy.source).toBe('manual');
    expect(getActiveProgram(ctx)?.id).toBe(a.id);
    expect(duplicateProgram(ctx, copy.id, ' (copie)')!.definition.meta.label).toBe('PROGRAMME SALLE (copie)');
    expect(duplicateProgram(ctx, 'nope', ' (copie)')).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/db/__tests__/programsRepo.test.ts`
Expected: FAIL — `updateProgram is not a function`.

- [ ] **Step 3: Implémenter** (ajouter à `programsRepo.ts`)

```ts
export function updateProgram(ctx: RepoCtx, id: string, input: unknown): StoredProgram {
  const parsed = parseProgram(input);
  if (!parsed.ok) throw new ProgramValidationError(parsed.errors);
  const existing = getProgram(ctx, id);
  if (!existing) throw new Error('programme introuvable');
  const now = ctx.now();
  ctx.db.update(programs).set({ definition: JSON.stringify(parsed.program), updatedAt: now }).where(eq(programs.id, id)).run();
  return { ...existing, definition: parsed.program, updatedAt: now };
}

/** Copie d'un programme (ids d'exercices et de séances conservés : les poids suivent) ; non activée */
export function duplicateProgram(ctx: RepoCtx, id: string, copySuffix: string): StoredProgram | null {
  const source = getProgram(ctx, id);
  if (!source) return null;
  const label = source.definition.meta.label.trim();
  const already = label.endsWith(copySuffix.trim());
  const definition = { ...source.definition, meta: { ...source.definition.meta, label: already ? label : `${label}${copySuffix}` } };
  return createProgram(ctx, definition, 'manual');
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/db && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repos/programsRepo.ts src/db/__tests__/programsRepo.test.ts
git commit -m "feat(mobile): add program update and duplication to programs repository

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `restoreDraft`, store du brouillon, entitlements

**Files:**
- Modify: `mobile/src/domain/draft.ts` (+ `restoreDraft`), `mobile/src/db/repos/settingsRepo.ts` (`programDraft: Draft`), `mobile/src/app/_layout.tsx`
- Create: `mobile/src/state/draftStore.ts`, `mobile/src/entitlements/index.ts`, `mobile/src/domain/__tests__/restoreDraft.test.ts`, `mobile/src/state/__tests__/draftStore.test.ts`

**Interfaces:**
- Produces:
  - `restoreDraft(value: unknown): Draft | null` (contrôle structurel ; ne valide pas le programme)
  - `SettingsMap.programDraft: Draft`
  - `useDraftStore` : `{ draft: Draft | null; lost: boolean; hydrate(ctx): void; start(ctx, draft: Draft): void; apply(ctx, op: (d: Draft) => Draft): void; discard(ctx): void; ackLost(): void }` ; `DRAFT_INITIAL`
  - `useEntitlements(): Entitlements` avec `Entitlements = { canUseAI: boolean; maxPrograms: number; canUseHealthSync: boolean }`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/__tests__/restoreDraft.test.ts` :
```ts
import { addSession, newDraft, restoreDraft } from '../draft';

describe('restoreDraft', () => {
  it('relit un brouillon valide (y compris JSON aller-retour)', () => {
    const d = addSession(newDraft(), 'lift', () => 'aaaa').draft;
    expect(restoreDraft(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it('manualAccents absent (ancien format) → []', () => {
    const { manualAccents: _m, ...old } = newDraft();
    expect(restoreDraft(old)?.manualAccents).toEqual([]);
  });

  it('Review Focus 1 : formes invalides → null', () => {
    expect(restoreDraft(null)).toBeNull();
    expect(restoreDraft('x')).toBeNull();
    expect(restoreDraft({ sourceProgramId: null })).toBeNull();
    expect(restoreDraft({ sourceProgramId: 3, program: newDraft().program })).toBeNull();
    expect(restoreDraft({ sourceProgramId: null, program: { ...newDraft().program, sessions: [] } })).toBeNull();
    expect(restoreDraft({ sourceProgramId: null, program: { ...newDraft().program, meta: { label: 1 } } })).toBeNull();
    expect(restoreDraft({ sourceProgramId: null, program: { ...newDraft().program, sessions: { a: { type: 'lift', name: 'A' } } } })).toBeNull();
  });
});
```

`mobile/src/state/__tests__/draftStore.test.ts` :
```ts
/** @jest-environment node */
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { settings } from '@/db/schema';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { newDraft, setMeta } from '@/domain/draft';
import { DRAFT_INITIAL, useDraftStore } from '../draftStore';

describe('draftStore', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('start / apply persistent dans settings.programDraft ; discard efface', () => {
    const ctx = createTestCtx();
    useDraftStore.getState().start(ctx, newDraft());
    useDraftStore.getState().apply(ctx, (d) => setMeta(d, { label: 'P' }));
    expect(useDraftStore.getState().draft?.program.meta.label).toBe('P');
    expect(getSetting(ctx, 'programDraft')?.program.meta.label).toBe('P');
    useDraftStore.getState().discard(ctx);
    expect(useDraftStore.getState().draft).toBeNull();
    expect(getSetting(ctx, 'programDraft')).toBeUndefined();
  });

  it('apply sans brouillon : sans effet', () => {
    const ctx = createTestCtx();
    useDraftStore.getState().apply(ctx, (d) => setMeta(d, { label: 'P' }));
    expect(useDraftStore.getState().draft).toBeNull();
  });

  it('hydrate relit un brouillon ; un brouillon corrompu est effacé et signalé', () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'programDraft', setMeta(newDraft(), { label: 'X' }));
    useDraftStore.getState().hydrate(ctx);
    expect(useDraftStore.getState()).toMatchObject({ draft: { program: { meta: { label: 'X' } } }, lost: false });

    ctx.db.update(settings).set({ value: '{"sourceProgramId":null,"program":{"sessions":[]}}' }).run();
    useDraftStore.getState().hydrate(ctx);
    expect(useDraftStore.getState()).toMatchObject({ draft: null, lost: true });
    expect(getSetting(ctx, 'programDraft')).toBeUndefined();
    useDraftStore.getState().ackLost();
    expect(useDraftStore.getState().lost).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/domain/__tests__/restoreDraft.test.ts src/state/__tests__/draftStore.test.ts`
Expected: FAIL — `restoreDraft` / `../draftStore` introuvables.

- [ ] **Step 3: Implémenter**

Ajouter à `mobile/src/domain/draft.ts` (et `SessionTypeSchema` à l'import depuis `./program`, en valeur : `import { SessionTypeSchema, type Exercise, … } from './program';`) :
```ts
/* ── Relecture (settings.programDraft) ────────────────── */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Contrôle structurel d'un brouillon relu ; ne valide pas le programme (il peut être incomplet) */
export function restoreDraft(value: unknown): Draft | null {
  if (!isObj(value)) return null;
  const { sourceProgramId, program, manualAccents } = value;
  if (sourceProgramId !== null && typeof sourceProgramId !== 'string') return null;
  if (!isObj(program) || !isObj(program.meta) || !isObj(program.sessions) || !isObj(program.schedule) || !Array.isArray(program.rules)) return null;
  const meta = program.meta;
  if (typeof meta.label !== 'string' || (meta.units !== 'kg' && meta.units !== 'lbs') || typeof meta.restDefaultSec !== 'number') return null;
  for (const s of Object.values(program.sessions)) {
    if (!isObj(s) || !SessionTypeSchema.safeParse(s.type).success || typeof s.name !== 'string') return null;
    if (!Array.isArray(s.exercises) || !Array.isArray(s.warmup) || !Array.isArray(s.tips)) return null;
  }
  const accents = Array.isArray(manualAccents) ? manualAccents.filter((k): k is string => typeof k === 'string') : [];
  return { sourceProgramId, program: program as Program, manualAccents: accents };
}
```

`mobile/src/db/repos/settingsRepo.ts` : `import type { Draft } from '@/domain/draft';` et `programDraft: Draft;`.

`mobile/src/state/draftStore.ts` :
```ts
// ============================================================
// Brouillon de l'éditeur (Zustand) — recopié dans settings.programDraft
// à chaque modification : il survit à l'arrêt de l'app.
// ============================================================
import { create } from 'zustand';
import { deleteSetting, getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { restoreDraft, type Draft } from '@/domain/draft';

interface DraftState {
  draft: Draft | null;
  /** Un brouillon illisible a été effacé au démarrage (message à afficher une fois) */
  lost: boolean;
  hydrate(ctx: RepoCtx): void;
  start(ctx: RepoCtx, draft: Draft): void;
  apply(ctx: RepoCtx, op: (d: Draft) => Draft): void;
  discard(ctx: RepoCtx): void;
  ackLost(): void;
}

export const DRAFT_INITIAL = { draft: null, lost: false };

export const useDraftStore = create<DraftState>((set, get) => ({
  ...DRAFT_INITIAL,
  hydrate: (ctx) => {
    const raw = getSetting(ctx, 'programDraft');
    if (raw === undefined) {
      set({ draft: null });
      return;
    }
    const draft = restoreDraft(raw);
    if (!draft) {
      deleteSetting(ctx, 'programDraft');
      set({ draft: null, lost: true });
      return;
    }
    set({ draft });
  },
  start: (ctx, draft) => {
    setSetting(ctx, 'programDraft', draft);
    set({ draft });
  },
  apply: (ctx, op) => {
    const current = get().draft;
    if (!current) return;
    const draft = op(current);
    setSetting(ctx, 'programDraft', draft);
    set({ draft });
  },
  discard: (ctx) => {
    deleteSetting(ctx, 'programDraft');
    set({ draft: null });
  },
  ackLost: () => set({ lost: false }),
}));
```
Note : `getSetting` renvoie `undefined` pour un JSON illisible ; ce cas est alors traité comme « pas de brouillon » (pas de message). Le test couvre le cas JSON valide mais de forme invalide.

`mobile/src/entitlements/index.ts` :
```ts
// ============================================================
// Droits d'accès (spec §2.3) — v1 : tout débloqué.
// Le sous-projet 3 branchera le paywall ici sans toucher aux écrans.
// ============================================================
export interface Entitlements {
  canUseAI: boolean;
  maxPrograms: number;
  canUseHealthSync: boolean;
}

const V1: Entitlements = { canUseAI: true, maxPrograms: Infinity, canUseHealthSync: true };

export function useEntitlements(): Entitlements {
  return V1;
}
```

`mobile/src/app/_layout.tsx` (`PrefsGate`, dans le `useEffect`) : ajouter `useDraftStore.getState().hydrate(ctx);` après l'hydratation du minuteur, et l'import `import { useDraftStore } from '@/state/draftStore';`.

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/draft.ts src/domain/__tests__/restoreDraft.test.ts src/state/draftStore.ts src/state/__tests__/draftStore.test.ts src/entitlements src/db/repos/settingsRepo.ts src/app/_layout.tsx
git commit -m "feat(mobile): add persisted editor draft store and v1 entitlements

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Chaînes i18n M3a

**Files:**
- Modify: `mobile/src/i18n/locales/fr.json`, `mobile/src/i18n/locales/en.json`

**Interfaces:**
- Produces: les clés ci-dessous (Tasks 8 à 17). Clés PWA réutilisées sans changement : `plan_*`, `editor_*`, `exo_*`, `session_type_*`, `accent_*`, `step_next`.

- [ ] **Step 1: Ajouter les clés** (avant `"coming_soon"`, par un petit script Node comme au M2 pour conserver l'ordre)

| Clé | fr | en |
|---|---|---|
| `editor_err_session_name` | `Chaque séance doit avoir un nom.` | `Each session needs a name.` |
| `editor_errors_title` | `Impossible d'enregistrer` | `Cannot save` |
| `editor_save` | `Enregistrer` | `Save` |
| `editor_cancel` | `Annuler` | `Cancel` |
| `editor_cancel_title` | `Abandonner les modifications ?` | `Discard changes?` |
| `editor_cancel_body` | `Le brouillon sera supprimé.` | `The draft will be deleted.` |
| `editor_discard` | `Abandonner` | `Discard` |
| `editor_keep` | `Continuer` | `Keep editing` |
| `editor_replace_draft_title` | `Abandonner le brouillon en cours ?` | `Discard the current draft?` |
| `editor_draft_banner` | `Brouillon en cours : %s` | `Draft in progress: %s` |
| `editor_draft_resume` | `Reprendre` | `Resume` |
| `editor_draft_lost` | `Brouillon illisible : il a été supprimé.` | `Unreadable draft was deleted.` |
| `editor_rest_default_label` | `Repos par défaut (sec)` | `Default rest (sec)` |
| `editor_rules_section` | `Règles` | `Rules` |
| `editor_add_rule` | `Ajouter une règle` | `Add a rule` |
| `editor_rule_ph` | `EX: Garder 1 à 2 reps en réserve` | `E.G. Keep 1-2 reps in reserve` |
| `editor_sess_note_label` | `Note (optionnel)` | `Note (optional)` |
| `editor_sess_accent_label` | `Couleur` | `Color` |
| `editor_bonus_section` | `Bonus` | `Bonus` |
| `editor_bonus_title_ph` | `Titre du bonus (optionnel)` | `Bonus title (optional)` |
| `editor_add_bonus` | `AJOUTER UN BONUS` | `ADD A BONUS EXERCISE` |
| `editor_copy_suffix` | ` (copie)` | ` (copy)` |
| `editor_duplicate` | `Dupliquer` | `Duplicate` |
| `editor_delete` | `Supprimer` | `Delete` |
| `editor_remove_item` | `Retirer` | `Remove` |
| `editor_alt_details` | `Détails` | `Details` |
| `editor_day_pick_title` | `%s` | `%s` |
| `plan_active_badge` | `Actif` | `Active` |
| `plan_activated` | `Programme activé ✓` | `Program activated ✓` |
| `stepper_decrease` | `Diminuer` | `Decrease` |
| `stepper_increase` | `Augmenter` | `Increase` |

- [ ] **Step 2: Vérifier**

Run: `npx jest src/i18n && npx tsc --noEmit`
Expected: PASS (parité des clés fr/en).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales
git commit -m "feat(mobile): add M3a plan and editor strings (fr/en)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Composants communs (`BottomSheet` déplacé, `NumberStepper`, `ListEditor`, `AccentPicker`)

**Files:**
- Move: `mobile/src/features/today/BottomSheet.tsx` → `mobile/src/features/common/BottomSheet.tsx` (mettre à jour les imports de `SetEditSheet.tsx` et `SwapSheet.tsx` : `import { BottomSheet } from '@/features/common/BottomSheet';`)
- Create: `mobile/src/features/common/NumberStepper.tsx`, `mobile/src/features/common/ListEditor.tsx`, `mobile/src/features/editor/AccentPicker.tsx`, `mobile/src/features/common/__tests__/inputs.test.tsx`

**Interfaces:**
- Produces:
  - `<NumberStepper value: number; min: number; max: number; step?: number; label: string; format?: (v: number) => string; testID?: string; onChange(v: number): void />` (boutons `−`/`+` bornés, `accessibilityRole="adjustable"`)
  - `<ListEditor items: string[]; onChange(items: string[]): void; placeholder: string; addLabel: string; maxItems: number; maxLength: number; testID: string />` (champ par élément + « Retirer » ; testIDs `${testID}-<i>` et `${testID}-add`)
  - `<AccentPicker value: string | null | undefined; onChange(accent: AccentKey): void />` (4 pastilles, libellés `accent_*`)

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/common/__tests__/inputs.test.tsx` :
```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { AccentPicker } from '@/features/editor/AccentPicker';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ListEditor } from '../ListEditor';
import { NumberStepper } from '../NumberStepper';

describe('NumberStepper', () => {
  it('incrémente par pas et respecte les bornes', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<NumberStepper value={90} min={0} max={600} step={15} label="Repos" onChange={onChange} />);
    expect(screen.getByText('90')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Augmenter Repos' }));
    expect(onChange).toHaveBeenLastCalledWith(105);
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuer Repos' }));
    expect(onChange).toHaveBeenLastCalledWith(75);
  });

  it('boutons désactivés aux bornes', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<NumberStepper value={1} min={1} max={20} label="Séries" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuer Séries' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ListEditor', () => {
  it('modifie, ajoute et retire des éléments ; plafond respecté', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <ListEditor items={['Vélo']} onChange={onChange} placeholder="ex" addLabel="Ajouter" maxItems={2} maxLength={200} testID="wu" />,
    );
    await fireEvent.changeText(screen.getByTestId('wu-0'), 'Vélo 5 min');
    expect(onChange).toHaveBeenLastCalledWith(['Vélo 5 min']);
    await fireEvent.press(screen.getByTestId('wu-add'));
    expect(onChange).toHaveBeenLastCalledWith(['Vélo', '']);
    await fireEvent.press(screen.getByRole('button', { name: 'Retirer 1' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('bouton Ajouter absent au plafond', async () => {
    await renderWithProviders(
      <ListEditor items={['a', 'b']} onChange={jest.fn()} placeholder="ex" addLabel="Ajouter" maxItems={2} maxLength={200} testID="wu" />,
    );
    expect(screen.queryByTestId('wu-add')).toBeNull();
  });
});

describe('AccentPicker', () => {
  it('sélectionne une couleur', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<AccentPicker value="gold" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Or' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('radio', { name: 'Bleu' }));
    expect(onChange).toHaveBeenCalledWith('blue');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/common/__tests__/inputs.test.tsx`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

Déplacer le fichier : `git mv src/features/today/BottomSheet.tsx src/features/common/BottomSheet.tsx`, puis corriger les deux imports.

`mobile/src/features/common/NumberStepper.tsx` :
```tsx
// Stepper numérique −/+ borné (séries, repos) — cibles 44 pt, boutons libellés pour le lecteur d'écran
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  format?: (v: number) => string;
  testID?: string;
  onChange(value: number): void;
}

export function NumberStepper({ value, min, max, step = 1, label, format = String, testID, onChange }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const canDec = value - step >= min;
  const canInc = value + step <= max;
  const dec = () => { if (canDec) onChange(value - step); };
  const inc = () => { if (canInc) onChange(value + step); };
  const btn = (enabled: boolean) => [styles.btn, { backgroundColor: colors.bgCardSoft, borderRadius: radius.sm, opacity: enabled ? 1 : 0.4 }];
  const sign = { color: colors.text, fontFamily: fonts.uiBold, fontSize: 18 };
  return (
    <View testID={testID} style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('stepper_decrease')} ${label}`} accessibilityState={{ disabled: !canDec }} onPress={dec} style={btn(canDec)}>
        <Text style={sign}>−</Text>
      </Pressable>
      <Text style={[styles.value, { color: colors.text, fontFamily: fonts.uiBold }]}>{format(value)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('stepper_increase')} ${label}`} accessibilityState={{ disabled: !canInc }} onPress={inc} style={btn(canInc)}>
        <Text style={sign}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 56, textAlign: 'center', fontSize: 18 },
});
```

`mobile/src/features/common/ListEditor.tsx` :
```tsx
// Liste de textes éditable (échauffement, règles) — plafond d'éléments et de longueur
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  items: string[];
  onChange(items: string[]): void;
  placeholder: string;
  addLabel: string;
  maxItems: number;
  maxLength: number;
  testID: string;
}

export function ListEditor({ items, onChange, placeholder, addLabel, maxItems, maxLength, testID }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];
  return (
    <View style={styles.root}>
      {items.map((item, i) => (
        <View key={i} style={styles.row}>
          <TextInput
            testID={`${testID}-${i}`}
            value={item}
            maxLength={maxLength}
            placeholder={placeholder}
            placeholderTextColor={colors.textDim}
            onChangeText={(text) => onChange(items.map((v, j) => (j === i ? text : v)))}
            style={field}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('editor_remove_item')} ${i + 1}`}
            onPress={() => onChange(items.filter((_, j) => j !== i))}
            style={styles.icon}
          >
            <Ionicons name="close" size={18} color={colors.textDim} />
          </Pressable>
        </View>
      ))}
      {items.length < maxItems ? (
        <Pressable testID={`${testID}-add`} accessibilityRole="button" onPress={() => onChange([...items, ''])} style={styles.add}>
          <Ionicons name="add" size={18} color={colors.gold} />
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{addLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { flex: 1, minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  icon: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  add: { minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
```

`mobile/src/features/editor/AccentPicker.tsx` :
```tsx
// Choix de la couleur d'une séance (or / rouille / bleu / gris)
import { Pressable, StyleSheet, View } from 'react-native';
import { ACCENT_KEYS, type AccentKey } from '@/domain/accents';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

export function AccentPicker({ value, onChange }: { value: string | null | undefined; onChange(accent: AccentKey): void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {ACCENT_KEYS.map((key) => {
        const selected = (value ?? 'gold') === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={t(`accent_${key}` as StringKey)}
            accessibilityState={{ selected }}
            onPress={() => onChange(key)}
            style={[styles.hit, { borderColor: selected ? colors.text : 'transparent' }]}
          >
            <View style={[styles.dot, { backgroundColor: accentColors(colors, key).fill }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  hit: { width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: TOUCH_MIN / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14 },
});
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (dont les tests M2 de `SetEditSheet` / `SwapSheet` après le déplacement de `BottomSheet`).

- [ ] **Step 5: Commit**

```bash
git add src/features/common src/features/editor/AccentPicker.tsx src/features/today
git commit -m "feat(mobile): add number stepper, list editor and accent picker; share bottom sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Vues de Plan (`planStats`, `WeekView`, `ProgramCard`, `ProgramsView`)

**Files:**
- Create: `mobile/src/features/plan/planStats.ts`, `mobile/src/features/plan/WeekView.tsx`, `mobile/src/features/plan/ProgramCard.tsx`, `mobile/src/features/plan/ProgramsView.tsx`, `mobile/src/features/plan/__tests__/planViews.test.tsx`

**Interfaces:**
- Consumes: `StoredProgram`, `Program`, `WEEK_ORDER`, `resolveDay`, `weekdayOf`, `accentColors`.
- Produces:
  - `programSummary(p: Program): { days: number; exercises: number }` (jours planifiés vers une séance existante ; somme des exercices principaux de toutes les séances)
  - `<WeekView program: Program | null; today: Date; onAddSession(): void; onCreate(): void />` (testIDs `week-<weekday>`, badge `today-badge`)
  - `<ProgramCard program: StoredProgram; active: boolean; onActivate(); onEdit(); onDuplicate(); onDelete() />` (testID `program-<id>`)
  - `<ProgramsView programs: StoredProgram[]; activeId: string | null; onActivate(id); onEdit(id); onDuplicate(id); onDelete(id); onCreate() />`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/plan/__tests__/planViews.test.tsx` :
```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '@/domain/__fixtures__/builders';
import type { Program } from '@/domain/program';
import { renderWithProviders } from '@/test/renderWithProviders';
import { programSummary } from '../planStats';
import { ProgramsView } from '../ProgramsView';
import { WeekView } from '../WeekView';

const program = parseOrThrow(makeProgramInput({ '1': 'a', '3': 'b' }, {
  a: makeSession('FULL BODY', [makeExercise('x', 3), makeExercise('y', 3)]),
  b: makeSession('HAUT', [makeExercise('z', 3)], { accent: 'rust' }),
}));
const stored = (id: string, label: string): StoredProgram =>
  ({ id, definition: { ...program, meta: { ...program.meta, label } }, source: 'manual', createdAt: '', updatedAt: '' });

describe('planStats', () => {
  it('jours planifiés (séances existantes seulement) et nombre d\'exercices', () => {
    expect(programSummary(program)).toEqual({ days: 2, exercises: 3 });
    // Un jour pointant vers une séance absente (impossible via ProgramSchema) n'est pas compté
    const withGhost = { ...program, schedule: { ...program.schedule, '5': 'ghost' } } as Program;
    expect(programSummary(withGhost)).toEqual({ days: 2, exercises: 3 });
  });
});

describe('WeekView', () => {
  it('lundi → dimanche, séance du jour badgée, repos atténués', async () => {
    const MONDAY = new Date(2026, 9, 5, 10);
    await renderWithProviders(<WeekView program={program} today={MONDAY} onAddSession={jest.fn()} onCreate={jest.fn()} />);
    const ids = screen.getAllByTestId(/^week-\d$/).map((n) => n.props.testID);
    expect(ids).toEqual(['week-1', 'week-2', 'week-3', 'week-4', 'week-5', 'week-6', 'week-0']);
    expect(screen.getByText('FULL BODY')).toBeTruthy();
    expect(screen.getByText('2 exercices')).toBeTruthy();
    expect(screen.getByTestId('today-badge')).toBeTruthy();
    expect(screen.getAllByText('Repos').length).toBe(5);
  });

  it('sans programme : message + créer', async () => {
    const onCreate = jest.fn();
    await renderWithProviders(<WeekView program={null} today={new Date()} onAddSession={jest.fn()} onCreate={onCreate} />);
    expect(screen.getByText('Aucun programme actif.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER MON PROGRAMME' }));
    expect(onCreate).toHaveBeenCalled();
  });
});

describe('ProgramsView', () => {
  it('cartes, badge Actif, actions', async () => {
    const handlers = { onActivate: jest.fn(), onEdit: jest.fn(), onDuplicate: jest.fn(), onDelete: jest.fn(), onCreate: jest.fn() };
    await renderWithProviders(<ProgramsView programs={[stored('a', 'PROG A'), stored('b', 'PROG B')]} activeId="a" {...handlers} />);
    expect(screen.getByText('Actif')).toBeTruthy();
    expect(screen.getAllByText('2 jours · 3 exercices').length).toBe(2);
    await fireEvent.press(screen.getByTestId('program-b'));
    expect(handlers.onActivate).toHaveBeenCalledWith('b');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Modifier' })[1]);
    expect(handlers.onEdit).toHaveBeenCalledWith('b');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Dupliquer' })[0]);
    expect(handlers.onDuplicate).toHaveBeenCalledWith('a');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Supprimer' })[0]);
    expect(handlers.onDelete).toHaveBeenCalledWith('a');
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER UN NOUVEAU PROGRAMME' }));
    expect(handlers.onCreate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/plan/__tests__/planViews.test.tsx`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/features/plan/planStats.ts` :
```ts
// Résumé d'un programme pour les cartes de Plan
import type { Program } from '@/domain/program';

export function programSummary(p: Program): { days: number; exercises: number } {
  const days = Object.values(p.schedule).filter((k) => k != null && Object.hasOwn(p.sessions, k)).length;
  const exercises = Object.values(p.sessions).reduce((n, s) => n + s.exercises.length, 0);
  return { days, exercises };
}
```

`mobile/src/features/plan/WeekView.tsx` :
```tsx
// Plan · Cette semaine — lundi → dimanche, séance colorée, badge Aujourd'hui
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Program } from '@/domain/program';
import { resolveDay, WEEK_ORDER, weekdayOf } from '@/domain/schedule';
import { useI18n } from '@/i18n/I18nProvider';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  program: Program | null;
  today: Date;
  onAddSession(): void;
  onCreate(): void;
}

export function WeekView({ program, today, onAddSession, onCreate }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t, tList } = useI18n();
  const primary = [styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }];

  if (!program) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('plan_no_active')}</Text>
        <Pressable accessibilityRole="button" onPress={onCreate} style={primary}>
          <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('plan_create_program')}</Text>
        </Pressable>
      </View>
    );
  }

  const days = tList('days_short');
  const current = weekdayOf(today);
  return (
    <View style={{ gap: 8 }}>
      {WEEK_ORDER.map((weekday) => {
        const plan = resolveDay(program, weekday);
        const isRest = plan.kind === 'implicit-rest';
        const n = plan.kind === 'session' ? plan.session.exercises.length : 0;
        return (
          <View
            key={weekday}
            testID={`week-${weekday}`}
            style={[styles.row, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, opacity: isRest ? 0.55 : 1 }]}
          >
            <Text style={[styles.day, { color: colors.textDim, fontFamily: fonts.uiBold }]}>{days[weekday].toUpperCase()}</Text>
            <View style={styles.flex}>
              <Text style={{ color: plan.kind === 'session' ? accentColors(colors, plan.session.accent).text : colors.textDim, fontFamily: fonts.uiBold }}>
                {plan.kind === 'session' ? plan.session.name : t('plan_rest')}
              </Text>
              {plan.kind === 'session' ? (
                <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{`${n} ${n > 1 ? t('plan_exercises') : t('plan_exercise')}`}</Text>
              ) : null}
            </View>
            {weekday === current ? (
              <Text testID="today-badge" style={{ color: colors.gold, fontFamily: fonts.uiBold, fontSize: 11 }}>{t('plan_today_badge').toUpperCase()}</Text>
            ) : null}
          </View>
        );
      })}
      <Pressable accessibilityRole="button" onPress={onAddSession} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('plan_add_session')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  day: { width: 40, fontSize: 12, letterSpacing: 1 },
  flex: { flex: 1, gap: 2 },
  btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
});
```

`mobile/src/features/plan/ProgramCard.tsx` :
```tsx
// Carte d'un programme — tap = activer ; Modifier / Dupliquer / Supprimer
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { programSummary } from './planStats';

interface Props {
  program: StoredProgram;
  active: boolean;
  onActivate(): void;
  onEdit(): void;
  onDuplicate(): void;
  onDelete(): void;
}

export function ProgramCard({ program, active, onActivate, onEdit, onDuplicate, onDelete }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const { days, exercises } = programSummary(program.definition);
  const meta = `${days} ${days > 1 ? t('plan_days') : t('plan_day')} · ${exercises} ${exercises > 1 ? t('plan_exercises') : t('plan_exercise')}`;
  const action = (label: string, onPress: () => void, danger = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}>
      <Text style={{ color: danger ? colors.redDanger : colors.text, fontFamily: fonts.uiBold, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
  return (
    <Pressable
      testID={`program-${program.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onActivate}
      style={[styles.card, { backgroundColor: colors.bgCard, borderColor: active ? colors.borderActive : colors.border, borderRadius: radius.lg, padding: spacing.md }]}
    >
      <View style={styles.header}>
        <Text style={[styles.flex, { color: colors.text, fontFamily: fonts.uiBold, fontSize: 16 }]}>{program.definition.meta.label}</Text>
        {active ? <Text style={{ color: colors.gold, fontFamily: fonts.uiBold, fontSize: 11 }}>{t('plan_active_badge')}</Text> : null}
      </View>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{meta}</Text>
      <View style={styles.actions}>
        {action(t('plan_edit'), onEdit)}
        {action(t('plan_duplicate'), onDuplicate)}
        {action(t('plan_delete'), onDelete, true)}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 4, marginTop: 4 },
  action: { minHeight: TOUCH_MIN, paddingHorizontal: 10, justifyContent: 'center' },
});
```

`mobile/src/features/plan/ProgramsView.tsx` :
```tsx
// Plan · Mes programmes
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { ProgramCard } from './ProgramCard';

interface Props {
  programs: StoredProgram[];
  activeId: string | null;
  onActivate(id: string): void;
  onEdit(id: string): void;
  onDuplicate(id: string): void;
  onDelete(id: string): void;
  onCreate(): void;
}

export function ProgramsView({ programs, activeId, onActivate, onEdit, onDuplicate, onDelete, onCreate }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: 12 }}>
      {programs.length === 0 ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('plan_no_programs')}</Text> : null}
      {programs.map((p) => (
        <ProgramCard
          key={p.id}
          program={p}
          active={p.id === activeId}
          onActivate={() => onActivate(p.id)}
          onEdit={() => onEdit(p.id)}
          onDuplicate={() => onDuplicate(p.id)}
          onDelete={() => onDelete(p.id)}
        />
      ))}
      <Pressable accessibilityRole="button" onPress={onCreate} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
        <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('plan_create_new')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({ btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' } });
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/plan && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/plan
git commit -m "feat(mobile): add Plan week view and programs list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Écran Plan (onglets animés, bannière de brouillon, ouverture de l'éditeur)

**Files:**
- Create: `mobile/src/features/editor/nav.ts`, `mobile/src/features/editor/openEditor.ts`, `mobile/src/features/plan/PlanTabs.tsx`, `mobile/src/features/plan/DraftBanner.tsx`, `mobile/src/features/plan/PlanScreen.tsx`, `mobile/src/features/plan/__tests__/PlanScreen.test.tsx`, `mobile/src/features/editor/__tests__/openEditor.test.ts`
- Modify: `mobile/src/app/(tabs)/plan.tsx`

**Interfaces:**
- Consumes: `useDraftStore`, `newDraft`, `draftFromProgram`, `getProgram`, `listPrograms`, `getActiveProgram`, `setActiveProgram`, `duplicateProgram`, `softDeleteProgram`, `confirm`, `useToastStore`, `useEntitlements`.
- Produces:
  - `type EditorStep = 1 | 2 | 3`
  - `interface EditorNav { goToStep(step: EditorStep): void; openSession(key: string): void; closeSession(): void; finish(): void }`
  - `type EditorTarget = { kind: 'new' } | { kind: 'edit'; programId: string }`
  - `sameTarget(d: Draft, target: EditorTarget): boolean`
  - `prepareEditor(ctx: RepoCtx, target: EditorTarget, confirmReplace: () => Promise<boolean>): Promise<boolean>`
  - `<PlanTabs value: 'week' | 'programs'; onChange(v): void />`
  - `<DraftBanner label: string; onResume(): void; onDiscard(): void />`
  - `<PlanScreen onOpenEditor(step: EditorStep): void />`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/editor/__tests__/openEditor.test.ts` :
```ts
/** @jest-environment node */
import example from '@/data/program.example.json';
import { createProgram } from '@/db/repos/programsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { setMeta } from '@/domain/draft';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { prepareEditor } from '../openEditor';

describe('prepareEditor', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('nouveau programme : brouillon vide', async () => {
    const ctx = createTestCtx();
    expect(await prepareEditor(ctx, { kind: 'new' }, jest.fn())).toBe(true);
    expect(useDraftStore.getState().draft?.sourceProgramId).toBeNull();
  });

  it('modifier : copie du programme ; même cible → reprise sans confirmation', async () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    const ask = jest.fn();
    await prepareEditor(ctx, { kind: 'edit', programId: p.id }, ask);
    useDraftStore.getState().apply(ctx, (d) => setMeta(d, { label: 'EN COURS' }));
    expect(await prepareEditor(ctx, { kind: 'edit', programId: p.id }, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
    expect(useDraftStore.getState().draft?.program.meta.label).toBe('EN COURS');
  });

  it('autre cible : confirmation ; refus → brouillon conservé', async () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    await prepareEditor(ctx, { kind: 'new' }, jest.fn());
    useDraftStore.getState().apply(ctx, (d) => setMeta(d, { label: 'NEUF' }));
    expect(await prepareEditor(ctx, { kind: 'edit', programId: p.id }, async () => false)).toBe(false);
    expect(useDraftStore.getState().draft?.program.meta.label).toBe('NEUF');
    expect(await prepareEditor(ctx, { kind: 'edit', programId: p.id }, async () => true)).toBe(true);
    expect(useDraftStore.getState().draft?.sourceProgramId).toBe(p.id);
  });

  it('programme introuvable → false', async () => {
    expect(await prepareEditor(createTestCtx(), { kind: 'edit', programId: 'nope' }, jest.fn())).toBe(false);
  });
});
```

`mobile/src/features/plan/__tests__/PlanScreen.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { createProgram, getActiveProgram, listPrograms, setActiveProgram } from '@/db/repos/programsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { newDraft, setMeta } from '@/domain/draft';
import { confirm } from '@/platform/confirm';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TOAST_INITIAL, useToastStore } from '@/state/toastStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { PlanScreen } from '../PlanScreen';

async function setup() {
  const ctx = createTestCtx();
  const a = createProgram(ctx, example, 'example');
  const b = createProgram(ctx, { ...example, meta: { ...example.meta, label: 'PROG B' } }, 'manual');
  setActiveProgram(ctx, a.id);
  const onOpenEditor = jest.fn();
  await renderWithProviders(<PlanScreen onOpenEditor={onOpenEditor} />, { ctx });
  return { ctx, a, b, onOpenEditor };
}

describe('PlanScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useDraftStore.setState(DRAFT_INITIAL); useToastStore.setState(TOAST_INITIAL); });
  });

  it('semaine du programme actif par défaut ; « Ajouter une séance » ouvre l\'éditeur à l\'étape 2', async () => {
    const { a, onOpenEditor } = await setup();
    expect(screen.getByTestId('week-1')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UNE SÉANCE' }));
    expect(onOpenEditor).toHaveBeenCalledWith(2);
    expect(useDraftStore.getState().draft?.sourceProgramId).toBe(a.id);
  });

  it('Mes programmes : activer, dupliquer, supprimer (confirmé)', async () => {
    const { ctx, b } = await setup();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mes programmes' }));
    await fireEvent.press(screen.getByTestId(`program-${b.id}`));
    expect(getActiveProgram(ctx)?.id).toBe(b.id);
    expect(useToastStore.getState().message).toBe('Programme activé ✓');

    await fireEvent.press(screen.getAllByRole('button', { name: 'Dupliquer' })[0]);
    expect(screen.getByText('PROGRAMME SALLE (copie)')).toBeTruthy();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Supprimer' })[0]);
    expect(confirm).toHaveBeenCalled();
    expect(listPrograms(ctx).map((p) => p.definition.meta.label)).toEqual(['PROG B', 'PROGRAMME SALLE (copie)']);
  });

  it('suppression refusée : rien ne change', async () => {
    const { ctx } = await setup();
    jest.mocked(confirm).mockResolvedValueOnce(false);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mes programmes' }));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Supprimer' })[0]);
    expect(listPrograms(ctx)).toHaveLength(2);
  });

  it('bannière de brouillon : reprendre ouvre l\'étape 1, abandonner l\'efface', async () => {
    const { ctx, onOpenEditor } = await setup();
    await act(async () => { useDraftStore.getState().start(ctx, setMeta(newDraft(), { label: 'BROUILLON' })); });
    expect(screen.getByText('Brouillon en cours : BROUILLON')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reprendre' }));
    expect(onOpenEditor).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Abandonner' }));
    expect(useDraftStore.getState().draft).toBeNull();
  });

  it('brouillon illisible signalé une fois', async () => {
    await act(async () => { useDraftStore.setState({ draft: null, lost: true }); });
    await setup();
    expect(useToastStore.getState().message).toBe('Brouillon illisible : il a été supprimé.');
    expect(useDraftStore.getState().lost).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/plan src/features/editor`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/features/editor/nav.ts` :
```ts
// Navigation de l'éditeur — fournie par les routes (Expo Router) ou par les tests
export type EditorStep = 1 | 2 | 3;

export interface EditorNav {
  goToStep(step: EditorStep): void;
  openSession(key: string): void;
  closeSession(): void;
  /** Sortie de l'éditeur (après enregistrement ou annulation) → Plan */
  finish(): void;
}
```

`mobile/src/features/editor/openEditor.ts` :
```ts
// Ouverture de l'éditeur : reprise du brouillon ou nouveau brouillon (confirmation si une autre cible)
import { getProgram } from '@/db/repos/programsRepo';
import type { RepoCtx } from '@/db/types';
import { draftFromProgram, newDraft, type Draft } from '@/domain/draft';
import { useDraftStore } from '@/state/draftStore';

export type EditorTarget = { kind: 'new' } | { kind: 'edit'; programId: string };

export function sameTarget(d: Draft, target: EditorTarget): boolean {
  return target.kind === 'new' ? d.sourceProgramId === null : d.sourceProgramId === target.programId;
}

export async function prepareEditor(ctx: RepoCtx, target: EditorTarget, confirmReplace: () => Promise<boolean>): Promise<boolean> {
  const store = useDraftStore.getState();
  const current = store.draft;
  if (current && sameTarget(current, target)) return true;
  const program = target.kind === 'edit' ? getProgram(ctx, target.programId) : null;
  if (target.kind === 'edit' && !program) return false;
  if (current && !(await confirmReplace())) return false;
  store.start(ctx, program ? draftFromProgram(program.id, program.definition) : newDraft());
  return true;
}
```

`mobile/src/features/plan/PlanTabs.tsx` :
```tsx
// Onglets segmentés « Cette semaine » / « Mes programmes » — indicateur glissant (< 250 ms)
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

export type PlanTab = 'week' | 'programs';

export function PlanTabs({ value, onChange }: { value: PlanTab; onChange(v: PlanTab): void }) {
  const { colors, fonts, radius, duration } = useTheme();
  const { t } = useI18n();
  const [width, setWidth] = useState(0);
  const half = (width - 8) / 2;
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(value === 'week' ? 0 : half, { duration: duration.normal }) }],
  }));
  const tab = (key: PlanTab, label: string) => (
    <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: value === key }} onPress={() => onChange(key)} style={styles.tab}>
      <Text style={{ color: value === key ? '#0a0a0a' : colors.text, fontFamily: fonts.uiBold }}>{label}</Text>
    </Pressable>
  );
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[styles.row, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
      {width > 0 ? <Animated.View style={[styles.thumb, { width: half, backgroundColor: colors.gold, borderRadius: radius.md }, thumb]} /> : null}
      {tab('week', t('plan_this_week'))}
      {tab('programs', t('plan_my_programs'))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4 },
  thumb: { position: 'absolute', top: 4, bottom: 4, left: 4 },
  tab: { flex: 1, minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
```

`mobile/src/features/plan/DraftBanner.tsx` :
```tsx
// Bannière « Brouillon en cours » — reprendre ou abandonner
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

export function DraftBanner({ label, onResume, onDiscard }: { label: string; onResume(): void; onDiscard(): void }) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const btn = [styles.btn, { borderColor: colors.gold, borderRadius: radius.md }];
  return (
    <View style={{ gap: 10, borderColor: colors.gold, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.bgCard }}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('editor_draft_banner', label || t('editor_no_name'))}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onResume} style={btn}>
          <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('editor_draft_resume')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDiscard} style={btn}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('editor_discard')}</Text>
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

`mobile/src/features/plan/PlanScreen.tsx` :
```tsx
// ============================================================
// PLAN — Cette semaine / Mes programmes, bannière de brouillon.
// Les écritures (activer, dupliquer, supprimer) passent par programsRepo.
// ============================================================
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { useRepoCtx } from '@/db/DbContext';
import { duplicateProgram, getActiveProgram, listPrograms, setActiveProgram, softDeleteProgram } from '@/db/repos/programsRepo';
import type { RepoCtx } from '@/db/types';
import { Screen } from '@/features/common/Screen';
import { useDbQuery } from '@/features/common/useDbQuery';
import type { EditorStep } from '@/features/editor/nav';
import { prepareEditor, type EditorTarget } from '@/features/editor/openEditor';
import { useI18n } from '@/i18n/I18nProvider';
import { confirm } from '@/platform/confirm';
import { useDraftStore } from '@/state/draftStore';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { DraftBanner } from './DraftBanner';
import { PlanTabs, type PlanTab } from './PlanTabs';
import { ProgramsView } from './ProgramsView';
import { WeekView } from './WeekView';

const readPlan = (ctx: RepoCtx) => ({ programs: listPrograms(ctx), active: getActiveProgram(ctx) });

/** Écriture + rafraîchissement ; false et toast d'erreur si elle échoue (fonction de module : compatible React Compiler) */
function attempt(write: () => void, errorMessage: string): boolean {
  try {
    write();
    return true;
  } catch {
    useToastStore.getState().show(errorMessage);
    return false;
  } finally {
    usePrefs.getState().bumpData();
  }
}

export function PlanScreen({ onOpenEditor }: { onOpenEditor(step: EditorStep): void }) {
  const ctx = useRepoCtx();
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const { programs, active } = useDbQuery(readPlan);
  const draft = useDraftStore((s) => s.draft);
  const lost = useDraftStore((s) => s.lost);
  const [tab, setTab] = useState<PlanTab>('week');

  useEffect(() => {
    if (!lost) return;
    useToastStore.getState().show(t('editor_draft_lost'));
    useDraftStore.getState().ackLost();
  }, [lost, t]);

  const open = async (target: EditorTarget, step: EditorStep) => {
    const ok = await prepareEditor(ctx, target, () =>
      confirm({ title: t('editor_replace_draft_title'), confirmLabel: t('editor_discard'), cancelLabel: t('editor_keep'), destructive: true }));
    if (ok) onOpenEditor(step);
  };
  const activate = (id: string) => {
    if (attempt(() => setActiveProgram(ctx, id), t('error_not_saved'))) useToastStore.getState().show(t('plan_activated'));
  };
  const duplicate = (id: string) => {
    if (attempt(() => { duplicateProgram(ctx, id, t('editor_copy_suffix')); }, t('error_not_saved'))) useToastStore.getState().show(t('plan_duplicated'));
  };
  const remove = async (id: string) => {
    const label = programs.find((p) => p.id === id)?.definition.meta.label ?? '';
    const ok = await confirm({ title: t('plan_delete'), message: t('plan_confirm_delete', label), confirmLabel: t('plan_delete'), cancelLabel: t('editor_cancel'), destructive: true });
    if (!ok) return;
    if (attempt(() => softDeleteProgram(ctx, id), t('error_not_saved'))) useToastStore.getState().show(t('plan_deleted'));
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('plan_title')}</Text>
      {draft ? (
        <DraftBanner
          label={draft.program.meta.label}
          onResume={() => onOpenEditor(1)}
          onDiscard={() => useDraftStore.getState().discard(ctx)}
        />
      ) : null}
      <PlanTabs value={tab} onChange={setTab} />
      <Animated.View key={tab} entering={(tab === 'programs' ? SlideInRight : SlideInLeft).duration(220)}>
        {tab === 'week' ? (
          <WeekView
            program={active?.definition ?? null}
            today={new Date()}
            onAddSession={() => { if (active) void open({ kind: 'edit', programId: active.id }, 2); }}
            onCreate={() => void open({ kind: 'new' }, 1)}
          />
        ) : (
          <ProgramsView
            programs={programs}
            activeId={active?.id ?? null}
            onActivate={activate}
            onEdit={(id) => void open({ kind: 'edit', programId: id }, 1)}
            onDuplicate={duplicate}
            onDelete={(id) => void remove(id)}
            onCreate={() => void open({ kind: 'new' }, 1)}
          />
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { fontSize: 44, letterSpacing: -0.5 } });
```
Les animations de mise en page Reanimated respectent « réduire les animations » par défaut (`ReduceMotion.System`).

`mobile/src/app/(tabs)/plan.tsx` :
```tsx
// Route Plan — ErrorBoundary + ouverture de l'éditeur (pile plein écran)
import { router } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { PlanScreen } from '@/features/plan/PlanScreen';

const STEP_ROUTES = { 1: '/editor', 2: '/editor/sessions', 3: '/editor/schedule' } as const;

export default function PlanRoute() {
  return (
    <TabErrorBoundary>
      <PlanScreen onOpenEditor={(step) => router.push(STEP_ROUTES[step])} />
    </TabErrorBoundary>
  );
}
```
Les routes `/editor…` n'existent qu'à la Task 11 : si `tsc` (routes typées) refuse ces chaînes à ce stade, n'exécuter `npx tsc --noEmit` qu'après la Task 11, ou caster temporairement `as Href` — consigner la décision.

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/plan src/features/editor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/plan src/features/editor src/app/\(tabs\)/plan.tsx
git commit -m "feat(mobile): add Plan screen with animated tabs, draft banner and editor entry points

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Enregistrer / annuler, en-tête de l'éditeur, pile de routes

**Files:**
- Create: `mobile/src/features/editor/saveDraft.ts`, `mobile/src/features/editor/errorMessage.ts`, `mobile/src/features/editor/useEditorActions.ts`, `mobile/src/features/editor/EditorHeader.tsx`, `mobile/src/features/editor/SaveErrorsSheet.tsx`, `mobile/src/features/editor/useRouterNav.ts`, `mobile/src/app/editor/_layout.tsx`, `mobile/src/features/editor/__tests__/saveDraft.test.ts`, `mobile/src/features/editor/__tests__/EditorHeader.test.tsx`
- Modify: `mobile/src/app/_layout.tsx` (écrans de la pile racine)

**Interfaces:**
- Consumes: `validateDraft`, `DraftError`, `createProgram`, `updateProgram`, `getProgram`, `setActiveProgram`, `useDraftStore`, `confirm`, `useToastStore`, `EditorNav`.
- Produces:
  - `type SaveResult = { ok: true; programId: string } | { ok: false; errors: DraftError[] }`
  - `saveDraft(ctx: RepoCtx, draft: Draft): SaveResult`
  - `errorMessage(t: (key: StringKey, ...a: (string | number)[]) => string, e: DraftError, sessionName?: string): string`
  - `useEditorActions(nav: EditorNav): { save(): void; cancel(): Promise<void>; errors: DraftError[] | null; dismissErrors(): void; goToError(e: DraftError): void }`
  - `<EditorHeader step?: EditorStep; onCancel(): void; onSave(): void />`
  - `<SaveErrorsSheet errors: DraftError[] | null; sessionName(key: string): string; onSelect(e: DraftError): void; onClose(): void />`
  - `useRouterNav(): EditorNav`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/editor/__tests__/saveDraft.test.ts` :
```ts
/** @jest-environment node */
import example from '@/data/program.example.json';
import { createProgram, getActiveProgram, getProgram, listPrograms, setActiveProgram, softDeleteProgram } from '@/db/repos/programsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { addSession, draftFromProgram, newDraft, setMeta, setSchedule, updateSession } from '@/domain/draft';
import { saveDraft } from '../saveDraft';

function validNew() {
  const { draft, key } = addSession(setMeta(newDraft(), { label: 'NEUF' }), 'lift', () => 'aaaa');
  return setSchedule(updateSession(draft, key, { name: 'FULL' }), 1, key);
}

describe('saveDraft', () => {
  it('brouillon invalide : rien n\'est écrit', () => {
    const ctx = createTestCtx();
    const r = saveDraft(ctx, newDraft());
    expect(r.ok).toBe(false);
    expect(listPrograms(ctx)).toEqual([]);
  });

  it('nouveau programme : créé (source manual) et activé', () => {
    const ctx = createTestCtx();
    const r = saveDraft(ctx, validNew());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(getProgram(ctx, r.programId)).toMatchObject({ source: 'manual', definition: { meta: { label: 'NEUF' } } });
      expect(getActiveProgram(ctx)?.id).toBe(r.programId);
    }
  });

  it('programme existant : mis à jour, programme actif inchangé', () => {
    const ctx = createTestCtx();
    const a = createProgram(ctx, example, 'example');
    const b = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, a.id);
    const r = saveDraft(ctx, setMeta(draftFromProgram(b.id, b.definition), { label: 'B2' }));
    expect(r).toEqual({ ok: true, programId: b.id });
    expect(getProgram(ctx, b.id)?.definition.meta.label).toBe('B2');
    expect(getActiveProgram(ctx)?.id).toBe(a.id);
  });

  it('Review Focus 3 : programme source supprimé entre-temps → enregistré comme nouveau et activé', () => {
    const ctx = createTestCtx();
    const a = createProgram(ctx, example, 'example');
    const draft = setMeta(draftFromProgram(a.id, a.definition), { label: 'SURVIVANT' });
    softDeleteProgram(ctx, a.id);
    const r = saveDraft(ctx, draft);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.programId).not.toBe(a.id);
      expect(getActiveProgram(ctx)?.definition.meta.label).toBe('SURVIVANT');
    }
  });
});
```

`mobile/src/features/editor/__tests__/EditorHeader.test.tsx` :
```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { EditorHeader } from '../EditorHeader';
import { SaveErrorsSheet } from '../SaveErrorsSheet';

describe('EditorHeader', () => {
  it('étape, annuler, enregistrer', async () => {
    const onCancel = jest.fn();
    const onSave = jest.fn();
    await renderWithProviders(<EditorHeader step={2} onCancel={onCancel} onSave={onSave} />);
    expect(screen.getByText('Étape 2 / 3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });
});

describe('SaveErrorsSheet', () => {
  it('liste les erreurs traduites ; un tap ouvre l\'étape concernée', async () => {
    const onSelect = jest.fn();
    await renderWithProviders(
      <SaveErrorsSheet
        errors={[{ step: 1, code: 'name_required' }, { step: 4, code: 'session_name_required', sessionKey: 's1' }]}
        sessionName={() => 'Sans nom'}
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText("Impossible d'enregistrer")).toBeTruthy();
    expect(screen.getByText('Le nom du programme est requis.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Chaque séance doit avoir un nom.'));
    expect(onSelect).toHaveBeenCalledWith({ step: 4, code: 'session_name_required', sessionKey: 's1' });
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/editor`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/features/editor/saveDraft.ts` :
```ts
// Enregistrement du brouillon : validation puis création (et activation) ou mise à jour
import { createProgram, getProgram, setActiveProgram, updateProgram } from '@/db/repos/programsRepo';
import type { RepoCtx } from '@/db/types';
import type { Draft } from '@/domain/draft';
import { validateDraft, type DraftError } from '@/domain/programRules';

export type SaveResult = { ok: true; programId: string } | { ok: false; errors: DraftError[] };

export function saveDraft(ctx: RepoCtx, draft: Draft): SaveResult {
  const v = validateDraft(draft);
  if (!v.ok) return v;
  const existing = draft.sourceProgramId ? getProgram(ctx, draft.sourceProgramId) : null;
  if (existing) {
    updateProgram(ctx, existing.id, v.program);
    return { ok: true, programId: existing.id };
  }
  const created = createProgram(ctx, v.program, 'manual');
  setActiveProgram(ctx, created.id);
  return { ok: true, programId: created.id };
}
```

`mobile/src/features/editor/errorMessage.ts` :
```ts
// Erreur de brouillon → message affichable
import type { DraftError } from '@/domain/programRules';
import type { StringKey } from '@/i18n/translate';

type T = (key: StringKey, ...args: (string | number)[]) => string;

const KEYS: Record<Exclude<DraftError['code'], 'schema'>, StringKey> = {
  name_required: 'editor_err_name',
  no_session: 'editor_err_session',
  no_schedule: 'editor_err_schedule',
  session_name_required: 'editor_err_session_name',
};

export function errorMessage(t: T, e: DraftError, sessionName?: string): string {
  if (e.code === 'schema') return sessionName ? `${sessionName} — ${e.detail ?? ''}` : e.detail ?? '';
  return t(KEYS[e.code]);
}
```

`mobile/src/features/editor/useEditorActions.ts` :
```ts
// Enregistrer / annuler depuis n'importe quelle étape
import { useState } from 'react';
import { useRepoCtx } from '@/db/DbContext';
import type { DraftError } from '@/domain/programRules';
import { useI18n } from '@/i18n/I18nProvider';
import { confirm } from '@/platform/confirm';
import { useDraftStore } from '@/state/draftStore';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import type { EditorNav } from './nav';
import { saveDraft, type SaveResult } from './saveDraft';

/** Hors composant : un try/catch ici n'empêche pas le React Compiler d'optimiser les écrans */
function trySave(run: () => SaveResult): SaveResult | null {
  try {
    return run();
  } catch {
    return null;
  }
}

export function useEditorActions(nav: EditorNav) {
  const ctx = useRepoCtx();
  const { t } = useI18n();
  const [errors, setErrors] = useState<DraftError[] | null>(null);

  const save = () => {
    const draft = useDraftStore.getState().draft;
    if (!draft) return;
    const result = trySave(() => saveDraft(ctx, draft));
    if (!result) {
      useToastStore.getState().show(t('error_not_saved'));
      return;
    }
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    // La disparition du brouillon fait sortir de l'éditeur (EditorScreen appelle nav.finish une seule fois)
    useDraftStore.getState().discard(ctx);
    usePrefs.getState().bumpData();
    useToastStore.getState().show(t('editor_saved'));
  };

  const cancel = async () => {
    const ok = await confirm({ title: t('editor_cancel_title'), message: t('editor_cancel_body'), confirmLabel: t('editor_discard'), cancelLabel: t('editor_keep'), destructive: true });
    if (!ok) return;
    useDraftStore.getState().discard(ctx);
  };

  const goToError = (e: DraftError) => {
    setErrors(null);
    if (e.step === 4 && e.sessionKey) nav.openSession(e.sessionKey);
    else nav.goToStep(e.step === 4 ? 2 : e.step);
  };

  return { save, cancel, errors, dismissErrors: () => setErrors(null), goToError };
}
```

`mobile/src/features/editor/EditorHeader.tsx` :
```tsx
// En-tête de l'éditeur : Annuler · Étape N / 3 · Enregistrer
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import type { EditorStep } from './nav';

export function EditorHeader({ step, onCancel, onSave }: { step?: EditorStep; onCancel(): void; onSave(): void }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={styles.btn}>
        <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('editor_cancel')}</Text>
      </Pressable>
      <Text style={{ color: colors.textDim, fontFamily: fonts.uiMedium }}>{step ? `${t('editor_step')} ${step} ${t('editor_step_of')} 3` : ''}</Text>
      <Pressable accessibilityRole="button" onPress={onSave} style={styles.btn}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('editor_save')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: { minHeight: TOUCH_MIN, minWidth: TOUCH_MIN, justifyContent: 'center' },
});
```

`mobile/src/features/editor/SaveErrorsSheet.tsx` :
```tsx
// Erreurs d'enregistrement — chacune ramène à l'étape concernée
import { Pressable, StyleSheet, Text } from 'react-native';
import type { DraftError } from '@/domain/programRules';
import { BottomSheet } from '@/features/common/BottomSheet';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { errorMessage } from './errorMessage';

interface Props {
  errors: DraftError[] | null;
  sessionName(key: string): string;
  onSelect(e: DraftError): void;
  onClose(): void;
}

export function SaveErrorsSheet({ errors, sessionName, onSelect, onClose }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  if (!errors) return null;
  return (
    <BottomSheet visible title={t('editor_errors_title')} onClose={onClose}>
      {errors.map((e, i) => (
        <Pressable key={i} accessibilityRole="button" onPress={() => onSelect(e)} style={[styles.item, { borderColor: colors.redDanger, borderRadius: radius.md }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{errorMessage(t, e, e.sessionKey ? sessionName(e.sessionKey) : undefined)}</Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ item: { minHeight: TOUCH_MIN, borderWidth: 1, padding: 12, justifyContent: 'center' } });
```

`mobile/src/features/editor/useRouterNav.ts` :
```ts
// Navigation réelle de l'éditeur (Expo Router)
import { router } from 'expo-router';
import type { EditorNav, EditorStep } from './nav';

const STEP_ROUTES = { 1: '/editor', 2: '/editor/sessions', 3: '/editor/schedule' } as const;

export function useRouterNav(): EditorNav {
  return {
    goToStep: (step: EditorStep) => router.navigate(STEP_ROUTES[step]),
    openSession: (key) => router.push({ pathname: '/editor/session/[key]', params: { key } }),
    closeSession: () => router.back(),
    finish: () => router.dismissTo('/plan'),
  };
}
```
`router.dismissTo` est disponible dans expo-router 57 (`global-state/routing.d.ts`).

`mobile/src/app/editor/_layout.tsx` :
```tsx
// Pile de l'éditeur (ouverte en plein écran par-dessus les onglets)
import { Stack } from 'expo-router';
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { useTheme } from '@/theme/ThemeProvider';

export default function EditorLayout() {
  const { colors } = useTheme();
  return (
    <TabErrorBoundary>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </TabErrorBoundary>
  );
}
```

`mobile/src/app/_layout.tsx` (`ThemedStack`) : déclarer les écrans de la pile racine :
```tsx
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="editor" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/editor`
Expected: PASS. (`tsc` est vérifié en Task 12, une fois les routes d'étapes créées et les types de routes régénérés.)

- [ ] **Step 5: Commit**

```bash
git add src/features/editor src/app/editor/_layout.tsx src/app/_layout.tsx
git commit -m "feat(mobile): add draft save/cancel actions, editor header and editor stack

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Étape 1 — programme (`MetaStep`) + routes d'étapes

**Files:**
- Create: `mobile/src/features/editor/EditorScreen.tsx`, `mobile/src/features/editor/MetaStep.tsx`, `mobile/src/app/editor/index.tsx`, `mobile/src/features/editor/__tests__/MetaStep.test.tsx`

**Interfaces:**
- Consumes: `useDraftStore`, `setMeta`, `setRules`, `useEditorActions`, `EditorHeader`, `SaveErrorsSheet`, `NumberStepper`, `ListEditor`, `Segmented` (`@/features/profile/Segmented`).
- Produces:
  - `<EditorScreen nav: EditorNav; step?: EditorStep; children: ReactNode | ((actions: { save(): void }) => ReactNode) />` (Screen + en-tête + feuille d'erreurs **unique** ; `save` exposé aux enfants ; si aucun brouillon → `nav.finish()`, une seule fois)
  - `<MetaStep nav: EditorNav />`

- [ ] **Step 1: Écrire le test**

`mobile/src/features/editor/__tests__/MetaStep.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { newDraft } from '@/domain/draft';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { MetaStep } from '../MetaStep';

const nav = () => ({ goToStep: jest.fn(), openSession: jest.fn(), closeSession: jest.fn(), finish: jest.fn() });

describe('MetaStep', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('nom, unité, repos par défaut, règles → brouillon ; Suivant → étape 2', async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, newDraft()); });
    const n = nav();
    await renderWithProviders(<MetaStep nav={n} />, { ctx });
    expect(screen.getByText('Étape 1 / 3')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('meta-label'), 'MON PROGRAMME');
    await fireEvent.press(screen.getByRole('button', { name: 'LBS' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Augmenter Repos par défaut (sec)' }));
    await fireEvent.press(screen.getByTestId('rules-add'));
    await fireEvent.changeText(screen.getByTestId('rules-0'), 'Technique avant tout');
    expect(useDraftStore.getState().draft?.program).toMatchObject({
      meta: { label: 'MON PROGRAMME', units: 'lbs', restDefaultSec: 105 },
      rules: ['Technique avant tout'],
    });
    await fireEvent.press(screen.getByRole('button', { name: 'SUIVANT' }));
    expect(n.goToStep).toHaveBeenCalledWith(2);
  });

  it('sans brouillon : sortie de l\'éditeur', async () => {
    const n = nav();
    await renderWithProviders(<MetaStep nav={n} />, { ctx: createTestCtx() });
    expect(n.finish).toHaveBeenCalled();
  });

  it('Enregistrer un brouillon vide affiche les erreurs ; un tap ramène à l\'étape', async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, newDraft()); });
    const n = nav();
    await renderWithProviders(<MetaStep nav={n} />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await fireEvent.press(screen.getByText('Au moins une séance est requise.'));
    expect(n.goToStep).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/editor/__tests__/MetaStep.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/editor/EditorScreen.tsx` :
```tsx
// Cadre commun d'une étape de l'éditeur : écran, en-tête, erreurs d'enregistrement
import { useEffect, type ReactNode } from 'react';
import { Screen } from '@/features/common/Screen';
import { useI18n } from '@/i18n/I18nProvider';
import { useDraftStore } from '@/state/draftStore';
import { EditorHeader } from './EditorHeader';
import type { EditorNav, EditorStep } from './nav';
import { SaveErrorsSheet } from './SaveErrorsSheet';
import { useEditorActions } from './useEditorActions';

type Children = ReactNode | ((actions: { save(): void }) => ReactNode);

export function EditorScreen({ nav, step, children }: { nav: EditorNav; step?: EditorStep; children: Children }) {
  const { t } = useI18n();
  const draft = useDraftStore((s) => s.draft);
  const { save, cancel, errors, dismissErrors, goToError } = useEditorActions(nav);
  const { finish } = nav;

  // Plus de brouillon (enregistré, annulé ou absent) → sortie de l'éditeur
  useEffect(() => {
    if (!draft) finish();
  }, [draft, finish]);

  if (!draft) return null;
  const sessionName = (key: string) => draft.program.sessions[key]?.name || t('editor_no_name');
  return (
    <Screen>
      <EditorHeader step={step} onCancel={() => void cancel()} onSave={save} />
      {typeof children === 'function' ? children({ save }) : children}
      <SaveErrorsSheet errors={errors} sessionName={sessionName} onSelect={goToError} onClose={dismissErrors} />
    </Screen>
  );
}
```
`nav` doit avoir des fonctions **stables** (l'effet dépend de `finish`) : `useRouterNav` renvoie des fonctions de module (Task 11), et les tests créent `nav` une fois par rendu de test.

`mobile/src/features/editor/MetaStep.tsx` :
```tsx
// Étape 1 — programme : nom, unité, repos par défaut, règles
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { setMeta, setRules } from '@/domain/draft';
import type { Units } from '@/domain/program';
import { ListEditor } from '@/features/common/ListEditor';
import { NumberStepper } from '@/features/common/NumberStepper';
import { Segmented } from '@/features/profile/Segmented';
import { useI18n } from '@/i18n/I18nProvider';
import { useDraftStore } from '@/state/draftStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { EditorScreen } from './EditorScreen';
import type { EditorNav } from './nav';

export function MetaStep({ nav }: { nav: EditorNav }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const program = useDraftStore((s) => s.draft?.program);
  const apply = useDraftStore((s) => s.apply);
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };

  return (
    <EditorScreen nav={nav} step={1}>
      {program ? (
        <View style={styles.root}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('editor_step1_title').toUpperCase()}</Text>
          <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('editor_step1_sub')}</Text>
          <Text style={label}>{t('editor_prog_name_label').toUpperCase()}</Text>
          <TextInput
            testID="meta-label"
            value={program.meta.label}
            maxLength={100}
            placeholder={t('editor_prog_name_ph')}
            placeholderTextColor={colors.textDim}
            onChangeText={(v) => apply(ctx, (d) => setMeta(d, { label: v }))}
            style={[styles.input, { color: colors.text, fontFamily: fonts.uiBold, borderColor: colors.border, borderRadius: radius.sm }]}
          />
          <Text style={label}>{t('editor_prog_units_label').toUpperCase()}</Text>
          <Segmented<Units>
            options={[{ value: 'kg', label: 'KG' }, { value: 'lbs', label: 'LBS' }]}
            value={program.meta.units}
            onChange={(v) => apply(ctx, (d) => setMeta(d, { units: v }))}
          />
          <Text style={label}>{t('editor_rest_default_label').toUpperCase()}</Text>
          <NumberStepper
            value={program.meta.restDefaultSec}
            min={10}
            max={600}
            step={15}
            label={t('editor_rest_default_label')}
            onChange={(v) => apply(ctx, (d) => setMeta(d, { restDefaultSec: v }))}
          />
          <Text style={label}>{t('editor_rules_section').toUpperCase()}</Text>
          <ListEditor
            items={program.rules}
            onChange={(rules) => apply(ctx, (d) => setRules(d, rules))}
            placeholder={t('editor_rule_ph')}
            addLabel={t('editor_add_rule')}
            maxItems={20}
            maxLength={200}
            testID="rules"
          />
          <Pressable accessibilityRole="button" onPress={() => nav.goToStep(2)} style={[styles.next, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
            <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('step_next')}</Text>
          </Pressable>
        </View>
      ) : null}
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  title: { fontSize: 36, letterSpacing: -0.5 },
  input: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
  next: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
```
Le pas de 15 depuis 90 donne 105 (test). Note : `step_next` vaut `SUIVANT`.

`mobile/src/app/editor/index.tsx` :
```tsx
// Route éditeur · étape 1
import { MetaStep } from '@/features/editor/MetaStep';
import { useRouterNav } from '@/features/editor/useRouterNav';

export default function EditorMetaRoute() {
  return <MetaStep nav={useRouterNav()} />;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/editor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor src/app/editor/index.tsx
git commit -m "feat(mobile): add editor step 1 (program name, units, default rest, rules)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Étape 2 — séances (`SessionCard`, `SessionsStep`)

**Files:**
- Create: `mobile/src/features/editor/SessionCard.tsx`, `mobile/src/features/editor/SessionsStep.tsx`, `mobile/src/app/editor/sessions.tsx`, `mobile/src/features/editor/__tests__/SessionsStep.test.tsx`

**Interfaces:**
- Consumes: `addSession`, `duplicateSession`, `deleteSession`, `moveSession`, `isScheduled`, `ReorderableList` (`@/features/today/ReorderableList`), `accentColors`, `confirm`.
- Produces:
  - `<SessionCard session: Session; onEdit(); onDuplicate(); onDelete(); header?: (title) => ReactElement />` (testID `session-card-<key>` posé par l'étape)
  - `<SessionsStep nav: EditorNav />`

- [ ] **Step 1: Écrire le test**

`mobile/src/features/editor/__tests__/SessionsStep.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { draftFromProgram, newDraft } from '@/domain/draft';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '@/domain/__fixtures__/builders';
import { confirm } from '@/platform/confirm';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { SessionsStep } from '../SessionsStep';

const nav = () => ({ goToStep: jest.fn(), openSession: jest.fn(), closeSession: jest.fn(), finish: jest.fn() });
const program = parseOrThrow(makeProgramInput({ '1': 'a' }, {
  a: makeSession('HAUT', [makeExercise('dc', 3), makeExercise('row', 3)]),
  b: makeSession('BAS', [], { type: 'cardio' }),
}));

describe('SessionsStep', () => {
  beforeEach(() => { jest.clearAllMocks(); useDraftStore.setState(DRAFT_INITIAL); });

  it('liste vide puis création → ouvre l\'éditeur de séance', async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, newDraft()); });
    const n = nav();
    await renderWithProviders(<SessionsStep nav={n} />, { ctx });
    expect(screen.getByText('Aucune séance — créez-en une ci-dessous.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER UNE SÉANCE' }));
    const keys = Object.keys(useDraftStore.getState().draft!.program.sessions);
    expect(keys).toHaveLength(1);
    expect(n.openSession).toHaveBeenCalledWith(keys[0]);
  });

  it('cartes : nom, type et nombre d\'exercices ; modifier, dupliquer, supprimer (confirmé, planning nettoyé)', async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, draftFromProgram('p', program)); });
    const n = nav();
    await renderWithProviders(<SessionsStep nav={n} />, { ctx });
    expect(screen.getByText('HAUT')).toBeTruthy();
    expect(screen.getByText('Muscu · 2 exercices')).toBeTruthy();
    expect(screen.getByText('Cardio · 0 exercice')).toBeTruthy();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Modifier la séance' })[0]);
    expect(n.openSession).toHaveBeenCalledWith('a');

    await fireEvent.press(screen.getAllByRole('button', { name: 'Dupliquer' })[0]);
    expect(screen.getByText('HAUT (copie)')).toBeTruthy();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Supprimer' })[0]);
    expect(confirm).toHaveBeenCalled();
    expect(useDraftStore.getState().draft!.program.sessions.a).toBeUndefined();
    expect(useDraftStore.getState().draft!.program.schedule).toEqual({});

    await fireEvent.press(screen.getByRole('button', { name: 'CONFIGURER LE PLANNING' }));
    expect(n.goToStep).toHaveBeenCalledWith(3);
  });

  it('réordonner (action d\'accessibilité)', async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, draftFromProgram('p', program)); });
    await renderWithProviders(<SessionsStep nav={nav()} />, { ctx });
    await fireEvent(screen.getByTestId('reorder-b'), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    expect(Object.keys(useDraftStore.getState().draft!.program.sessions)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/editor/__tests__/SessionsStep.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/editor/SessionCard.tsx` :
```tsx
// Carte de séance dans l'éditeur : pastille de couleur, nom, « Type · N exercices », actions
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Session } from '@/domain/program';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  session: Session;
  onEdit(): void;
  onDuplicate(): void;
  onDelete(): void;
  header?: (title: ReactElement) => ReactElement;
}

export function SessionCard({ session, onEdit, onDuplicate, onDelete, header }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t } = useI18n();
  const n = session.exercises.length;
  const meta = `${t(`session_type_${session.type}` as StringKey)} · ${n} ${n > 1 ? t('plan_exercises') : t('plan_exercise')}`;
  const title = (
    <View style={styles.titleRow}>
      <View style={[styles.dot, { backgroundColor: accentColors(colors, session.accent).fill }]} />
      <View style={styles.flex}>
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{session.name || t('editor_no_name')}</Text>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{meta}</Text>
      </View>
    </View>
  );
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.icon}>
      <Ionicons name={name} size={20} color={colors.textDim} />
    </Pressable>
  );
  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
      <View style={styles.flex}>{header ? header(title) : title}</View>
      {icon('create-outline', t('editor_edit_session'), onEdit)}
      {icon('copy-outline', t('editor_duplicate'), onDuplicate)}
      {icon('trash-outline', t('editor_delete'), onDelete)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  flex: { flex: 1 },
  icon: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
```

`mobile/src/features/editor/SessionsStep.tsx` :
```tsx
// Étape 2 — séances : liste réordonnable, créer / modifier / dupliquer / supprimer
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { addSession, deleteSession, duplicateSession, moveSession } from '@/domain/draft';
import { ReorderableList } from '@/features/today/ReorderableList';
import { useI18n } from '@/i18n/I18nProvider';
import { confirm } from '@/platform/confirm';
import { useDraftStore } from '@/state/draftStore';
import { useTheme } from '@/theme/ThemeProvider';
import { EditorScreen } from './EditorScreen';
import type { EditorNav } from './nav';
import { SessionCard } from './SessionCard';

export function SessionsStep({ nav }: { nav: EditorNav }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const program = useDraftStore((s) => s.draft?.program);
  const apply = useDraftStore((s) => s.apply);
  const keys = program ? Object.keys(program.sessions) : [];

  const create = () => {
    let created = '';
    apply(ctx, (d) => {
      const r = addSession(d);
      created = r.key;
      return r.draft;
    });
    if (created) nav.openSession(created);
  };
  const remove = async (key: string) => {
    const name = program?.sessions[key]?.name || t('editor_no_name');
    const ok = await confirm({ title: t('editor_delete'), message: t('editor_confirm_delete_session', name), confirmLabel: t('editor_delete'), cancelLabel: t('editor_cancel'), destructive: true });
    if (ok) apply(ctx, (d) => deleteSession(d, key));
  };

  return (
    <EditorScreen nav={nav} step={2}>
      {program ? (
        <View style={styles.root}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('editor_step2_title').toUpperCase()}</Text>
          <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>
            {program.meta.label ? t('editor_step2_sub_named', program.meta.label) : t('editor_step2_sub')}
          </Text>
          {keys.length === 0 ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('editor_no_sessions')}</Text> : null}
          <ReorderableList
            items={keys}
            keyOf={(k) => k}
            onMove={(from, to) => apply(ctx, (d) => moveSession(d, from, to))}
            moveUpLabel={t('today_move_up')}
            moveDownLabel={t('today_move_down')}
            renderItem={(key, _i, handle) => (
              <SessionCard
                session={program.sessions[key]}
                header={handle}
                onEdit={() => nav.openSession(key)}
                onDuplicate={() => apply(ctx, (d) => duplicateSession(d, key, t('editor_copy_suffix')).draft)}
                onDelete={() => void remove(key)}
              />
            )}
          />
          <Pressable accessibilityRole="button" onPress={create} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
            <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('editor_add_session_btn')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => nav.goToStep(3)} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
            <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('editor_configure_planning')}</Text>
          </Pressable>
        </View>
      ) : null}
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  title: { fontSize: 36, letterSpacing: -0.5 },
  btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
});
```
Note : `create` lit la clé créée depuis la fonction passée à `apply` (exécutée de façon synchrone par le store).

`mobile/src/app/editor/sessions.tsx` :
```tsx
// Route éditeur · étape 2
import { SessionsStep } from '@/features/editor/SessionsStep';
import { useRouterNav } from '@/features/editor/useRouterNav';

export default function EditorSessionsRoute() {
  return <SessionsStep nav={useRouterNav()} />;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/editor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor src/app/editor/sessions.tsx
git commit -m "feat(mobile): add editor step 2 (reorderable sessions list)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Étape 3 — planning (`DayPicker`, `ScheduleStep`)

**Files:**
- Create: `mobile/src/features/editor/DayPicker.tsx`, `mobile/src/features/editor/ScheduleStep.tsx`, `mobile/src/app/editor/schedule.tsx`, `mobile/src/features/editor/__tests__/ScheduleStep.test.tsx`

**Interfaces:**
- Consumes: `setSchedule`, `WEEK_ORDER`, `BottomSheet`, `EditorScreen` (rendu-fonction `({ save })`), `Weekday`.
- Produces:
  - `<DayPicker visible: boolean; title: string; sessions: { key: string; name: string }[]; value: string | null; onSelect(key: string | null): void; onClose(): void />`
  - `<ScheduleStep nav: EditorNav />` (lignes testID `day-row-<weekday>` ; bouton « ENREGISTRER LE PROGRAMME »)

- [ ] **Step 1: Écrire le test**

`mobile/src/features/editor/__tests__/ScheduleStep.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { getActiveProgram } from '@/db/repos/programsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { addSession, newDraft, setMeta, updateSession } from '@/domain/draft';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ScheduleStep } from '../ScheduleStep';

const nav = () => ({ goToStep: jest.fn(), openSession: jest.fn(), closeSession: jest.fn(), finish: jest.fn() });

describe('ScheduleStep', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('7 jours lundi → dimanche ; choisir une séance puis repos ; enregistrer', async () => {
    const ctx = createTestCtx();
    const { draft, key } = addSession(setMeta(newDraft(), { label: 'P' }), 'lift', () => 'aaaa');
    await act(async () => { useDraftStore.getState().start(ctx, updateSession(draft, key, { name: 'FULL' })); });
    const n = nav();
    await renderWithProviders(<ScheduleStep nav={n} />, { ctx });
    expect(screen.getAllByTestId(/^day-row-\d$/).map((r) => r.props.testID)).toEqual(
      ['day-row-1', 'day-row-2', 'day-row-3', 'day-row-4', 'day-row-5', 'day-row-6', 'day-row-0'],
    );
    await fireEvent.press(screen.getByTestId('day-row-1'));
    await fireEvent.press(screen.getByRole('button', { name: 'FULL' }));
    expect(useDraftStore.getState().draft!.program.schedule).toEqual({ '1': key });
    await fireEvent.press(screen.getByTestId('day-row-3'));
    await fireEvent.press(screen.getByRole('button', { name: 'FULL' }));
    await fireEvent.press(screen.getByTestId('day-row-3'));
    await fireEvent.press(screen.getByRole('button', { name: 'Repos' }));
    expect(useDraftStore.getState().draft!.program.schedule).toEqual({ '1': key });

    await fireEvent.press(screen.getByRole('button', { name: 'ENREGISTRER LE PROGRAMME' }));
    expect(getActiveProgram(ctx)?.definition.meta.label).toBe('P');
    expect(useDraftStore.getState().draft).toBeNull();
    expect(n.finish).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/editor/__tests__/ScheduleStep.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/editor/DayPicker.tsx` :
```tsx
// Choix de la séance d'un jour : Repos ou une séance du brouillon
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { BottomSheet } from '@/features/common/BottomSheet';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  visible: boolean;
  title: string;
  sessions: { key: string; name: string }[];
  value: string | null;
  onSelect(key: string | null): void;
  onClose(): void;
}

export function DayPicker({ visible, title, sessions, value, onSelect, onClose }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const option = (key: string | null, label: string) => (
    <Pressable
      key={key ?? '__rest__'}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: value === key }}
      onPress={() => onSelect(key)}
      style={[styles.option, { backgroundColor: colors.bgCard, borderColor: value === key ? colors.borderActive : colors.border, borderRadius: radius.md }]}
    >
      <Text style={[styles.flex, { color: colors.text, fontFamily: fonts.uiBold }]}>{label}</Text>
      {value === key ? <Ionicons name="checkmark" size={18} color={colors.gold} /> : null}
    </Pressable>
  );
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      {option(null, t('plan_rest'))}
      {sessions.map((s) => option(s.key, s.name || t('editor_no_name')))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
```

`mobile/src/features/editor/ScheduleStep.tsx` :
```tsx
// Étape 3 — planning : une séance (ou repos) par jour, lundi → dimanche
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { setSchedule } from '@/domain/draft';
import { WEEK_ORDER, type Weekday } from '@/domain/schedule';
import { useI18n } from '@/i18n/I18nProvider';
import { useDraftStore } from '@/state/draftStore';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { DayPicker } from './DayPicker';
import { EditorScreen } from './EditorScreen';
import type { EditorNav } from './nav';

export function ScheduleStep({ nav }: { nav: EditorNav }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t, tList } = useI18n();
  const program = useDraftStore((s) => s.draft?.program);
  const apply = useDraftStore((s) => s.apply);
  const [picking, setPicking] = useState<Weekday | null>(null);
  const daysLong = tList('days_long');

  const sessions = program ? Object.entries(program.sessions).map(([key, s]) => ({ key, name: s.name })) : [];
  const valueOf = (d: Weekday) => {
    const key = program?.schedule[String(d)] ?? null;
    return key && program && Object.hasOwn(program.sessions, key) ? key : null;
  };

  return (
    <EditorScreen nav={nav} step={3}>
      {({ save }) => (program ? (
        <View style={styles.root}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('editor_step3_title').toUpperCase()}</Text>
          <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('editor_step3_sub')}</Text>
          {WEEK_ORDER.map((d) => {
            const key = valueOf(d);
            const session = key ? program.sessions[key] : null;
            return (
              <Pressable
                key={d}
                testID={`day-row-${d}`}
                accessibilityRole="button"
                onPress={() => setPicking(d)}
                style={[styles.row, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.md }]}
              >
                <Text style={[styles.day, { color: colors.textDim, fontFamily: fonts.uiBold }]}>{daysLong[d]}</Text>
                <Text style={[styles.flex, { color: session ? accentColors(colors, session.accent).text : colors.textDim, fontFamily: fonts.uiBold }]}>
                  {session ? session.name || t('editor_no_name') : t('plan_rest')}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textDim} />
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" onPress={save} style={[styles.save, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
            <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('editor_save_program_btn')}</Text>
          </Pressable>
          <DayPicker
            visible={picking !== null}
            title={picking !== null ? daysLong[picking] : ''}
            sessions={sessions}
            value={picking !== null ? valueOf(picking) : null}
            onSelect={(key) => {
              if (picking !== null) apply(ctx, (dr) => setSchedule(dr, picking, key));
              setPicking(null);
            }}
            onClose={() => setPicking(null)}
          />
        </View>
      ) : null)}
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  title: { fontSize: 36, letterSpacing: -0.5 },
  row: { minHeight: TOUCH_MIN + 8, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  day: { width: 90 },
  flex: { flex: 1 },
  save: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
```
Le bouton du bas utilise le `save` d'`EditorScreen` (rendu-fonction) : une seule feuille d'erreurs, partagée avec l'en-tête.

`mobile/src/app/editor/schedule.tsx` :
```tsx
// Route éditeur · étape 3
import { ScheduleStep } from '@/features/editor/ScheduleStep';
import { useRouterNav } from '@/features/editor/useRouterNav';

export default function EditorScheduleRoute() {
  return <ScheduleStep nav={useRouterNav()} />;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/editor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor src/app/editor/schedule.tsx
git commit -m "feat(mobile): add editor step 3 (weekly schedule picker) and save button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Fenêtre de détail d'un exercice (`AlternativeEditor`, `ExerciseSheet`)

**Files:**
- Create: `mobile/src/features/editor/AlternativeEditor.tsx`, `mobile/src/features/editor/ExerciseSheet.tsx`, `mobile/src/features/editor/__tests__/ExerciseSheet.test.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `NumberStepper`, `Alternative`, `alternativeName`, `Exercise`, `ExerciseInput`, `Units`.
- Produces:
  - `<AlternativeEditor value: Alternative[]; onChange(v: Alternative[]): void />` (≤ 10 ; détail repliable : séries, schéma, charge, repos ; sans détail → chaîne)
  - `blankExercise(restSec: number): ExerciseInput`
  - `<ExerciseSheet visible: boolean; initial: Exercise | ExerciseInput; isNew: boolean; units: Units; onSave(input: ExerciseInput): void; onClose(): void />` (Enregistrer désactivé tant que le nom est vide)

- [ ] **Step 1: Écrire le test**

`mobile/src/features/editor/__tests__/ExerciseSheet.test.tsx` :
```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import type { Exercise } from '@/domain/program';
import { renderWithProviders } from '@/test/renderWithProviders';
import { blankExercise, ExerciseSheet } from '../ExerciseSheet';

describe('ExerciseSheet', () => {
  it('nouvel exercice : nom requis, steppers, chronométré, alternatives', async () => {
    const onSave = jest.fn();
    await renderWithProviders(<ExerciseSheet visible isNew initial={blankExercise(90)} units="kg" onSave={onSave} onClose={jest.fn()} />);
    expect(screen.getByText('Nouvel exercice')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('exo-name'), '  Gainage ');
    await fireEvent.press(screen.getByRole('button', { name: 'Augmenter Séries' }));
    await fireEvent(screen.getByTestId('exo-timed'), 'valueChange', true);
    expect(screen.getByPlaceholderText('EX: 45')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('exo-scheme'), '45');
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuer Repos (sec)' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une alternative' }));
    await fireEvent.changeText(screen.getByTestId('alt-name-0'), 'Planche latérale');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Gainage', sets: 4, timed: true, scheme: '45', restSec: 75, load: null, cue: null, alternatives: ['Planche latérale'],
    }));
  });

  it('exercice existant : champs inconnus conservés, alternative détaillée → objet', async () => {
    const onSave = jest.fn();
    const initial = { id: 'dc', name: 'DC', scheme: '4×8', sets: 4, load: '60 kg', restSec: 120, cue: null, alternatives: [], custom: 1 } as Exercise;
    await renderWithProviders(<ExerciseSheet visible isNew={false} initial={initial} units="kg" onSave={onSave} onClose={jest.fn()} />);
    expect(screen.getByText("Modifier l'exercice")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une alternative' }));
    await fireEvent.changeText(screen.getByTestId('alt-name-0'), 'DC haltères');
    await fireEvent.press(screen.getByRole('button', { name: 'Détails 1' }));
    await fireEvent.changeText(screen.getByTestId('alt-load-0'), '24 kg');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    const saved = onSave.mock.calls[0][0];
    expect(saved).toMatchObject({ name: 'DC', load: '60 kg', custom: 1 });
    expect(saved.id).toBeUndefined();
    expect(saved.alternatives).toEqual([{ name: 'DC haltères', load: '24 kg' }]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/editor/__tests__/ExerciseSheet.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/editor/AlternativeEditor.tsx` :
```tsx
// Alternatives d'un exercice : nom seul, ou détail repliable (séries, schéma, charge, repos)
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { alternativeName, type Alternative } from '@/domain/program';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

const MAX_ALTERNATIVES = 10;
type AltObject = Exclude<Alternative, string>;

/** Détails vides retirés ; alternative sans aucun détail → simple nom (format historique) */
function normalize(alt: AltObject): Alternative {
  const clean = Object.fromEntries(
    Object.entries(alt).filter(([k, v]) => k === 'name' || (v !== undefined && v !== null && v !== '')),
  ) as AltObject;
  return Object.keys(clean).length > 1 ? clean : alt.name;
}

const toObject = (alt: Alternative): AltObject => (typeof alt === 'string' ? ({ name: alt } as AltObject) : alt);

export function AlternativeEditor({ value, onChange }: { value: Alternative[]; onChange(v: Alternative[]): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];

  const patch = (i: number, p: Partial<AltObject>) =>
    onChange(value.map((a, j) => (j === i ? normalize({ ...toObject(a), ...p }) : a)));
  const num = (text: string) => {
    const n = parseInt(text, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  return (
    <View style={styles.root}>
      {value.map((alt, i) => {
        const obj = toObject(alt);
        return (
          <View key={i} style={styles.item}>
            <View style={styles.row}>
              <TextInput
                testID={`alt-name-${i}`}
                value={alternativeName(alt)}
                maxLength={100}
                placeholder={t('exo_alt_name_ph')}
                placeholderTextColor={colors.textDim}
                onChangeText={(name) => patch(i, { name })}
                style={field}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('editor_alt_details')} ${i + 1}`} onPress={() => setOpen(open === i ? null : i)} style={styles.icon}>
                <Ionicons name={open === i ? 'chevron-up' : 'options-outline'} size={18} color={colors.textDim} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('editor_remove_item')} ${i + 1}`} onPress={() => onChange(value.filter((_, j) => j !== i))} style={styles.icon}>
                <Ionicons name="close" size={18} color={colors.textDim} />
              </Pressable>
            </View>
            {open === i ? (
              <View style={styles.details}>
                <TextInput testID={`alt-sets-${i}`} keyboardType="number-pad" value={obj.sets != null ? String(obj.sets) : ''} placeholder={t('exo_sets_label')} placeholderTextColor={colors.textDim} onChangeText={(v) => patch(i, { sets: num(v) && num(v)! >= 1 ? Math.min(20, num(v)!) : undefined })} style={field} />
                <TextInput testID={`alt-scheme-${i}`} maxLength={50} value={obj.scheme ?? ''} placeholder={t('exo_scheme_label')} placeholderTextColor={colors.textDim} onChangeText={(v) => patch(i, { scheme: v })} style={field} />
                <TextInput testID={`alt-load-${i}`} maxLength={100} value={obj.load ?? ''} placeholder={t('exo_load_label_fmt', '')} placeholderTextColor={colors.textDim} onChangeText={(v) => patch(i, { load: v || null })} style={field} />
                <TextInput testID={`alt-rest-${i}`} keyboardType="number-pad" value={obj.restSec != null ? String(obj.restSec) : ''} placeholder={t('exo_rest_label')} placeholderTextColor={colors.textDim} onChangeText={(v) => patch(i, { restSec: num(v) !== undefined ? Math.min(600, num(v)!) : null })} style={field} />
              </View>
            ) : null}
          </View>
        );
      })}
      {value.length < MAX_ALTERNATIVES ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('exo_add_alt')} onPress={() => onChange([...value, ''])} style={styles.add}>
          <Ionicons name="add" size={18} color={colors.gold} />
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('exo_add_alt')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  item: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: { flex: 1, minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  icon: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  details: { gap: 6, paddingLeft: 12 },
  add: { minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
```
Les alternatives au nom vide sont retirées à l'enregistrement par `ExerciseSheet`.

`mobile/src/features/editor/ExerciseSheet.tsx` :
```tsx
// Fenêtre de détail d'un exercice : séries, chronométré, reps/secondes, charge, repos, consigne, alternatives
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { ExerciseInput } from '@/domain/draft';
import { alternativeName, type Exercise, type Units } from '@/domain/program';
import { BottomSheet } from '@/features/common/BottomSheet';
import { NumberStepper } from '@/features/common/NumberStepper';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { AlternativeEditor } from './AlternativeEditor';

export function blankExercise(restSec: number): ExerciseInput {
  return { name: '', sets: 3, scheme: '', timed: false, load: null, restSec, cue: null, alternatives: [] } as ExerciseInput;
}

interface Props {
  visible: boolean;
  initial: Exercise | ExerciseInput;
  isNew: boolean;
  units: Units;
  onSave(input: ExerciseInput): void;
  onClose(): void;
}

export function ExerciseSheet({ visible, initial, isNew, units, onSave, onClose }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const { id: _id, ...rest } = initial as Exercise;
  const [form, setForm] = useState<ExerciseInput>({ ...rest, timed: rest.timed === true, restSec: rest.restSec ?? 90 } as ExerciseInput);
  const set = (p: Partial<ExerciseInput>) => setForm((f) => ({ ...f, ...p }));
  const valid = form.name.trim().length > 0;
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };
  const text = (v: string) => (v.trim() ? v.trim() : null);

  const submit = () => {
    if (!valid) return;
    onSave({
      ...form,
      name: form.name.trim(),
      scheme: form.scheme.trim(),
      load: text(form.load ?? ''),
      cue: text(form.cue ?? ''),
      alternatives: form.alternatives.filter((a) => alternativeName(a).trim() !== ''),
    } as ExerciseInput);
  };

  return (
    <BottomSheet visible={visible} title={isNew ? t('editor_new_exo') : t('editor_edit_exo')} onClose={onClose}>
      <Text style={label}>{t('exo_name_label').toUpperCase()}</Text>
      <TextInput testID="exo-name" value={form.name} maxLength={100} placeholder={t('exo_name_ph')} placeholderTextColor={colors.textDim} onChangeText={(name) => set({ name })} style={field} />
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={label}>{t('exo_sets_label').toUpperCase()}</Text>
          <NumberStepper value={form.sets} min={1} max={20} label={t('exo_sets_label')} onChange={(sets) => set({ sets })} />
        </View>
        <View style={styles.timed}>
          <Text style={label}>{t('exo_timed_label')}</Text>
          <Switch testID="exo-timed" value={form.timed === true} onValueChange={(timed) => set({ timed })} />
        </View>
      </View>
      <Text style={label}>{t('exo_scheme_label').toUpperCase()}</Text>
      <TextInput testID="exo-scheme" value={form.scheme} maxLength={50} placeholder={form.timed ? t('exo_scheme_ph_timed') : t('exo_scheme_ph')} placeholderTextColor={colors.textDim} onChangeText={(scheme) => set({ scheme })} style={field} />
      <Text style={label}>{t('exo_load_label_fmt', units).toUpperCase()}</Text>
      <TextInput testID="exo-load" value={form.load ?? ''} maxLength={100} placeholderTextColor={colors.textDim} onChangeText={(load) => set({ load })} style={field} />
      <Text style={label}>{t('exo_rest_label').toUpperCase()}</Text>
      <NumberStepper value={form.restSec ?? 90} min={0} max={600} step={15} label={t('exo_rest_label')} onChange={(restSec) => set({ restSec })} />
      <Text style={label}>{t('exo_cue_label').toUpperCase()}</Text>
      <TextInput testID="exo-cue" value={form.cue ?? ''} maxLength={300} placeholder={t('exo_cue_ph')} placeholderTextColor={colors.textDim} onChangeText={(cue) => set({ cue })} style={field} />
      <Text style={label}>{t('exo_alt_label').toUpperCase()}</Text>
      <AlternativeEditor value={form.alternatives} onChange={(alternatives) => set({ alternatives })} />
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onClose} style={[styles.btn, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('exo_cancel')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid }} onPress={submit} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md, opacity: valid ? 1 : 0.5 }]}>
          <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('exo_save')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  col: { flex: 1, gap: 6 },
  timed: { alignItems: 'center', gap: 6 },
  btn: { flex: 1, minHeight: TOUCH_MIN + 4, alignItems: 'center', justifyContent: 'center' },
});
```
Le contenu de la feuille peut dépasser la hauteur d'écran : envelopper les champs dans un `ScrollView` (`keyboardShouldPersistTaps="handled"`) à l'intérieur de `BottomSheet` si nécessaire sur appareil (checklist).

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/editor/__tests__/ExerciseSheet.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/AlternativeEditor.tsx src/features/editor/ExerciseSheet.tsx src/features/editor/__tests__/ExerciseSheet.test.tsx
git commit -m "feat(mobile): add exercise detail sheet with steppers, timed flag and alternatives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Étape 4 — éditeur de séance (`ExerciseRow`, `TipsEditor`, `SessionStep`)

**Files:**
- Create: `mobile/src/features/editor/ExerciseRow.tsx`, `mobile/src/features/editor/TipsEditor.tsx`, `mobile/src/features/editor/SessionStep.tsx`, `mobile/src/app/editor/session/[key].tsx`, `mobile/src/features/editor/__tests__/SessionStep.test.tsx`

**Interfaces:**
- Consumes: `updateSession`, `setSessionAccent`, `addExercise`, `updateExercise`, `deleteExercise`, `duplicateExercise`, `moveExercise`, `setBonusTitle`, `sectionExercises`, `ExerciseSheet`, `blankExercise`, `AccentPicker`, `ListEditor`, `Segmented`, `ReorderableList`, `formatScheme`.
- Produces:
  - `<ExerciseRow exercise: Exercise; onEdit(); onDuplicate(); onDelete(); header?: (title) => ReactElement />`
  - `<TipsEditor tips: { title: string; body: string }[]; onChange(tips): void />` (≤ 20 ; testIDs `tip-title-<i>`, `tip-body-<i>`, `tips-add`)
  - `<SessionStep nav: EditorNav; sessionKey: string />`

- [ ] **Step 1: Écrire le test**

`mobile/src/features/editor/__tests__/SessionStep.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { addSession, newDraft } from '@/domain/draft';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { SessionStep } from '../SessionStep';

const nav = () => ({ goToStep: jest.fn(), openSession: jest.fn(), closeSession: jest.fn(), finish: jest.fn() });

async function setup() {
  const ctx = createTestCtx();
  const { draft, key } = addSession(newDraft(), 'lift', () => 'aaaa');
  await act(async () => { useDraftStore.getState().start(ctx, draft); });
  const n = nav();
  await renderWithProviders(<SessionStep nav={n} sessionKey={key} />, { ctx });
  const session = () => useDraftStore.getState().draft!.program.sessions[key];
  return { n, key, session };
}

describe('SessionStep', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('nom, couleur, échauffement, exercices (ajout, édition, duplication, suppression), bonus', async () => {
    const { n, session } = await setup();
    await fireEvent.changeText(screen.getByTestId('sess-name'), 'FULL BODY');
    await fireEvent.press(screen.getByRole('radio', { name: 'Bleu' }));
    await fireEvent.press(screen.getByTestId('warmup-add'));
    await fireEvent.changeText(screen.getByTestId('warmup-0'), 'Vélo 5 min');

    await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UN EXERCICE' }));
    await fireEvent.changeText(screen.getByTestId('exo-name'), 'Squat');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(session()).toMatchObject({ name: 'FULL BODY', accent: 'blue', warmup: ['Vélo 5 min'] });
    expect(session().exercises.map((e) => e.name)).toEqual(['Squat']);
    const squatId = session().exercises[0].id;

    await fireEvent.press(screen.getByRole('button', { name: "Modifier l'exercice Squat" }));
    await fireEvent.changeText(screen.getByTestId('exo-name'), 'Squat barre');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(session().exercises[0]).toMatchObject({ id: squatId, name: 'Squat barre' });

    await fireEvent.press(screen.getByRole('button', { name: 'Dupliquer Squat barre' }));
    expect(session().exercises).toHaveLength(2);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Supprimer Squat barre' })[1]);
    expect(session().exercises.map((e) => e.id)).toEqual([squatId]);

    await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UN BONUS' }));
    await fireEvent.changeText(screen.getByTestId('exo-name'), 'Abdos');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(session().bonus?.exercises.map((e) => e.name)).toEqual(['Abdos']);

    await fireEvent.press(screen.getByRole('button', { name: 'TERMINER LA SÉANCE' }));
    expect(n.closeSession).toHaveBeenCalled();
  });

  it('type cardio : conseils à la place des exercices', async () => {
    const { session } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Cardio' }));
    expect(screen.queryByRole('button', { name: 'AJOUTER UN EXERCICE' })).toBeNull();
    await fireEvent.press(screen.getByTestId('tips-add'));
    await fireEvent.changeText(screen.getByTestId('tip-title-0'), 'Cible');
    await fireEvent.changeText(screen.getByTestId('tip-body-0'), 'RPE 6-7');
    expect(session()).toMatchObject({ type: 'cardio', tips: [{ title: 'Cible', body: 'RPE 6-7' }] });
  });

  it('séance introuvable : retour à la liste', async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, newDraft()); });
    const n = nav();
    await renderWithProviders(<SessionStep nav={n} sessionKey="nope" />, { ctx });
    expect(n.closeSession).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx jest src/features/editor/__tests__/SessionStep.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/editor/ExerciseRow.tsx` :
```tsx
// Ligne d'exercice dans l'éditeur de séance : nom, schéma, actions
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Exercise } from '@/domain/program';
import { formatScheme } from '@/domain/scheme';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  exercise: Exercise;
  onEdit(): void;
  onDuplicate(): void;
  onDelete(): void;
  header?: (title: ReactElement) => ReactElement;
}

export function ExerciseRow({ exercise, onEdit, onDuplicate, onDelete, header }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const title = (
    <View>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{exercise.name}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{formatScheme(exercise)}</Text>
    </View>
  );
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${exercise.name}`} onPress={onPress} style={styles.icon}>
      <Ionicons name={name} size={18} color={colors.textDim} />
    </Pressable>
  );
  return (
    <View style={[styles.row, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
      <View style={styles.flex}>{header ? header(title) : title}</View>
      {icon('create-outline', t('editor_edit_exo'), onEdit)}
      {icon('copy-outline', t('editor_duplicate'), onDuplicate)}
      {icon('trash-outline', t('editor_delete'), onDelete)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  flex: { flex: 1 },
  icon: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
```

`mobile/src/features/editor/TipsEditor.tsx` :
```tsx
// Conseils des séances cardio / repos : titre + texte, ≤ 20
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

type Tip = { title: string; body: string };
const MAX_TIPS = 20;

export function TipsEditor({ tips, onChange }: { tips: Tip[]; onChange(tips: Tip[]): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];
  const patch = (i: number, p: Partial<Tip>) => onChange(tips.map((tip, j) => (j === i ? { ...tip, ...p } : tip)));
  return (
    <View style={styles.root}>
      {tips.map((tip, i) => (
        <View key={i} style={[styles.card, { borderColor: colors.border, borderRadius: radius.md }]}>
          <View style={styles.row}>
            <TextInput testID={`tip-title-${i}`} value={tip.title} maxLength={100} placeholder={t('editor_tip_title_ph')} placeholderTextColor={colors.textDim} onChangeText={(title) => patch(i, { title })} style={[field, styles.flex]} />
            <Pressable accessibilityRole="button" accessibilityLabel={`${t('editor_remove_item')} ${i + 1}`} onPress={() => onChange(tips.filter((_, j) => j !== i))} style={styles.icon}>
              <Ionicons name="close" size={18} color={colors.textDim} />
            </Pressable>
          </View>
          <TextInput testID={`tip-body-${i}`} value={tip.body} maxLength={300} multiline placeholder={t('editor_tip_body_ph')} placeholderTextColor={colors.textDim} onChangeText={(body) => patch(i, { body })} style={field} />
        </View>
      ))}
      {tips.length < MAX_TIPS ? (
        <Pressable testID="tips-add" accessibilityRole="button" onPress={() => onChange([...tips, { title: '', body: '' }])} style={styles.add}>
          <Ionicons name="add" size={18} color={colors.gold} />
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('editor_add_tip')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  card: { borderWidth: 1, padding: 8, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
  input: { minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  icon: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  add: { minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
```

`mobile/src/features/editor/SessionStep.tsx` :
```tsx
// ============================================================
// Étape 4 — éditeur de séance : identité, type, couleur, puis
// exercices (lift/mixte) ou conseils (cardio/repos).
// ============================================================
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import {
  addExercise, deleteExercise, duplicateExercise, moveExercise, sectionExercises, setBonusTitle,
  setSessionAccent, updateExercise, updateSession, type ExerciseSection,
} from '@/domain/draft';
import type { Exercise, SessionType } from '@/domain/program';
import { ListEditor } from '@/features/common/ListEditor';
import { Segmented } from '@/features/profile/Segmented';
import { ReorderableList } from '@/features/today/ReorderableList';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { useDraftStore } from '@/state/draftStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { AccentPicker } from './AccentPicker';
import { EditorScreen } from './EditorScreen';
import { ExerciseRow } from './ExerciseRow';
import { blankExercise, ExerciseSheet } from './ExerciseSheet';
import type { EditorNav } from './nav';
import { TipsEditor } from './TipsEditor';

const TYPES: SessionType[] = ['lift', 'cardio', 'rest', 'mixed'];

export function SessionStep({ nav, sessionKey }: { nav: EditorNav; sessionKey: string }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const draft = useDraftStore((s) => s.draft);
  const apply = useDraftStore((s) => s.apply);
  const [sheet, setSheet] = useState<{ section: ExerciseSection; exercise: Exercise | null } | null>(null);
  const session = draft?.program.sessions[sessionKey];
  const units = draft?.program.meta.units ?? 'kg';
  const restDefault = draft?.program.meta.restDefaultSec ?? 90;

  useEffect(() => {
    if (draft && !session) nav.closeSession();
  }, [draft, session, nav]);

  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];
  const update = (patch: Parameters<typeof updateSession>[2]) => apply(ctx, (d) => updateSession(d, sessionKey, patch));

  const exerciseList = (section: ExerciseSection) => {
    if (!session) return null;
    const list = sectionExercises(session, section);
    return (
      <ReorderableList
        items={list}
        keyOf={(e) => e.id}
        onMove={(from, to) => apply(ctx, (d) => moveExercise(d, sessionKey, section, from, to))}
        moveUpLabel={t('today_move_up')}
        moveDownLabel={t('today_move_down')}
        renderItem={(e, _i, handle) => (
          <ExerciseRow
            exercise={e}
            header={handle}
            onEdit={() => setSheet({ section, exercise: e })}
            onDuplicate={() => apply(ctx, (d) => duplicateExercise(d, sessionKey, section, e.id).draft)}
            onDelete={() => apply(ctx, (d) => deleteExercise(d, sessionKey, section, e.id))}
          />
        )}
      />
    );
  };
  const addButton = (section: ExerciseSection, text: string) => (
    <Pressable accessibilityRole="button" onPress={() => setSheet({ section, exercise: null })} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
      <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{text}</Text>
    </Pressable>
  );

  return (
    <EditorScreen nav={nav}>
      {session ? (
        <View style={styles.root}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('editor_edit_session').toUpperCase()}</Text>
          <Text style={label}>{t('editor_sess_name_label').toUpperCase()}</Text>
          <TextInput testID="sess-name" value={session.name} maxLength={100} placeholder={t('editor_sess_name_ph')} placeholderTextColor={colors.textDim} onChangeText={(name) => update({ name })} style={field} />
          <Text style={label}>{t('editor_sess_subtitle_label').toUpperCase()}</Text>
          <TextInput testID="sess-subtitle" value={session.subtitle ?? ''} maxLength={150} placeholder={t('editor_sess_subtitle_ph')} placeholderTextColor={colors.textDim} onChangeText={(v) => update({ subtitle: v || null })} style={field} />
          <Text style={label}>{t('editor_sess_note_label').toUpperCase()}</Text>
          <TextInput testID="sess-note" value={session.note ?? ''} maxLength={500} multiline placeholderTextColor={colors.textDim} onChangeText={(v) => update({ note: v || null })} style={field} />
          <Text style={label}>{t('editor_sess_type_label').toUpperCase()}</Text>
          <Segmented<SessionType>
            options={TYPES.map((type) => ({ value: type, label: t(`session_type_${type}` as StringKey) }))}
            value={session.type}
            onChange={(type) => update({ type })}
          />
          <Text style={label}>{t('editor_sess_accent_label').toUpperCase()}</Text>
          <AccentPicker value={session.accent} onChange={(accent) => apply(ctx, (d) => setSessionAccent(d, sessionKey, accent))} />

          {session.type === 'lift' || session.type === 'mixed' ? (
            <>
              <Text style={label}>{t('editor_warmup_section').toUpperCase()}</Text>
              <ListEditor items={session.warmup} onChange={(warmup) => update({ warmup })} placeholder={t('editor_warmup_ph')} addLabel={t('editor_add_warmup')} maxItems={20} maxLength={200} testID="warmup" />
              <Text style={label}>{t('editor_exercises_section').toUpperCase()}</Text>
              {exerciseList('main')}
              {addButton('main', t('editor_add_exercise'))}
              <Text style={label}>{t('editor_cardio_section').toUpperCase()}</Text>
              <TextInput testID="cardio-label" value={session.cardio?.label ?? ''} maxLength={100} placeholder={t('editor_cardio_label_ph')} placeholderTextColor={colors.textDim}
                onChangeText={(v) => update({ cardio: v ? { ...(session.cardio ?? {}), label: v, detail: session.cardio?.detail ?? null } : null })} style={field} />
              <TextInput testID="cardio-detail" value={session.cardio?.detail ?? ''} maxLength={200} placeholder={t('editor_cardio_detail_ph')} placeholderTextColor={colors.textDim}
                onChangeText={(v) => update({ cardio: session.cardio ? { ...session.cardio, detail: v || null } : null })} style={field} />
              <Text style={label}>{t('editor_bonus_section').toUpperCase()}</Text>
              <TextInput testID="bonus-title" value={session.bonus?.title ?? ''} maxLength={100} placeholder={t('editor_bonus_title_ph')} placeholderTextColor={colors.textDim}
                onChangeText={(v) => apply(ctx, (d) => setBonusTitle(d, sessionKey, v || null))} style={field} />
              {exerciseList('bonus')}
              {addButton('bonus', t('editor_add_bonus'))}
            </>
          ) : (
            <>
              <Text style={label}>{t('editor_tips_section').toUpperCase()}</Text>
              <TipsEditor tips={session.tips} onChange={(tips) => update({ tips })} />
            </>
          )}

          <Pressable accessibilityRole="button" onPress={nav.closeSession} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
            <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('editor_save_session_btn')}</Text>
          </Pressable>

          {sheet ? (
            <ExerciseSheet
              key={sheet.exercise?.id ?? `new-${sheet.section}`}
              visible
              isNew={sheet.exercise === null}
              initial={sheet.exercise ?? blankExercise(restDefault)}
              units={units}
              onClose={() => setSheet(null)}
              onSave={(input) => {
                const target = sheet;
                setSheet(null);
                apply(ctx, (d) => target.exercise
                  ? updateExercise(d, sessionKey, target.section, target.exercise.id, input)
                  : addExercise(d, sessionKey, target.section, input).draft);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  title: { fontSize: 32, letterSpacing: -0.5 },
  input: { minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
});
```
Les libellés d'accessibilité attendus par le test (`Modifier l'exercice Squat`, `Dupliquer Squat barre`, `Supprimer Squat barre`) viennent d'`ExerciseRow` (`${label} ${exercise.name}`).

`mobile/src/app/editor/session/[key].tsx` :
```tsx
// Route éditeur · étape 4 (séance)
import { useLocalSearchParams } from 'expo-router';
import { SessionStep } from '@/features/editor/SessionStep';
import { useRouterNav } from '@/features/editor/useRouterNav';

export default function EditorSessionRoute() {
  const { key } = useLocalSearchParams<{ key: string }>();
  return <SessionStep nav={useRouterNav()} sessionKey={key ?? ''} />;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx jest src/features/editor`
Expected: PASS. Puis régénérer les types de routes et vérifier TypeScript :
Run: `npx expo export --platform web --output-dir "$TEMP/m3a-web" && npx tsc --noEmit`
Expected: export réussi, aucune erreur TypeScript (les routes `/editor…` sont maintenant connues). Si `tsc` signale encore des routes inconnues, `.expo/types/router.d.ts` n'a pas été régénéré par l'export : lancer `npx expo start --web` quelques secondes puis l'arrêter, et le consigner.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor src/app/editor
git commit -m "feat(mobile): add editor step 4 (session editor with exercises, bonus and tips)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Parcours complets, extensibilité, checklist M3a

**Files:**
- Create: `mobile/src/features/editor/__tests__/EditorFlow.test.tsx`
- Modify: `mobile/docs/DEVICE_CHECKLIST.md`

**Interfaces:**
- Consumes: tout ce qui précède, `TodayScreen`, `loadTodayView`, `cardWeight`, `setWeight`.

- [ ] **Step 1: Écrire les tests de parcours**

`mobile/src/features/editor/__tests__/EditorFlow.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import example from '@/data/program.example.json';
import { createProgram, getActiveProgram, getProgram, listPrograms, setActiveProgram } from '@/db/repos/programsRepo';
import { setWeight } from '@/db/repos/weightsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import type { RepoCtx } from '@/db/types';
import { confirm } from '@/platform/confirm';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TodayScreen } from '@/features/today/TodayScreen';
import { cardWeight, loadTodayView } from '@/features/today/todayView';
import { MetaStep } from '../MetaStep';
import type { EditorNav, EditorStep } from '../nav';
import { prepareEditor } from '../openEditor';
import { ScheduleStep } from '../ScheduleStep';
import { SessionsStep } from '../SessionsStep';
import { SessionStep } from '../SessionStep';

/** Pile de l'éditeur simulée : même enchaînement que les routes Expo Router */
function EditorHarness({ initial, onFinish }: { initial: EditorStep; onFinish(): void }) {
  const [route, setRoute] = useState<{ step: EditorStep } | { session: string }>({ step: initial });
  const nav: EditorNav = {
    goToStep: (step) => setRoute({ step }),
    openSession: (key) => setRoute({ session: key }),
    closeSession: () => setRoute({ step: 2 }),
    finish: onFinish,
  };
  if ('session' in route) return <SessionStep nav={nav} sessionKey={route.session} />;
  if (route.step === 1) return <MetaStep nav={nav} />;
  if (route.step === 2) return <SessionsStep nav={nav} />;
  return <ScheduleStep nav={nav} />;
}

async function openEditor(ctx: RepoCtx, target: Parameters<typeof prepareEditor>[1], initial: EditorStep = 1) {
  await act(async () => { await prepareEditor(ctx, target, async () => true); });
  const onFinish = jest.fn();
  await renderWithProviders(<EditorHarness initial={initial} onFinish={onFinish} />, { ctx });
  return onFinish;
}

async function addSessionWithExercise(name: string, exercise: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'CRÉER UNE SÉANCE' }));
  await fireEvent.changeText(screen.getByTestId('sess-name'), name);
  await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UN EXERCICE' }));
  await fireEvent.changeText(screen.getByTestId('exo-name'), exercise);
  await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
  await fireEvent.press(screen.getByRole('button', { name: 'TERMINER LA SÉANCE' }));
}

async function planDay(weekday: number, sessionName: string) {
  await fireEvent.press(screen.getByTestId(`day-row-${weekday}`));
  await fireEvent.press(screen.getByRole('button', { name: sessionName }));
}

describe('Éditeur — parcours complets', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useDraftStore.setState(DRAFT_INITIAL); });
  });

  it('créer un programme de 2 séances, planifier, enregistrer → actif ; Today l\'affiche le lundi', async () => {
    const ctx = createTestCtx();
    const onFinish = await openEditor(ctx, { kind: 'new' });
    await fireEvent.changeText(screen.getByTestId('meta-label'), 'MON PLAN');
    await fireEvent.press(screen.getByRole('button', { name: 'SUIVANT' }));
    await addSessionWithExercise('HAUT', 'Développé couché');
    await addSessionWithExercise('BAS', 'Squat');
    await fireEvent.press(screen.getByRole('button', { name: 'CONFIGURER LE PLANNING' }));
    await planDay(1, 'HAUT');
    await planDay(4, 'BAS');
    await fireEvent.press(screen.getByRole('button', { name: 'ENREGISTRER LE PROGRAMME' }));
    expect(onFinish).toHaveBeenCalled();

    const active = getActiveProgram(ctx)!;
    expect(active.definition.meta.label).toBe('MON PLAN');
    expect(Object.values(active.definition.sessions).map((s) => s.name)).toEqual(['HAUT', 'BAS']);

    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 5, 10));
    await renderWithProviders(<TodayScreen />, { ctx });
    expect(screen.getAllByText('HAUT').length).toBeGreaterThan(0);
    expect(screen.getByText('Développé couché')).toBeTruthy();
    jest.useRealTimers();
  });

  it('Review Focus 5 : renommer un exercice garde son id et son poids mémorisé', async () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, p.id);
    setWeight(ctx, 'presse-cuisses', 140, 'kg');
    await openEditor(ctx, { kind: 'edit', programId: p.id }, 2);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Modifier la séance' })[0]);
    await fireEvent.press(screen.getByRole('button', { name: "Modifier l'exercice Presse à cuisses" }));
    await fireEvent.changeText(screen.getByTestId('exo-name'), 'Presse inclinée');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    const saved = getProgram(ctx, p.id)!;
    const sessionKey = Object.keys(saved.definition.sessions)[0];
    const ex = saved.definition.sessions[sessionKey].exercises.find((e) => e.id === 'presse-cuisses');
    expect(ex?.name).toBe('Presse inclinée');
    const view = loadTodayView(ctx, saved, sessionKey, '2026-10-05');
    expect(cardWeight(view, view.exercises.find((e) => e.id === 'presse-cuisses')!)).toBe(140);
  });

  it('erreur de validation depuis l\'étape 3 → la feuille d\'erreurs ramène à l\'étape 1', async () => {
    const ctx = createTestCtx();
    await openEditor(ctx, { kind: 'new' }, 3);
    await fireEvent.press(screen.getByRole('button', { name: 'ENREGISTRER LE PROGRAMME' }));
    await fireEvent.press(screen.getByText('Le nom du programme est requis.'));
    expect(screen.getByTestId('meta-label')).toBeTruthy();
    expect(listPrograms(ctx)).toEqual([]);
  });

  it('Annuler (confirmé) : base inchangée, brouillon effacé', async () => {
    const ctx = createTestCtx();
    const p = createProgram(ctx, example, 'example');
    const onFinish = await openEditor(ctx, { kind: 'edit', programId: p.id });
    await fireEvent.changeText(screen.getByTestId('meta-label'), 'NE PAS GARDER');
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    expect(confirm).toHaveBeenCalled();
    expect(getProgram(ctx, p.id)?.definition.meta.label).toBe('PROGRAMME SALLE');
    expect(useDraftStore.getState().draft).toBeNull();
    expect(onFinish).toHaveBeenCalled();
  });

  it('reprise du brouillon après relecture du store (app relancée)', async () => {
    const ctx = createTestCtx();
    await openEditor(ctx, { kind: 'new' });
    await fireEvent.changeText(screen.getByTestId('meta-label'), 'EN COURS');
    await act(async () => { useDraftStore.setState(DRAFT_INITIAL); useDraftStore.getState().hydrate(ctx); });
    expect(useDraftStore.getState().draft?.program.meta.label).toBe('EN COURS');
  });

  it('extensibilité : 7 jours en lbs créés via l\'éditeur, affichés par Today sans changement de code', async () => {
    const ctx = createTestCtx();
    await openEditor(ctx, { kind: 'new' });
    await fireEvent.changeText(screen.getByTestId('meta-label'), 'SEPT JOURS');
    await fireEvent.press(screen.getByRole('button', { name: 'LBS' }));
    await fireEvent.press(screen.getByRole('button', { name: 'SUIVANT' }));
    for (let d = 0; d < 7; d++) await addSessionWithExercise(`JOUR ${d}`, `Exo ${d}`);
    await fireEvent.press(screen.getByRole('button', { name: 'CONFIGURER LE PLANNING' }));
    for (let d = 0; d < 7; d++) await planDay(d, `JOUR ${d}`);
    await fireEvent.press(screen.getByRole('button', { name: 'ENREGISTRER LE PROGRAMME' }));

    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 10, 10)); // samedi
    await renderWithProviders(<TodayScreen />, { ctx });
    expect(screen.getAllByText('JOUR 6').length).toBeGreaterThan(0);
    expect(screen.getAllByText('lbs').length).toBeGreaterThan(0);
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/editor/__tests__/EditorFlow.test.tsx`
Expected: PASS si les Tasks 1 à 16 sont correctes. Un échec révèle un défaut d'assemblage : le corriger dans le code (systematic-debugging), pas dans le test, sauf libellé non spécifié.

- [ ] **Step 3: Checklist appareil M3a**

Ajouter à `mobile/docs/DEVICE_CHECKLIST.md` :
```markdown

## M3a — Plan + Éditeur (pas de nouveau build nécessaire)
- [ ] Plan : onglets « Cette semaine » / « Mes programmes », l'indicateur glisse et le contenu coulisse ; aucune animation si « réduire les animations » est activé.
- [ ] Cette semaine : lundi → dimanche, séance du jour badgée, repos atténués ; « Ajouter une séance » ouvre l'éditeur à l'étape 2.
- [ ] Mes programmes : tap = activer (toast), Dupliquer (« (copie) »), Supprimer (confirmation) ; le programme actif supprimé bascule sur un autre.
- [ ] Éditeur plein écran : Annuler (confirmation), Enregistrer depuis chaque étape ; erreurs listées, un tap ramène à l'étape.
- [ ] Étape 2 / étape 4 : glisser-déposer des séances et des exercices (appui long sur le titre) ; actions VoiceOver « Monter / Descendre ».
- [ ] Fenêtre d'exercice : clavier numérique ou texte selon le champ ; la feuille reste utilisable clavier ouvert (champs du bas visibles).
- [ ] Steppers séries (1–20) et repos (pas de 15 s) ; chronométré change le placeholder.
- [ ] Couleur choisie conservée après enregistrement ; type « Repos » met la séance en gris si la couleur était automatique.
- [ ] Tuer l'app en pleine édition puis la rouvrir : bannière « Brouillon en cours », Reprendre retrouve les modifications.
- [ ] Renommer un exercice : son poids mémorisé et « Dernière fois » sont conservés dans Today.
```

- [ ] **Step 4: Vérification complète**

Run: `npx jest && npx tsc --noEmit && npx expo export --platform web --output-dir "$TEMP/m3a-web" && npx expo export --platform ios --output-dir "$TEMP/m3a-ios"`
Expected: toute la suite verte, aucune erreur TypeScript, les deux bundles exportés.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/__tests__/EditorFlow.test.tsx docs/DEVICE_CHECKLIST.md
git commit -m "test(mobile): end-to-end editor flows, extensibility check and M3a device checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Couverture de la spec (auto-revue)

| Exigence (addendum M3a) | Task |
|---|---|
| Plan : Cette semaine (lundi → dimanche, badge, repos atténués, Ajouter une séance) | 9, 10 |
| Plan : Mes programmes (activer, modifier, dupliquer, supprimer, créer) | 5, 9, 10 |
| Onglets animés, bannière de brouillon, brouillon perdu signalé | 6, 10 |
| Brouillon unique, opérations pures, persistance, reprise, confirmation d'une autre cible | 2, 3, 6, 10 |
| Ids stables (création, renommage, duplication séance / exercice / programme) | 1, 2, 3, 5, 17 |
| Couleur par défaut + choix manuel conservé | 1, 2, 8, 16 |
| Étape 1 (nom, unité, repos par défaut, règles) | 12 |
| Étape 2 (séances déplaçables, dupliquer, supprimer + planning nettoyé) | 2, 13 |
| Étape 3 (planning, Enregistrer) | 14 |
| Étape 4 (identité, type, couleur, échauffement, exercices, cardio, bonus, conseils) | 3, 16 |
| Fenêtre d'exercice (steppers, chronométré, alternatives détaillées) | 15 |
| Enregistrer : validation, erreurs par étape, création + activation / mise à jour, source supprimée | 4, 11, 14, 17 |
| Annuler sans toucher la base | 11, 17 |
| Bornes de saisie | 8, 12, 15, 16 |
| Entitlements | 6, 10 |
| Extensibilité 7 jours / lbs | 17 |
