# AI Coach UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le flux IA complet dans index.html — boutons d'entrée, overlay questionnaire 4 étapes, génération via `/api/generate-program`, prévisualisation avec accordéon, et sauvegarde dans localStorage.

**Architecture:** Un overlay `overlayAiCoach` autonome avec une machine à états JS (6 vues), un module IIFE `AiCoach` ajouté après `Profil.init()`, et une nouvelle méthode `openEditorWithProgram()` exposée par l'App. Zéro modification du moteur Today, de l'éditeur, ou du système de persistance existant.

**Tech Stack:** HTML/CSS/JS vanilla, `fetch` vers `/api/generate-program` (Groq via Vercel), localStorage existant.

---

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `index.html:2553` | Ajout CSS AI Coach avant `</style>` |
| `index.html:2688-2689` | Ajout bouton `btnCreateAi` dans onboarding |
| `index.html:2881` | Ajout HTML overlay `overlayAiCoach` après l'éditeur |
| `index.html:3314` | Ajout bouton AI dans Plan → Mes programmes |
| `index.html:4936` | Ajout `openEditorWithProgram` dans App public API |
| `index.html:5679` | Ajout module IIFE `AiCoach` avant `</body>` |

---

## Task 1 : Étendre App avec `openEditorWithProgram`

**Fichier :** `index.html:4152-4161` (fonction `openEditor`) et `index.html:4936` (return)

- [ ] **Étape 1 : Ajouter la fonction dans le module App**

Trouver la fonction `openEditor` (ligne ~4152) et ajouter juste après la fonction `closeEditor` (après la ligne `}`  de closeEditor, ~ligne 4171) :

```js
    function openEditorWithProgram(program) {
      loadDraft();
      draft = JSON.parse(JSON.stringify(program));
      if (!draft.id) draft.id = 'prog-' + Date.now();
      persistDraft();
      prevDisplayStep = 1;
      $editor.classList.remove('is-hidden');
      goToEditorStep(1, false);
    }
```

- [ ] **Étape 2 : Exposer la fonction dans le return de App**

Trouver la ligne (~ 4936) :
```js
    return { openEditor, openImport, showToast, getPrograms: () => programs,
             getActiveId: () => localStorage.getItem(LS_ACTIVE) };
```
Remplacer par :
```js
    return { openEditor, openEditorWithProgram, openImport, showToast,
             getPrograms: () => programs,
             getActiveId: () => localStorage.getItem(LS_ACTIVE) };
```

- [ ] **Étape 3 : Vérifier dans la console du navigateur**

Ouvrir l'app dans le navigateur, ouvrir DevTools → Console :
```js
typeof App.openEditorWithProgram
// Attendu : "function"
```

- [ ] **Étape 4 : Commit**
```bash
git add index.html
git commit -m "feat(app): expose openEditorWithProgram in App public API"
```

---

## Task 2 : HTML — Bouton onboarding + overlay `overlayAiCoach`

**Fichier :** `index.html`

- [ ] **Étape 1 : Ajouter le bouton `btnCreateAi` dans l'onboarding**

Trouver (ligne ~2688) :
```html
        <button class="btn btn--primary btn--full" id="btnCreate" data-i18n="onboarding_create">CRÉER MON PROGRAMME</button>
        <button class="btn btn--secondary btn--full" id="btnImport" data-i18n="onboarding_import">Importer un programme (JSON)</button>
```
Remplacer par :
```html
        <button class="btn btn--primary btn--full" id="btnCreate" data-i18n="onboarding_create">CRÉER MON PROGRAMME</button>
        <button class="btn btn--primary btn--full" id="btnCreateAi">✨ CRÉER AVEC L'IA</button>
        <button class="btn btn--secondary btn--full" id="btnImport" data-i18n="onboarding_import">Importer un programme (JSON)</button>
```

- [ ] **Étape 2 : Ajouter l'overlay `overlayAiCoach` après la ligne 2881**

