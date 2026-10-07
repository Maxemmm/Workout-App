# App native Expo — Jalon M3a (Plan + Éditeur) — Addendum de design

> Complète `2026-10-05-expo-native-foundation-design.md` (spec du sous-projet 1). Le jalon M3 de la spec est découpé en **M3a (Plan + Éditeur)** et **M3b (Onboarding + Import)**. Ce document fixe le M3a ; en cas de divergence avec la spec du sous-projet 1, **il l'emporte pour le M3a**.

## 0. Périmètre

**Objectif :** gérer ses programmes et les éditer dans l'app native, avec la parité PWA (onglet Plan, éditeur en 4 étapes) et quatre améliorations natives.

**Parité PWA :** Plan avec sous-vues « Cette semaine » / « Mes programmes » (activer, modifier, dupliquer, supprimer, créer), animation latérale entre sous-vues ; éditeur en 4 étapes (programme, séances, planning, séance) avec fenêtre de détail d'un exercice (séries, chronométré, reps, charge, repos, consigne, alternatives), échauffement, cardio de fin, conseils ; validation avant enregistrement.

**Améliorations natives retenues :**
1. Réordonner exercices et séances par glisser-déposer (réutilise `ReorderableList` du M2).
2. Couleur de séance au choix (or / rouille / bleu / gris), l'attribution automatique restant la valeur par défaut.
3. Dupliquer une séance et un exercice dans l'éditeur.
4. Saisie numérique ergonomique : steppers −/+ pour séries et repos, clavier numérique.

**Ajout :** les exercices **bonus** sont éditables (section « Bonus » avec titre optionnel), pour ne pas les perdre en modifiant un programme importé.

**Hors M3a :** onboarding et import (M3b) ; export et boutons Profil (M4) ; boutons IA (M5, masqués derrière `canUseAI` + IA activée).

**Architecture retenue :** le brouillon est un document unique `{ sourceProgramId, program }` dans un store Zustand, recopié dans `settings.programDraft` à chaque modification. Toutes les opérations d'édition sont des **fonctions pures** (`domain/draft.ts`). Le programme en base n'est modifié qu'à « Enregistrer », après validation.

**Dépendances :** aucune nouvelle ; pas de nouveau build EAS requis.

---

## 1. Unités

| Unité | Rôle |
|---|---|
| `domain/draft.ts` | Type `Draft = { sourceProgramId: string \| null; program: DraftProgram }` ; `newDraft()`, `draftFromProgram(id, program)` ; opérations pures : `setMeta`, `setRules`, `addSession`, `updateSession`, `deleteSession` (retire aussi la séance du planning), `duplicateSession`, `moveSession`, `addExercise`, `updateExercise`, `deleteExercise`, `duplicateExercise`, `moveExercise` (principaux et bonus), `setSchedule(day, key \| null)` |
| `domain/entityIds.ts` | `makeEntityId(name, existing, random)` → slug lisible + suffixe aléatoire (`developpe-machine-k3f9`), unique parmi `existing` ; créé une fois, jamais modifié (même au renommage) |
| `domain/accents.ts` | `defaultAccent(type, existingSessions)` : cycle or → rouille → bleu sur les séances non-repos, gris pour `rest` |
| `domain/programRules.ts` | `validateDraft(draft)` → `ok` + programme validé, ou liste d'erreurs `{ step: 1 \| 2 \| 3 \| 4, sessionKey?, code, params }` : nom requis, ≥ 1 séance, ≥ 1 jour planifié, puis `ProgramSchema` ; codes traduits par l'i18n |
| `db/repos/programsRepo` | + `updateProgram(id, definition)` (validation, remplacement, `updated_at`) ; + `duplicateProgram(id, copySuffix)` (copie profonde, libellé « (copie) », ids conservés, non activée) |
| `state/draftStore.ts` | Zustand : `draft`, `hydrate(ctx)` (brouillon corrompu → effacé, signalé), `start(ctx, draft)`, `apply(ctx, op)`, `discard(ctx)` |
| `entitlements/index.ts` | `useEntitlements()` → `{ canUseAI: true, maxPrograms: Infinity, canUseHealthSync: true }` (spec §2.3) |
| `features/plan/` | `PlanScreen`, `PlanTabs` (segmenté animé), `WeekView`, `ProgramsView`, `ProgramCard`, `DraftBanner` |
| `app/editor/` | Pile Expo Router : `_layout`, `index` (étape 1), `sessions` (étape 2), `schedule` (étape 3), `session/[key]` (étape 4) |
| `features/editor/` | `EditorHeader`, `ExerciseSheet`, `AlternativeEditor`, `NumberStepper`, `AccentPicker`, `ListEditor` (échauffement, règles), `TipsEditor`, `DayPicker`, `SessionCard` |

