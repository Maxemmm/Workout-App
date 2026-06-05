# AI Coach — UI Design Spec
**Date :** 2026-06-05
**Branche :** ai-coach (base : multi-user)
**Scope :** Questionnaire IA, génération, prévisualisation — intégration dans l'onboarding et Plan

---

## 1. Points d'entrée

### Onboarding (premier lancement)
Trois boutons dans `.onboarding__ctas`, dans cet ordre :
```
[CRÉER MON PROGRAMME]            ← btn--primary (or), id=btnCreate
[✨ CRÉER AVEC L'IA]             ← btn--primary (or), id=btnCreateAi
[Importer un programme (JSON)]   ← btn--secondary (outline), id=btnImport
```
`btnCreateAi` appelle `openAiCoach()`.

### Plan → Mes programmes
À côté du bouton `+ CRÉER UN NOUVEAU PROGRAMME` (existant), ajouter :
```
[+ CRÉER UN NOUVEAU PROGRAMME]   [✨ CRÉER AVEC L'IA]
```
Le second bouton appelle également `openAiCoach()`.

---

## 2. Overlay `overlayAiCoach`

### Structure DOM
```html
<div id="overlayAiCoach" class="overlay-full is-hidden">
  <div class="editor-header">   <!-- réutilise le style existant -->
    <button id="aiBack">←</button>
    <span id="aiStepLabel">Étape 1 / 4</span>
    <button id="aiCancel">✕</button>
  </div>
  <div id="aiBody">
    <div class="ai-step" id="aiStep0">...</div>  <!-- Objectif -->
    <div class="ai-step" id="aiStep1">...</div>  <!-- Disponibilités -->
    <div class="ai-step" id="aiStep2">...</div>  <!-- Matériel -->
    <div class="ai-step" id="aiStep3">...</div>  <!-- Contexte -->
    <div class="ai-step" id="aiStep4">...</div>  <!-- Génération -->
    <div class="ai-step" id="aiStep5">...</div>  <!-- Prévisualisation -->
  </div>
</div>
```

Réutilise les classes CSS existantes `overlay-full`, `editor-header`, `is-hidden`.
Ajouts CSS minimes : `.ai-step`, `.ai-option-card`, `.ai-chip`, `.ai-spinner`, `.ai-accordion-item`.

### Navigation
- État interne `let aiStep = 0` + objet `aiFormData = {}`
- `goToAiStep(n)` : masque la vue courante, affiche la cible, met à jour le label et le bouton Retour
- Vues 0–3 : en-tête affiche `Étape X / 4` + bouton Retour actif
- Vues 4–5 : label vide, bouton Retour masqué, bouton Annuler visible
- Bouton `SUIVANT` en bas de chaque vue 0–3, désactivé si la vue n'est pas valide

---

## 3. Contenu de chaque vue

### Vue 0 — Objectif
Sélection unique parmi 5 cards :
- 🏋 Gagner en force
- 📐 Prise de masse
- 🔥 Sèche / définition
- ⚖️ Recomposition corporelle
- 💪 Forme générale

Card sélectionnée : bordure `--gold`, fond `--bg-card-soft`. `SUIVANT` activé dès qu'une card est sélectionnée.
Stocke : `aiFormData.objectif = "Prise de masse"` (le label texte).

### Vue 1 — Disponibilités
Sélection unique parmi 5 chips : `[2]  [3]  [4]  [5]  [6]` (jours/semaine).
`SUIVANT` activé dès qu'un chip est sélectionné.
Stocke : `aiFormData.frequence = 3` (entier).

### Vue 2 — Matériel
Sélection multiple parmi 5 options (même style card que vue 0) :
- 🏠 Haltères à la maison
- 🏋 Salle de sport complète
- 📦 Machines guidées uniquement
- 🪢 Élastiques / poids de corps
- 🚲 Cardio machines (vélo, tapis)

`SUIVANT` activé dès qu'au moins une option est sélectionnée.
Stocke : `aiFormData.materiel = ["Salle de sport complète"]` (tableau de labels).

### Vue 3 — Contexte
- Niveau : 3 chips `[Débutant]  [Intermédiaire]  [Avancé]`
- Textarea 300 chars max, placeholder "Blessures, contre-indications… (optionnel)"
- Note de confidentialité : `Ces données transitent vers l'IA et ne sont pas conservées.`

`SUIVANT` activé dès qu'un niveau est sélectionné. Textarea optionnelle.
Stocke : `aiFormData.niveau = "intermédiaire"`, `aiFormData.antecedents = "..."` (ou null).

### Vue 4 — Génération
- Bouton `GÉNÉRER MON PROGRAMME` (btn--primary, pleine largeur)
- Au clic : bouton remplacé par spinner + messages rotatifs toutes les 2s :
  - "Analyse de ton profil…"
  - "Construction du programme…"
  - "Optimisation des exercices…"
  - "Finalisation…"
- **Si succès** : `goToAiStep(5)` avec le programme en mémoire (`aiGeneratedProgram`)
- **Si erreur** : spinner masqué, message d'erreur inline (texte rouge), bouton `Réessayer` visible

### Vue 5 — Prévisualisation
- Titre : `aiGeneratedProgram.meta.label` (éditable inline, input simple)
- Résumé : `X jours · Y exercices`
- Accordéon : une card par séance du schedule (ordre lun→dim), cliquable pour voir la liste des exercices (nom + scheme)
- Deux CTA :
  - `[✏️ MODIFIER DANS L'ÉDITEUR]` → btn--secondary → `closeAiCoach(); openEditor(aiGeneratedProgram)`
  - `[✅ UTILISER CE PROGRAMME]` → btn--primary → `saveAndActivateAiProgram()`

---

## 4. Flux de données

### Appel API
```js
async function generateProgram() {
  const res = await fetch('/api/generate-program', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(aiFormData),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erreur inconnue');
  return json.program;
}
```

### Sauvegarde
```js
function saveAndActivateAiProgram() {
  const program = { ...aiGeneratedProgram, id: 'prog-' + Date.now() };
  // Ajoute dans localStorage["programs"] via saveProgram() existante
  saveProgram(program);
  setActiveProgram(program.id);
  closeAiCoach();
  navigateTo('today');
  showToast('Programme activé ✓');
}
```

### "Modifier dans l'éditeur"
```js
closeAiCoach();
openEditor(aiGeneratedProgram); // fonction existante, accepte un programme en entrée
```

---

## 5. CSS — ajouts minimes

Tous les ajouts respectent le design system de REFONTE_V2 (palette, typo, border-radius).

```css
/* Cartes de sélection (objectif, matériel) */
.ai-option-card { /* fond --bg-card, bordure --border, sélectionné: bordure --gold */ }

/* Chips (fréquence, niveau) */
.ai-chip { /* pilule, fond --bg-card-soft, sélectionné: fond --gold, texte noir */ }

/* Spinner génération */
.ai-spinner { /* cercle animé, couleur --gold */ }

/* Accordéon prévisualisation */
.ai-accordion-item { /* card cliquable, chevron animé */ }
```

---

## 6. Ce qui ne change pas

- Moteur Today : inchangé
- Éditeur de programme : inchangé (on lui passe juste un programme pré-rempli)
- localStorage : on réutilise les fonctions `saveProgram()` et `setActiveProgram()` existantes
- Design system : palette, typo, composants — inchangés

---

## 7. Hors scope

- Modification IA d'un programme existant (§2D de AI_COACH_SPEC.md) — itération suivante
- Internationalisation du questionnaire (EN) — itération suivante
- Animation de transition entre vues — nice-to-have, non bloquant
