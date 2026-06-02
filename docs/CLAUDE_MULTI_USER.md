# CLAUDE.md — Workout App (branche `multi-user`)

> Branche dérivée de `main`. Même moteur, même design system.
> Différence fondamentale : le programme ne vit plus dans `program.js`
> (fichier serveur) mais dans `localStorage` de chaque appareil.
> Même URL → moteur identique pour tous. Chaque appareil → son propre
> programme, ses propres logs, ses propres poids. Zéro backend.

---

## 1. Principe central

```
Branche main          Branche multi-user
─────────────         ──────────────────
program.js            localStorage["program"]
  (servi par           (stocké sur l'appareil,
   GitHub Pages,        importé par l'utilisateur,
   identique pour       différent sur chaque
   tous)                appareil)
```

Le moteur (`index.html`) est identique pour tous les utilisateurs.
Ce qui diffère : le contenu de leur `localStorage`.

**Conséquence pour le code :** remplacer partout
`window.PROGRAM` (objet chargé depuis `program.js`)
par `JSON.parse(localStorage.getItem("program"))`.
Le reste du moteur ne change pas.

---

## 2. Fichiers du repo (diff vs `main`)

```
Supprimé   program.js
Ajouté     program.example.json   ← programme exemple à copier pour démarrer
Ajouté     program.schema.json    ← documentation du format JSON attendu
Modifié    index.html             ← lit localStorage au lieu de program.js
Modifié    docs/CLAUDE.md         ← ce fichier
Inchangé   manifest.json, icon-180.png, service-worker.js
```

`program.example.json` et `program.schema.json` sont des ressources
d'onboarding, pas des données d'exécution. L'app ne les charge jamais
automatiquement.

---

## 3. Format JSON du programme

