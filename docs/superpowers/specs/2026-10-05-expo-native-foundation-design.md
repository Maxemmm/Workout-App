# App native Expo — Sous-projet 1 : socle + parité hors ligne — Design Spec
**Date :** 2026-10-05
**Branche :** expo-native (base : ai-coach)
**Scope :** Réécriture de l'app en Expo (React Native) pour iOS, Android et web, à parité fonctionnelle avec la PWA, stockage local SQLite conçu pour une future synchronisation cloud, plus quatre capacités natives (notification de fin de repos, haptique, Live Activity, Apple Health / Health Connect).

---

## 0. Contexte et intention

### Ce que l'utilisateur veut
- **Publier l'app sur l'App Store et le Play Store** (grand public).
- **Un seul code** : l'app Expo remplace la PWA (`index.html`, ~8 600 lignes de JS vanilla), y compris sur le web via l'export web d'Expo.
- **À terme : comptes + synchronisation cloud** (Supabase envisagé, décision finale au sous-projet 2).
- **Modèle économique probable : freemium** (coach IA et certaines fonctions payantes, par ex. plusieurs programmes). Rien de décidé : on prévoit le point d'extension sans paywall.

### Découpage en sous-projets
| # | Sous-projet | Statut |
|---|---|---|
| 1 | Socle Expo + parité hors ligne + capacités natives | **cette spec** |
| 2 | Comptes (Apple/Google) + sync cloud + suppression de compte + migration | spec à venir |
| 3 | Coach IA en production (endpoint authentifié, rate-limit, coûts, paywall) | spec à venir |
| 4 | Publication (EAS Submit, fiches store, politique de confidentialité, crash reporting) | spec à venir |

### Critères de réussite du sous-projet 1
1. Toutes les fonctions de la PWA actuelle existent dans l'app Expo (voir §4).
2. L'app fonctionne entièrement **sans réseau**, sauf le coach IA.
3. Le moteur reste **piloté par les données** : un programme de 1 à 7 jours, en kg ou en lbs, s'affiche sans modifier le code (principe central du `CLAUDE.md`).
4. Une sauvegarde exportée depuis la PWA (`workout-backup-YYYY-MM-DD.json`) s'importe sans perte.
5. Le schéma local porte déjà les colonnes de synchronisation : le sous-projet 2 n'a pas besoin de migrer la structure des données.
6. Le repos qui se termine app en arrière-plan ou écran verrouillé déclenche une notification ; sur iOS le décompte est visible en Live Activity.
7. « Terminer la séance » enregistre un entraînement dans Apple Health / Health Connect si l'utilisateur l'a autorisé.

### Hors périmètre
Comptes, synchronisation, paywall/achats in-app, sécurisation des fonctions `api/` pour un usage public, fiches store, analytics/crash reporting. Ces sujets relèvent des sous-projets 2 à 4.

---

## 1. Choix techniques

| Domaine | Choix | Raison |
|---|---|---|
| Framework | Expo (dernier SDK stable) + TypeScript strict | iOS/Android/web depuis un seul code ; builds iOS dans le cloud (le poste de dev est sous Windows) |
| Navigation | Expo Router (routes fichiers, onglets) | Standard Expo, deep links, export web |
| Exécution | **Development build** (`expo-dev-client`) via EAS Build | Live Activity et Santé exigent du code natif : **Expo Go ne suffit pas** |
| Données | `expo-sqlite` + Drizzle ORM + `drizzle-kit` (migrations) | Relationnel, typé, stats en SQL, schéma prêt pour la sync (PowerSync/Supabase compatibles) ; fonctionne aussi sur le web (wasm) |
| Validation | Zod | Programmes importés, générés par l'IA ou relus depuis la DB |
| État UI éphémère | Zustand | Minuteur, onglet actif, brouillons d'écran |
| Notifications | `expo-notifications` (locales uniquement) | Notification planifiée à l'heure de fin du repos |
| Haptique | `expo-haptics` | |
| Écran allumé | `expo-keep-awake` | Remplace le Wake Lock de la PWA |
| Graphiques | `victory-native` (Skia) | Remplace Chart.js |
| Live Activity | Module Expo local (`mobile/modules/live-activity`) + extension widget Swift (ActivityKit) via config plugin | Pas d'alternative JS |
| Santé | `react-native-health` (iOS) + `react-native-health-connect` (Android), derrière une interface commune | |
| Polices | Barlow Condensed (display) + DM Sans (UI) via `expo-font`, fichiers embarqués | Identité visuelle de la PWA |
| Tests | Jest (`jest-expo`) + React Native Testing Library | |
| Backend existant | Fonctions Vercel `api/generate-program` et `api/modify-program` **inchangées** | Le sous-projet 3 les sécurisera |

