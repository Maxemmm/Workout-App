// program.js — SEUL fichier à éditer pour changer le programme.
// Dérivé de docs/workout.txt. Re-déployer après toute modification.
//
// IDs d'exercices : STABLES. Ne jamais réutiliser un id pour un exercice différent.
// Les ids partagés entre séances (ex: "presse-cuisses") sont intentionnels :
// même exercice → même mémorisation de poids.

const PROGRAM = {

  // ─── Métadonnées globales ──────────────────────────────────────────────
  meta: {
    label:          "PROGRAMME SALLE",   // bandeau supérieur
    units:          "kg",               // "kg" | "lbs"
    restDefaultSec: 90,                 // repos si non précisé sur l'exercice
    repsInReserve:  "1 à 2 reps en réserve",
  },

  // ─── Séances (indépendantes des jours) ────────────────────────────────
  sessions: {

    // ── LUNDI : FULL BODY ─────────────────────────────────────────────
    "full-body": {
      type:     "lift",
      name:     "FULL BODY",
      accent:   "gold",
      subtitle: "JAMBES · PECS · DOS · ÉPAULES",
      note:     null,

      warmup: [
        "Vélo ou tapis 5 à 7 min (léger)",
        "Mobilité épaules et hanches",
        "1 série légère sur presse et développé",
      ],

      exercises: [
        {
          id:           "presse-cuisses",
          name:         "Presse à cuisses",
          scheme:       "4×8",
          sets:         4,
          load:         "100 à 120 kg",
          restSec:      120,
          cue:          null,
          alternatives: [],
        },
        {
          id:           "developpe-machine",
          name:         "Développé machine",
          scheme:       "4×8",
          sets:         4,
          load:         "30 à 40 kg",
          restSec:      120,
          cue:          null,
          alternatives: ["Développé haltères"],
        },
        {
          id:           "tirage-horizontal",
          name:         "Tirage horizontal",
          scheme:       "4×10",
          sets:         4,
          load:         "35 à 45 kg",
          restSec:      90,
          cue:          null,
          alternatives: [],
        },
        {
          id:           "leg-curl",
          name:         "Leg curl",
          scheme:       "3×12",
          sets:         3,
          load:         "25 à 35 kg",
          restSec:      90,
          cue:          null,
          alternatives: [],
        },
        {
          id:           "elevations-laterales",
          name:         "Élévations latérales",
          scheme:       "3×12",
          sets:         3,
          load:         "6 à 8 kg",
          restSec:      60,
          cue:          null,
          alternatives: [],
        },
        {
          id:           "gainage",
          name:         "Gainage",
          scheme:       "45",
          sets:         3,
          timed:        true,
          load:         "poids du corps",
          restSec:      60,
          cue:          null,
          alternatives: [],
        },
      ],

      cardio: {
        label:  "Marche inclinée",
        detail: "15 à 20 min — inclinaison 5 à 10 % — 5 à 6,5 km/h",
      },

      bonus: null,
      tips:  null,
    },

    // ── MERCREDI : HAUT DU CORPS ──────────────────────────────────────
    "haut-du-corps": {
      type:     "lift",
      name:     "HAUT DU CORPS",
      accent:   "rust",
      subtitle: "PECS · DOS · BRAS",
      note:     null,

      warmup: [
        "Vélo ou rameur 5 min",
        "Mobilité épaules",
        "1 série légère développé incliné 6-8 kg",
      ],

      exercises: [
        {
          id:           "developpe-incline-halteres",
          name:         "Développé incliné haltères",
          scheme:       "3×10",
          sets:         3,
          load:         "10 kg",
          restSec:      90,
          cue:          null,
          alternatives: [],
        },
        {
          id:           "tirage-vertical",
          name:         "Tirage vertical",
          scheme:       "3×10",
          sets:         3,
          load:         "30 kg",
          restSec:      90,
          cue:          null,
          alternatives: [],
        },
        {
          // Alternative : Rowing machine RH06 à 45 kg (selon dispo)
          id:           "rowing-unilateral",
          name:         "Rowing unilatéral",
          scheme:       "3×10",
          sets:         3,
          load:         "14 à 20 kg",
          restSec:      90,
          cue:          null,
          alternatives: ["Rowing machine RH06 — 45 kg"],
        },
        {
          id:           "dips-assistes",
          name:         "Dips assistés",
          scheme:       "3×MAX",
          sets:         3,
          load:         "assistance 21 kg",
          restSec:      90,
          cue:          null,
          alternatives: [],
        },
        {
          id:           "curl-machine",
          name:         "Curl machine RH15",
          scheme:       "3×12",
          sets:         3,
          load:         "20 kg",
          restSec:      60,
          cue:          null,
          alternatives: [],
        },
        {
          id:           "triceps-corde",
          name:         "Triceps corde",
          scheme:       "3×12",
          sets:         3,
          load:         "20 à 30 kg",
          restSec:      60,
          cue:          null,
          alternatives: [],
        },
      ],

      cardio: {
        label:  "Vélo fractionné",
        detail: "15 à 20 min — 30 sec rapide / 1 min lent",
      },

      bonus: null,
      tips:  null,
    },

    // ── VENDREDI : BAS DU CORPS ───────────────────────────────────────
    "bas-du-corps": {
      type:     "lift",
      name:     "BAS DU CORPS",
      accent:   "rust",
      subtitle: "QUADS · ISCHIOS · MOLLETS",
      note:     null,

      warmup: [
        "Vélo 5 à 7 min",
        "Mobilité hanches et genoux",
        "1 série légère presse",
      ],

      exercises: [
        {
          // Même exercice qu'en Full Body → même id → même poids mémorisé
          id:           "presse-cuisses",
          name:         "Presse à cuisses",
          scheme:       "4×8",
          sets:         4,
          load:         "100 à 120 kg",
          restSec:      120,
          cue:          null,
          alternatives: [],
        },
        {
          id:           "fentes-marchees",
          name:         "Fentes marchées",
          scheme:       "3×12",
          sets:         3,
          load:         "10 à 14 kg",
          restSec:      90,
          cue:          null,
          alternatives: [],
        },
        {
          // Même exercice qu'en Full Body → même id
          id:           "leg-curl",
          name:         "Leg curl",
          scheme:       "3×12",
          sets:         3,
          load:         "25 à 35 kg",
          restSec:      90,
          cue:          null,
          alternatives: [],
        },
        {
          id:           "mollets-machine",
          name:         "Mollets machine",
          scheme:       "3×15",
          sets:         3,
          load:         "60 à 80 kg",
          restSec:      90,
          cue:          null,
          alternatives: [],
        },
        {
          // Même exercice qu'en Full Body → même id
          id:           "gainage",
          name:         "Gainage",
          scheme:       "45",
          sets:         3,
          timed:        true,
          load:         "poids du corps",
          restSec:      60,
          cue:          null,
          alternatives: [],
        },
      ],

      cardio: {
        label:  "Vélo",
        detail: "15 à 20 min — intensité modérée",
      },

      bonus: null,
      tips:  null,
    },

    // ── Séances types réutilisables (cardio / repos) ──────────────────
    "cardio": {
      type:     "cardio",
      name:     "CARDIO",
      accent:   "blue",
      subtitle: "VÉLO",
      tips: [
        { title: "Cible",   body: "Allure modérée — RPE 6-7. Effort régulier, pas une course." },
        { title: "Durée",   body: "15 à 20 min selon résistance et niveau du jour." },
        { title: "Protéines", body: "Les jours cardio ne sont pas des jours de relâche nutritionnelle. Tiens ton apport." },
      ],
    },

    "repos": {
      type:     "rest",
      name:     "REPOS",
      accent:   "gray",
      subtitle: "RÉCUPÈRE. MANGE. DORS.",
      tips: [
        { title: "Le sommeil est de l'entraînement", body: "7 à 9 h — pic d'hormone de croissance. C'est là que le muscle se construit vraiment." },
        { title: "Protéines",    body: "Ne pas baisser l'apport les jours de repos. La réparation musculaire continue 24 h / 24." },
        { title: "Hydratation",  body: "Boire au moins 2 L d'eau. L'eau transporte les nutriments vers les muscles." },
        { title: "Mobilité",     body: "5 à 10 min d'étirements doux si tu en as l'occasion. Pas obligatoire, mais bienvenu." },
      ],
    },

  }, // fin sessions

  // ─── Planning hebdomadaire ─────────────────────────────────────────────
  // Indices alignés sur Date.getDay() : 0 = dimanche … 6 = samedi.
  // Jour ABSENT ou null → repos implicite (moteur gère seul).
  schedule: {
    1: "full-body",      // Lundi
    3: "haut-du-corps",  // Mercredi
    5: "bas-du-corps",   // Vendredi
    // 0, 2, 4, 6 non définis → repos implicite
  },

  // ─── Règles de base (depuis workout.txt) ──────────────────────────────
  rules: [
    "Garder 1 à 2 répétitions en réserve",
    "Si trop facile, augmenter légèrement la charge",
    "Si trop difficile, diminuer légèrement la charge",
    "Priorité à l'exécution propre",
    "Progression chaque semaine si possible",
  ],

}; // fin PROGRAM