Le format est la traduction exacte du modèle de données de `main`
(voir §3 de l'ancien CLAUDE.md), sérialisée en JSON standard.
C'est le contrat entre l'utilisateur et le moteur.

```jsonc
{
  "meta": {
    "label": "PROGRAMME SALLE",   // bandeau haut de l'app
    "units": "kg",                // "kg" | "lbs"
    "restDefaultSec": 90,         // repos par défaut si non précisé
    "repsInReserve": "1 à 2 reps en réserve"
  },

  "sessions": {
    // Clé = identifiant de session (stable, utilisé dans schedule)
    "full-body": {
      "type": "lift",             // "lift" | "cardio" | "rest" | "mixed"
      "name": "FULL BODY",        // affiché en grand
      "accent": "gold",           // "gold" | "rust" | "blue" | "gray"
      "subtitle": "JAMBES · PECS · DOS · ÉPAULES",
      "note": null,               // note optionnelle en tête de séance
      "warmup": [                 // liste de strings, affiché non coché
        "Vélo ou tapis 5 à 7 min",
        "Mobilité épaules et hanches"
      ],
      "exercises": [
        {
          "id": "presse-cuisses", // STABLE — clé de mémorisation du poids
          "name": "Presse à cuisses",
          "scheme": "4×8",        // texte affiché (séries×reps)
          "sets": 4,              // nombre de cercles cochables
          "load": "100 à 120 kg", // suggestion affichée
          "restSec": 120,
          "cue": null,            // consigne d'exécution (italique)
          "alternatives": []      // noms d'exercices de substitution
        }
      ],
      "cardio": {                 // optionnel, fin de séance lift
        "label": "Marche inclinée",
        "detail": "15 à 20 min — inclinaison 5 à 10% — 5 à 6,5 km/h"
      },
      "bonus": null,              // ou { "title": "...", "exercises": [...] }
      "tips": null                // pour type cardio/rest uniquement
    }
  },

  "schedule": {
    // Indices = Date.getDay() : 0=dim … 6=sam
    // Valeur = clé dans sessions
    // Jour absent = repos implicite
    "1": "full-body",
    "3": "haut-du-corps",
    "5": "bas-du-corps"
  },

  "rules": [
    "Garder 1 à 2 répétitions en réserve",
    "Si trop facile, augmenter légèrement la charge"
  ]
}
```

**Règles de format :**
- Les `id` d'exercices sont **stables et uniques**. Ne jamais réutiliser
  un `id` pour un exercice différent (c'est la clé des poids mémorisés).
- Les clés de `sessions` et `schedule` sont des strings JSON
  (donc `"1"` et non `1`).
- `type` détermine le rendu : `"lift"/"mixed"` → cartes d'exercices ;
  `"cardio"/"rest"` → cartes de conseils (`tips`).

---

## 4. Flux utilisateur

### Premier lancement (localStorage vide)

```
Écran d'onboarding
├── Message : "Aucun programme trouvé"
├── Option A : Importer un fichier JSON
├── Option B : Coller du JSON directement
└── Option C : Charger le programme exemple
      (charge program.example.json embarqué dans index.html
       ou récupéré depuis le repo)
         ↓
Validation du JSON (structure + champs requis)
  ├── Erreur → message explicite, l'utilisateur corrige
  └── OK → localStorage.setItem("program", JSON.stringify(data))
              → démarrage normal sur la séance du jour
```

### Lancements suivants

```
localStorage["program"] existe
  → démarrage direct sur la séance du jour
  (onboarding jamais affiché)
```

### Remplacement de programme

Accessible depuis l'écran Paramètres :
- Ré-importer un nouveau JSON → remplace l'ancien
- Les logs et poids existants sont **conservés** (clés différentes)
- Avertissement si des `id` d'exercices changent
  (les poids associés seront orphelins)

---

## 5. Persistance localStorage

Schéma complet des clés :

```
"program"                   → objet JSON du programme (importé)
"weight:<exerciseId>"       → dernier poids saisi (string, ex. "110")
"track:<YYYY-MM-DD>:<key>"  → séries cochées du jour
"layout:<sessionKey>"       → ordre / swaps choisis
"log:<YYYY-MM-DD>"          → log de séance (voir feature dashboard)
```

Réinitialisation auto des `track:*` au changement de jour.
Tout le reste persiste jusqu'à reset explicite ou effacement du cache.

---

## 6. Écrans de l'application

### Écrans existants (inchangés vs `main`)
- Séance du jour (lift / cardio / rest)
- Navigation par onglets (7 jours)

### Nouveaux écrans (cette branche)

**Onboarding** (premier lancement uniquement)
- Import JSON (fichier ou paste)
- Validation + message d'erreur explicite
- Chargement du programme exemple

**Paramètres** (icône engrenage dans la nav)
- Voir le programme actuel (résumé : nom, nb de jours, nb d'exercices)
- Remplacer le programme (ré-import JSON)
- Exporter toutes les données (programme + logs + poids → JSON)
- Importer une sauvegarde (restaurer un export)
- Reset complet (efface tout le localStorage)

**Éditeur de programme** (feature ultérieure — ne pas implémenter maintenant)
- Créer / modifier / supprimer sessions et exercices
- Générer le JSON exportable
- Documenter l'emplacement prévu : écran "Mon programme" dans Paramètres

---

## 7. Validation du JSON à l'import

Le moteur doit valider le JSON avant de le stocker.
Checks minimaux :
- `meta.units` présent ("kg" ou "lbs")
- `sessions` est un objet non vide
- `schedule` est un objet avec au moins une entrée
- Chaque session référencée dans `schedule` existe dans `sessions`
- Chaque exercice a `id`, `name`, `sets` (number > 0)
- Les `id` d'exercices sont uniques dans le fichier

En cas d'erreur : afficher un message clair ("Exercice sans id ligne X",
"Session 'toto' dans schedule mais absente de sessions"…).
Ne jamais stocker un programme invalide.

---

## 8. Design system

Identique à `main` — voir §6 de l'ancien CLAUDE.md.

Ajouts pour cette branche :
- **Écran onboarding** : fond `--bg`, card centrale, bouton d'import
  proéminent en `--gold`, lien discret "charger l'exemple".
- **Écran paramètres** : liste de cartes actions, destructive actions
  (reset) en `--rust` avec confirmation modale.

---

## 9. Plan de développement (pour Claude Code)

1. Créer `program.example.json` (dérivé de `docs/workout.txt` — 3 jours kg).
2. Modifier `index.html` : remplacer le chargement de `program.js` par
   `JSON.parse(localStorage.getItem("program"))`.
3. Implémenter l'écran **onboarding** (import + validation + exemple).
4. Implémenter l'écran **paramètres** (export / import / reset).
5. Tester : onboarding → séance du jour → poids persistés → reset → onboarding.
6. Tester multi-appareil : même URL, deux programmes différents.
7. (Plus tard) éditeur de programme.

---

## 10. Contraintes & rappels

- **Zéro backend, zéro compte.** Tout dans localStorage.
- **Un programme par appareil**, pas de sync entre appareils.
- **Export JSON = seule sauvegarde.** L'UI doit inciter à exporter
  régulièrement (rappel dans Paramètres).
- **`id` stables.** Avertir l'utilisateur si un import remplace des `id`
  existants (poids orphelins).
- **Validation stricte à l'import.** Jamais stocker un JSON invalide.
- **Mobile-first, portrait, cibles tactiles ≥ 44 px.**
- Code commenté en français, sections délimitées.
