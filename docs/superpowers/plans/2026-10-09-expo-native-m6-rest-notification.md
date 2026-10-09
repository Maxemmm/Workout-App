# App native Expo — M6 Notification de fin de repos — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une notification locale à la fin d'un repos ou d'une série chronométrée (texte « série suivante », actions « +15 s » / « Valider la série »), avec autorisation demandée à la première série et réglage Profil.

**Architecture:** adaptateur `platform/restNotifier` (expo-notifications, web inerte) ; texte calculé par une fonction pure `domain/restNotice` ; un pilote sans affichage monté à la racine suit le minuteur (planifie / annule) et applique les actions ; feuille d'autorisation dans Today ; section « Minuteur » dans Profil.

**Tech Stack:** Expo SDK 57, TypeScript strict, Expo Router, expo-sqlite + Drizzle (tests : better-sqlite3), Zustand, Jest (jest-expo) + RNTL 14, `expo-notifications` (nouveau, inclus dans Expo Go).

**Spec:** `docs/superpowers/specs/2026-10-09-expo-native-m6-rest-notification-design.md` (+ `docs/superpowers/specs/2026-10-05-expo-native-foundation-design.md` §5.2, §5.3).

Toutes les commandes se lancent depuis `mobile/`.

## Global Constraints

- Notifications **locales** uniquement ; **une seule** planifiée à la fois, identifiant fixe `rest-end`.
- Planification **dès le démarrage** du minuteur (approche A) ; remplacée à l'ajustement ; annulée à l'arrêt.
- App au premier plan à l'échéance : ni bannière, ni liste, ni son système.
- Rien n'est planifié si `restAlerts !== true` ou si l'autorisation n'est pas `granted`.
- Catégories iOS : `rest` (bouton `plus15`, « +15 s ») et `work` (bouton `validate`, « Valider la série »).
- Une action n'est appliquée que si le minuteur correspond encore (`workoutId`, `exerciseId`, `setIndex`) ; « +15 s » aussi quand aucun minuteur n'est actif.
- Web : adaptateur inerte (`permission()` → `'unavailable'`), ni feuille ni section Profil.
- Code et commentaires en français ; chaînes via i18n (fr + en).
- Pas de nouveau build (Expo Go). Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ; push uniquement sur `expo-native`.

## Review Focus

1. **Même action reçue deux fois** (réponse temps réel puis « dernière réponse » au lancement) : appliquée une seule fois (Task 5 — test).
2. **Réglage désactivé pendant qu'une notification est planifiée** : la notification en attente est annulée (Task 4 — test).
3. **Minuteur ajusté plusieurs fois rapidement (+15 s ×3)** : une seule notification, à la dernière heure de fin (Task 4 — test).
4. **Autorisation retirée dans iOS après « Activer »** : plus rien n'est planifié, Profil affiche « Refusées » (Task 4 et Task 7 — tests).
5. **Feuille d'autorisation sur un poste web ou sans autorisation possible** : jamais affichée si `permission()` vaut `'unavailable'` (Task 6 — test).

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/platform/types.ts` | `NotifierPermission`, `NoticeTarget`, `NoticeAction`, `ScheduledNotice` |
| `src/platform/restNotifier.ts` / `.web.ts` (créés) | Adaptateur notifications |
| `src/test/jestSetup.js` | Mock global de `@/platform/restNotifier` |
| `src/domain/restNotice.ts` (créé) | Contenu de la notification (pur) |
| `src/db/repos/settingsRepo.ts` | Clé `restAlerts` |
| `src/features/notifications/permissionFlow.ts` (créé) | `shouldAskForAlerts`, `answerAlerts` |
| `src/features/notifications/formatNotice.ts` (créé) | Contenu → titre / texte traduits |
| `src/features/notifications/RestNotificationDriver.tsx` (créé) | Planification + actions |
| `src/features/notifications/AlertsPermissionSheet.tsx` (créé) | Feuille d'autorisation |
| `src/features/today/TodaySessionBody.tsx` | Déclenche la feuille à la première série |
| `src/features/profile/TimerSection.tsx` (créé), `ProfileScreen.tsx` | Section « Minuteur » |
| `src/app/_layout.tsx` | Monte le pilote |
| `src/i18n/locales/fr.json`, `en.json` | Chaînes M6 |
| `docs/DEVICE_CHECKLIST.md` | Section M6 |

---

### Task 1: Adaptateur `restNotifier` (expo-notifications) et mock global

**Files:**
- Create: `mobile/src/platform/restNotifier.ts`, `mobile/src/platform/restNotifier.web.ts`, `mobile/src/platform/__tests__/restNotifier.test.ts`
- Modify: `mobile/src/platform/types.ts`, `mobile/src/test/jestSetup.js`, `mobile/package.json` (via `expo install`)

**Interfaces:**
- Produces:
  - `type NotifierPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable'`
  - `type NoticeTarget = { workoutId: string; exerciseId: string; setIndex: number }`
  - `type NoticeKind = 'rest' | 'work'`
  - `type NoticeAction = { id: string; action: 'plus15' | 'validate' | 'open'; kind: NoticeKind; target: NoticeTarget }` (`id` = identifiant unique de la réponse, pour ne l'appliquer qu'une fois)
  - `type ScheduledNotice = { endAt: number; title: string; body: string; kind: NoticeKind; target: NoticeTarget }`
  - `restNotifier = { permission(), requestPermission(), schedule(n), cancel(), configure(labels: { plus15: string; validate: string }), onAction(cb), lastAction(), openSettings() }`
  - `REST_NOTICE_ID = 'rest-end'`

- [ ] **Step 1: Installer**

Run: `npx expo install expo-notifications`
Expected: `expo-notifications ~57.0.x` dans `package.json`. Si `app.json` reçoit un plugin, le laisser hors commit si `app.json` contient d'autres modifications locales de l'utilisateur (vérifier `git diff app.json`) et ledger la ruling.

- [ ] **Step 2: Écrire le test de l'adaptateur**

