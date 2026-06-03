# REFONTE V2 — Workout App : application complète et livrable

> Spec de refonte pour Claude Code.
> Cette version transforme l'app en produit fini, autonome, utilisable
> par n'importe qui sans fichier externe ni aide technique.
> Elle s'appuie sur l'architecture multi-user (localStorage + JSON),
> y ajoute un écran d'accueil, un éditeur de programme complet,
> et repose l'ensemble de la navigation pour que l'expérience soit
> cohérente du premier lancement au suivi quotidien.

---

## 1. Vision produit

L'application doit sentir comme une vraie app native iOS — pas une page
web habillée. Trois qualités non négociables :

**Autonome.** L'utilisateur installe l'app, crée son programme depuis
l'app, s'entraîne, consulte sa progression. Zéro fichier à éditer,
zéro manipulation technique, zéro compte.

**Cohérente.** Un seul design system, une seule logique de navigation,
une seule palette. Chaque écran doit sembler avoir été dessiné en même
temps que les autres.

**Intentionnelle.** L'esthétique noir / doré / rouille des maquettes
n'est pas un thème sombre générique — c'est une identité. Chaque décision
de design (typographie, espacement, animation, iconographie) doit la
renforcer, pas la diluer.

---

## 2. Direction artistique (à suivre scrupuleusement)

### Identité visuelle
Style : **luxury athletic / editorial dark**.
Références : maquettes fournies dans `docs/resources/`.
Mot-clé : ce que ressentirait l'interface d'un coach personnel premium.

### Palette (inchangée, étendue)
```
--bg              #0a0a0a    fond principal
--bg-card         #161616    cartes standard
--bg-card-soft    #1e1e1e    cartes secondaires, inputs
--bg-elevated     #222222    modales, sheets
--text            #f5f5f5    titres, texte principal
--text-dim        #8a8a8a    sous-titres, labels, placeholders
--text-faint      #444444    séparateurs, hints
--gold            #d4a23c    accent principal (lift, CTA primaire)
--gold-dim        #8a6520    accent atténué (états disabled)
--rust            #c4561f    accent secondaire (BAS DU CORPS, alertes)
--blue            #5b9bd5    cardio
--green-done      #2e7d4f    série complétée, succès
--red-timer       #d23a3a    minuteur critique (< 10 s)
--red-danger      #a02020    actions destructives
--border          #2a2a2a    bordures standard
--border-active   #d4a23c    bordure élément actif/focus
```

