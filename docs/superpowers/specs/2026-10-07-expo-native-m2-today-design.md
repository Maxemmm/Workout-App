# App native Expo — Jalon M2 (Today) — Addendum de design

> Complète `2026-10-05-expo-native-foundation-design.md` (spec du sous-projet 1), qui reste la référence. Ce document fixe ce que la spec laissait ouvert pour le M2 et les améliorations natives retenues. En cas de divergence, **cet addendum l'emporte pour le M2**.

## 0. Périmètre

**Objectif :** l'écran Today atteint la parité avec la PWA, plus quatre améliorations natives, sur iOS, Android et web.

**Parité PWA :** cartes d'exercices, cercles cochables, carte verte, compteur X / N, sélecteur de poids mémorisé, note de séance, échauffement, bloc cardio, cartes de conseils (`cardio` / `rest`), écran de repos implicite, « Terminer la séance » (avec confirmation si incomplète), « Réinitialiser la séance du jour », minuteur de repos (rouge sous 10 s, vibration, deux bips, flash), **chrono d'effort des exercices chronométrés**, écran allumé.

**Ajouts exigés par le `CLAUDE.md` mais absents du Today de la PWA :** réordonnancement et échange vers une alternative, section BONUS, règles du programme.

**Améliorations natives retenues :**
1. **Séance terminée visible** : récapitulatif + « Rouvrir » au lieu de remettre les cercles à zéro.
2. **Poids / reps par série** : appui long sur un cercle.
3. **« La dernière fois »** sur chaque carte.
4. **Minuteur pilotable** : barre flottante avec −15 s / +15 s / Passer.

**Hors M2 :** notification de fin de repos en arrière-plan (M6), Live Activity (M7), Santé (M8). Leurs appels sont des points d'extension vides dans le flux du minuteur et de « Terminer ».

**Architecture d'état retenue :** SQLite est la seule source de vérité. Chaque action écrit immédiatement via un repository, puis `bumpData()` ; l'écran relit par `useDbQuery`. Seul le minuteur vit dans Zustand (persisté dans `settings.activeRest`).

---

## 1. Unités