`mobile/src/platform/__tests__/restNotifier.test.ts` :
```ts
// Le vrai adaptateur (mocké ailleurs) : identifiant fixe, déclencheur à date, catégories, réponses
jest.unmock('@/platform/restNotifier');

const listeners: ((r: unknown) => void)[] = [];
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('rest-end')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  addNotificationResponseReceivedListener: jest.fn((cb: (r: unknown) => void) => { listeners.push(cb); return { remove: jest.fn() }; }),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));

import * as Notifications from 'expo-notifications';
import { REST_NOTICE_ID, restNotifier } from '../restNotifier';

const target = { workoutId: 'w', exerciseId: 'presse', setIndex: 1 };
const response = (actionIdentifier: string, kind = 'rest') => ({
  actionIdentifier,
  notification: { request: { identifier: REST_NOTICE_ID, content: { data: { kind, ...target } } }, date: 1234 },
});

describe('restNotifier (natif)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pas de bannière ni de son quand l\'app est au premier plan', async () => {
    const handler = jest.mocked(Notifications.setNotificationHandler).mock.calls[0]?.[0];
    // Le gestionnaire est installé à l'import du module
    expect(handler).toBeDefined();
    await expect(handler!.handleNotification({} as never)).resolves.toMatchObject({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false });
  });

  it('planifie avec l\'identifiant fixe, à la date de fin, avec la catégorie du type', async () => {
    await restNotifier.schedule({ endAt: 1_800_000_000_000, title: 'Repos terminé', body: 'Presse', kind: 'rest', target });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: REST_NOTICE_ID,
      content: { title: 'Repos terminé', body: 'Presse', sound: true, categoryIdentifier: 'rest', data: { kind: 'rest', ...target } },
      trigger: { type: 'date', date: new Date(1_800_000_000_000) },
    });
  });

  it('annule par l\'identifiant fixe', async () => {
    await restNotifier.cancel();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REST_NOTICE_ID);
  });

  it('état de l\'autorisation', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ status: 'denied' } as never);
    await expect(restNotifier.permission()).resolves.toBe('denied');
  });

  it('libellés des boutons : catégories rest (+15 s) et work (Valider la série)', async () => {
    await restNotifier.configure({ plus15: '+15 s', validate: 'Valider la série' });
    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith('rest', [{ identifier: 'plus15', buttonTitle: '+15 s', options: { opensAppToForeground: false } }]);
    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith('work', [{ identifier: 'validate', buttonTitle: 'Valider la série', options: { opensAppToForeground: false } }]);
  });

  it('réponses : bouton → action ; toucher la notification → open ; id unique', async () => {
    const got: unknown[] = [];
    const off = restNotifier.onAction((a) => got.push(a));
    listeners.forEach((l) => l(response('plus15')));
    listeners.forEach((l) => l(response('expo.modules.notifications.actions.DEFAULT', 'work')));
    expect(got).toEqual([
      { id: 'rest-end:1234:plus15', action: 'plus15', kind: 'rest', target },
      { id: 'rest-end:1234:expo.modules.notifications.actions.DEFAULT', action: 'open', kind: 'work', target },
    ]);
    off();
  });

  it('dernière réponse au lancement', async () => {
    jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValueOnce(response('validate', 'work') as never);
    await expect(restNotifier.lastAction()).resolves.toMatchObject({ action: 'validate', kind: 'work', target });
  });
});
```

- [ ] **Step 3: Lancer**

Run: `npx jest src/platform/__tests__/restNotifier.test.ts`
Expected: FAIL — module `../restNotifier` introuvable.

- [ ] **Step 4: Implémenter**

`mobile/src/platform/types.ts` — ajouter à la fin :
```ts
/** Autorisation des notifications ; 'unavailable' sur le web */
export type NotifierPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';
/** Série visée par une notification de minuteur */
export type NoticeTarget = { workoutId: string; exerciseId: string; setIndex: number };
export type NoticeKind = 'rest' | 'work';
/** Réponse à une notification : bouton touché (ou notification ouverte) ; id unique pour ne l'appliquer qu'une fois */
export type NoticeAction = { id: string; action: 'plus15' | 'validate' | 'open'; kind: NoticeKind; target: NoticeTarget };
export type ScheduledNotice = { endAt: number; title: string; body: string; kind: NoticeKind; target: NoticeTarget };
```

`mobile/src/platform/restNotifier.ts` :
```ts
// ============================================================
// Notification locale de fin de minuteur (expo-notifications).
// Une seule planifiée à la fois (identifiant fixe) ; pas de bannière app ouverte ;
// boutons « +15 s » (repos) et « Valider la série » (série chronométrée).
// ============================================================
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import type { NoticeAction, NoticeKind, NoticeTarget, NotifierPermission, ScheduledNotice } from './types';

export const REST_NOTICE_ID = 'rest-end';

// App au premier plan : le son et l'haptique de l'app suffisent
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

function toAction(r: Notifications.NotificationResponse | null): NoticeAction | null {
  if (!r) return null;
  const data = (r.notification.request.content.data ?? {}) as Partial<NoticeTarget> & { kind?: NoticeKind };
  if (typeof data.workoutId !== 'string' || typeof data.exerciseId !== 'string' || typeof data.setIndex !== 'number') return null;
  const kind: NoticeKind = data.kind === 'work' ? 'work' : 'rest';
  const action = r.actionIdentifier === 'plus15' ? 'plus15' : r.actionIdentifier === 'validate' ? 'validate' : 'open';
  return {
    id: `${r.notification.request.identifier}:${r.notification.date}:${r.actionIdentifier}`,
    action,
    kind,
    target: { workoutId: data.workoutId, exerciseId: data.exerciseId, setIndex: data.setIndex },
  };
}

export const restNotifier = {
  async permission(): Promise<NotifierPermission> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  },
  async requestPermission(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },
  async schedule(n: ScheduledNotice): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      identifier: REST_NOTICE_ID,
      content: { title: n.title, body: n.body, sound: true, categoryIdentifier: n.kind, data: { kind: n.kind, ...n.target } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(n.endAt) },
    });
  },
  async cancel(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(REST_NOTICE_ID);
  },
  /** Libellés des boutons dans la langue de l'app */
  async configure(labels: { plus15: string; validate: string }): Promise<void> {
    await Notifications.setNotificationCategoryAsync('rest', [{ identifier: 'plus15', buttonTitle: labels.plus15, options: { opensAppToForeground: false } }]);
    await Notifications.setNotificationCategoryAsync('work', [{ identifier: 'validate', buttonTitle: labels.validate, options: { opensAppToForeground: false } }]);
  },
  onAction(cb: (a: NoticeAction) => void): () => void {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const a = toAction(r);
      if (a) cb(a);
    });
    return () => sub.remove();
  },
  /** Réponse reçue pendant que l'app était fermée (appliquée au lancement) */
  async lastAction(): Promise<NoticeAction | null> {
    return toAction(await Notifications.getLastNotificationResponseAsync());
  },
  async openSettings(): Promise<void> {
    await Linking.openSettings();
  },
};
```

`mobile/src/platform/restNotifier.web.ts` :
```ts
// Web : pas de notification de minuteur (adaptateur inerte)
import type { NoticeAction, NotifierPermission, ScheduledNotice } from './types';

export const REST_NOTICE_ID = 'rest-end';

export const restNotifier = {
  async permission(): Promise<NotifierPermission> { return 'unavailable'; },
  async requestPermission(): Promise<boolean> { return false; },
  async schedule(_n: ScheduledNotice): Promise<void> {},
  async cancel(): Promise<void> {},
  async configure(_labels: { plus15: string; validate: string }): Promise<void> {},
  onAction(_cb: (a: NoticeAction) => void): () => void { return () => {}; },
  async lastAction(): Promise<NoticeAction | null> { return null; },
  async openSettings(): Promise<void> {},
};
```

`mobile/src/test/jestSetup.js` — ajouter :
```js
jest.mock('@/platform/restNotifier', () => ({
  REST_NOTICE_ID: 'rest-end',
  restNotifier: {
    permission: jest.fn(() => Promise.resolve('granted')),
    requestPermission: jest.fn(() => Promise.resolve(true)),
    schedule: jest.fn(() => Promise.resolve()),
    cancel: jest.fn(() => Promise.resolve()),
    configure: jest.fn(() => Promise.resolve()),
    onAction: jest.fn(() => () => {}),
    lastAction: jest.fn(() => Promise.resolve(null)),
    openSettings: jest.fn(() => Promise.resolve()),
  },
}));
```

Si les types d'`expo-notifications` 57 diffèrent (nom des champs de `NotificationBehavior`, `SchedulableTriggerInputTypes`), suivre les types installés et ledger la ruling.

- [ ] **Step 5: Relancer**