Trouver `</div><!-- fin overlayEditor -->` (ligne 2881) et insérer **après** cette ligne :

```html

  <!-- ============================================================
       AI COACH OVERLAY (questionnaire + génération + prévisualisation)
  ============================================================ -->
  <div id="overlayAiCoach" class="overlay-full is-hidden" aria-label="Coach IA">

    <!-- En-tête -->
    <div class="editor-header">
      <button class="editor-header__back" id="aiBack" aria-label="Retour">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>
      <span class="editor-header__step" id="aiStepLabel">Étape 1 / 4</span>
      <button class="editor-header__cancel" id="aiCancel">Annuler</button>
    </div>

    <!-- Corps : 6 vues -->
    <div id="aiBody" class="editor-body" style="padding-bottom: 100px; overflow-y: auto;">

      <!-- Vue 0 : Objectif -->
      <div class="ai-step" id="aiStep0">
        <h2 class="ai-step__title">Quel est ton objectif ?</h2>
        <div class="ai-options-grid">
          <button class="ai-option-card" data-value="Gagner en force">🏋 Gagner en force</button>
          <button class="ai-option-card" data-value="Prise de masse">📐 Prise de masse</button>
          <button class="ai-option-card" data-value="Sèche / définition">🔥 Sèche / définition</button>
          <button class="ai-option-card" data-value="Recomposition corporelle">⚖️ Recomposition corporelle</button>
          <button class="ai-option-card" data-value="Forme générale">💪 Forme générale</button>
        </div>
      </div>

      <!-- Vue 1 : Disponibilités -->
      <div class="ai-step is-hidden" id="aiStep1">
        <h2 class="ai-step__title">Combien de jours par semaine ?</h2>
        <div class="ai-chips">
          <button class="ai-chip" data-value="2">2 jours</button>
          <button class="ai-chip" data-value="3">3 jours</button>
          <button class="ai-chip" data-value="4">4 jours</button>
          <button class="ai-chip" data-value="5">5 jours</button>
          <button class="ai-chip" data-value="6">6 jours</button>
        </div>
      </div>

      <!-- Vue 2 : Matériel (multi-select) -->
      <div class="ai-step is-hidden" id="aiStep2">
        <h2 class="ai-step__title">Quel matériel as-tu ?</h2>
        <p class="ai-step__label">Sélection multiple</p>
        <div class="ai-options-grid">
          <button class="ai-option-card" data-value="Haltères à la maison">🏠 Haltères à la maison</button>
          <button class="ai-option-card" data-value="Salle de sport complète">🏋 Salle de sport complète</button>
          <button class="ai-option-card" data-value="Machines guidées uniquement">📦 Machines guidées uniquement</button>
          <button class="ai-option-card" data-value="Élastiques / poids de corps">🪢 Élastiques / poids de corps</button>
          <button class="ai-option-card" data-value="Cardio machines (vélo, tapis)">🚲 Cardio machines (vélo, tapis)</button>
        </div>
      </div>

      <!-- Vue 3 : Contexte -->
      <div class="ai-step is-hidden" id="aiStep3">
        <h2 class="ai-step__title">Ton profil</h2>
        <p class="ai-step__label">Niveau</p>
        <div class="ai-chips">
          <button class="ai-chip" data-value="débutant">Débutant</button>
          <button class="ai-chip" data-value="intermédiaire">Intermédiaire</button>
          <button class="ai-chip" data-value="avancé">Avancé</button>
        </div>
        <p class="ai-step__label" style="margin-top: var(--space-lg);">
          Antécédents / contre-indications
          <span class="ai-optional">(optionnel)</span>
        </p>
        <textarea id="aiAntecedents" class="ai-textarea" maxlength="300"
          placeholder="Blessures, douleurs, opérations…"></textarea>
        <p class="ai-privacy-note">
          Ces données transitent vers l'IA et ne sont pas conservées.
        </p>
      </div>

      <!-- Vue 4 : Génération -->
      <div class="ai-step is-hidden" id="aiStep4">
        <div class="ai-generate-content">
          <h2 class="ai-step__title">Prêt à générer ?</h2>
          <p class="ai-step__sub" id="aiGenerateSummary"></p>
          <div id="aiSpinner" class="ai-spinner is-hidden">
            <div class="ai-spinner__ring"></div>
            <p class="ai-generating-msg" id="aiGeneratingMsg">Analyse de ton profil…</p>
          </div>
          <div id="aiError" class="ai-error is-hidden">
            <p id="aiErrorMsg"></p>
            <button class="btn btn--secondary" id="aiRetry">Réessayer</button>
          </div>
          <button class="btn btn--primary btn--full" id="aiGenerate">✨ GÉNÉRER MON PROGRAMME</button>
        </div>
      </div>

      <!-- Vue 5 : Prévisualisation -->
      <div class="ai-step is-hidden" id="aiStep5">
        <h2 class="ai-step__title">Ton programme</h2>
        <input class="ai-prog-name" type="text" id="aiProgName" maxlength="100" />
        <p class="ai-prog-summary" id="aiProgSummary"></p>
        <div id="aiAccordion" class="ai-accordion"></div>
        <div class="ai-preview-ctas">
          <button class="btn btn--secondary btn--full" id="aiEditInEditor">✏️ MODIFIER DANS L'ÉDITEUR</button>
          <button class="btn btn--primary btn--full" id="aiUseProgram">✅ UTILISER CE PROGRAMME</button>
        </div>
      </div>

    </div><!-- fin aiBody -->

    <!-- Footer : bouton SUIVANT (visible vues 0-3 uniquement) -->
    <div class="editor-footer" id="aiFooter">
      <button class="btn btn--primary btn--full" id="aiNext" disabled>SUIVANT →</button>
    </div>

  </div><!-- fin overlayAiCoach -->
```