---

## 2. Cycle de vie du brouillon

- **Créer un programme** → brouillon vide : `{ meta: { label: '', units: 'kg', restDefaultSec: 90 }, sessions: {}, schedule: {}, rules: [] }`, `sourceProgramId = null`.
- **Modifier** (Plan) → brouillon = copie profonde du programme, `sourceProgramId = id`.
- **Ajouter une séance** (Cette semaine) → brouillon du programme actif, ouvert à l'étape 2.
- **Un brouillon existe déjà :** même cible → reprise ; autre cible → confirmation « Abandonner le brouillon en cours ? ».
- **Plan affiche une bannière** « Brouillon en cours — Reprendre / Abandonner » quand un brouillon existe (app tuée pendant l'édition).
- **Chaque modification** passe par une opération de `domain/draft.ts`, met à jour le store et réécrit `settings.programDraft`. Today et la base ne bougent pas.
- **Supprimer une séance planifiée** demande confirmation, puis la retire aussi des jours concernés.
- **Bornes (reprises de la PWA), appliquées à la saisie :** noms 100 caractères, sous-titre 150, note 500, consigne 300, charge 100, schéma 50, titre de conseil 100, texte de conseil 300 ; échauffement, règles et conseils ≤ 20 éléments ; séries 1–20 ; repos 0–600 s par pas de 15 s ; repos par défaut 10–600 s ; alternatives ≤ 10 par exercice.
- **Identifiants :** un exercice ou une séance reçoit son id à la création (`makeEntityId`), jamais modifié ensuite. **Dupliquer une séance** garde les ids de ses exercices (poids et historique partagés entre séances A/B) ; **dupliquer un exercice** dans une séance lui donne un nouvel id ; **dupliquer un programme** garde tous les ids (écart volontaire avec la PWA : les poids suivent la copie).
- **Couleur :** `defaultAccent` à la création d'une séance (et au passage au type `rest` si la couleur était automatique) ; un choix explicite de l'utilisateur est conservé, jamais recalculé à l'enregistrement.

**Enregistrer** (bouton de l'en-tête, et en bas de l'étape 3) :
1. `validateDraft` ; en cas d'erreur, rien n'est écrit, liste d'erreurs traduites, chaque erreur ramène à son étape (et à sa séance pour l'étape 4).
2. Nouveau programme (`sourceProgramId` nul, ou programme source supprimé entre-temps) → `createProgram(…, 'manual')` puis activation.
3. Programme existant → `updateProgram` ; le programme actif ne change pas.
4. Brouillon effacé, `bumpData()`, toast « Programme enregistré ✓ », retour à Plan.

**Annuler** : confirmation, brouillon effacé, base inchangée.

**Effets sur les données :** exercice renommé → même id, poids et historique conservés ; exercice ou séance supprimé → historique conservé en base, plus affiché dans Today ; séance du jour en cours au moment de l'enregistrement → continue, Today relit le programme. **Supprimer un programme** (confirmation) → suppression logique, historique conservé ; si c'était l'actif, repli sur le premier programme restant, sinon Today affiche « Pas de programme ». **Activer** (tap sur une carte) → `activeProgramId` + toast.

---

## 3. Écrans