Run: `npx jest src/platform && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/platform src/test/jestSetup.js
git commit -m "feat(mobile): add the rest notification platform adapter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Contenu de la notification (`domain/restNotice`)

**Files:**
- Create: `mobile/src/domain/restNotice.ts`, `mobile/src/domain/__tests__/restNotice.test.ts`

**Interfaces:**
- Consumes: `EffectiveExercise` (`@/domain/exerciseView`), `SetTrack` (`@/domain/progress`).
- Produces:
  - `type NoticeLine = { type: 'same' | 'next'; name: string; set: number; total: number; weight: number | null } | { type: 'done' }`
  - `type NoticeContent = { kind: 'rest' | 'work'; line: NoticeLine }`
  - `restNotice(input: { mode: 'rest' | 'work'; exerciseId: string; setIndex: number; exercises: EffectiveExercise[]; track: SetTrack; weightOf(ex: EffectiveExercise): number | null }): NoticeContent`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/__tests__/restNotice.test.ts` :
```ts
import { effectiveExercise } from '../exerciseView';
import { restNotice } from '../restNotice';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '../__fixtures__/builders';

const program = parseOrThrow(makeProgramInput({ '1': 's' }, {
  s: makeSession('S', [
    makeExercise('presse', 4, { name: 'Presse' }),
    makeExercise('dc', 3, { name: 'DC', alternatives: ['Développé haltères'] }),
    makeExercise('gainage', 3, { name: 'Gainage' }),
  ]),
}));
const [presse, dc, gainage] = program.sessions.s.exercises.map((e) => effectiveExercise(e, null));
const weights: Record<string, number> = { presse: 100 };
const weightOf = (ex: { id: string }) => weights[ex.id] ?? null;
const base = { exercises: [presse, dc, gainage], weightOf };

describe('restNotice', () => {
  it('fin de repos, séries restantes : même exercice, prochaine série non cochée, poids', () => {
    const n = restNotice({ ...base, mode: 'rest', exerciseId: 'presse', setIndex: 1, track: { presse: [true, true, false, false] } });
    expect(n).toEqual({ kind: 'rest', line: { type: 'same', name: 'Presse', set: 3, total: 4, weight: 100 } });
  });

  it('exercice terminé : exercice suivant non complet (ordre affiché), sans poids connu', () => {
    const n = restNotice({ ...base, mode: 'rest', exerciseId: 'presse', setIndex: 3, track: { presse: [true, true, true, true], dc: [true, false, false] } });
    expect(n.line).toEqual({ type: 'next', name: 'DC', set: 2, total: 3, weight: null });
  });

  it('suivant : on repart du début si les exercices après sont complets', () => {
    const n = restNotice({ ...base, mode: 'rest', exerciseId: 'gainage', setIndex: 2, track: { presse: [true, true, true, true], dc: [false, false, false], gainage: [true, true, true] } });
    expect(n.line).toMatchObject({ type: 'next', name: 'DC', set: 1 });
  });

  it('toutes les séries faites', () => {
    const n = restNotice({ ...base, mode: 'rest', exerciseId: 'gainage', setIndex: 2, track: { presse: [true, true, true, true], dc: [true, true, true], gainage: [true, true, true] } });
    expect(n.line).toEqual({ type: 'done' });
  });

  it('alternative choisie : son nom', () => {
    const alt = effectiveExercise(program.sessions.s.exercises[1], 'Développé haltères');
    const n = restNotice({ exercises: [presse, alt, gainage], weightOf, mode: 'rest', exerciseId: 'dc', setIndex: 0, track: { dc: [true, false, false] } });
    expect(n.line).toMatchObject({ type: 'same', name: 'Développé haltères', set: 2 });
  });

  it('fin d\'une série chronométrée : la série en cours', () => {
    const n = restNotice({ ...base, mode: 'work', exerciseId: 'gainage', setIndex: 1, track: { gainage: [true, false, false] } });
    expect(n).toEqual({ kind: 'work', line: { type: 'same', name: 'Gainage', set: 2, total: 3, weight: null } });
  });

  it('exercice introuvable (programme modifié) : tout fait plutôt qu\'une erreur', () => {
    expect(restNotice({ ...base, mode: 'rest', exerciseId: 'nope', setIndex: 0, track: {} }).line.type).toBe('next');
  });
});
```

Le dernier cas : l'exercice du minuteur n'existe plus ; on propose le premier exercice non complet (`next`), ou `done` s'il n'y en a pas.

- [ ] **Step 2: Lancer**

Run: `npx jest src/domain/__tests__/restNotice.test.ts`
Expected: FAIL — module `../restNotice` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/restNotice.ts` :
```ts
// ============================================================
// Contenu de la notification de fin de minuteur (pur) :
// série suivante sur le même exercice, exercice suivant (ordre affiché), ou séance finie.
// ============================================================
import type { EffectiveExercise } from './exerciseView';
import type { SetTrack } from './progress';

export type NoticeLine =
  | { type: 'same' | 'next'; name: string; set: number; total: number; weight: number | null }
  | { type: 'done' };
export type NoticeContent = { kind: 'rest' | 'work'; line: NoticeLine };

export interface NoticeInput {
  mode: 'rest' | 'work';
  exerciseId: string;
  setIndex: number;
  /** Exercices affichés (ordre, alternatives), bonus exclu */
  exercises: EffectiveExercise[];
  track: SetTrack;
  weightOf(ex: EffectiveExercise): number | null;
}

const firstOpenSet = (ex: EffectiveExercise, track: SetTrack): number => {
  const done = track[ex.id] ?? [];
  for (let i = 0; i < ex.sets; i += 1) if (done[i] !== true) return i;
  return -1;
};

const line = (type: 'same' | 'next', ex: EffectiveExercise, setIndex: number, weightOf: NoticeInput['weightOf']): NoticeLine =>
  ({ type, name: ex.performedName ?? ex.name, set: setIndex + 1, total: ex.sets, weight: weightOf(ex) });

export function restNotice(input: NoticeInput): NoticeContent {
  const { exercises, track, weightOf } = input;
  const index = exercises.findIndex((e) => e.id === input.exerciseId);
  const current = index >= 0 ? exercises[index] : undefined;

  if (input.mode === 'work' && current) {
    return { kind: 'work', line: line('same', current, input.setIndex, weightOf) };
  }
  if (current) {
    const open = firstOpenSet(current, track);
    if (open >= 0) return { kind: input.mode, line: line('same', current, open, weightOf) };
  }
  // Exercice suivant non complet : après l'exercice courant, puis depuis le début
  const order = index >= 0 ? [...exercises.slice(index + 1), ...exercises.slice(0, index)] : exercises;
  for (const ex of order) {
    const open = firstOpenSet(ex, track);
    if (open >= 0) return { kind: input.mode, line: line('next', ex, open, weightOf) };
  }
  return { kind: input.mode, line: { type: 'done' } };
}
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/domain && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat(mobile): compute the rest notification content

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Réglage `restAlerts`, parcours d'autorisation, chaînes

**Files:**
- Create: `mobile/src/features/notifications/permissionFlow.ts`, `mobile/src/features/notifications/formatNotice.ts`, `mobile/src/features/notifications/__tests__/permissionFlow.test.ts`
- Modify: `mobile/src/db/repos/settingsRepo.ts`, `mobile/src/i18n/locales/fr.json`, `mobile/src/i18n/locales/en.json`

**Interfaces:**
- Consumes: `restNotifier` (Task 1), `NoticeContent` (Task 2).
- Produces:
  - `SettingsMap.restAlerts: boolean`
  - `shouldAskForAlerts(ctx: RepoCtx, permission: NotifierPermission): boolean` — vrai seulement si `restAlerts` absent et `permission === 'undetermined'`
  - `answerAlerts(ctx: RepoCtx, accept: boolean): Promise<boolean>` — écrit `restAlerts = accept` ; si `accept`, demande l'autorisation et renvoie le résultat
  - `alertsEnabled(ctx: RepoCtx): boolean` (= `getSetting(ctx, 'restAlerts') === true`)
  - `formatNotice(c: NoticeContent, t, units: Units): { title: string; body: string }`

