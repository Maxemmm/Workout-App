# App native Expo — Jalon M3b (Onboarding + Import) — Addendum de design

> Complète `2026-10-05-expo-native-foundation-design.md` (§3.6 import PWA, §3.7 export, §4 Onboarding) et fait suite au M3a. En cas de divergence avec la spec du sous-projet 1, **cet addendum l'emporte pour le M3b**.

## 0. Périmètre

**Objectif :** un premier lancement guidé (onboarding) et l'import de trois formats : programme seul, sauvegarde de la PWA, sauvegarde native.

**Inclus :** écran d'onboarding (créer, importer, langue, lien « programme exemple ») ; écran d'import (choisir un fichier ou coller le JSON, aperçu + rapport, confirmation) ; conversion d'une sauvegarde PWA ; format natif `workout-native` v1 (lecture ; l'écriture sert l'export du M4) ; restauration en une transaction ; bouton « Importer » dans Plan → Mes programmes.

**Hors M3b :** export et boutons Profil (M4) ; « Créer avec l'IA » (M5).

**Architecture retenue :** une fonction **pure** convertit le contenu en `ImportBundle` (+ rapport) ; l'écran affiche l'aperçu ; à la confirmation, `importRepo.replaceAll` écrit tout en **une seule transaction**. La restauration **remplace** toutes les données (pas de fusion).

**Dépendances :** `expo-document-picker` (et `expo-file-system` si nécessaire à la lecture du fichier). **Nouveau build EAS requis.**

---

## 1. Unités