### Typographie
- **Display** (titres TODAY, noms de séances, écran d'accueil) :
  Police condensée ultra-bold, tout en majuscules.
  Recommandation : `Barlow Condensed` 800 ou `Bebas Neue` via Google Fonts CDN.
- **UI** (labels, boutons, données) :
  Sans-serif géométrique lisible.
  Recommandation : `DM Sans` ou `Outfit` via Google Fonts CDN.
- Jamais Inter, Roboto, Arial ou polices système génériques.

### Micro-interactions & animations
- Transition entre écrans : slide horizontal (< 250 ms, ease-out).
- Cocher une série : cercle qui se "remplit" avec un micro-bounce.
- Carte complétée : fond qui vire au vert avec un fade doux (300 ms).
- Minuteur sous 10 s : pulsation rouge (CSS keyframe).
- Boutons CTA : légère élévation au tap (transform scale 0.97).
- Modale de confirmation : slide-up depuis le bas (sheet iOS).
- Toutes les transitions respectent `prefers-reduced-motion`.

### Composants de base
- **Cards** : border-radius 16 px, fond `--bg-card`, bordure
  `1px solid --border`, padding 20 px, ombre douce.
- **Inputs** : fond `--bg-card-soft`, bordure `--border`, focus =
  `--border-active`, border-radius 12 px, hauteur min 48 px.
- **Buttons primaires** : fond `--gold`, texte noir, font-weight 700,
  border-radius 12 px, hauteur 52 px, tout en majuscules.
- **Buttons secondaires** : fond transparent, bordure `--border`,
  texte `--text`, même géométrie.
- **Buttons destructifs** : fond transparent, texte `--red-danger`,
  bordure `--red-danger`.
- **Cercles de séries** : 44 px, bordure 2 px `--border`, état coché =
  fond `--gold` (lift) ou `--rust` (BAS DU CORPS), check SVG centré.

---

## 3. Architecture de navigation

### Structure globale : Tab Bar (4 onglets)

```
┌─────────────────────────────────┐
│                                 │
│         CONTENU PRINCIPAL       │
│                                 │
│                                 │
├─────────────────────────────────┤
│  🏋  Today  │  📋  Plan  │  📊  Stats  │  ⚙  Profil  │
└─────────────────────────────────┘
```

La tab bar est fixe en bas, respecte `env(safe-area-inset-bottom)`.
Icônes + label court. Onglet actif = icône et label en `--gold`.

| Onglet | Icône | Contenu |
|--------|-------|---------|
| Today | haltère | Séance du jour (moteur existant) |
| Plan | calendrier | Vue hebdomadaire + gestion des programmes |
| Stats | graphique | Dashboard de progression (feature dashboard) |
| Profil | personne | Paramètres, export, import, reset |

### Flux premier lancement

```
Installation PWA
      ↓
Écran d'accueil (splash + onboarding)
      ↓
L'utilisateur n'a pas de programme
      ↓
      ├── "Créer mon programme" → Éditeur de programme (flow guidé)
      └── "Importer un JSON"   → Import + validation
            ↓
      Programme créé / importé → Tab Bar → Today
```

### Flux lancement normal (programme existant)

```
Ouverture de l'app
      ↓
Tab Bar → Today (séance du jour ou repos)
```

---

## 4. Écrans détaillés

---

### 4.1 Écran d'accueil (onboarding — premier lancement uniquement)

Affiché une seule fois, quand `localStorage["program"]` est absent.
Jamais revu après (sauf reset complet depuis Profil).

**Structure visuelle :**
```
[fond noir avec texture subtile ou grain léger]

        LOGO / NOM APP
        (typographie display, --gold)

        [tagline courte, 1 ligne, --text-dim]

        ────────────────

        [CTA principal]
        "CRÉER MON PROGRAMME"
        (bouton pleine largeur, --gold)

        [CTA secondaire]
        "Importer un programme (JSON)"
        (bouton outline)
```

- Pas de carousel d'onboarding. Pas de slides "features". Entrée directe.
- Animation d'entrée : logo fade-in + slide-up léger, puis CTA (staggered).
- Le nom de l'app et le tagline sont à définir (laisser un placeholder
  `APP_NAME` dans le code, facilement remplaçable).

---

### 4.2 Today (séance du jour)

Inchangé dans sa logique, enrichi dans son design.

**En-tête :**
```
LABEL DU PROGRAMME                   LUN, 2 JUIN
TODAY
FULL BODY                            ← couleur selon accent
JAMBES · PECS · DOS · ÉPAULES

[SUN][MON●][TUE][WED][THU][FRI][SAT]

SÉRIES FAITES ──────────░░░░  8 / 24
```

Barre de progression linéaire animée (fill en `--gold`).

**Cartes d'exercices :**
Voir §2 composants. Ajout : bouton "⇅" (réordonner) et "↔" (swap)
intégrés discrètement dans la card, pas en mode édition séparé.

**Footer de séance :**
Bouton "TERMINER LA SÉANCE" pleine largeur, affiché dès qu'au moins
une série est cochée (pas seulement quand tout est fait).
Au tap : modale de confirmation + log enregistré + feedback visuel
("Séance enregistrée ✓").

---

### 4.3 Plan (gestion des programmes)

Deux sous-vues accessibles par onglets internes (segmented control) :

**Sous-vue "Cette semaine"**
```
┌──────────────────────────────────┐
│ LUN        FULL BODY             │  ← card cliquable → détail séance
│            6 exercices           │
├──────────────────────────────────┤
│ MAR        Repos                 │
├──────────────────────────────────┤
│ MER        HAUT DU CORPS         │
│            6 exercices           │
├──────────────────────────────────┤
│ ...                              │
└──────────────────────────────────┘
         [+ AJOUTER UNE SÉANCE]
```

**Sous-vue "Mes programmes"**
```
● Programme actif
  PROGRAMME SALLE                  ← nom
  3 jours · 17 exercices           ← résumé
  [Modifier]  [Dupliquer]  [···]

  ────────────────────────

○ Programme 2
  MON SPLIT PUSH PULL
  [Activer]  [Modifier]  [···]

  [+ CRÉER UN NOUVEAU PROGRAMME]
```