- [ ] **Step 1: Ajouter les chaînes** (avant `"coming_soon"`, fr puis en)

fr :
```json
  "notif_rest_title": "Repos terminé",
  "notif_work_title": "Série terminée",
  "notif_same": "%s · série %s/%s",
  "notif_next": "Suivant : %s · série %s/%s",
  "notif_done": "Toutes les séries sont faites, termine ta séance",
  "notif_action_plus15": "+15 s",
  "notif_action_validate": "Valider la série",
  "alerts_sheet_title": "Être prévenu à la fin du repos",
  "alerts_sheet_body": "Une notification à la fin de chaque repos, même téléphone verrouillé, avec la série à faire.",
  "alerts_enable": "Activer",
  "alerts_later": "Plus tard",
  "profile_open_settings": "Ouvrir les Réglages",
```
en :
```json
  "notif_rest_title": "Rest over",
  "notif_work_title": "Set done",
  "notif_same": "%s · set %s/%s",
  "notif_next": "Next: %s · set %s/%s",
  "notif_done": "All sets done, finish your session",
  "notif_action_plus15": "+15 s",
  "notif_action_validate": "Log the set",
  "alerts_sheet_title": "Get notified when rest ends",
  "alerts_sheet_body": "A notification at the end of each rest, even with the phone locked, showing the next set.",
  "alerts_enable": "Enable",
  "alerts_later": "Not now",
  "profile_open_settings": "Open Settings",
```
Clés existantes réutilisées : `profile_timer_section`, `profile_timer_alerts`, `profile_timer_alerts_on`, `profile_timer_alerts_denied`.

- [ ] **Step 2: Écrire les tests**

`mobile/src/features/notifications/__tests__/permissionFlow.test.ts` :
```ts
/** @jest-environment node */
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { restNotifier } from '@/platform/restNotifier';
import { translate } from '@/i18n/translate';
import { formatNotice } from '../formatNotice';
import { alertsEnabled, answerAlerts, shouldAskForAlerts } from '../permissionFlow';

const t = (k: Parameters<typeof translate>[1], ...a: (string | number)[]) => translate('fr', k, ...a);

describe('parcours d\'autorisation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('on demande seulement si jamais répondu et autorisation jamais demandée', () => {
    const ctx = createTestCtx();
    expect(shouldAskForAlerts(ctx, 'undetermined')).toBe(true);
    expect(shouldAskForAlerts(ctx, 'granted')).toBe(false);
    expect(shouldAskForAlerts(ctx, 'denied')).toBe(false);
    expect(shouldAskForAlerts(ctx, 'unavailable')).toBe(false);
    setSetting(ctx, 'restAlerts', false);
    expect(shouldAskForAlerts(ctx, 'undetermined')).toBe(false);
  });

  it('Activer : réglage écrit puis demande système', async () => {
    const ctx = createTestCtx();
    await expect(answerAlerts(ctx, true)).resolves.toBe(true);
    expect(restNotifier.requestPermission).toHaveBeenCalled();
    expect(getSetting(ctx, 'restAlerts')).toBe(true);
    expect(alertsEnabled(ctx)).toBe(true);
  });

  it('Plus tard : réglage désactivé, pas de demande système', async () => {
    const ctx = createTestCtx();
    await expect(answerAlerts(ctx, false)).resolves.toBe(false);
    expect(restNotifier.requestPermission).not.toHaveBeenCalled();
    expect(alertsEnabled(ctx)).toBe(false);
  });
});

describe('formatNotice', () => {
  it('fin de repos : série suivante avec poids ; exercice suivant ; tout fait ; série chronométrée', () => {
    expect(formatNotice({ kind: 'rest', line: { type: 'same', name: 'Presse', set: 3, total: 4, weight: 100 } }, t, 'kg'))
      .toEqual({ title: 'Repos terminé', body: 'Presse · série 3/4 · 100 kg' });
    expect(formatNotice({ kind: 'rest', line: { type: 'next', name: 'DC', set: 1, total: 3, weight: null } }, t, 'kg').body)
      .toBe('Suivant : DC · série 1/3');
    expect(formatNotice({ kind: 'rest', line: { type: 'done' } }, t, 'kg').body).toBe('Toutes les séries sont faites, termine ta séance');
    expect(formatNotice({ kind: 'work', line: { type: 'same', name: 'Gainage', set: 2, total: 3, weight: null } }, t, 'kg'))
      .toEqual({ title: 'Série terminée', body: 'Gainage · série 2/3' });
  });

  it('poids décimal et lbs', () => {
    expect(formatNotice({ kind: 'rest', line: { type: 'same', name: 'Curl', set: 1, total: 3, weight: 22.5 } }, t, 'lbs').body)
      .toBe('Curl · série 1/3 · 22,5 lbs');
  });
});
```

Vérifier la sortie de `formatWeight(22.5)` (`@/domain/scheme`) : si elle produit `22.5`, utiliser l'attendu réel du projet pour l'affichage des poids et ledger.

- [ ] **Step 3: Lancer**

Run: `npx jest src/features/notifications`
Expected: FAIL — modules introuvables.

- [ ] **Step 4: Implémenter**

`settingsRepo.ts` — ajouter à `SettingsMap` :
```ts
  /** Alertes de fin de repos : true activées, false refusées / désactivées ; absent = jamais demandé */
  restAlerts: boolean;
```

`mobile/src/features/notifications/permissionFlow.ts` :
```ts
// Autorisation des alertes de fin de repos : question posée une seule fois, réglage mémorisé
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { restNotifier } from '@/platform/restNotifier';
import type { NotifierPermission } from '@/platform/types';

export const alertsEnabled = (ctx: RepoCtx): boolean => getSetting(ctx, 'restAlerts') === true;

/** Feuille à afficher : jamais répondu et autorisation système jamais demandée */
export function shouldAskForAlerts(ctx: RepoCtx, permission: NotifierPermission): boolean {
  return getSetting(ctx, 'restAlerts') === undefined && permission === 'undetermined';
}

/** Réponse à la feuille ; « Activer » déclenche la demande système et renvoie son résultat */
export async function answerAlerts(ctx: RepoCtx, accept: boolean): Promise<boolean> {
  setSetting(ctx, 'restAlerts', accept);
  if (!accept) return false;
  return restNotifier.requestPermission();
}
```

`mobile/src/features/notifications/formatNotice.ts` :
```ts
// Contenu de notification → titre et texte dans la langue de l'app
import type { Units } from '@/domain/program';
import type { NoticeContent } from '@/domain/restNotice';
import { formatWeight } from '@/domain/scheme';
import type { StringKey } from '@/i18n/translate';

type T = (key: StringKey, ...args: (string | number)[]) => string;

export function formatNotice(c: NoticeContent, t: T, units: Units): { title: string; body: string } {
  const title = c.kind === 'work' ? t('notif_work_title') : t('notif_rest_title');
  const l = c.line;
  if (l.type === 'done') return { title, body: t('notif_done') };
  const head = t(l.type === 'next' ? 'notif_next' : 'notif_same', l.name, l.set, l.total);
  return { title, body: l.weight !== null ? `${head} · ${formatWeight(l.weight)} ${units}` : head };
}
```

- [ ] **Step 5: Relancer**

Run: `npx jest src/features/notifications src/i18n && npx tsc --noEmit`
Expected: PASS (dont parité fr/en), tsc propre.

- [ ] **Step 6: Commit**