| Unité | Rôle |
|---|---|
| `domain/importFormat.ts` | `detectImportFormat(value: unknown)` → `'program' \| 'pwa-backup' \| 'native-backup' \| 'unknown'`. Règle PWA `isBackupSnapshot` (objet non tableau ; `meta`+`sessions` sans `programs` → programme ; `_backupFormat === 1`, ou `programs` / `activeProgram`, ou clé `weight:` / `log:` / `track:` / `layout:` → sauvegarde PWA) ; `_format === 'workout-native'` → sauvegarde native |
| `domain/importBundle.ts` | `ImportBundle` : programmes (avec id d'origine), id d'origine du programme actif, séances (statut, date, horodatages, programme et séance d'origine), séries, poids (clé, valeur, unité), organisations, réglages ; `ImportReport` : comptes par catégorie + éléments ignorés `{ key, reason }` |
| `domain/legacyImport.ts` | `parseLegacyBackup(json, today: string)` → `{ ok: true, bundle } \| { ok: false, error }` (règles §2) |
| `domain/nativeBackup.ts` | Format `{ _format: 'workout-native', _version: 1, programs, workouts, setEntries, weights, layouts, settings }` ; `parseNativeBackup(json)` → bundle ; `toNativeBackup(bundle)` (utilisé au M4) |
| `db/repos/importRepo.ts` | `replaceAll(ctx, bundle)` (transaction : suppression logique des programmes, séances, séries, poids, organisations ; insertion avec nouveaux ids natifs et références remappées ; réglages ; programme actif ; brouillon et minuteur effacés) ; `importProgram(ctx, program)` (ajout, source `import`, activation) |
| `platform/pickJsonFile` | Sélecteur natif (`expo-document-picker`) → contenu texte ; web : `<input type=file>` ; annulation → `null` |
| `features/onboarding/OnboardingScreen` | Accroche, sélecteur FR/EN, « Créer mon programme », « Importer un fichier JSON », lien « Essayer avec le programme exemple » |
| `features/import/ImportScreen` | Fichier ou zone de texte, aperçu (type + rapport), confirmation |
| Routes | `app/onboarding.tsx`, `app/import.tsx` ; garde dans `_layout` |

---

## 2. Conversion d'une sauvegarde PWA

Les valeurs de la sauvegarde sont des **chaînes** (instantané du `localStorage`).

- **Programmes** : `programs` (tableau JSON) → `parseProgram` ; invalide → ignoré et compté. Ancienne clé `program` (programme unique) acceptée si `programs` est absent. Chaque programme reçoit un nouvel id natif ; l'id d'origine (`prog-…`) sert au remappage.
- **Programme actif** : `activeProgram` remappé ; absent ou introuvable → premier programme importé.
- **Séances terminées (`log:<date>`)** → séance `completed` à la date `date` ; début = fin = `finishedAt` (midi local de la date si absent).
  - Programme : `programId` remappé ; absent ou introuvable → programme actif **si** `sessionKey` y existe ; sinon ignoré et compté.
  - Séries : pour chaque exercice, `sets` séries cochées (index 0…sets−1) ; poids = poids du log (`"35"` → 35, vide → aucun) ; reps = `schemeReps` de l'exercice du programme s'il existe, sinon aucune ; pas de `performed_name`.
  - Doublon (même programme, séance, date) : le premier gardé, l'autre compté comme doublon.
- **Séances entamées (`track:<date>:<séance>`)** : format `{"v":2, idExercice: booléens}` ou ancien tableau (aligné sur l'ordre des exercices de la séance).
  - Ignorée si aucune série cochée, si un log existe pour la même date et séance, ou si la séance n'existe pas dans le programme actif (la PWA ne suivait que lui).
  - Sinon : seules les séries cochées, poids = poids mémorisé de l'exercice ; statut **`abandoned`** si la date est passée, **`in_progress`** si c'est aujourd'hui (`today`).
- **Poids (`weight:<id>`)** : nombre (virgule acceptée) ; vide, nul ou illisible → ignoré. Unité = celle du programme qui contient l'exercice, sinon celle du programme actif, sinon `kg`.
- **Organisation (`layout:<séance>`)** : importée si présente (ordre + échanges), rattachée au programme actif.
- **Réglages** : `lang`, `theme` (si valides) ; `aiEnabled` `"true"/"false"` → booléen ; `pref-timer-wakelock` → `keepAwake` ; `onboarded` → vrai.
- **Ignorées sans signalement** : `_backupFormat`, `_exportedAt`, `program-draft`, `workout-active-timer`.
- **Ignorées et listées** : toute autre clé (ex. `logWeightRepair_v2`).
- **Aucun programme valide** → `{ ok: false }` : rien n'est remplacé.

**Attendus sur la sauvegarde réelle du 7 oct. 2026** (fixture anonymisée) : 2 programmes ; programme actif = « Remise en forme » (remappé) ; 7 séances terminées pour 114 séries ; 7 entrées `track:` → 4 sans série cochée ignorées, 2 vers des séances introuvables ignorées, 1 séance **abandonnée** (15 juin, bas du corps) ; 11 clés de poids → 10 importées (1 vide) ; réglages : thème clair, IA désactivée, `onboarded` ; `logWeightRepair_v2` listée.

**Programme seul** : validé, ajouté (source `import`), activé ; rien d'autre n'est modifié.

**Sauvegarde native** : relue en bundle ; ids régénérés à l'écriture.

---

## 3. Écrans et parcours

**Garde de premier lancement** (`_layout`) : aucun programme **et** `settings.onboarded` non vrai → onboarding à la place des onglets.

**Onboarding** : nom de l'app + « Entraîne-toi avec intention. » ; sélecteur FR / EN (immédiat) ; **Créer mon programme** → éditeur M3a (nouveau brouillon) ; enregistrement → `onboarded` vrai → Today ; **Importer un fichier JSON** → import ; **Essayer avec le programme exemple** → charge l'exemple, `onboarded` vrai → Today. Annuler l'éditeur ou l'import sans programme → retour à l'onboarding.

**Tous les programmes supprimés plus tard** : `onboarded` reste vrai ; Today « Pas de programme » propose **Créer** et **Importer** (remplace le bouton provisoire du M1).

**Import** (depuis l'onboarding ou Plan → Mes programmes → « Importer »)
1. « Choisir un fichier .json » ou zone « Coller le JSON ».
2. Analyse immédiate → type + aperçu :
   - programme : « Programme : Remise en forme · 3 séances · 3 jours » ;
   - sauvegarde : « Sauvegarde : 2 programmes, 7 séances, 10 poids… » + éléments ignorés ;
   - JSON invalide / format inconnu / programme invalide → message, pas de confirmation.
3. Confirmer :
   - programme → « Importer ce programme » → ajout + activation, toast « Programme importé ✓ » → Plan ;
   - sauvegarde → « Restaurer cette sauvegarde » → confirmation « Toutes les données actuelles seront remplacées » → `replaceAll`, toast « Sauvegarde restaurée ✓ » → Today.

**Après restauration** : stores relus depuis la base (préférences ; minuteur et brouillon vidés) ; thème et langue appliqués immédiatement.

---

## 4. Gestion d'erreurs

| Cas | Comportement |
|---|---|
| JSON invalide | « JSON invalide — vérifiez la syntaxe. » ; pas de confirmation |
| Format inconnu | « Format non reconnu : programme ou sauvegarde attendu » |
| Programme seul invalide | Erreurs de validation listées |
| Sauvegarde sans programme valide | Refusée ; rien n'est remplacé |
| Sélection annulée / fichier illisible | Rien / message discret |
| Fichier > 5 Mo | Refusé avec un message |
| Échec d'écriture | Transaction annulée, données intactes ; toast « Action non enregistrée » |
| Éléments ignorés | Jamais bloquants ; comptés et listés dans le rapport |

---

## 5. Tests

| Couche | Couvert |
|---|---|
| `domain/` (TDD) | Détection (programme, PWA via `_backupFormat` / `programs` / clés préfixées, natif, inconnu, tableau, null) ; `parseLegacyBackup` sur la **fixture réelle anonymisée** (attendus §2) ; cas construits : log sans `programId`, doublon de date, ancien `track` en tableau, poids avec virgule, séance entamée aujourd'hui → en cours, programme invalide ignoré, clé `program` historique ; aller-retour natif bundle → JSON → bundle |
| `db/` | `replaceAll` (anciennes données supprimées logiquement, nouvelles visibles, références remappées, actif correct) ; annulation sur erreur ; `importProgram` ; bout en bout sur la fixture réelle : Today affiche la séance du jour du programme importé et « Dernière fois » est alimenté |
| `features/` | Onboarding (créer, importer, exemple, langue) ; import (aperçu des trois formats, erreurs, confirmation refusée sans effet, restauration qui applique le thème) |
| Manuel | Section « M3b » de `mobile/docs/DEVICE_CHECKLIST.md` : sélecteur de fichiers iOS / Android, coller un JSON, restauration de la vraie sauvegarde, premier lancement après réinstallation |

**Fixture** : `mobile/src/domain/__fixtures__/pwa-backup.json`, copie anonymisée de la sauvegarde réelle (structure, clés, dates, poids conservés ; libellés de programmes neutralisés). Le fichier d'origine `docs/workout-backup-2026-10-07.json` n'est **jamais commité** (ajouté au `.gitignore`).