- [ ] **Étape 3 : Vérifier visuellement**

Ouvrir l'app dans le navigateur. Dans la console :
```js
document.getElementById('overlayAiCoach').classList.remove('is-hidden')
```
L'overlay doit apparaître avec l'en-tête et la vue 0 (cartes d'objectif visibles).

- [ ] **Étape 4 : Commit**
```bash
git add index.html
git commit -m "feat(ui): add overlayAiCoach HTML structure and onboarding button"
```

---

## Task 3 : CSS — Styles AI Coach

**Fichier :** `index.html:2553` (juste avant `</style>`)

- [ ] **Étape 1 : Ajouter les styles avant `</style>`**

Trouver `.no-program p { color: var(--text-faint); }` (ligne ~2553), insérer après :

```css
    /* ═══════════════════════════════════════════════════════════
       AI COACH — composants spécifiques
    ═══════════════════════════════════════════════════════════ */

    /* Vues */
    .ai-step { display: flex; flex-direction: column; gap: var(--space-md); padding: var(--space-lg); }
    .ai-step.is-hidden { display: none; }
    .ai-step__title {
      font-family: var(--font-display);
      font-size: 1.6rem;
      font-weight: 800;
      text-transform: uppercase;
      color: var(--text);
      margin: 0;
    }
    .ai-step__label {
      font-size: .75rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin: 0;
    }
    .ai-step__sub { color: var(--text-dim); font-size: .9rem; text-align: center; margin: 0; }
    .ai-optional { color: var(--text-faint); font-size: .8rem; text-transform: none; letter-spacing: 0; }

    /* Cards de sélection (objectif, matériel) */
    .ai-options-grid { display: flex; flex-direction: column; gap: var(--space-sm); }
    .ai-option-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: var(--space-md);
      text-align: left;
      color: var(--text);
      font-size: .95rem;
      cursor: pointer;
      transition: border-color .15s, background .15s;
      min-height: 52px;
      width: 100%;
    }
    .ai-option-card:active { transform: scale(.98); }
    .ai-option-card.is-selected {
      border-color: var(--gold);
      background: var(--bg-card-soft);
    }

    /* Chips (fréquence, niveau) */
    .ai-chips { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
    .ai-chip {
      background: var(--bg-card-soft);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: .5rem 1.25rem;
      color: var(--text);
      font-size: .9rem;
      cursor: pointer;
      min-height: 44px;
      transition: all .15s;
    }
    .ai-chip.is-selected {
      background: var(--gold);
      border-color: var(--gold);
      color: #000;
      font-weight: 700;
    }

    /* Textarea */
    .ai-textarea {
      background: var(--bg-card-soft);
      border: 1px solid var(--border);
      border-radius: 12px;
      color: var(--text);
      font-size: .95rem;
      padding: var(--space-md);
      min-height: 100px;
      resize: vertical;
      width: 100%;
      box-sizing: border-box;
      font-family: inherit;
    }
    .ai-textarea:focus { outline: none; border-color: var(--border-active); }
    .ai-privacy-note { font-size: .75rem; color: var(--text-faint); margin: 0; }

    /* Génération */
    .ai-generate-content {
      display: flex; flex-direction: column;
      align-items: center; gap: var(--space-lg);
      padding: var(--space-xl) var(--space-lg);
      width: 100%;
    }
    .ai-spinner { display: flex; flex-direction: column; align-items: center; gap: var(--space-md); }
    .ai-spinner__ring {
      width: 48px; height: 48px;
      border: 3px solid var(--border);
      border-top-color: var(--gold);
      border-radius: 50%;
      animation: aiSpin .8s linear infinite;
    }
    @keyframes aiSpin { to { transform: rotate(360deg); } }
    .ai-generating-msg { color: var(--text-dim); font-size: .9rem; text-align: center; }
    .ai-error { display: flex; flex-direction: column; align-items: center; gap: var(--space-md); width: 100%; }
    .ai-error p { color: var(--rust); text-align: center; margin: 0; }

    /* Prévisualisation */
    .ai-prog-name {
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--border);
      color: var(--text);
      font-family: var(--font-display);
      font-size: 1.25rem;
      text-transform: uppercase;
      font-weight: 700;
      padding: .25rem 0;
      width: 100%;
    }
    .ai-prog-name:focus { outline: none; border-bottom-color: var(--gold); }
    .ai-prog-summary { color: var(--text-dim); font-size: .85rem; margin: 0; }

    .ai-accordion { display: flex; flex-direction: column; gap: var(--space-sm); }
    .ai-accordion-item {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .ai-accordion-item__header {
      display: flex; justify-content: space-between; align-items: center;
      padding: var(--space-md);
      cursor: pointer;
      font-weight: 600;
    }
    .ai-accordion-item__header .ai-day {
      display: block;
      font-size: .7rem;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--text-dim);
      margin-bottom: .2rem;
    }
    .ai-accordion-item__header .ai-chevron { transition: transform .2s; color: var(--text-dim); flex-shrink: 0; }
    .ai-accordion-item.is-open .ai-chevron { transform: rotate(180deg); }
    .ai-accordion-item__body { display: none; padding: 0 var(--space-md) var(--space-md); }
    .ai-accordion-item.is-open .ai-accordion-item__body { display: block; }
    .ai-accordion-item__body ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .4rem; }
    .ai-accordion-item__body li { font-size: .875rem; color: var(--text-dim); display: flex; justify-content: space-between; }
    .ai-accordion-item__body li span { color: var(--text-faint); font-size: .8rem; }

    .ai-preview-ctas { display: flex; flex-direction: column; gap: var(--space-sm); padding-top: var(--space-md); }
```

- [ ] **Étape 2 : Vérifier visuellement**

Dans la console :
```js
document.getElementById('overlayAiCoach').classList.remove('is-hidden')
```
Les cartes d'objectif doivent être visibles avec le style noir/doré.

- [ ] **Étape 3 : Commit**
```bash
git add index.html
git commit -m "feat(ui): add AI Coach CSS styles"
```

---

## Task 4 : Module JS `AiCoach`

**Fichier :** `index.html` — ajouter un nouveau `<script>` juste avant `</body>` (ligne 5681)

- [ ] **Étape 1 : Ajouter le bloc `<script>` complet juste avant `</body>`**

Trouver `</body>` (ligne 5681) et insérer juste avant :

```html
  <!-- ============================================================
       MODULE AI COACH
  ============================================================ -->
  <script>
  const AiCoach = (function () {
    'use strict';

    /* ── État ──────────────────────────────────────────────────── */
    let aiStep           = 0;
    let aiFormData       = {};
    let aiGeneratedProgram = null;
    let msgInterval      = null;

    const MSGS = [
      'Analyse de ton profil…',
      'Construction du programme…',
      'Optimisation des exercices…',
      'Finalisation…',
    ];
    const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    /* ── Refs DOM ──────────────────────────────────────────────── */
    const $overlay   = document.getElementById('overlayAiCoach');
    const $back      = document.getElementById('aiBack');
    const $cancel    = document.getElementById('aiCancel');
    const $stepLabel = document.getElementById('aiStepLabel');
    const $next      = document.getElementById('aiNext');
    const $footer    = document.getElementById('aiFooter');
    const $steps     = Array.from(document.querySelectorAll('#aiBody .ai-step'));

    /* ── Navigation entre vues ─────────────────────────────────── */
    function goToAiStep(n) {
      $steps.forEach((s, i) => s.classList.toggle('is-hidden', i !== n));
      aiStep = n;

      const isQuestionnaire = n <= 3;
      $stepLabel.textContent  = isQuestionnaire ? `Étape ${n + 1} / 4` : '';
      $back.style.visibility  = n === 0 ? 'hidden' : 'visible';
      $footer.style.display   = isQuestionnaire ? 'block' : 'none';
      updateNextBtn();
      /* Scroll en haut de la vue */
      document.getElementById('aiBody').scrollTop = 0;
    }

    function updateNextBtn() {
      let valid = false;
      if (aiStep === 0) valid = !!aiFormData.objectif;
      if (aiStep === 1) valid = !!aiFormData.frequence;
      if (aiStep === 2) valid = !!(aiFormData.materiel?.length);
      if (aiStep === 3) valid = !!aiFormData.niveau;
      $next.disabled = !valid;
    }

    /* ── Vue 0 : Objectif (sélection unique) ───────────────────── */
    document.querySelectorAll('#aiStep0 .ai-option-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('#aiStep0 .ai-option-card')
          .forEach(c => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
        aiFormData.objectif = card.dataset.value;
        updateNextBtn();
      });
    });

    /* ── Vue 1 : Disponibilités (sélection unique) ─────────────── */
    document.querySelectorAll('#aiStep1 .ai-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#aiStep1 .ai-chip')
          .forEach(c => c.classList.remove('is-selected'));
        chip.classList.add('is-selected');
        aiFormData.frequence = parseInt(chip.dataset.value, 10);
        updateNextBtn();
      });
    });

    /* ── Vue 2 : Matériel (multi-select) ───────────────────────── */
    document.querySelectorAll('#aiStep2 .ai-option-card').forEach(card => {
      card.addEventListener('click', () => {
        card.classList.toggle('is-selected');
        aiFormData.materiel = Array.from(
          document.querySelectorAll('#aiStep2 .ai-option-card.is-selected')
        ).map(c => c.dataset.value);
        updateNextBtn();
      });
    });

    /* ── Vue 3 : Contexte ──────────────────────────────────────── */
    document.querySelectorAll('#aiStep3 .ai-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#aiStep3 .ai-chip')
          .forEach(c => c.classList.remove('is-selected'));
        chip.classList.add('is-selected');
        aiFormData.niveau = chip.dataset.value;
        updateNextBtn();
      });
    });

    /* ── Vue 4 : Génération ────────────────────────────────────── */
    function updateGenerateSummary() {
      document.getElementById('aiGenerateSummary').textContent =
        `${aiFormData.objectif} · ${aiFormData.frequence} j/sem · ${aiFormData.niveau}`;
    }

    async function doGenerate() {
      const $btn    = document.getElementById('aiGenerate');
      const $spin   = document.getElementById('aiSpinner');
      const $err    = document.getElementById('aiError');
      const $msgEl  = document.getElementById('aiGeneratingMsg');

      $err.classList.add('is-hidden');
      $btn.classList.add('is-hidden');
      $spin.classList.remove('is-hidden');
      $msgEl.textContent = MSGS[0];

      let msgIdx = 0;
      clearInterval(msgInterval);
      msgInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % MSGS.length;
        $msgEl.textContent = MSGS[msgIdx];
      }, 2000);

      const antecedents = document.getElementById('aiAntecedents').value.trim() || null;

      try {
        const res = await fetch('/api/generate-program', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            objectif:  aiFormData.objectif,
            frequence: aiFormData.frequence,
            materiel:  aiFormData.materiel,
            niveau:    aiFormData.niveau,
            antecedents,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur inconnue');

        aiGeneratedProgram    = json.program;
        aiGeneratedProgram.id = 'prog-' + Date.now();
        clearInterval(msgInterval);
        showPreview();

      } catch (err) {
        clearInterval(msgInterval);
        $spin.classList.add('is-hidden');
        $btn.classList.remove('is-hidden');
        $err.classList.remove('is-hidden');
        document.getElementById('aiErrorMsg').textContent = err.message;
      }
    }

    document.getElementById('aiGenerate').addEventListener('click', doGenerate);
    document.getElementById('aiRetry').addEventListener('click', doGenerate);

    /* ── Vue 5 : Prévisualisation ──────────────────────────────── */
    function showPreview() {
      const prog     = aiGeneratedProgram;
      const sessions = Object.values(prog.sessions || {});
      const exoCount = sessions.reduce((acc, s) => acc + (s.exercises?.length || 0), 0);
      const dayCount = Object.keys(prog.schedule || {}).length;

      document.getElementById('aiProgName').value = prog.meta?.label || 'Mon programme';
      document.getElementById('aiProgSummary').textContent =
        `${dayCount} jour${dayCount > 1 ? 's' : ''} · ${exoCount} exercice${exoCount > 1 ? 's' : ''}`;

      /* Accordéon */
      const $acc = document.getElementById('aiAccordion');
      $acc.innerHTML = '';
      const sortedDays = Object.entries(prog.schedule || {})
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

      sortedDays.forEach(([day, sessKey]) => {
        const sess = prog.sessions[sessKey];
        if (!sess) return;

        const item = document.createElement('div');
        item.className = 'ai-accordion-item';
        item.innerHTML = `
          <div class="ai-accordion-item__header">
            <div>
              <span class="ai-day">${DAY_NAMES[parseInt(day)] || `Jour ${day}`}</span>
              <div>${sess.name || sessKey}</div>
            </div>
            <svg class="ai-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <div class="ai-accordion-item__body">
            <ul>
              ${(sess.exercises || []).map(e =>
                `<li>${e.name || '?'}<span>${e.scheme || ''}</span></li>`
              ).join('')}
              ${!sess.exercises?.length ? '<li style="color:var(--text-faint)">Aucun exercice</li>' : ''}
            </ul>
          </div>`;
        item.querySelector('.ai-accordion-item__header').addEventListener('click', () => {
          item.classList.toggle('is-open');
        });
        $acc.appendChild(item);
      });

      goToAiStep(5);
    }

    /* CTA "Modifier dans l'éditeur" */
    document.getElementById('aiEditInEditor').addEventListener('click', () => {
      const name = document.getElementById('aiProgName').value.trim();
      if (name) aiGeneratedProgram.meta.label = name;
      closeAiCoach();
      App.openEditorWithProgram(aiGeneratedProgram);
    });

    /* CTA "Utiliser ce programme" */
    document.getElementById('aiUseProgram').addEventListener('click', () => {
      const name = document.getElementById('aiProgName').value.trim();
      if (name) aiGeneratedProgram.meta.label = name;

      const all = JSON.parse(localStorage.getItem('programs') || '[]');
      all.push(aiGeneratedProgram);
      localStorage.setItem('programs', JSON.stringify(all));
      localStorage.setItem('activeProgram', aiGeneratedProgram.id);
      localStorage.setItem('onboarded', 'true');

      closeAiCoach();
      if (typeof Today !== 'undefined') Today.refresh();
      if (typeof Plan  !== 'undefined') Plan.refresh();
      /* Navigation vers l'onglet Today */
      document.querySelector('[data-tab="0"]')?.click();
      App.showToast('Programme activé ✓');
    });

    /* ── SUIVANT ───────────────────────────────────────────────── */
    $next.addEventListener('click', () => {
      if (aiStep < 3) {
        goToAiStep(aiStep + 1);
      } else {
        updateGenerateSummary();
        goToAiStep(4);
      }
    });

    /* ── Retour / Annuler ──────────────────────────────────────── */
    $back.addEventListener('click', () => { if (aiStep > 0) goToAiStep(aiStep - 1); });
    $cancel.addEventListener('click', closeAiCoach);

    /* ── Open / Close ──────────────────────────────────────────── */
    function openAiCoach() {
      aiStep             = 0;
      aiFormData         = {};
      aiGeneratedProgram = null;
      clearInterval(msgInterval);

      /* Réinitialise sélections */
      $overlay.querySelectorAll('.ai-option-card, .ai-chip')
        .forEach(el => el.classList.remove('is-selected'));
      document.getElementById('aiAntecedents').value = '';
      document.getElementById('aiSpinner').classList.add('is-hidden');
      document.getElementById('aiGenerate').classList.remove('is-hidden');
      document.getElementById('aiError').classList.add('is-hidden');

      $overlay.classList.remove('is-hidden');
      goToAiStep(0);
    }

    function closeAiCoach() {
      clearInterval(msgInterval);
      $overlay.classList.add('is-hidden');
      if (!localStorage.getItem('onboarded')) {
        document.getElementById('overlayOnboarding').classList.remove('is-hidden');
      }
    }

    return { open: openAiCoach };
  })();
  </script>
```

- [ ] **Étape 2 : Vérifier dans la console**
```js
// Ouvrir l'overlay manuellement
AiCoach.open()
// Attendu : overlay visible, vue 0 affichée, bouton SUIVANT désactivé
```

- [ ] **Étape 3 : Tester le flow questionnaire complet**

1. Cliquer sur une card objectif → SUIVANT s'active
2. Cliquer SUIVANT → Vue 1 (chips fréquence)
3. Sélectionner "3 jours" → SUIVANT s'active
4. Cliquer SUIVANT → Vue 2 (matériel multi-select)
5. Sélectionner "Salle de sport complète" → SUIVANT s'active
6. Cliquer SUIVANT → Vue 3 (niveau + textarea)
7. Sélectionner "Intermédiaire" → SUIVANT s'active
8. Cliquer SUIVANT → Vue 4 (génération, avec résumé affiché)
9. Cliquer "GÉNÉRER MON PROGRAMME" → spinner + messages rotatifs
10. Attendre ~5s → Vue 5 (prévisualisation avec accordéon)
11. Cliquer une card accordéon → liste des exercices s'affiche
12. Cliquer "UTILISER CE PROGRAMME" → overlay se ferme, toast "Programme activé ✓"

- [ ] **Étape 4 : Tester la gestion d'erreur**

Couper `vercel dev` et relancer le test → vue 4 doit afficher un message d'erreur rouge + bouton "Réessayer".

- [ ] **Étape 5 : Commit**
```bash
git add index.html
git commit -m "feat(ui): add AiCoach JS module with full questionnaire + generation + preview flow"
```

---

## Task 5 : Points d'entrée — wiring + bouton Plan

**Fichier :** `index.html`

- [ ] **Étape 1 : Wirer `btnCreateAi` dans l'onboarding**

Trouver le bloc JS de l'onboarding (ligne ~4129) :
```js
    document.getElementById('btnCreate').addEventListener('click', () => {
      $onboarding.classList.add('is-hidden');
      openEditor(null);
    });
```
Ajouter juste après :
```js
    document.getElementById('btnCreateAi').addEventListener('click', () => {
      $onboarding.classList.add('is-hidden');
      AiCoach.open();
    });
```

- [ ] **Étape 2 : Ajouter le bouton AI dans Plan → Mes programmes**

Trouver dans le module Plan (ligne ~3314) :
```js
      btnNew.addEventListener('click', () => App.openEditor(null));
      body.appendChild(btnNew);
```
Remplacer par :
```js
      btnNew.addEventListener('click', () => App.openEditor(null));
      body.appendChild(btnNew);

      /* Bouton Créer avec l'IA */
      const btnAi = mkEl('button', 'btn btn--secondary btn--full');
      btnAi.style.marginTop = 'var(--space-xs)';
      btnAi.textContent = '✨ CRÉER AVEC L\'IA';
      btnAi.addEventListener('click', () => AiCoach.open());
      body.appendChild(btnAi);
```

- [ ] **Étape 3 : Tester les deux points d'entrée**

a) Supprimer `onboarded` de localStorage (`localStorage.removeItem('onboarded')`), recharger → l'écran d'accueil doit afficher 3 boutons dont "✨ CRÉER AVEC L'IA".