```bash
git add src/db src/features/notifications src/i18n/locales
git commit -m "feat(mobile): add the rest alerts setting, permission flow and notification text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pilote — planifier / annuler en suivant le minuteur

**Files:**
- Create: `mobile/src/features/notifications/RestNotificationDriver.tsx`, `mobile/src/features/notifications/__tests__/RestNotificationDriver.test.tsx`
- Modify: `mobile/src/app/_layout.tsx` (monter le pilote)

**Interfaces:**
- Consumes: `restNotifier` (Task 1), `restNotice` (Task 2), `formatNotice`, `alertsEnabled` (Task 3), `loadTodayView`, `cardWeight` (`@/features/today/todayView`), `getWorkout` (`@/db/repos/workoutsRepo`), `getProgram` (`@/db/repos/programsRepo`), `useTimerStore`.
- Produces:
  - `composeNotice(ctx: RepoCtx, timer: TimerState, t: T): ScheduledNotice` (module, testable)
  - `RestNotificationDriver()` — composant monté dans `ThemedStack`

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/notifications/__tests__/RestNotificationDriver.test.tsx` :
```tsx
import { act } from '@testing-library/react-native';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { setSetting } from '@/db/repos/settingsRepo';
import { ensureWorkout, upsertSet } from '@/db/repos/workoutsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { startTimer } from '@/domain/timer';
import { restNotifier } from '@/platform/restNotifier';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { RestNotificationDriver } from '../RestNotificationDriver';

const NOW = new Date(2026, 9, 5, 10).getTime();

async function setup(opts: { alerts?: boolean } = { alerts: true }) {
  const ctx = createTestCtx();
  const p = createProgram(ctx, makeProgramInput({ '1': 'fb' }, {
    fb: makeSession('FB', [makeExercise('presse', 3, { name: 'Presse' }), makeExercise('gainage', 2, { name: 'Gainage' })]),
  }), 'manual');
  setActiveProgram(ctx, p.id);
  if (opts.alerts !== undefined) setSetting(ctx, 'restAlerts', opts.alerts);
  const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 'fb', date: '2026-10-05' });
  upsertSet(ctx, w.id, 'presse', 0, { done: true });
  await renderWithProviders(<RestNotificationDriver />, { ctx });
  const rest = (setIndex = 0, durationSec = 90) => startTimer({ mode: 'rest', nowMs: NOW, durationSec, workoutId: w.id, exerciseId: 'presse', setIndex });
  return { ctx, w, rest };
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('RestNotificationDriver — planification', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useTimerStore.setState(TIMER_INITIAL); });
  });

  it('repos démarré → notification planifiée à l\'heure de fin avec la série suivante', async () => {
    const { ctx, rest, w } = await setup();
    await act(async () => { useTimerStore.getState().start(ctx, rest()); });
    await flush();
    expect(restNotifier.schedule).toHaveBeenLastCalledWith({
      endAt: NOW + 90_000, title: 'Repos terminé', body: 'Presse · série 2/3', kind: 'rest',
      target: { workoutId: w.id, exerciseId: 'presse', setIndex: 0 },
    });
  });

  it('Review Focus 3 : ajusté plusieurs fois → dernière heure de fin', async () => {
    const { ctx, rest } = await setup();
    await act(async () => {
      useTimerStore.getState().start(ctx, rest());
      useTimerStore.getState().adjust(ctx, 15, NOW);
      useTimerStore.getState().adjust(ctx, 15, NOW);
    });
    await flush();
    expect(jest.mocked(restNotifier.schedule).mock.calls.at(-1)?.[0].endAt).toBe(NOW + 120_000);
  });

  it('minuteur arrêté → notification annulée', async () => {
    const { ctx, rest } = await setup();
    await act(async () => { useTimerStore.getState().start(ctx, rest()); });
    await flush();
    await act(async () => { useTimerStore.getState().clear(ctx); });
    await flush();
    expect(restNotifier.cancel).toHaveBeenCalled();
  });

  it('réglage désactivé → rien de planifié', async () => {
    const { ctx, rest } = await setup({ alerts: false });
    await act(async () => { useTimerStore.getState().start(ctx, rest()); });
    await flush();
    expect(restNotifier.schedule).not.toHaveBeenCalled();
  });

  it('Review Focus 4 : autorisation retirée dans iOS → rien de planifié', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('denied');
    const { ctx, rest } = await setup();
    await act(async () => { useTimerStore.getState().start(ctx, rest()); });
    await flush();
    expect(restNotifier.schedule).not.toHaveBeenCalled();
    jest.mocked(restNotifier.permission).mockResolvedValue('granted');
  });

  it('Review Focus 2 : réglage désactivé alors qu\'une notification attend → annulée', async () => {
    const { ctx, rest } = await setup();
    await act(async () => { useTimerStore.getState().start(ctx, rest()); });
    await flush();
    jest.mocked(restNotifier.cancel).mockClear();
    await act(async () => { setSetting(ctx, 'restAlerts', false); usePrefs.getState().bumpData(); });
    await flush();
    expect(restNotifier.cancel).toHaveBeenCalled();
  });

  it('libellés des boutons configurés dans la langue de l\'app', async () => {
    await setup();
    await flush();
    expect(restNotifier.configure).toHaveBeenCalledWith({ plus15: '+15 s', validate: 'Valider la série' });
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/notifications/__tests__/RestNotificationDriver.test.tsx`
Expected: FAIL — module `../RestNotificationDriver` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/notifications/RestNotificationDriver.tsx` :
```tsx
// ============================================================
// Pilote des notifications de fin de minuteur (sans affichage, monté à la racine) :
// planifie à chaque démarrage / ajustement, annule à l'arrêt ; applique les actions.
// ============================================================
import { useEffect } from 'react';
import { useRepoCtx } from '@/db/DbContext';
import { getProgram } from '@/db/repos/programsRepo';
import { getWorkout } from '@/db/repos/workoutsRepo';
import type { RepoCtx } from '@/db/types';
import { restNotice } from '@/domain/restNotice';
import type { TimerState } from '@/domain/timer';
import { useDbQuery } from '@/features/common/useDbQuery';
import { cardWeight, loadTodayView } from '@/features/today/todayView';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { restNotifier } from '@/platform/restNotifier';
import type { ScheduledNotice } from '@/platform/types';
import { useTimerStore } from '@/state/timerStore';
import { formatNotice } from './formatNotice';
import { alertsEnabled } from './permissionFlow';

type T = (key: StringKey, ...args: (string | number)[]) => string;

/** Notification d'un minuteur : texte calculé depuis la séance (texte minimal si elle est introuvable) */
export function composeNotice(ctx: RepoCtx, timer: TimerState, t: T): ScheduledNotice {
  const target = { workoutId: timer.workoutId, exerciseId: timer.exerciseId, setIndex: timer.setIndex };
  const fallback = { endAt: timer.endAt, title: timer.mode === 'work' ? t('notif_work_title') : t('notif_rest_title'), body: '', kind: timer.mode, target };
  const workout = getWorkout(ctx, timer.workoutId);
  const program = workout ? getProgram(ctx, workout.programId) : null;
  if (!workout || !program) return fallback;
  const view = loadTodayView(ctx, program, workout.sessionKey, workout.date);
  const content = restNotice({
    mode: timer.mode, exerciseId: timer.exerciseId, setIndex: timer.setIndex,
    exercises: view.exercises, track: view.track, weightOf: (ex) => cardWeight(view, ex),
  });
  return { ...fallback, ...formatNotice(content, t, program.definition.meta.units) };
}

