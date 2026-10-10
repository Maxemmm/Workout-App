# App native Expo — Jalon M10 (Bibliothèque d'exercices) — Addendum de design

> Complète `2026-10-05-expo-native-foundation-design.md` (tableau des jalons, M10) et fait suite au M6. En cas de divergence avec la spec du sous-projet 1, **cet addendum l'emporte pour le M10**. Il prépare le M11 (carte des muscles et création guidée).

## 0. Périmètre

**Objectif :** une bibliothèque d'exercices hors ligne, riche (≈ 1 400 exercices, instructions en français, illustrations animées quand elles existent), consultable dans un onglet dédié et utilisable depuis l'éditeur de programme.

**Inclus :** catalogue fusionné (exercises-dataset + workout-guide) ; noms traduits en français ; liste de muscles et de matériel propres à l'app ; onglet « Exercices » (recherche, filtres, favoris, « mon matériel ») ; fiche exercice (illustration animée, muscles, matériel, instructions, historique personnel) ; exercices personnalisés ; choix d'un exercice de la bibliothèque dans l'éditeur ; vignette et lien vers la fiche sur les cartes ; crédits.

**Hors M10 :** liaison des exercices existants des programmes à la bibliothèque (M11) ; carte des muscles et carte de chaleur (M11) ; médias Gym visual (licence payante, jamais embarqués) ; ExerciseDB (AGPL, API payante).

**Sources et licences**
| Source | Contenu repris | Licence | Obligation |
|---|---|---|---|
| [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) (commit figé) | id, nom anglais, muscle cible, muscles secondaires, matériel, étapes d'instructions `en` et `fr` | MIT (données, textes) | Crédit dans l'app ; **aucune image / GIF** (© Gym visual) |
| [workout-guide](https://github.com/bryllim/workout-guide) (commit figé) | slug, nom, type, matériel, muscles, 3 images SVG | MIT (code, métadonnées) ; **CC BY-SA 4.0** (images, dérivées d'Everkinetic) | Crédit « Bryl Lim, Everkinetic », lien vers CC BY-SA 4.0 ; nos SVG optimisés / recolorés restent sous CC BY-SA 4.0 (le code de l'app n'est pas concerné) |

**Architecture retenue (approche A, fusion) :** base = exercises-dataset ; exercices présents dans les deux sources enrichis des illustrations workout-guide ; exercices propres à workout-guide ajoutés (illustrés, sans instructions). Correspondance générée une fois puis relue (`wg-match.json`).

**Dépendances :** aucune nouvelle bibliothèque d'exécution (`react-native-svg` et `expo-asset` déjà présents ; `svgo` uniquement en développement pour le script). **Aucun nouveau build.**

---

## 1. Données générées (versionnées)

Script `mobile/scripts/build-catalog.mjs` (Node, hors app) : télécharge les deux sources aux commits figés (constantes en tête du script), applique traductions et correspondances, écrit :

| Fichier | Contenu |
|---|---|
| `src/data/library/catalog.json` | `LibraryEntry[]` compact (voir §2) — sans les 8 autres langues ni aucun média Gym visual ; cible ≤ 3 Mo |
| `src/data/library/names.fr.json` | `{ [sourceId]: nomFrançais }` pour **toutes** les entrées (1 324 + exercices propres à workout-guide), produit une fois, relisible et corrigible à la main |
| `src/data/library/wg-match.json` | `{ [wgSlug]: dsId \| null }` — correspondance relue (null = exercice propre à workout-guide) |
| `assets/exercises/<slug>/frame-1.svg … frame-3.svg` | Illustrations workout-guide optimisées (svgo), remplissage d'origine conservé (recoloré à l'affichage) |
| `assets/exercises/LICENSE-ASSETS.md` | CC BY-SA 4.0 + attribution (Bryl Lim, Everkinetic) |
| `src/data/library/illustrations.ts` | Table `slug → [require(frame-1), require(frame-2), require(frame-3)]` (générée) |