**Plan :** titre « PLAN » ; onglets segmentés « Cette semaine » / « Mes programmes », indicateur glissant et contenu qui coulisse (< 250 ms, aucune animation si « réduire les animations »).
- *Cette semaine* : 7 lignes lundi → dimanche (jour, nom de séance coloré selon sa couleur, « N exercices », badge « Aujourd'hui »), jours de repos atténués ; bouton « Ajouter une séance ». Sans programme : « Aucun programme actif » + « Créer mon programme ».
- *Mes programmes* : cartes (nom, « N jours · M exercices », badge « Actif ») ; tap = activer ; Modifier / Dupliquer / Supprimer ; « Créer un nouveau programme ». Boutons IA seulement si `canUseAI` et IA activée.
- Bannière « Brouillon en cours » si un brouillon existe.

**Éditeur** (pile plein écran par-dessus les onglets) ; en-tête : Annuler · « Étape N / 3 » (étapes 1 à 3 ; l'étape 4 est une sous-page de l'étape 2) · Enregistrer.
- *Étape 1* : nom (obligatoire), unité kg / lbs (segmenté), repos par défaut (stepper), règles (liste éditable), « Suivant ».
- *Étape 2* : cartes de séances déplaçables (pastille de couleur, nom, « Type · N exercices ») avec modifier / dupliquer / supprimer ; « Créer une séance » ; « Configurer le planning ».
- *Étape 3* : 7 lignes lundi → dimanche, sélecteur « Repos » / séances (feuille en bas d'écran) ; « Enregistrer le programme ».
- *Étape 4* : nom, sous-titre, note ; type lift / cardio / repos / mixte (segmenté) ; couleur ; sections selon le type — lift/mixte : échauffement, exercices déplaçables (modifier / dupliquer / supprimer), cardio de fin, bonus (titre optionnel + exercices) ; cardio/repos : conseils (titre + texte) ; « Terminer la séance » → retour à l'étape 2.
- *Fenêtre de détail d'un exercice* (feuille) : nom ; séries (stepper 1–20) ; case « Chronométré » ; reps ou secondes (placeholder adapté) ; charge ; repos (stepper par 15 s) ; consigne ; alternatives (nom seul, ou détail repliable : séries, schéma, charge, repos) ; Enregistrer / Annuler.

Cibles tactiles ≥ 44 pt, couleurs via le thème, toutes les chaînes en fr/en (réutilisation des clés PWA `editor_*`, `exo_*`, `plan_*`, `session_type_*`, `accent_*`).

---

## 4. Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Brouillon illisible ou corrompu | Ignoré et effacé ; toast « Brouillon perdu » à l'ouverture de Plan |
| Programme invalide à l'enregistrement | Rien n'est écrit ; erreurs traduites, chacune ramène à son étape |
| Échec d'écriture en base | Toast « Action non enregistrée » ; brouillon conservé |
| Séance planifiée supprimée | Retirée du planning (après confirmation) |
| Programme source supprimé pendant l'édition | Le brouillon est enregistré comme un nouveau programme |
| Champs inconnus (ajouts futurs, programmes de l'IA) | Conservés à travers le brouillon |
| Exception de rendu | `TabErrorBoundary` sur Plan et sur l'éditeur |

---

## 5. Tests

| Couche | Couvert |
|---|---|
| `domain/` (TDD) | Chaque opération du brouillon (dont suppression qui nettoie le planning, duplication séance avec ids conservés, duplication exercice avec nouvel id unique, déplacement, planification) ; id stable au renommage ; `makeEntityId` (slug, accents, collisions) ; `defaultAccent` ; `validateDraft` et étapes des erreurs ; champs inconnus conservés |
| `db/` | `updateProgram` (validation, actif inchangé) ; `duplicateProgram` (« (copie) », ids conservés, non activé) |
| `state/` | Brouillon persisté et relu ; brouillon corrompu effacé |
| `features/` (RNTL) | Plan : semaine (badge Aujourd'hui, repos atténués), activer / dupliquer / supprimer ; éditeur : création d'un programme de 2 séances → planning → enregistrer → Today affiche la séance ; modifier un exercice garde son poids mémorisé ; erreur de validation → étape concernée ; Annuler ne touche pas la base ; reprise du brouillon |
| Extensibilité | Programme 7 jours en lbs créé via l'éditeur, affiché par Today sans changement de code |
| Manuel | Section « M3a » de `mobile/docs/DEVICE_CHECKLIST.md` : glisser-déposer dans l'éditeur, clavier numérique, feuilles avec clavier ouvert, animation des onglets de Plan, reprise du brouillon après arrêt de l'app |