/** Planifie ou annule (erreurs ignorées : le minuteur au premier plan fonctionne toujours) */
async function sync(ctx: RepoCtx, timer: TimerState | null, enabled: boolean, t: T): Promise<void> {
  try {
    if (!timer || !enabled || timer.endAt <= Date.now() || (await restNotifier.permission()) !== 'granted') {
      await restNotifier.cancel();
      return;
    }
    await restNotifier.schedule(composeNotice(ctx, timer, t));
  } catch {
    // ignoré
  }
}

export function RestNotificationDriver() {
  const ctx = useRepoCtx();
  const { t } = useI18n();
  const timer = useTimerStore((s) => s.timer);
  const enabled = useDbQuery(alertsEnabled);

  // Libellés des boutons dans la langue de l'app
  useEffect(() => {
    restNotifier.configure({ plus15: t('notif_action_plus15'), validate: t('notif_action_validate') }).catch(() => {});
  }, [t]);

  useEffect(() => {
    void sync(ctx, timer, enabled, t);
  }, [ctx, timer, enabled, t]);

  return null;
}
```

Remarque : la règle « `timer.endAt <= Date.now()` → annuler » évite de planifier dans le passé (minuteur relu au lancement déjà échu).

`mobile/src/app/_layout.tsx` — dans `ThemedStack`, importer et monter le pilote à côté de `<Toast />` :
```tsx
import { RestNotificationDriver } from '@/features/notifications/RestNotificationDriver';
```
```tsx
      <Toast />
      <RestNotificationDriver />
      <HideSplashWhenReady />
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/notifications && npx tsc --noEmit`
Expected: PASS, tsc propre. Le test « première série » utilise la séance déjà cochée en série 1 (`presse` index 0) : prochaine série = 2/3.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications src/app/_layout.tsx
git commit -m "feat(mobile): schedule the rest notification from the timer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pilote — actions de la notification (+15 s, Valider la série, au lancement)

**Files:**
- Modify: `mobile/src/features/notifications/RestNotificationDriver.tsx`
- Create: `mobile/src/features/notifications/applyAction.ts`
- Test: `mobile/src/features/notifications/__tests__/applyAction.test.ts`

**Interfaces:**
- Consumes: `NoticeAction` (Task 1), `completeWorkTimer` (`@/features/today/actions`), `startTimer`, `useTimerStore`, `usePrefs.bumpData`.
- Produces: `applyAction(ctx: RepoCtx, a: NoticeAction, nowMs: number): boolean` — applique au plus une fois chaque `a.id` (mémoire de module) ; renvoie true si appliquée ; `resetAppliedActions()` (tests).

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/notifications/__tests__/applyAction.test.ts` :
```ts
/** @jest-environment node */
import { createProgram } from '@/db/repos/programsRepo';
import { ensureWorkout, listEntries } from '@/db/repos/workoutsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { startTimer } from '@/domain/timer';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { applyAction, resetAppliedActions } from '../applyAction';

const NOW = 1_800_000_000_000;

function setup() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, makeProgramInput({ '1': 'fb' }, { fb: makeSession('FB', [makeExercise('gainage', 3, { name: 'Gainage' })]) }), 'manual');
  const w = ensureWorkout(ctx, { programId: p.id, sessionKey: 'fb', date: '2026-10-05' });
  const target = { workoutId: w.id, exerciseId: 'gainage', setIndex: 1 };
  return { ctx, w, target };
}

describe('applyAction', () => {
  beforeEach(() => { useTimerStore.setState(TIMER_INITIAL); resetAppliedActions(); });

  it('+15 s après la fin du repos : nouveau repos de 15 s sur la même série', () => {
    const { ctx, target } = setup();
    expect(applyAction(ctx, { id: 'a', action: 'plus15', kind: 'rest', target }, NOW)).toBe(true);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', endAt: NOW + 15_000, ...target });
  });

  it('Valider la série (fin de série chronométrée) : série enregistrée, repos suivant', () => {
    const { ctx, w, target } = setup();
    useTimerStore.getState().start(ctx, startTimer({
      mode: 'work', nowMs: NOW - 45_000, durationSec: 45, ...target,
      pending: { weight: null, reps: null, performedName: null, restSec: 60 },
    }));
    expect(applyAction(ctx, { id: 'b', action: 'validate', kind: 'work', target }, NOW)).toBe(true);
    expect(listEntries(ctx, w.id).find((e) => e.setIndex === 1)?.done).toBe(true);
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest' });
  });

  it('action périmée (le minuteur a changé) : ignorée', () => {
    const { ctx, target } = setup();
    useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs: NOW, durationSec: 90, ...target, setIndex: 2 }));
    expect(applyAction(ctx, { id: 'c', action: 'plus15', kind: 'rest', target }, NOW)).toBe(false);
    expect(applyAction(ctx, { id: 'd', action: 'validate', kind: 'work', target }, NOW)).toBe(false);
  });

  it('Review Focus 1 : même réponse reçue deux fois → appliquée une seule fois', () => {
    const { ctx, target } = setup();
    expect(applyAction(ctx, { id: 'same', action: 'plus15', kind: 'rest', target }, NOW)).toBe(true);
    useTimerStore.getState().clear(ctx);
    expect(applyAction(ctx, { id: 'same', action: 'plus15', kind: 'rest', target }, NOW + 1000)).toBe(false);
    expect(useTimerStore.getState().timer).toBeNull();
  });

  it('notification simplement ouverte : rien à appliquer', () => {
    const { ctx, target } = setup();
    expect(applyAction(ctx, { id: 'e', action: 'open', kind: 'rest', target }, NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/notifications/__tests__/applyAction.test.ts`
Expected: FAIL — module `../applyAction` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/notifications/applyAction.ts` :
```ts
// Actions des notifications de minuteur : « +15 s » (fin de repos), « Valider la série » (fin de série chronométrée).
// Chaque réponse n'est appliquée qu'une fois (temps réel et « dernière réponse » au lancement peuvent se recouper).
import type { RepoCtx } from '@/db/types';
import { startTimer } from '@/domain/timer';
import { completeWorkTimer } from '@/features/today/actions';
import type { NoticeAction } from '@/platform/types';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';

const EXTRA_REST_SEC = 15;
const applied = new Set<string>();

export function resetAppliedActions(): void {
  applied.clear();
}

export function applyAction(ctx: RepoCtx, a: NoticeAction, nowMs: number): boolean {
  if (a.action === 'open' || applied.has(a.id)) return false;
  const timer = useTimerStore.getState().timer;
  const same = timer !== null && timer.workoutId === a.target.workoutId && timer.exerciseId === a.target.exerciseId && timer.setIndex === a.target.setIndex;

  if (a.action === 'plus15') {
    // Le repos est fini (plus de minuteur) ou c'est toujours le même
    if (timer !== null && !same) return false;
    applied.add(a.id);
    useTimerStore.getState().start(ctx, startTimer({ mode: 'rest', nowMs, durationSec: EXTRA_REST_SEC, ...a.target }));
    usePrefs.getState().bumpData();
    return true;
  }
  // validate : seulement si la série chronométrée visée est toujours en cours
  if (!timer || !same || timer.mode !== 'work') return false;
  applied.add(a.id);
  completeWorkTimer(ctx, timer, nowMs, true);
  usePrefs.getState().bumpData();
  return true;
}
```

`RestNotificationDriver.tsx` — brancher les actions (temps réel + au lancement) :
```tsx
import { applyAction } from './applyAction';
```
```tsx
  // Actions des notifications : en temps réel, et celle reçue pendant que l'app était fermée
  useEffect(() => {
    const off = restNotifier.onAction((a) => { applyAction(ctx, a, Date.now()); });
    restNotifier.lastAction().then((a) => { if (a) applyAction(ctx, a, Date.now()); }).catch(() => {});
    return off;
  }, [ctx]);