L'utilisateur peut avoir **plusieurs programmes** stockés.
Un seul est actif à la fois (`localStorage["activeProgram"]`).
Changer de programme actif ne supprime pas les logs.

---

### 4.4 Éditeur de programme

Accessible depuis "Créer" (onboarding) ou "Modifier" (Plan).
C'est l'écran le plus complexe — le décomposer en étapes.

**Étape 1 — Métadonnées du programme**
```
Nom du programme    [__________________]
Unité de poids      [kg ▼]
Repos par défaut    [90] secondes
```

**Étape 2 — Planning hebdomadaire**
```
Lundi     [Aucune séance ▼]
Mardi     [Aucune séance ▼]
Mercredi  [Aucune séance ▼]
...
```
Chaque jour : dropdown (liste des séances créées + "Aucune séance" = repos).

**Étape 3 — Séances**
Liste des séances du programme.
Chaque séance = card avec nom, type, nb d'exercices.
Actions : modifier (→ Étape 4), dupliquer, supprimer.
Bouton : "+ CRÉER UNE SÉANCE".

**Étape 4 — Éditeur de séance**
```
Nom de la séance    [__________________]
Type                [Musculation ▼]      (lift / cardio / repos)
Sous-titre          [__________________]  (groupes musculaires)
Couleur accent      [● Or  ● Rouille  ● Bleu  ● Gris]

── ÉCHAUFFEMENT ──────────────────────
  + Ajouter une note d'échauffement

── EXERCICES ─────────────────────────
  ┌────────────────────────────────┐
  │ Presse à cuisses               │
  │ 4 × 8   100–120 kg   2 min     │
  │ [Modifier]          [Suppr.]   │
  └────────────────────────────────┘
  + AJOUTER UN EXERCICE

── CARDIO DE FIN ─────────────────────
  [label]  [détail]

── CONSEILS (jours repos/cardio) ─────
  + Ajouter un conseil
```

**Étape 5 — Éditeur d'exercice (modale)**
```
Nom de l'exercice   [__________________]
Séries              [4]
Reps / Schéma       [8]        ex: 8-12, MAX, 45 sec
Charge suggérée     [100 à 120 kg]
Temps de repos      [120] sec
Consigne            [__________________]  (optionnel)
Alternatives        [________________]   + Ajouter
```

**Navigation dans l'éditeur :**
- Chaque étape est un écran dédié (pas tout sur une seule page longue).
- Barre de progression en haut (étape X / 5).
- Bouton "Retour" toujours présent.
- Modifications sauvegardées en brouillon dans localStorage en temps réel.
- Bouton "ENREGISTRER LE PROGRAMME" à la fin de l'étape 4.

---

### 4.5 Stats (dashboard)

Voir `docs/DASHBOARD_FEATURE.md` pour le détail complet.

Résumé de l'écran :
- En-tête : streak, séances cette semaine.
- Sélecteur d'exercice → courbe des charges + PR.
- Volume par séance (Chart.js CDN).
- Bouton export JSON.

---

### 4.6 Profil / Paramètres

```
[Avatar initiales ou icône]
NOM APP                   ← ou nom personnalisé si ajouté plus tard

── MON PROGRAMME ─────────────────────
  Programme actif : PROGRAMME SALLE
  [Gérer mes programmes]

── DONNÉES ───────────────────────────
  [Exporter mes données]       → JSON (programme + logs + poids)
  [Importer une sauvegarde]    → restaurer un export
  [Réinitialiser la séance du jour]

── DANGER ZONE ───────────────────────
  [Supprimer tous mes logs]    → confirmation
  [Réinitialiser l'application]→ confirmation ("irréversible")

── À PROPOS ──────────────────────────
  Version · Format du programme · Aide
```

---

## 5. Modèle de données localStorage

```
"programs"          → JSON.stringify([...tableauDeProgrammes])
                      Chaque programme = objet complet (même format que
                      program.example.json)

"activeProgram"     → string (id du programme actif, ex. "prog-1")

"weight:<id>"       → dernier poids saisi par exercice

"track:<YYYY-MM-DD>:<sessionKey>"
                    → séries cochées du jour

"layout:<sessionKey>"
                    → ordre/swaps choisis

"log:<YYYY-MM-DD>"  → log de séance (voir DASHBOARD_FEATURE.md)

"onboarded"         → "true" une fois le premier programme créé
                      (évite de revoir l'écran d'accueil)
```

