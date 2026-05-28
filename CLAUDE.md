# CLAUDE.md — Application d'entraînement personnelle (PWA, pilotée par les données)

> Fichier de contexte projet pour Claude Code.
> Objectif : une application web mono-fichier (ou quasi) qui sert de **carnet d'entraînement quotidien**, déployable en PWA sur iPhone via GitHub Pages + « Ajouter à l'écran d'accueil ».
>
> **Principe central : l'app est un MOTEUR générique qui LIT un programme. Le programme vit dans un fichier de données séparé (`program.js`). Changer de routine = éditer ce fichier et re-déployer. Le moteur ne doit JAMAIS supposer un nombre de jours fixe ni des noms de séances en dur.**

---

## 1. Vue d'ensemble du produit

Application personnelle de suivi d'entraînement. Elle détecte le jour de la semaine, charge la séance programmée pour ce jour, et permet de cocher chaque série en suivant un minuteur de repos. Les jours sans musculation (cardio, repos) affichent des conseils de récupération plutôt qu'un écran vide.

**Utilisateur unique.** Pas de comptes, pas de backend, pas d'authentification.

**Plateforme cible : iPhone, mode standalone** (icône écran d'accueil, plein écran sans barre Safari). Design *mobile-first*, portrait, écran étroit (~390 px).

### Contrainte de déploiement (à respecter absolument)
1. Livrable = fichiers **statiques**, **sans build step**.
2. Poussé sur un dépôt GitHub → servi par **GitHub Pages**.
3. Ouvert dans Safari iOS → installable via « Ajouter à l'écran d'accueil ».

> Conséquence : **HTML + CSS + JS vanilla.** Pas de bundler, pas de framework nécessitant compilation, pas de serveur, pas de variables d'environnement.

### Workflow d'édition du programme (décidé par l'utilisateur)
- L'utilisateur **modifie son programme en éditant le fichier de données `program.js`**, puis re-déploie (commit/push).
- **Pas d'éditeur de programme dans l'app.** L'app est en lecture seule sur la définition du programme (elle n'écrit que l'état de suivi : séries cochées, poids saisis).
- **Pas de parsing de `workout.txt` en prose à l'exécution.** Le texte libre est trop fragile. À la place : `workout.txt` est la *source humaine*, et on en dérive `program.js` (structure propre). Voir §3.

---

## 2. ⚠️ Architecture pilotée par les données (le point le plus important)

Le moteur ne connaît **aucun** détail du programme. Tout est dérivé de la structure `PROGRAM`. Règles non négociables :

- **Nombre de jours VARIABLE (1 à 7), jours nommés.** Aujourd'hui le programme réel = 3 jours (Lundi/Mercredi/Vendredi). Demain il peut en compter 4, 5, 6 ou 7. Le moteur itère sur ce qui existe ; il n'affiche jamais un onglet pour un jour non défini autrement que comme « repos par défaut ».
- **Aucun nom de séance, groupe musculaire, couleur, exercice ou durée de repos en dur dans le moteur.** Tout vient des données.
- **Un jour non défini dans le programme = jour de repos implicite** (écran de récupération générique), sans planter.
- **Le moteur doit fonctionner identiquement** que le programme ait 3 jours en kg ou 7 jours en lbs. C'est le test de validité de l'architecture.

> Si Claude Code se surprend à écrire `if (jour === "Lundi")` ou `case "PUSH DAY"` dans la logique, c'est un bug d'architecture : refactorer pour que ça passe par les données.

---

## 3. Modèle de données : `program.js`

Fichier **séparé** de la logique, conçu pour être édité à la main facilement. C'est l'unique fichier que l'utilisateur touche pour changer sa routine.

```js
// program.js — SEUL fichier à éditer pour changer le programme.
// Dérivé manuellement de workout.txt. Re-déployer après modification.

const PROGRAM = {
  meta: {
    label: "PROGRAMME SALLE",   // bandeau haut
    units: "kg",                // "kg" | "lbs" — gère l'affichage des poids
    restDefaultSec: 90,         // repos par défaut si non précisé sur un exo
    repsInReserve: "1 à 2 reps en réserve", // règle affichable
  },

  // Liste de SÉANCES, indépendante des jours.
  // Permet de réutiliser une séance et de la réaffecter sans la réécrire.
  sessions: {
    "full-body": {
      type: "lift",                       // "lift" | "cardio" | "rest" | "mixed"
      name: "FULL BODY",
      accent: "gold",                     // clé de couleur (voir design system)
      subtitle: "JAMBES · PECS · DOS · ÉPAULES",
      note: null,                         // ex. note de séance affichée en tête de liste
      warmup: [                           // échauffement (affiché, non coché)
        "Vélo ou tapis 5 à 7 min (léger)",
        "Mobilité épaules et hanches",
        "1 série légère sur presse et développé",
      ],
      exercises: [
        {
          id: "presse-cuisses",           // identifiant STABLE (sert à mémoriser le poids)
          name: "Presse à cuisses",
          scheme: "4×8",                  // texte affiché
          sets: 4,                        // nombre de cercles cochables
          load: "100 à 120 kg",           // suggestion (le poids réel saisi est stocké à part)
          restSec: 120,
          cue: null,                      // consigne d'exécution (italique)
          alternatives: [],               // pour le swap (machines indispo)
        },
        { id: "developpe-machine", name: "Développé machine", scheme: "4×8",
          sets: 4, load: "30 à 40 kg", restSec: 120, alternatives: ["Développé haltères"] },
        { id: "tirage-horizontal", name: "Tirage horizontal", scheme: "4×10",
          sets: 4, load: "35 à 45 kg", restSec: 90 },
        { id: "leg-curl", name: "Leg curl", scheme: "3×12",
          sets: 3, load: "25 à 35 kg", restSec: 90 },
        { id: "elevations-laterales", name: "Élévations latérales", scheme: "3×12",
          sets: 3, load: "6 à 8 kg", restSec: 60 },
        { id: "gainage", name: "Gainage", scheme: "3×45 sec",
          sets: 3, load: "poids du corps", restSec: 60 },
      ],
      cardio: { label: "Marche inclinée", detail: "15 à 20 min — inclinaison 5 à 10% — 5 à 6,5 km/h" },
      bonus: null,                        // ou { title, exercises: [...] }
      tips: null,                         // utilisé pour cardio/rest
    },

    "haut-du-corps": { type: "lift", name: "HAUT DU CORPS", accent: "rust",
      subtitle: "PECS · DOS · BRAS", exercises: [ /* ... mercredi ... */ ] },

    "bas-du-corps": { type: "lift", name: "BAS DU CORPS", accent: "rust",
      subtitle: "QUADS · ISCHIOS · MOLLETS", exercises: [ /* ... vendredi ... */ ] },

    // Exemples de séances non-lift réutilisables si le programme s'étend :
    "cardio": { type: "cardio", name: "CARDIO", accent: "blue",
      subtitle: "VÉLO", tips: [
        { title: "Cible", body: "Allure modérée — RPE 6-7. Effort régulier." },
        { title: "Durée", body: "~15 à 20 min selon résistance." },
      ] },
    "repos": { type: "rest", name: "REPOS", accent: "gray",
      subtitle: "RÉCUPÈRE. MANGE. DORS.", tips: [
        { title: "Le sommeil est de l'entraînement", body: "7 à 9 h — pic d'hormone de croissance." },
        { title: "Protéines", body: "Ne pas baisser l'apport les jours de repos." },
      ] },
  },

  // PLANNING : associe chaque jour de la semaine à une clé de séance.
  // Indices alignés sur Date.getDay() : 0 = dimanche … 6 = samedi.
  // Un jour ABSENT ou null => repos implicite. Le programme actuel = 3 jours.
  schedule: {
    1: "full-body",      // Lundi
    3: "haut-du-corps",  // Mercredi
    5: "bas-du-corps",   // Vendredi
    // 0,2,4,6 non définis => repos par défaut
  },

  // Règles de base affichables (depuis workout.txt) :
  rules: [
    "Garder 1 à 2 répétitions en réserve",
    "Si trop facile, augmenter légèrement la charge",
    "Si trop difficile, diminuer légèrement la charge",
    "Priorité à l'exécution propre",
    "Progression chaque semaine si possible",
  ],
};
```

### Pourquoi cette forme
- **`sessions` séparé de `schedule`** : tu peux réaffecter une séance à un autre jour, ou en ajouter une 4ᵉ/5ᵉ, en changeant uniquement `schedule` — sans réécrire les exos.
- **`schedule` partiel** : 3 jours aujourd'hui, davantage demain, sans modifier le moteur. Les jours manquants tombent sur un repos générique.
- **`id` stable par exercice** : c'est la clé qui relie le poids mémorisé à l'exercice. **Ne jamais réutiliser un `id` pour un exercice différent.**

### Mapping depuis `workout.txt`
`workout.txt` reste la source humaine de référence (à garder dans le dépôt, ex. `docs/workout.txt`). À chaque changement de programme, l'utilisateur (ou Claude Code sur demande) reporte les changements dans `program.js`. Le format texte « Exercice — séries×reps — charge — repos » se transpose directement vers `{ name, scheme, sets, load, restSec }`.

---

## 4. Fonctionnalités (cahier des charges)

Tiré de `requirement.txt` :

1. **Détection automatique du jour.** À l'ouverture : `new Date().getDay()` → `PROGRAM.schedule[jour]` → séance correspondante (ou repos si absent). Navigation manuelle possible via la barre d'onglets.
2. **Suivi des séries.** Cercles numérotés cochables par exercice. Toutes les séries cochées → **carte verte** (« complete »). Compteur global « SÉRIES FAITES — X / N » + barre de progression. N = somme des `sets` de la séance du jour.
3. **Minuteur de repos en direct.** Valider une série → **démarre automatiquement** le repos (`exercise.restSec`, sinon `meta.restDefaultSec`). Décompte visible, **passe au rouge sous 10 s**, feedback en fin (`navigator.vibrate` si dispo + flash visuel).
4. **Blocs bonus.** Champ `bonus` optionnel par séance, affiché en section « BONUS ».
5. **Cardio & repos = conseils.** Séances `type: "cardio"` / `"rest"` rendent les `tips` (cartes de conseils) au lieu de cartes d'exercices.
6. **Exercices interchangeables / sans ordre imposé.** L'utilisateur peut **réordonner** les exercices (boutons monter/descendre, simple et robuste sur mobile) et **swap** vers une `alternative` (selon dispo des machines). L'ordre et le swap choisis sont mémorisés.
7. **Suivi de poids par exercice.** Champ poids éditable par exercice ; valeur **persistée** et ré-affichée à la séance suivante. La suggestion `load` reste visible comme repère. Unité selon `meta.units`.
8. **Esthétique fidèle aux photos** : noir, doré, rouille/orange, bleu pour le cardio. Voir §6.

---

## 5. Structure d'écran (d'après les maquettes)

```
RECOMP/LABEL · PLAN                LUN, 27 AVR   ← bandeau
TODAY                                            ← "AUJOURD'HUI"
FULL BODY                                        ← nom de séance, coloré selon accent
JAMBES · PECS · DOS · ÉPAULES                    ← sous-titre groupes musculaires
[DIM][LUN•][MAR][MER][JEU][VEN][SAM]             ← onglets; point = aujourd'hui; actif = bordure colorée
SÉRIES FAITES                       0 / N        ← compteur + barre

┌ Presse à cuisses                       4×8 ┐
│ (consigne en italique si présente)         │
│ Poids : [____] kg   (suggestion 100-120)   │
│  (1) (2) (3) (4)                           │
│  ⏱ REPOS 120S                              │
└────────────────────────────────────────────┘
... cartes suivantes ...
```

- Onglets : afficher **les 7 jours** de la semaine ; ceux sans séance sont stylés « repos » (atténués) mais restent cliquables et mènent à l'écran repos.
- Séances `lift`/`mixed` → liste de cartes ; `cardio`/`rest` → cartes de conseils.
- Le grand visuel récap (image 8) = écran « Plan » **optionnel**, après que le quotidien fonctionne.

---

## 6. Design system

### Palette
```
--bg            #0a0a0a
--bg-card       #161616
--bg-card-soft  #1e1e1e
--text          #f5f5f5
--text-dim      #8a8a8a
--gold          #d4a23c   /* lift / accents / reps */
--rust          #c4561f   /* séances "rust", alertes */
--blue          #5b9bd5   /* cardio uniquement */
--green-done    #2e7d4f   /* carte complétée */
--red-timer     #d23a3a   /* minuteur < 10 s */
--border        #2a2a2a
```
Couleur du titre de séance pilotée par `accent` dans les données (`gold` | `rust` | `blue` | `gray`). Le moteur mappe la clé → variable CSS ; **aucune couleur en dur par nom de jour**.

### Typographie
- Titres « TODAY » / nom de séance : sans-serif condensé très gras, MAJUSCULES (ex. Oswald/Anton via Google Fonts CDN, ou `-apple-system` `font-weight:900` + `letter-spacing` négatif).
- Labels : petites majuscules, `letter-spacing` large, gris.
- Consignes d'exercice : italique, gris.

### Composants
- **Cartes** : coins ~16 px, fond `--bg-card`, fine bordure, padding généreux.
- **Cercles de série** : ronds ~44 px (cible tactile), numéro centré ; coché = rempli couleur d'accent.
- **Onglets jours** : pilules arrondies ; aujourd'hui = point ; actif = bordure colorée.
- **Barre de repos** : pleine largeur, icône chrono + « REPOS 90S » ; en décompte affiche le temps ; rouge sous 10 s.
- Respecter les *safe areas* iOS (`env(safe-area-inset-*)`).

---

## 7. Persistance (localStorage)

L'app n'écrit JAMAIS dans `program.js` (lecture seule). Elle persiste uniquement l'état de suivi :

- **Séries cochées** par date+séance : clé `track:<YYYY-MM-DD>:<sessionKey>` → tableau de booléens par exercice.
- **Poids saisi** par exercice : clé `weight:<exerciseId>` → valeur (persiste entre séances ; conservée même si on reset le suivi).
- **Ordre / swaps** par séance : clé `layout:<sessionKey>`.
- Réinitialisation auto du suivi de séries à **chaque nouveau jour** ; les poids et layouts sont conservés.
- Prévoir un bouton « Réinitialiser la séance du jour ».

> ⚠️ **localStorage est interdit dans un Artifact Claude.ai** et fait échouer l'app en preview. Pour tester en Artifact, utiliser l'état mémoire. **Le livrable GitHub Pages doit utiliser `localStorage`** (fonctionne normalement). Livrer la version `localStorage`.

---

## 8. PWA / installation iOS

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `<meta name="apple-mobile-web-app-title" content="...">`
- `<link rel="apple-touch-icon" href="icon-180.png">` (180×180 ; sinon icône SVG/PNG simple).
- `manifest.json` : `display: "standalone"`, `theme_color/background_color: "#0a0a0a"`.
- Optionnel : `service-worker.js` minimal pour usage hors-ligne à la salle (bonus, pas bloquant).

Structure de dépôt acceptable (compatible GitHub Pages, sans build) :
```
index.html          ← moteur (HTML/CSS/JS)
program.js          ← LES DONNÉES (seul fichier à éditer pour changer de routine)
manifest.json
icon-180.png
service-worker.js   ← optionnel
docs/workout.txt    ← source humaine de référence
```

---

## 9. Plan de développement suggéré (pour Claude Code)

1. Poser le squelette `index.html` + design system CSS (variables, fonts, layout mobile, safe areas).
2. Créer `program.js` avec le programme **3 jours actuel** dérivé de `workout.txt` (Lundi/Mercredi/Vendredi, kg).
3. **Moteur de planning** : `getDay()` → séance ou repos implicite ; rendu selon `type` (lift / cardio / rest / mixed). Itérer sur les données, zéro valeur en dur.
4. **Cartes d'exercices** + cercles cochables + état « complete » (vert) + compteur global = somme des `sets`.
5. **Minuteur de repos** auto, rouge < 10 s, feedback fin.
6. **Onglets** des 7 jours (jours sans séance = repos atténué mais cliquable).
7. **Saisie de poids** par exercice + persistance `localStorage`.
8. **Réordonnancement + swap** d'exercices, persistés.
9. Écrans **cardio/repos** (tips) + **bloc bonus**.
10. **PWA** : manifest, métas iOS, icône (+ service worker optionnel).
11. **Test d'extensibilité** : ajouter un 4ᵉ jour dans `schedule` et vérifier que tout s'affiche sans toucher au moteur. (Critère de réussite de l'architecture.)
12. (Optionnel) écran « Plan » récapitulatif (image 8).

---

## 10. Contraintes & rappels

- **Moteur générique, données externes.** Jamais de jour/séance/exo/couleur/repos en dur dans la logique.
- **Nombre de jours variable (1-7), jours nommés.** Jour non défini = repos implicite.
- **Mobile-first, portrait, une colonne.** Cibles tactiles ≥ 44 px.
- **Pas de backend, un seul utilisateur, pas de build step.**
- **Unités kg/lbs** selon `meta.units`.
- **`id` d'exercice stables** (clé de mémorisation des poids).
- Code **commenté en français**, sections délimitées.
- Tester le passage minuit (réinit suivi, conservation poids) et l'ajout d'un jour.