```
Ajouter au test du pilote (fichier de la Task 4) :
```tsx
describe('RestNotificationDriver — actions', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useTimerStore.setState(TIMER_INITIAL); });
  });

  it('écoute les réponses et applique la dernière réponse au lancement', async () => {
    const { w } = await setup();
    // setup() a déjà monté le pilote : on vérifie l'abonnement et la lecture au lancement
    expect(restNotifier.onAction).toHaveBeenCalled();
    expect(restNotifier.lastAction).toHaveBeenCalled();
    const cb = jest.mocked(restNotifier.onAction).mock.calls[0][0];
    await act(async () => { cb({ id: 'x', action: 'plus15', kind: 'rest', target: { workoutId: w.id, exerciseId: 'presse', setIndex: 0 } }); });
    expect(useTimerStore.getState().timer).toMatchObject({ mode: 'rest', exerciseId: 'presse' });
  });
});
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/notifications && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications
git commit -m "feat(mobile): handle +15 s and log-the-set notification actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Feuille d'autorisation à la première série (Today)

**Files:**
- Create: `mobile/src/features/notifications/AlertsPermissionSheet.tsx`, `mobile/src/features/notifications/__tests__/AlertsPermissionSheet.test.tsx`
- Modify: `mobile/src/features/today/TodaySessionBody.tsx`

**Interfaces:**
- Consumes: `shouldAskForAlerts`, `answerAlerts` (Task 3), `restNotifier.permission` (Task 1), `BottomSheet`.
- Produces: `AlertsPermissionSheet({ visible, onClose })` ; Today ouvre la feuille après une série cochée qui démarre un minuteur, si `shouldAskForAlerts`.

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/notifications/__tests__/AlertsPermissionSheet.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { getSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { TodayScreen } from '@/features/today/TodayScreen';
import { restNotifier } from '@/platform/restNotifier';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TIMER_INITIAL, useTimerStore } from '@/state/timerStore';
import { renderWithProviders } from '@/test/renderWithProviders';

const MONDAY = new Date(2026, 9, 5, 10, 0, 0);