Le script est **idempotent** : relancé sur les mêmes commits, il produit les mêmes fichiers. Les fichiers relus à la main (`names.fr.json`, `wg-match.json`) ne sont jamais écrasés : le script complète les entrées manquantes et signale les orphelines.

## 2. Modèle

**Identifiants stables :** `ds:<id>` (exercises-dataset, ex. `ds:0001`), `wg:<slug>` (propre à workout-guide), `custom:<uuid>` (personnalisé). Une entrée fusionnée garde l'id `ds:…` et porte l'illustration workout-guide.

```ts
type LibraryEntry = {
  id: string;                      // ds:… | wg:…
  name: { fr: string; en: string };
  primary: MuscleKey;
  secondary: MuscleKey[];          // sans doublon ni le principal
  equipment: EquipmentKey;
  steps: { fr: string[]; en: string[] } | null;   // null pour les wg sans instructions
  illustration: string | null;     // slug workout-guide
};
```

**Muscles (`MuscleKey`)**, libellés fr / en, calés sur les groupes de MuscleMap pour le M11 :
`chest` (Pectoraux), `shoulders` (Épaules), `biceps`, `triceps`, `forearms` (Avant-bras), `abs` (Abdominaux), `obliques` (Obliques), `lats` (Dorsaux), `upper_back` (Haut du dos), `traps` (Trapèzes), `lower_back` (Lombaires), `glutes` (Fessiers), `quads` (Quadriceps), `hamstrings` (Ischio-jambiers), `adductors` (Adducteurs), `abductors` (Abducteurs), `calves` (Mollets), `neck` (Cou), `serratus` (Dentelés), `cardio` (Cardio).
Correspondance depuis les sources (exemples) : `pectorals`/`Chest` → `chest` ; `delts`/`Shoulders` → `shoulders` ; `upper back`/`Upper Back` → `upper_back` ; `spine`/`lower back` → `lower_back` ; `cardiovascular system` → `cardio` ; `levator scapulae` → `neck` ; `serratus anterior` → `serratus`. **Toute valeur source sans correspondance fait échouer le script** (pas de muscle inconnu silencieux).

**Matériel (`EquipmentKey`)**, libellés fr / en :
`bodyweight` (Poids du corps), `barbell` (Barre ; dont olympic / ez / trap bar), `dumbbell` (Haltères), `kettlebell`, `cable` (Poulie), `machine` (Machine ; dont leverage, smith, sled, assisted), `band` (Élastique ; dont resistance band), `weighted` (Lest / disque ; dont weighted, plate), `ball` (Ballon ; stability, medicine, bosu), `pullup_bar` (Barre de traction), `bench` (Banc), `cardio_machine` (Machine cardio ; bike, elliptical, stepmill, skierg, ergometer), `other` (Autre ; rope, roller, wheel, tire, hammer, wall, chair, doorway, towel, box).

**Programme :** `Exercise` accepte un champ facultatif `libraryId: string` (conservé par le schéma Zod ; les programmes existants restent valides).

**Exercice personnalisé (table `custom_exercises`)** : colonnes de synchro + `name` (texte), `primary` (MuscleKey), `secondary` (JSON MuscleKey[]), `equipment` (EquipmentKey), `steps` (JSON string[] | null). Suppression logique. Id exposé : `custom:<id>`.

**Réglages :** `favoriteExercises: string[]` (ids), `myEquipment: EquipmentKey[]` (absent ou vide = filtre « mon matériel » inactif).

**Sauvegarde native v1 :** champ facultatif `customExercises` (lu et écrit) ; réglages `favoriteExercises` et `myEquipment` dans `settings`. Anciennes sauvegardes toujours valides.

## 3. Comportement

**Onglet « Exercices »** (5e onglet, entre Plan et Stats) :
- Recherche : sans accents ni casse, sur le nom français **et** anglais, mots dans n'importe quel ordre (« couche developpe » trouve « Développé couché »).
- Filtres (pastilles) : muscle (principal ou secondaire), matériel, « Favoris », « Mon matériel » (actif par défaut si `myEquipment` est renseigné). Combinables.
- Tri : illustrés d'abord, puis nom (langue de l'app). Personnalisés inclus (badge « Perso »).
- Ligne : vignette (première image ; sinon pastille du muscle), nom, « muscle · matériel », étoile favori (bouton).
- Liste virtualisée ; état vide « Aucun exercice ne correspond ».
- Bouton « + » : nouvel exercice personnalisé.