Chaque programme dans le tableau a un `id` généré à la création
(ex. `"prog-" + Date.now()`), un `name`, et toute la structure
définie dans `program.example.json`.

---

## 6. Gestion des programmes multiples

- Plusieurs programmes stockés dans `localStorage["programs"]` (tableau).
- Un seul actif (`localStorage["activeProgram"]`).
- Le moteur Today lit toujours le programme actif.
- Changer de programme actif = instantané, sans perte de logs.
- Dupliquer un programme = copie profonde avec nouvel `id` et nom
  suffixé "(copie)".
- Supprimer un programme : impossible si c'est le seul ; confirmation
  modale sinon.

---

## 7. Validation de l'éditeur

Avant d'enregistrer un programme créé via l'éditeur, appliquer les
mêmes validations qu'à l'import JSON (§7 de CLAUDE.md) :
- Au moins une séance dans `sessions`.
- Au moins un jour dans `schedule`.
- Chaque exercice a `id`, `name`, `sets > 0`.
- Les `id` sont uniques dans le programme.

Les `id` d'exercices sont auto-générés par l'éditeur
(`"exo-" + Date.now() + "-" + Math.random().toString(36).slice(2)`).
L'utilisateur ne les voit jamais.

---

## 8. PWA — inchangé

Voir CLAUDE.md (branche multi-user) §8.
Ajouter : `display: "standalone"`, splash screen couleur `#0a0a0a`.

---

## 9. Plan de développement pour Claude Code

> Chaque étape doit être validée avant de passer à la suivante.

### Phase 1 — Fondations design
1. Poser le design system complet : variables CSS, typographie (Google
   Fonts CDN), composants de base (cards, buttons, inputs, cercles).
2. Implémenter la Tab Bar fixe (Today / Plan / Stats / Profil) avec
   transitions entre onglets.
3. Tester le design system sur mobile (390 px, safe areas iOS).

### Phase 2 — Onboarding & programmes
4. Écran d'accueil (premier lancement) : animation d'entrée, CTA
   "Créer" et "Importer".
5. Éditeur de programme — métadonnées + planning (étapes 1 et 2).
6. Éditeur de programme — séances et exercices (étapes 3, 4, 5).
7. Validation + sauvegarde dans `localStorage["programs"]`.
8. Flux "Importer un JSON" avec validation.

### Phase 3 — Moteur Today
9. Adapter le moteur existant pour lire le programme actif depuis
   `localStorage["programs"]` + `localStorage["activeProgram"]`.
10. Cercles de séries, minuteur, carte complétée, compteur global.
11. Bouton "Terminer la séance" + log de séance.

### Phase 4 — Plan & multi-programmes
12. Sous-vue "Cette semaine" (vue planning).
13. Sous-vue "Mes programmes" (liste, activer, dupliquer, supprimer).

### Phase 5 — Stats & Profil
14. Dashboard Stats (Chart.js CDN, courbes, PR).
15. Écran Profil (export, import, reset, danger zone).

### Phase 6 — Polish
16. Animations et micro-interactions (transitions, bounce, fade).
17. Test complet : onboarding → création programme → séance →
    log → stats → export → import → reset.
18. Test multi-appareil : même URL, deux programmes différents.
19. Test PWA : installation iOS, offline, safe areas.

---

## 10. Contraintes générales

- **Zéro backend, zéro build step, zéro compte.**
- **HTML + CSS + JS vanilla** dans `index.html` (+ CDN Chart.js,
  Google Fonts). Pas de bundler.
- **Mobile-first strict** : portrait, 390 px, une colonne,
  cibles tactiles ≥ 44 px, safe areas iOS respectées.
- **`id` d'exercices auto-générés et stables** (jamais réutilisés
  pour un autre exercice).
- **Jamais stocker un programme invalide.**
- **Code commenté en français**, sections clairement délimitées,
  fonctions documentées.
- **Prefers-reduced-motion** respecté sur toutes les animations.
- **Pas de dépendance à program.js** (supprimé dans cette version).