---

## 2. Architecture

### 2.1 Arborescence
```
Workout-App/
├── api/                    ← inchangé (Vercel, coach IA)
├── legacy/                 ← PWA gelée (index.html, service-worker.js, manifest…) — déplacée au jalon M9
└── mobile/                 ← app Expo
    ├── app/                ← Expo Router : chaque fichier = un écran
    │   ├── _layout.tsx     ← providers (DB, thème, i18n), garde onboarding
    │   ├── onboarding.tsx
    │   ├── (tabs)/
    │   │   ├── _layout.tsx ← barre d'onglets (Today, Plan, Stats, Profil)
    │   │   ├── today.tsx
    │   │   ├── plan.tsx
    │   │   ├── stats.tsx
    │   │   └── profile.tsx
    │   ├── editor/         ← éditeur de programme (4 étapes)
    │   └── coach/          ← coach IA (6 vues)
    ├── src/
    │   ├── domain/         ← logique pure : aucun import React, SQLite ou natif
    │   ├── db/             ← schéma Drizzle, migrations, repositories
    │   ├── features/       ← composants + hooks par fonctionnalité
    │   ├── platform/       ← adaptateurs des capacités natives (+ versions web vides)
    │   ├── entitlements/   ← droits d'accès (tout débloqué en v1)
    │   ├── i18n/           ← dictionnaires fr/en repris de la PWA
    │   └── theme/          ← tokens du design system
    └── modules/
        └── live-activity/  ← module Expo + widget Swift
```

### 2.2 Règles de dépendance
```
app/ (écrans) → features/ → db/ (repositories), platform/, entitlements/, domain/
db/ → domain/ (types et validation)
domain/ → rien
```
- **`domain/`** est pur et entièrement testé unitairement. Il contient le planning (jour → séance ou repos implicite), la progression d'une séance, les calculs de stats, le schéma Zod du programme et le convertisseur de sauvegarde PWA.
- **`db/`** est le seul module qui touche SQLite. Il expose des repositories (`programsRepo`, `workoutsRepo`, `weightsRepo`, `layoutsRepo`, `settingsRepo`), et chaque écriture multi-lignes passe par une transaction.
- **`platform/`** expose une interface par capacité, avec une implémentation par plateforme via les extensions de fichier (`.ios.ts`, `.android.ts`, `.web.ts`). Les écrans ne testent jamais `Platform.OS`.
- **Aucune valeur du programme en dur** (jour, nom de séance, couleur, exercice, durée de repos) hors des données : règle héritée du `CLAUDE.md`. La couleur d'accent passe par une table `accent → token` dans `theme/`.

### 2.3 Entitlements
```ts
// src/entitlements/index.ts
export interface Entitlements {
  canUseAI: boolean;
  maxPrograms: number;    // Infinity en v1
  canUseHealthSync: boolean;
}
export function useEntitlements(): Entitlements; // v1 : tout débloqué, valeurs constantes
```
L'UI consulte toujours `useEntitlements()` avant d'exposer une fonction susceptible de devenir payante. Le sous-projet 3 branchera RevenueCat à cet endroit sans toucher aux écrans.

---

## 3. Modèle de données

### 3.1 Principe
- **Le programme est un document JSON validé** (colonne `definition`), au format actuel de la PWA et de `api/` (`meta`, `sessions`, `schedule`, `rules`). L'éditeur et l'IA lisent et écrivent toujours un programme entier.
- **Le suivi est relationnel**, parce que les stats l'interrogent.