**Fiche (`/exercise/[id]`)** :
- Illustration animée (3 images en boucle, ~0,8 s chacune ; immobile si « Réduire les animations » est actif) ; sans illustration : bloc muscle.
- Nom, muscle principal, muscles secondaires, matériel, étapes numérotées (langue de l'app ; anglais si la langue manque ; section absente si aucune instruction).
- Historique : si des séances contiennent un exercice lié (`libraryId`) → record et dernière fois (stats existantes), lien vers Stats sur cet exercice.
- Favori (bouton) ; personnalisé : « Modifier », « Supprimer » (confirmation).
- Id inconnu (exercice personnalisé supprimé) : message « Exercice introuvable » + retour.

**Exercice personnalisé** : nom (requis, ≤ 100), muscle principal (requis), secondaires (0..n), matériel (requis), étapes (facultatives, liste éditable). Création depuis l'onglet ou depuis le sélecteur.

**Mon matériel** (Profil, section « Mon matériel ») : cases à cocher des `EquipmentKey` ; « Poids du corps » coché par défaut à la première ouverture de la section.

**Éditeur** :
- Feuille « Nouvel exercice » : bouton « Choisir dans la bibliothèque » en tête → sélecteur plein écran (même recherche / filtres) → retour à la feuille préremplie : nom (langue de l'app), `libraryId`, séries 3, schéma vide, repos par défaut ; l'utilisateur complète puis enregistre. « Exercice libre » = comportement actuel.
- Exercice déjà lié : la feuille affiche « Lié à : {nom} » avec « Changer » et « Délier ».

**Cartes (Today, éditeur)** : exercice lié → vignette à gauche du nom ; toucher la vignette ouvre la fiche. Non lié : inchangé.

**Crédits** (Profil › À propos › « Crédits ») : exercises-dataset (MIT, lien) ; workout-guide par Bryl Lim et Everkinetic (CC BY-SA 4.0, liens) ; mention « Illustrations adaptées (optimisées, recolorées) ».

## 4. Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Illustration absente / lecture en erreur | Pastille du muscle à la place, sans message |
| `libraryId` inconnu sur une carte | Pas de vignette (comme un exercice libre) |
| Fiche d'un id inconnu | « Exercice introuvable » + retour |
| Écriture (perso, favoris, matériel) en erreur | Toast « Action non enregistrée » |
| Sauvegarde avec un exercice perso invalide | Ignoré (rapport d'import : valeur invalide) |

## 5. Tests

- **Données générées :** compte (1 324 `ds:` + n `wg:`), ids uniques, chaque entrée a un nom fr non vide, un muscle principal et un matériel connus, secondaires sans doublon ; chaque illustration référencée a ses 3 fichiers ; aucune chaîne `gymvisual` ni chemin `images/` / `videos/` dans `catalog.json` ; taille ≤ 3 Mo.
- **domain :** correspondances muscles / matériel (dont valeur inconnue → erreur dans le script) ; normalisation (accents, casse) ; recherche fr / en, mots dans le désordre ; filtres combinés ; tri (illustrés d'abord).
- **db :** exercices personnalisés (créer, modifier, supprimer logiquement, lister) ; migration ; export / restauration avec `customExercises`, favoris, mon matériel.
- **UI :** recherche + filtres ; favoris ; fiche (étapes, muscles, historique, introuvable) ; création / modification / suppression d'un personnalisé ; sélecteur depuis l'éditeur → feuille préremplie + `libraryId` ; Délier ; vignette et ouverture de la fiche depuis une carte ; Mon matériel ; crédits.
- **Checklist appareil M10 :** Expo Go (animation, thèmes clair / sombre, défilement fluide de la liste, recherche) et web.