b) Cliquer "✨ CRÉER AVEC L'IA" depuis l'onboarding → overlay s'ouvre.

c) Remettre `localStorage.setItem('onboarded','true')`, naviguer vers Plan → Mes programmes → bouton "✨ CRÉER AVEC L'IA" visible.

d) Cliquer → overlay s'ouvre.

- [ ] **Étape 4 : Commit**
```bash
git add index.html
git commit -m "feat(ui): wire AI Coach entry points in onboarding and Plan tab"
```

---

## Self-review

**Couverture spec :**
- ✅ Bouton onboarding (§1)
- ✅ Bouton Plan → Mes programmes (§1)
- ✅ Overlay unique 6 vues (§2)
- ✅ Navigation Retour / Annuler / SUIVANT (§2)
- ✅ Vue 0 : objectif single-select (§3)
- ✅ Vue 1 : fréquence chips (§3)
- ✅ Vue 2 : matériel multi-select (§3)
- ✅ Vue 3 : niveau + antécédents (§3)
- ✅ Vue 4 : spinner + messages rotatifs + erreur inline + retry (§3)
- ✅ Vue 5 : accordéon + nom éditable + CTAs (§3)
- ✅ `openEditorWithProgram` → éditeur pré-rempli (§4)
- ✅ `saveAndActivate` → localStorage + toast + navigation Today (§4)
- ✅ Réinitialisation état à chaque ouverture (§4)

**Placeholders :** aucun.

**Cohérence types :** `aiFormData.frequence` est un `number` (parseInt) → correspond à la validation API `Number.isInteger`. `aiFormData.niveau` est `'débutant'|'intermédiaire'|'avancé'` → correspond à l'enum de l'API.