### 3.2 Colonnes de synchronisation (toutes les tables sauf `settings`)
| Colonne | Type | Rôle |
|---|---|---|
| `id` | TEXT, UUID v7 généré sur l'appareil | Identifiant global, triable par date |
| `created_at` | TEXT (ISO 8601 UTC) | |
| `updated_at` | TEXT (ISO 8601 UTC) | Mis à jour à chaque écriture par le repository ; base du « last write wins » |
| `deleted_at` | TEXT nullable | Suppression logique : les repositories filtrent `deleted_at IS NULL` |
| `user_id` | TEXT nullable | Vide en v1, rempli au sous-projet 2 |

### 3.3 Tables
**`programs`**
| Colonne | Notes |
|---|---|
| `definition` | JSON texte, validé par `ProgramSchema` (Zod) en lecture et en écriture |
| `source` | `'manual' \| 'ai' \| 'import' \| 'example'` |

**`workouts`** : une séance réalisée ou en cours
| Colonne | Notes |
|---|---|
| `program_id` | FK `programs.id` |
| `session_key` | clé dans `definition.sessions` |
| `date` | jour **local** `YYYY-MM-DD` |
| `status` | `'in_progress' \| 'completed' \| 'abandoned'` |
| `started_at`, `completed_at` | ISO UTC ; `completed_at` nullable |
| `health_synced_at` | nullable ; évite un double enregistrement dans Santé |

Contrainte : au plus un `workout` non supprimé par (`program_id`, `session_key`, `date`).