### 1.1 `src/domain/` (pur, TDD)
| Fichier | Rôle |
|---|---|
| `exerciseView.ts` | `effectiveExercise(exercise, swapName?)` : exercice affiché. Une alternative **objet** surcharge `name`, `sets`, `scheme`, `load`, `restSec`, `timed` (champ absent → valeur de l'original) ; une alternative **chaîne** ne change que `name`. Un `swapName` qui ne correspond à aucune alternative est ignoré. `weightKey(exerciseId, swapName?)` → `id` ou `id::nomAlternative`. |
| `scheme.ts` | `schemeReps(scheme)` (nombre de reps ou `null`), `isTimed(exercise)` (règle PWA : `timed` explicite, sinon « N sec » dans le schéma), `workSeconds(exercise)`, `formatScheme(exercise)` (« 4 × 8 », « 3 × 45 sec »), `suggestedWeight(load)` (premier nombre), `weightStep(units)` (2,5 kg / 5 lbs). |
| `progress.ts` (étendu) | Compteur sur les exercices **effectifs** de la séance principale (bonus exclus de N). `sessionSummary(entries, startedAt, completedAt)` → durée, séries faites, volume (Σ poids × reps des séries cochées ayant poids et reps). |
| `timer.ts` | État du minuteur unique `{ mode: 'rest' \| 'work', endAt, durationSec, workoutId, exerciseId, setIndex? }` ; `adjust(state, ±15)` (jamais sous `now`), `phase(state, now)` → `running \| critical \| done`, `reviveOnStartup(state, now)` (purge si `endAt` dépassé). |
| `reorder.ts` | `moveId(order, fromIndex, toIndex)`. |

### 1.2 `src/db/repos/` (nouveaux)
| Repository | Fonctions |
|---|---|
| `workoutsRepo` | `findWorkout(programId, sessionKey, date)`, `ensureWorkout(...)` (création paresseuse), `setDone(workoutId, exerciseId, setIndex, done, { weight, reps, performedName })`, `editSet(entryId, { weight, reps })`, `completeWorkout`, `reopenWorkout`, `resetWorkout` (suppression logique du workout et de ses séries, transaction), `findStaleInProgress(today)`, `clearExerciseSets(workoutId, exerciseId)` |
| `weightsRepo` | `getWeight(key)`, `setWeight(key, weight, unit)` (vide → suppression logique) |
| `layoutsRepo` | `getLayout(programId, sessionKey)`, `setOrder(...)`, `setSwap(..., exerciseId, name \| null)` |
| `historyRepo` | `lastPerformance(exerciseId, performedName \| null, beforeDate)` → `{ date, sets, reps, maxWeight }` ou `null` |

### 1.3 `src/platform/` (interfaces spec §5.2)
`haptics` (`light` / `success` / `warning`), `keepAwake` (`activate` / `deactivate`), `sound` (`playRestDone()`). Implémentations natives : `expo-haptics`, `expo-keep-awake`, `expo-audio` ; web : `navigator.vibrate`, Wake Lock, Web Audio. Les écrans ne testent jamais `Platform.OS`.

### 1.4 `src/state/timerStore.ts`
Zustand : `start`, `adjust`, `skip`, `cancel`, `hydrate(ctx)` ; chaque changement est recopié dans `settings.activeRest`.

### 1.5 `src/features/today/`
`useTodaySession` (toutes les lectures de l'écran), `TodayScreen`, `ProgressBar`, `SessionNote`, `WarmupBlock`, `ExerciseCard`, `SetCircle`, `WeightStepper`, `LastTimeLine`, `SetEditSheet`, `SwapSheet`, `ReorderableList`, `CardioBlock`, `BonusBlock`, `RulesBlock`, `TipsList`, `RestDayScreen`, `RestBar`, `FinishBar`, `CompletedSummary`, `ResumeBanner`.

---

## 2. Données et flux

- **Workout du jour.** Créé au **premier cercle coché** seulement ; consulter un jour n'écrit rien. Date = jour local courant, **quel que soit le jour consulté** (comportement PWA : cocher la séance du mercredi un lundi crée le workout du lundi pour cette séance).
- **Cocher.** Upsert de `set_entries` (`done`, `done_at`), avec le poids affiché sur la carte à cet instant, `reps = schemeReps(scheme)` (vide pour un exercice chronométré), `performed_name` = nom de l'alternative si échange.
- **Décocher.** `done = false`, la ligne est conservée.
- **Poids de carte.** Affiché : poids mémorisé pour `weightKey`, sinon `suggestedWeight(load)`, sinon « — ». Une modification met à jour `exercise_weights` immédiatement et **s'applique aux séries cochées ensuite** ; les séries déjà cochées gardent leur poids (corrigeable par appui long). *Remplace* « pré-remplit toutes les séries » de la spec §3.4.
- **Poids par alternative.** `exercise_weights.exercise_id` reçoit la clé `id::nomAlternative` pour une variante échangée. Les `set_entries` gardent l'`exercise_id` du programme (stats rattachées à l'exercice du programme).
- **Appui long sur un cercle.** Feuille de saisie poids / reps de la série. Sur une série non cochée, valider la feuille coche la série avec ces valeurs et démarre le repos, exactement comme un tap (pas de chrono d'effort : la série est considérée comme faite).
- **Échange.** Feuille listant l'original et les alternatives. Mémorisé dans `session_layouts.swaps` (persistant d'une semaine sur l'autre). Si l'exercice a des séries cochées aujourd'hui : confirmation, puis `clearExerciseSets` et `setSwap` dans **une transaction**.
- **Ordre.** Glisser-déposer → `setOrder` ; `orderExercises` gère déjà les ids inconnus ou nouveaux.
- **Terminer.** Visible dès une série cochée. Confirmation si des séries restent non cochées. `status = completed`, `completed_at`. L'écran affiche `CompletedSummary` ; les cartes restent visibles, cochées et verrouillées. Point d'extension `onWorkoutCompleted` (Santé, M8).
- **Rouvrir.** `status = in_progress`, `completed_at = null`.
- **Réinitialiser la séance du jour.** Confirmation, puis suppression logique du workout et de ses séries. Poids mémorisés et layouts conservés.
- **Passage de minuit.** `findStaleInProgress(today)` → `ResumeBanner`. « Reprendre » affiche ce workout (daté du jour précédent) jusqu'à ce qu'il soit terminé ; « Terminer » le clôture. Si sa séance n'existe plus dans le programme, seul « Terminer » est proposé.
- **« La dernière fois ».** Workout `completed` le plus récent, **date antérieure à aujourd'hui**, avec des séries cochées pour cet exercice **et cette variante** (`performed_name`). Affiche « Dernière fois : 4 × 8 · 100 kg » (charge maximale si les poids diffèrent).
- **Bonus.** Cartes cochables, déclenchent le repos, **exclues de N**.
- **Rafraîchissement.** Chaque écriture se termine par `bumpData()`. Les écritures multi-lignes passent par une transaction.

---

## 3. Minuteur, haptique, son, écran allumé

- **Un seul minuteur** dans l'app (comme la PWA).
- **Exercice chronométré :** tap → chrono d'effort (`work`, durée `workSeconds`), cercle « en attente ». À 0 : la série est cochée puis le repos démarre. Second tap sur le cercle en attente : annulation sans cocher.
- **Exercice classique :** cocher → repos de `restSec` effectif, sinon `meta.restDefaultSec`. Décocher la série qui a lancé le repos en cours l'arrête.
- **`RestBar` flottante** au-dessus de la barre d'onglets : nom de l'exercice, temps restant, barre de progression, −15 s / +15 s / Passer ; rouge sous 10 s ; tap → défilement vers la carte. La ligne « ⏱ REPOS 90S » reste sur chaque carte.
- **Rafraîchissement** ≈ 4 fois/s, uniquement pendant qu'un minuteur tourne ; recalcul depuis `endAt` au retour au premier plan.
- **À 10 s :** `haptics.warning()`. **À 0 au premier plan :** `haptics.success()`, deux bips (880 Hz puis 1 100 Hz, fichier embarqué, catégorie audio « ambient » : se mêle à la musique, coupé par le mode silencieux iOS), flash vert, disparition après ≈ 1,5 s.
- **Retour au premier plan après la fin :** état « terminé » sans son ni vibration. Un chrono d'effort expiré coche sa série, sans démarrer de repos.
- **Redémarrage :** `reviveOnStartup` relit `settings.activeRest` et le purge si `endAt` est dépassé.
- **Haptique :** `light` à chaque série cochée ; `success` quand un exercice est complet et à « Terminer ».
- **Écran allumé :** actif tant qu'une séance est en cours et que Today est affiché. Réglage `keepAwake` (activé par défaut) dans Profil.
- **Points d'extension vides :** `restNotifier.schedule/cancel` (M6), `liveActivity.start/end` (M7).

---

## 4. Écran

**Séance `lift` / `mixed`, de haut en bas :** en-tête et pilules (M1) → `ResumeBanner` → compteur « SÉRIES FAITES X / N » + barre → note de séance → échauffement → cartes (glisser-déposer) → bloc cardio → section BONUS → règles (repliables) → « Terminer » → lien « Réinitialiser la séance du jour ». Séance terminée : `CompletedSummary` (durée, séries, volume, « Rouvrir ») en tête.

**Séance `cardio` / `rest` :** cartes de conseils. **Jour absent du planning :** écran de repos générique (icône, « REPOS », sous-titre traduits).

**Carte d'exercice :** nom (+ « remplace X » si échange), `formatScheme`, consigne en italique, « Dernière fois », sélecteur [−][valeur][+] + unité + suggestion `load`, cercles de 44 pt, ligne de repos, bouton ⇄ si alternatives. Verte quand toutes ses séries sont cochées. Couleurs via tokens et `accent` uniquement.

**Glisser-déposer :** appui long sur l'en-tête de carte, Reanimated + Gesture Handler (déjà installés) ; actions d'accessibilité « Monter » / « Descendre » en repli. L'appui long sur un **cercle** reste réservé à la saisie par série.

---

## 5. Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Écriture en base qui échoue | Toast « Action non enregistrée » ; l'écran reste sur l'état relu en base |
| Son, haptique, écran allumé indisponibles | Échec silencieux |
| Workout dont la séance n'existe plus | Terminable depuis le bandeau, sans cartes |
| Exception de rendu | `ErrorBoundary` sur l'onglet avec « Recharger l'onglet » |
| `swaps` vers une alternative supprimée du programme | Ignoré : l'original s'affiche |

---

## 6. Dépendances ajoutées

`expo-haptics`, `expo-keep-awake`, `expo-audio` (via `npx expo install`). Code natif : **nouveau build EAS `development` requis** pour tester le M2 sur téléphone.

---

## 7. Tests

| Couche | Couvert |
|---|---|
| `domain/` (TDD) | Exercice effectif et clé de poids, schéma et chronométré, N avec bonus exclu, récapitulatif et volume, minuteur (±15 s, Passer, seuils, purge au redémarrage), `moveId` |
| `db/` (SQLite en mémoire) | Création paresseuse, unicité, cocher / décocher, poids de série figé, terminer / rouvrir, réinitialisation logique, séance de la veille, « dernière fois » (exclut aujourd'hui, filtre par variante), échange + remise à zéro en transaction, poids par alternative |
| `features/` (RNTL) | Cocher → repos démarré + carte verte + compteur ; chrono d'effort → série cochée à la fin ; échange persisté ; jour non défini → écran repos ; Terminer → récapitulatif → Rouvrir |
| Extensibilité | Programme fixture de 7 jours en lbs affiché sans changement de code |
| Manuel | Section « M2 » de `mobile/docs/DEVICE_CHECKLIST.md` : glisser-déposer au doigt, haptique, son (musique en fond, mode silencieux), écran allumé, retour au premier plan après la fin du minuteur, passage de minuit |