async function setup() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, makeProgramInput({ '1': 'fb' }, { fb: makeSession('FB', [makeExercise('presse', 3, { name: 'Presse', restSec: 90 })]) }), 'manual');
  setActiveProgram(ctx, p.id);
  await renderWithProviders(<TodayScreen />, { ctx });
  return ctx;
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('feuille d\'autorisation des alertes', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
    jest.clearAllMocks();
    jest.mocked(restNotifier.permission).mockResolvedValue('undetermined');
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useTimerStore.setState(TIMER_INITIAL); });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(restNotifier.permission).mockResolvedValue('granted');
  });

  it('première série cochée → feuille ; Activer → demande système, réglage activé', async () => {
    const ctx = await setup();
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    await flush();
    expect(screen.getByText('Être prévenu à la fin du repos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Activer' }));
    await flush();
    expect(restNotifier.requestPermission).toHaveBeenCalled();
    expect(getSetting(ctx, 'restAlerts')).toBe(true);
    expect(screen.queryByText('Être prévenu à la fin du repos')).toBeNull();
  });

  it('Plus tard → réglage désactivé, plus jamais redemandé', async () => {
    const ctx = await setup();
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Plus tard' }));
    await flush();
    expect(getSetting(ctx, 'restAlerts')).toBe(false);
    await fireEvent.press(screen.getByTestId('set-presse-1'));
    await flush();
    expect(screen.queryByText('Être prévenu à la fin du repos')).toBeNull();
  });

  it('Review Focus 5 : notifications indisponibles (web) → jamais de feuille', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('unavailable');
    await setup();
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    await flush();
    expect(screen.queryByText('Être prévenu à la fin du repos')).toBeNull();
  });

  it('autorisation déjà accordée → pas de feuille', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('granted');
    await setup();
    await fireEvent.press(screen.getByTestId('set-presse-0'));
    await flush();
    expect(screen.queryByText('Être prévenu à la fin du repos')).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/notifications/__tests__/AlertsPermissionSheet.test.tsx`
Expected: FAIL — la feuille n'apparaît pas.

- [ ] **Step 3: Implémenter**

`mobile/src/features/notifications/AlertsPermissionSheet.tsx` :
```tsx
// Feuille « Être prévenu à la fin du repos » : Activer (demande système) ou Plus tard (ne plus demander)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { BottomSheet } from '@/features/common/BottomSheet';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { answerAlerts } from './permissionFlow';

export function AlertsPermissionSheet({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const answer = async (accept: boolean) => {
    onClose();
    await answerAlerts(ctx, accept).catch(() => false);
    usePrefs.getState().bumpData();
  };
  const actions = (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={() => void answer(false)} style={[styles.btn, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('alerts_later')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void answer(true)} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
        <Text style={{ color: colors.onGold, fontFamily: fonts.uiBold }}>{t('alerts_enable')}</Text>
      </Pressable>
    </View>
  );
  return (
    <BottomSheet visible={visible} title={t('alerts_sheet_title')} onClose={() => void answer(false)} footer={actions}>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('alerts_sheet_body')}</Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, minHeight: TOUCH_MIN + 4, alignItems: 'center', justifyContent: 'center' },
});
```

Fermer la feuille sans choisir (voile, retour Android) compte comme « Plus tard » : la question n'est posée qu'une fois (spec : « Plus tard » ne redemande pas).

`TodaySessionBody.tsx` :
- importer `AlertsPermissionSheet`, `shouldAskForAlerts` et `restNotifier` ;
- état `const [askAlerts, setAskAlerts] = useState(false);`
- fonction de module (hors composant, compatible React Compiler) :
```tsx
/** Après une série qui démarre un minuteur : faut-il proposer les alertes ? */
async function needsAlertsPrompt(ctx: RepoCtx): Promise<boolean> {
  if (useTimerStore.getState().timer === null) return false;
  try {
    return shouldAskForAlerts(ctx, await restNotifier.permission());
  } catch {
    return false;
  }
}
```
- dans `card(...)`, remplacer `onPressSet={(i) => run(() => pressSet(env(), view, ex, i))}` par :
```tsx
      onPressSet={(i) => {
        if (run(() => pressSet(env(), view, ex, i))) {
          void needsAlertsPrompt(ctx).then((ask) => { if (ask) setAskAlerts(true); });
        }
      }}
```
- rendre la feuille avant `SwapSheet` :
```tsx
      <AlertsPermissionSheet visible={askAlerts} onClose={() => setAskAlerts(false)} />
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/notifications src/features/today && npx tsc --noEmit`
Expected: PASS, tsc propre ; les tests Today existants passent (mock `permission` → `'granted'` par défaut : pas de feuille).

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications src/features/today
git commit -m "feat(mobile): ask for rest alerts on the first logged set

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Profil — section « Minuteur »

**Files:**
- Create: `mobile/src/features/profile/TimerSection.tsx`, `mobile/src/features/profile/__tests__/TimerSection.test.tsx`
- Modify: `mobile/src/features/profile/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `restNotifier` (Task 1), `alertsEnabled`, `answerAlerts` (Task 3), `getSetting` / `setSetting`.
- Produces: `TimerSection()` ; rendu `null` si `permission()` vaut `'unavailable'`.

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/profile/__tests__/TimerSection.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { restNotifier } from '@/platform/restNotifier';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TimerSection } from '../TimerSection';

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('TimerSection', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); });
  });
  afterEach(() => jest.mocked(restNotifier.permission).mockResolvedValue('granted'));

  it('activé + autorisé : « Son, vibration et notifications »', async () => {
    const ctx = createTestCtx();
    setSetting(ctx, 'restAlerts', true);
    await renderWithProviders(<TimerSection />, { ctx });
    await flush();
    expect(screen.getByText('Son, vibration et notifications')).toBeTruthy();
    expect(screen.getByTestId('alerts-switch').props.value).toBe(true);
  });

  it('Review Focus 4 : activé mais refusé dans iOS → message + bouton Réglages', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('denied');
    const ctx = createTestCtx();
    setSetting(ctx, 'restAlerts', true);
    await renderWithProviders(<TimerSection />, { ctx });
    await flush();
    expect(screen.getByText('Refusées — autoriser dans Réglages du téléphone')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir les Réglages' }));
    expect(restNotifier.openSettings).toHaveBeenCalled();
  });

  it('activer alors que jamais demandé → demande système ; désactiver → réglage false', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('undetermined');
    const ctx = createTestCtx();
    await renderWithProviders(<TimerSection />, { ctx });
    await flush();
    await fireEvent(screen.getByTestId('alerts-switch'), 'valueChange', true);
    await flush();
    expect(restNotifier.requestPermission).toHaveBeenCalled();
    expect(getSetting(ctx, 'restAlerts')).toBe(true);
    await fireEvent(screen.getByTestId('alerts-switch'), 'valueChange', false);
    await flush();
    expect(getSetting(ctx, 'restAlerts')).toBe(false);
  });

  it('web (indisponible) : section absente', async () => {
    jest.mocked(restNotifier.permission).mockResolvedValue('unavailable');
    await renderWithProviders(<TimerSection />, { ctx: createTestCtx() });
    await flush();
    expect(screen.queryByText('MINUTEUR')).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/profile/__tests__/TimerSection.test.tsx`
Expected: FAIL — module `../TimerSection` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/profile/TimerSection.tsx` :
```tsx
// Profil · Minuteur — alertes de fin de repos : réglage, état de l'autorisation, lien vers les Réglages iOS
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { setSetting } from '@/db/repos/settingsRepo';
import { useDbQuery } from '@/features/common/useDbQuery';
import { alertsEnabled, answerAlerts } from '@/features/notifications/permissionFlow';
import { useI18n } from '@/i18n/I18nProvider';
import { restNotifier } from '@/platform/restNotifier';
import type { NotifierPermission } from '@/platform/types';
import { usePrefs } from '@/state/prefsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

/** Bascule du réglage (fonction de module : compatible React Compiler) */
async function toggleAlerts(ctx: Parameters<typeof alertsEnabled>[0], on: boolean, permission: NotifierPermission): Promise<void> {
  if (on && permission === 'undetermined') await answerAlerts(ctx, true).catch(() => false);
  else setSetting(ctx, 'restAlerts', on);
  usePrefs.getState().bumpData();
}

export function TimerSection() {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const enabled = useDbQuery(alertsEnabled);
  const [permission, setPermission] = useState<NotifierPermission | null>(null);

  // État réel de l'autorisation : au montage, après un changement de réglage et au retour au premier plan
  useEffect(() => {
    const read = () => { restNotifier.permission().then(setPermission).catch(() => setPermission('unavailable')); };
    read();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') read(); });
    return () => sub.remove();
  }, [enabled]);

  if (permission === null || permission === 'unavailable') return null;
  const denied = permission === 'denied';
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };

  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('profile_timer_section').toUpperCase()}</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={label}>{t('profile_timer_alerts').toUpperCase()}</Text>
          {enabled ? (
            <Text style={{ color: denied ? colors.rust : colors.textDim, fontFamily: fonts.ui }}>
              {denied ? t('profile_timer_alerts_denied') : t('profile_timer_alerts_on')}
            </Text>
          ) : null}
        </View>
        <Switch
          testID="alerts-switch"
          accessibilityLabel={t('profile_timer_alerts')}
          value={enabled}
          onValueChange={(on) => void toggleAlerts(ctx, on, permission)}
        />
      </View>
      {enabled && denied ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile_open_settings')}
          onPress={() => void restNotifier.openSettings().catch(() => {})}
          style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}
        >
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('profile_open_settings')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 4 },
  btn: { minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
```

`ProfileScreen.tsx` — importer `TimerSection` et le rendre entre `SettingsSection` et `DataSection` :
```tsx
      <SettingsSection />
      <TimerSection />
      <DataSection onImport={onImport} />
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/profile && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile
git commit -m "feat(mobile): add the Timer section with rest alerts to Profile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Checklist M6 et vérification complète

**Files:**
- Modify: `mobile/docs/DEVICE_CHECKLIST.md`

- [ ] **Step 1: Checklist**

Ajouter à `mobile/docs/DEVICE_CHECKLIST.md` :
```markdown

## M6 — Notification de fin de repos (Expo Go)
- [ ] Première série cochée : feuille « Être prévenu à la fin du repos » ; « Activer » → demande iOS ; « Plus tard » → plus jamais affichée.
- [ ] Série cochée puis téléphone verrouillé : notification « Repos terminé — Presse à cuisses · série 2/4 · 100 kg » à la fin du repos.
- [ ] Dernière série d'un exercice : « Suivant : … » ; tout fait : « Toutes les séries sont faites… ».
- [ ] App ouverte à la fin du repos : pas de bannière (son et vibration de l'app seulement).
- [ ] « +15 s » / « −15 s » / « Passer » dans la barre de repos : la notification suit (une seule, à la bonne heure, ou annulée).
- [ ] Bouton « +15 s » sur la notification (sans ouvrir l'app) : nouveau repos de 15 s, nouvelle notification.
- [ ] Série chronométrée (gainage) : notification « Série terminée » ; bouton « Valider la série » → série cochée, repos lancé.
- [ ] App fermée (balayée) pendant le repos : la notification arrive quand même ; une action dessus est appliquée à la réouverture.
- [ ] Profil › Minuteur : désactiver → plus de notification ; refuser dans Réglages iOS → « Refusées » + « Ouvrir les Réglages ».
- [ ] Web : ni feuille ni section Minuteur.
```

- [ ] **Step 2: Vérification complète**

Run: `npx jest && npx tsc --noEmit && npx expo export --platform web --output-dir "$TEMP/m6-web" && npx expo export --platform ios --output-dir "$TEMP/m6-ios"`
Expected: suite verte, `tsc` propre, deux bundles exportés.

- [ ] **Step 3: Commit**

```bash
git add docs/DEVICE_CHECKLIST.md
git commit -m "docs(mobile): add the M6 device checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Couverture de la spec (auto-revue)

| Exigence (addendum M6) | Task |
|---|---|
| Notification locale, identifiant fixe, planifiée au démarrage, remplacée à l'ajustement, annulée à l'arrêt | 1, 5 |
| Pas de bannière app ouverte | 1 |
| Rien si réglage désactivé ou autorisation absente ; annulation si désactivé | 5 |
| Texte : série suivante / exercice suivant / tout fait ; poids ; alternative ; série chronométrée | 2, 3 |
| Texte minimal si séance introuvable ; erreurs ignorées | 5 |
| Actions « +15 s » et « Valider la série », règle de correspondance, au lancement, une seule fois | 1, 6 |
| Feuille d'autorisation à la première série ; Activer / Plus tard | 3, 7 |
| Profil › Minuteur : trois états, bouton Réglages | 8 |
| Web inerte | 1, 7, 8 |
| `expo-notifications`, pas de build | 1, 9 |
| Checklist Expo Go | 9 |