**`set_entries`**
| Colonne | Notes |
|---|---|
| `workout_id` | FK `workouts.id` |
| `exercise_id` | id **effectivement réalisé** (l'alternative si un échange a eu lieu) |
| `set_index` | 0-based |
| `done` | booléen |
| `weight` | nullable, dans l'unité du programme |
| `reps` | nullable (repris de `scheme` par défaut) |
| `done_at` | nullable |

**`exercise_weights`** : dernier poids saisi
| Colonne | Notes |
|---|---|
| `exercise_id` | unique (même portée globale que la clé `weight:<id>` de la PWA) |
| `weight` | |
| `unit` | `'kg' \| 'lbs'` |

**`session_layouts`**
| Colonne | Notes |
|---|---|
| `program_id`, `session_key` | unique ensemble |
| `order` | JSON : liste d'ids d'exercices |
| `swaps` | JSON : `{ idOriginal: idAlternative }` |

**`settings`** : clé/valeur, propre à l'appareil, non synchronisé
Clés : `activeProgramId`, `lang` (`fr`/`en`), `theme` (`dark`/`light`/`system`), `aiEnabled`, `keepAwake`, `onboarded`, `healthEnabled`, `programDraft` (brouillon de l'éditeur, JSON), `activeRest` (repos en cours : `{ workoutId, exerciseId, endAt }`, JSON).

### 3.4 Comportements par rapport à la PWA
- **Passage de minuit :** plus de réinitialisation. Un nouveau jour crée un nouveau `workout`. Si un `workout` `in_progress` date de la veille, Today propose « Reprendre » ou « Terminer », et la séance du jour reste celle du planning.
- **Poids par série :** saisie facultative. Le champ de poids de la carte pré-remplit toutes les séries et met à jour `exercise_weights`.
- **Historique :** conservé en entier. Les stats lisent `workouts` et `set_entries` (et non plus les clés `log:*`).

### 3.5 Migrations
`drizzle-kit generate` produit les fichiers SQL, appliqués au démarrage par `useMigrations`. Si une migration échoue : écran bloquant avec bouton « Exporter les données brutes » (dump JSON des tables), sans perte de données.

### 3.6 Import de la sauvegarde PWA
`domain/legacyImport.ts`, fonction pure : `parseLegacyBackup(json) → { programs, activeProgramId, weights, layouts, workouts, setEntries, settings }`.
- Détection identique à la PWA (`isBackupSnapshot`) : `_backupFormat === 1`, ou présence de `programs` / `activeProgram`, ou de clés `weight:` / `log:` / `track:` / `layout:`.
- Accepte aussi un **programme seul** (`meta` + `sessions`).
- Mapping : `programs` → `programs` ; `weight:<id>` → `exercise_weights` ; `layout:<key>` → `session_layouts` ; `log:<date>` → `workouts` `completed` + `set_entries` (poids repris du log) ; `track:<date>:<key>` sans log → `workout` `in_progress` ; `lang` / `theme` / `aiEnabled` / wake lock → `settings`.
- Clés inconnues ignorées et comptées dans un rapport d'import affiché à l'utilisateur.
- L'import remplace toutes les données, après confirmation, et s'exécute en une seule transaction.
- Testé sur une vraie sauvegarde anonymisée, placée en fixture.

### 3.7 Export
« Exporter mes données » produit un JSON `{ _format: "workout-native", _version: 1, programs, workouts, setEntries, weights, layouts, settings }` et le partage via la feuille de partage système (`expo-sharing`). L'import natif accepte ce format, le format PWA et un programme seul.

---

## 4. Écrans (parité PWA)

| Écran | Contenu |
|---|---|
| **Onboarding** | Affiché si aucun programme : « Créer mon programme », « Créer avec l'IA » (si `canUseAI`), « Importer (JSON) ». Sélecteur de langue. |
| **Today** | En-tête (label programme, date), « TODAY », nom de séance coloré selon `accent`, sous-titre ; pilules des 7 jours (point = aujourd'hui, jours sans séance atténués mais cliquables) ; compteur « SÉRIES FAITES X / N » + barre ; échauffement ; cartes d'exercices (consigne, poids + suggestion `load`, cercles de 44 px, barre de repos, monter/descendre, échange vers `alternatives`, carte verte quand complète) ; bloc cardio ; bloc bonus ; séances `cardio`/`rest` → cartes de conseils ; jour absent du planning → repos implicite générique ; « Terminer la séance » ; « Réinitialiser la séance du jour ». |
| **Plan** | Liste des programmes (tap = activer, supprimer, « Modifier avec l'IA »), vue hebdomadaire du programme actif, « Créer un programme », « Créer avec l'IA ». Animation latérale entre sous-onglets. |
| **Stats** | Résumé (série en cours, volume semaine vs précédente, dernière séance), vue par exercice (courbe de charge, record mis en évidence, volume), assiduité (séances faites vs prévues). |
| **Profil** | Langue, thème, écran allumé pendant la séance, IA activée, synchro Santé, exporter, importer (sauvegarde ou programme), réinitialiser toutes les données, version. |
| **Éditeur** | 4 étapes : métadonnées, séances, planning, éditeur de séance (lift/mixed : exercices ; cardio/rest : conseils). Brouillon auto-sauvegardé dans `settings.programDraft`. Validation Zod avant enregistrement. |
| **Coach IA** | 6 vues : objectif, disponibilités, matériel **ou** mode « modifier » (programme existant + instructions + chips d'intention), profil (durée, poids, taille), génération, prévisualisation avec vue des différences en mode modifier. Appelle `api/generate-program` / `api/modify-program` via une URL de base configurée dans `app.config.ts` (`extra.apiBaseUrl`). |

**Design system** : palette, typographie, composants et animations repris de `REFONTE_V2.md` §2, sous forme de tokens TypeScript dans `src/theme/` (thèmes sombre et clair, comme la PWA). Animations inférieures à 250 ms, respect de `AccessibilityInfo.isReduceMotionEnabled`. Cibles tactiles d'au moins 44 pt. Zones de sécurité gérées par `react-native-safe-area-context`.

---

## 5. Capacités natives

### 5.1 Minuteur de repos (cœur)
On stocke une **heure de fin** au lieu de décompter, car le JS est suspendu en arrière-plan.

```
validerSérie(exo)
  → endAt = now + (exo.restSec ?? meta.restDefaultSec) * 1000
  → timerStore.start({ workoutId, exerciseId, endAt })      // Zustand + persisté (settings.activeRest)
  → restNotifier.schedule(endAt, texte)                      // platform/
  → liveActivity.start({ endAt, exerciseName, nextSet })     // platform/ (iOS ≥ 16.2, sinon no-op)
  → haptics.light()
```
- **Premier plan :** affichage recalculé depuis `endAt` (≈ 4 rafraîchissements/s), rouge sous 10 s (`haptics.warning()` à 10 s), à 0 : `haptics.success()` + flash + annulation de la notification encore en attente.
- **Retour au premier plan après la fin :** l'état passe à « terminé », sans rejouer le retour sonore.
- **Passer / relancer :** `restNotifier.cancel()` et `liveActivity.end()`, puis nouveau démarrage le cas échéant.
- **Arrêt de l'app :** au redémarrage, l'éventuel `activeRest` est relu ; si `endAt` est dépassé, on le purge.

### 5.2 Interfaces `platform/`
```ts
interface RestNotifier   { ensurePermission(): Promise<boolean>; schedule(endAt: number, body: string): Promise<void>; cancel(): Promise<void>; }
interface LiveActivity   { isSupported(): boolean; start(p: RestActivityProps): Promise<void>; update(p: RestActivityProps): Promise<void>; end(): Promise<void>; }
interface Haptics        { light(): void; success(): void; warning(): void; }
interface HealthSync     { isAvailable(): Promise<boolean>; ensurePermission(): Promise<boolean>; writeStrengthWorkout(w: { start: Date; end: Date; title: string }): Promise<void>; }
interface KeepAwake      { activate(): void; deactivate(): void; }
```
Implémentations web : `RestNotifier`, `LiveActivity` et `HealthSync` sans effet (`isSupported` / `isAvailable` → false) ; `Haptics` via `navigator.vibrate` si disponible ; `KeepAwake` via l'API Wake Lock si disponible.

### 5.3 Notifications
- Locales uniquement (aucun serveur de push).
- Permission demandée **à la première validation de série**, précédée d'un écran explicatif. En cas de refus, le minuteur fonctionne au premier plan et Profil propose un lien vers les réglages.
- Une seule notification de repos planifiée à la fois (identifiant fixe).

### 5.4 Live Activity (iOS)
- Extension widget SwiftUI (`ActivityKit`) : nom de l'exercice, prochaine série « 3/4 », décompte natif `Text(timerInterval:)` jusqu'à `endAt` ; Dynamic Island en vue compacte et étendue.
- Démarrée et terminée depuis le module Expo local ; aucune mise à jour push.
- Couleurs du design system (fond noir, accent or, rouge sous 10 s si iOS le permet, sinon couleur fixe).
- Ajoutée au projet natif via config plugin, sans dossier `ios/` versionné (workflow « prebuild »).

### 5.5 Apple Health / Health Connect
- **Écriture seule** d'un entraînement de type musculation (début, fin, durée) à « Terminer la séance ». Aucune lecture.
- Autorisation demandée au premier « Terminer la séance » si `settings.healthEnabled` n'est pas encore défini. Désactivable dans Profil.
- `workouts.health_synced_at` empêche les doublons. En cas d'échec d'écriture, toast discret ; la séance reste enregistrée localement.
- Textes d'usage (`NSHealthUpdateUsageDescription`, déclarations Health Connect) en fr/en.

### 5.6 Haptique
| Événement | Retour |
|---|---|
| Série cochée | `light` |
| Exercice complet / séance terminée | `success` |
| Minuteur à 10 s | `warning` |
| Fin du repos (premier plan) | `success` |

---

## 6. Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Programme invalide (import, IA, DB) | Erreurs Zod traduites en message lisible ; rien n'est écrit ; transaction annulée |
| Échec de migration SQLite | Écran bloquant + « Exporter les données brutes » |
| Pas de réseau | Seul le coach IA est affecté : message hors ligne + réessayer |
| Erreur de l'API IA | Message générique (les détails serveur ne sont pas exposés, comme aujourd'hui) + réessayer |
| Permission refusée | Fonction dégradée, jamais bloquante ; lien vers les réglages |
| Exception de rendu | `ErrorBoundary` par onglet avec « Recharger l'onglet » |
| Fichier d'import illisible | Message dédié selon le type détecté (programme / sauvegarde / inconnu) |

---

## 7. Tests

| Couche | Outil | Ce qui est couvert |
|---|---|---|
| `domain/` | Jest, TDD | Planning (programmes de 1 à 7 jours, jours manquants → repos, kg/lbs), progression (compteur X/N, exercice complet), stats (record, volume, série en cours, assiduité), `ProgramSchema`, `parseLegacyBackup` (fixture réelle), calcul `endAt` |
| `db/` | Jest + SQLite en mémoire | Repositories : CRUD, suppression logique, `updated_at`, contrainte d'unicité `workouts`, transaction d'import |
| `features/` | React Native Testing Library | Parcours : cocher une série → minuteur démarré → carte verte → compteur ; échange d'exercice persisté ; jour non défini → écran repos |
| `platform/` | Mocks dans les tests ; vérification manuelle | Checklist sur iPhone réel + Android réel : notification écran verrouillé, Live Activity, écriture Santé, haptique |
| Extensibilité | Jest | Le critère du `CLAUDE.md` : ajouter un 4ᵉ jour au planning fixture → affiché sans changement de code |

---

## 8. Jalons

Chaque jalon est livrable et testable sur téléphone (build de développement EAS).

| Jalon | Contenu | Prérequis externes |
|---|---|---|
| **M1 Socle** | Projet Expo dans `mobile/`, TS strict, Expo Router, thème (sombre/clair), i18n, schéma DB + migrations, `domain/` (planning, schéma Zod, progression) testé, profil EAS `development` | Compte Expo ; **compte Apple Developer** pour installer sur iPhone |
| **M2 Today** | Séance du jour, onglets jours, cercles, compteur, poids, réordonnancement, échange, minuteur au premier plan, haptique, écran allumé, terminer / réinitialiser | |
| **M3 Plan + Éditeur + Onboarding** | Gestion des programmes, éditeur 4 étapes avec brouillon, onboarding, import programme / sauvegarde PWA | Une sauvegarde PWA réelle pour la fixture |
| **M4 Stats + Profil** | Stats (victory-native), réglages, export / import, réinitialisation | |
| **M5 Coach IA** | 6 vues, modes créer / modifier, diff, derrière `canUseAI` ; `api/` inchangé | URL de déploiement Vercel ; CORS `ALLOWED_ORIGIN` à vérifier pour l'origine web Expo |
| **M6 Notification de fin de repos** | `RestNotifier` iOS/Android, écran de permission | |
| **M7 Live Activity** | Module Expo + widget Swift + config plugin | Build EAS iOS |
| **M8 Santé** | `HealthSync` iOS/Android, réglage Profil | Capacité HealthKit sur l'App ID Apple |
| **M9 Bascule web** | Export web Expo déployé à la place de la PWA ; PWA déplacée dans `legacy/` ; `CLAUDE.md` mis à jour pour la nouvelle architecture | Choix de l'hébergeur web (Vercel, où vivent déjà les fonctions `api/`) |

---

## 9. Risques

| Risque | Mitigation |
|---|---|
| Live Activity : Swift + config plugin, rien de testable sur Windows en local | Jalon isolé et en dernier ; tout le reste n'en dépend pas ; builds EAS uniquement |
| `expo-sqlite` sur le web (wasm) moins mature | Testé dès M1 sur le web ; en cas de blocage, le web reste sur la PWA gelée jusqu'au sous-projet 2 |
| Revue App Store (Santé, notifications) | Permissions demandées au moment de l'usage et justifiées ; écriture Santé seule |
| Taille de la réécriture (~8 600 lignes) | Jalons livrables ; la PWA reste en ligne et intacte jusqu'à M9 |
| Divergence de format programme avec `api/` | `ProgramSchema` (Zod) unique dans `domain/`, testé contre `program.example.json` et contre une réponse réelle de l'API |
