# AI — Modifier un Programme Existant

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to modify an existing training program with AI, via a mode toggle ("Nouveau / Modifier existant") added to step 2 of the AI Coach overlay, with a diff preview showing exactly what changed.

**Architecture:** New `/api/modify-program.js` serverless function (same security pattern as generate-program). Shared API utilities extracted to `api/_shared.js`. The AiCoach module gains `aiMode` ('create'|'modify') state, a `computeDiff(oldProg, newProg)` function, and a `showDiff()` view. Step 2 of the overlay gets a segmented toggle that swaps matériel chips for a modification panel (free text + intent chips + program selector). Step 5 shows a diff view instead of an accordion in modify mode.

**Tech Stack:** Vanilla JS (IIFE pattern), Vercel Serverless Functions (Node.js ESM), Groq API (Llama 3.3 70B), localStorage.

---

### File map

| File | Action | Responsibility |
|------|--------|----------------|
| `api/_shared.js` | Create | `validateProgramJSON`, `resolveCorsOrigin` shared utilities |
| `api/generate-program.js` | Modify | Import from `_shared.js` instead of inline |
| `api/modify-program.js` | Create | Modify-program endpoint (validate, prompt, call Groq) |
| `index.html` | Modify | HTML step 2 + step 5, CSS diff styles, JS AiCoach module |

---

### Task 1: Extract shared API utilities into `api/_shared.js`

**Files:**
- Create: `api/_shared.js`
- Modify: `api/generate-program.js`

Vercel treats `_`-prefixed files in `api/` as private modules (not routes). We extract two helpers to avoid drift when both endpoints need the same logic.

- [ ] **Step 1: Create `api/_shared.js`**

```js
// api/_shared.js — Utilitaires partagés entre les endpoints AI Coach

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Valide et parse la réponse brute de l'IA (JSON, éventuellement dans un bloc ```json). */
export function validateProgramJSON(raw) {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let program;
  try {
    program = JSON.parse(cleaned);
  } catch {
    throw new ValidationError("JSON malformé : impossible de parser la réponse de l'IA");
  }

  if (!program.meta || typeof program.meta !== 'object' || Array.isArray(program.meta)) {
    throw new ValidationError('Structure invalide : champ "meta" manquant ou invalide');
  }
  if (!program.sessions || typeof program.sessions !== 'object' || Array.isArray(program.sessions)) {
    throw new ValidationError('Structure invalide : champ "sessions" manquant ou invalide');
  }
  if (!program.schedule || typeof program.schedule !== 'object' || Array.isArray(program.schedule)) {
    throw new ValidationError('Structure invalide : champ "schedule" manquant ou invalide');
  }
  if (Object.keys(program.sessions).length === 0) {
    throw new ValidationError('Validation échouée : "sessions" est vide');
  }

  const scheduleKeys = Object.keys(program.schedule);
  if (scheduleKeys.length === 0) {
    throw new ValidationError('Validation échouée : "schedule" est vide');
  }

  for (const day of scheduleKeys) {
    const dayInt = parseInt(day, 10);
    if (isNaN(dayInt) || dayInt < 0 || dayInt > 6) {
      throw new ValidationError(`Schedule invalide : clé "${day}" n'est pas un indice valide (0-6)`);
    }
    const sessionKey = program.schedule[day];
    if (!program.sessions[sessionKey]) {
      throw new ValidationError(
        `Schedule invalide : jour ${day} référence "${sessionKey}" absent de sessions`
      );
    }
  }

  const allIds = new Set();
  for (const [sessionKey, session] of Object.entries(program.sessions)) {
    if (!session.type || typeof session.type !== 'string') {
      throw new ValidationError(`Session "${sessionKey}" : champ "type" manquant`);
    }
    const exercises = session.exercises ?? [];
    if (!Array.isArray(exercises)) {
      throw new ValidationError(`Session "${sessionKey}" : "exercises" doit être un tableau`);
    }
    for (const exo of exercises) {
      if (!exo.id || typeof exo.id !== 'string' || exo.id.trim() === '') {
        throw new ValidationError(`Session "${sessionKey}" : exercice sans "id" valide`);
      }
      if (!exo.name || typeof exo.name !== 'string' || exo.name.trim() === '') {
        throw new ValidationError(`Session "${sessionKey}" : exercice "${exo.id}" sans "name" valide`);
      }
      const sets = Number(exo.sets);
      if (!Number.isInteger(sets) || sets < 1) {
        throw new ValidationError(
          `Session "${sessionKey}" : exercice "${exo.id}" a sets=${exo.sets} (entier ≥ 1 requis)`
        );
      }
      if (allIds.has(exo.id)) {
        throw new ValidationError(`Validation échouée : id dupliqué "${exo.id}"`);
      }
      allIds.add(exo.id);
    }
  }

  return program;
}

/**
 * Résout l'origine CORS autorisée.
 * En production : ALLOWED_ORIGIN doit être défini comme variable d'environnement Vercel.
 * En développement (variable absente) : permissif.
 */
export function resolveCorsOrigin(reqOrigin) {
  const allowed = process.env.ALLOWED_ORIGIN;
  if (!allowed) return reqOrigin || '*';
  return allowed === reqOrigin ? reqOrigin : null;
}
```

- [ ] **Step 2: Update `api/generate-program.js` to import from shared**

At the top of `api/generate-program.js`, add this import as the first line:
```js
import { ValidationError, validateProgramJSON, resolveCorsOrigin } from './_shared.js';
```

Then remove the three inline definitions currently in the file:
- The `class ValidationError` block (lines 93–98)
- The `function validateProgramJSON(raw)` function (lines 103–194)
- The `function resolveCorsOrigin(reqOrigin)` function (lines 268–272)

- [ ] **Step 3: Test the refactored endpoint**

```powershell
vercel dev
```

```powershell
curl.exe --% -X POST http://localhost:3000/api/generate-program -H "Content-Type: application/json" -d "{\"objectif\":\"Forme générale\",\"frequence\":3,\"duree\":60,\"materiel\":[\"Salle de sport complète\"],\"niveau\":\"intermédiaire\"}"
```

Expected: HTTP 200 with `{"program":{...}}`. Same behavior as before the refactor.

- [ ] **Step 4: Commit**

```
git add api/_shared.js api/generate-program.js
git commit -m "refactor(api): extract validateProgramJSON and resolveCorsOrigin to _shared.js"
```

---

### Task 2: Create `api/modify-program.js`

**Files:**
- Create: `api/modify-program.js`

- [ ] **Step 1: Create the file**

```js
// api/modify-program.js — Modifie un programme existant via Groq (Llama 3.3 70B)
// Reçoit le programme courant + instructions de modification, retourne le programme modifié.
// Principe RGPD : aucune donnée stockée ni loggée côté serveur.

import { ValidationError, validateProgramJSON, resolveCorsOrigin } from './_shared.js';

// ─── Prompt système ──────────────────────────────────────────────────────────
const MODIFY_SYSTEM_PROMPT = `Tu es un coach sportif expert en musculation et préparation physique.
Modifie le programme d'entraînement fourni selon les instructions de l'utilisateur.

Règles absolues :
- Réponds UNIQUEMENT avec le JSON complet du programme modifié, sans texte avant ni après
- Conserve les exercices et la structure existants sauf si les instructions demandent un changement
- Préserve les id d'exercices existants. Tout nouvel exercice a un id en kebab-case unique
- Le champ "scheme" contient UNIQUEMENT les reps (ex: "8", "8-12", "MAX", "45 sec") — JAMAIS "sets×reps"
- Les sets sont des entiers entre 1 et 6. Les restSec sont des entiers (60, 90, 120, 180)
- Le schedule utilise les indices Date.getDay() (0=dim … 6=sam)
- accent : "gold" pour musculation principale, "rust" pour membres inférieurs, "blue" pour cardio, "gray" pour repos`;

// ─── Sérialisation partielle ──────────────────────────────────────────────────
// Exclut warmup, tips, cues, alternatives pour réduire la taille du payload.
function serializeExistingProgram(program) {
  const slim = { meta: program.meta, sessions: {}, schedule: program.schedule };
  for (const [key, sess] of Object.entries(program.sessions || {})) {
    slim.sessions[key] = {
      type: sess.type,
      name: sess.name,
      accent: sess.accent,
      subtitle: sess.subtitle,
      exercises: (sess.exercises || []).map(e => ({
        id: e.id, name: e.name, scheme: e.scheme,
        sets: e.sets, load: e.load, restSec: e.restSec,
      })),
      cardio: sess.cardio ?? null,
    };
  }
  return JSON.stringify(slim, null, 2);
}

// ─── Construction du prompt ──────────────────────────────────────────────────
function buildModifyPrompt({ existingProgram, modification, intents, frequence, duree }) {
  const intentsSection = intents?.length
    ? `\nIntentions spécifiques : ${intents.join(', ')}`
    : '';
  const freqSection  = frequence ? `\nNouvelle fréquence souhaitée : ${frequence} jours/semaine` : '';
  const dureeSection = duree     ? `\nNouvelle durée par séance : ${duree} minutes`             : '';

  return `Programme existant à modifier :
\`\`\`json
${serializeExistingProgram(existingProgram)}
\`\`\`

Instructions de modification : ${modification}${intentsSection}${freqSection}${dureeSection}

Retourne le programme complet modifié en JSON valide, même schéma que le programme d'entrée.
Réponds UNIQUEMENT avec le JSON, sans texte avant ni après.`;
}

// ─── Validation de la requête ────────────────────────────────────────────────
function validateRequest(body) {
  const errors = [];

  if (!body.existingProgram || typeof body.existingProgram !== 'object' || Array.isArray(body.existingProgram)) {
    errors.push('"existingProgram" est requis (objet)');
  }

  if (!body.modification || typeof body.modification !== 'string') {
    errors.push('"modification" est requis (string)');
  } else if (body.modification.trim().length < 10) {
    errors.push('"modification" doit contenir au moins 10 caractères');
  } else if (body.modification.length > 500) {
    errors.push('"modification" dépasse 500 caractères');
  }

  if (body.intents !== undefined && body.intents !== null) {
    if (!Array.isArray(body.intents)) {
      errors.push('"intents" doit être un tableau (optionnel)');
    } else if (!body.intents.every(i => typeof i === 'string')) {
      errors.push('"intents" doit être un tableau de chaînes');
    }
  }

  if (body.frequence !== undefined && body.frequence !== null) {
    const freq = Number(body.frequence);
    if (!Number.isInteger(freq) || freq < 2 || freq > 6) {
      errors.push('"frequence" doit être entre 2 et 6 (optionnel)');
    }
  }

  const dureesValides = [30, 45, 60, 90];
  if (body.duree !== undefined && body.duree !== null) {
    const d = Number(body.duree);
    if (!dureesValides.includes(d)) {
      errors.push('"duree" doit être 30, 45, 60 ou 90 (optionnel)');
    }
  }

  return errors;
}

// ─── Handler principal ───────────────────────────────────────────────────────
export default async function handler(req, res) {
  const reqOrigin  = req.headers['origin'] || '';
  const corsOrigin = resolveCorsOrigin(reqOrigin);

  if (req.method === 'OPTIONS') {
    if (!corsOrigin) return res.status(403).end();
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  if (process.env.ALLOWED_ORIGIN && reqOrigin && corsOrigin === null) {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }

  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Vary', 'Origin');
  }

  // Corps max : 12 Ko (programme existant ~4 Ko + instructions)
  const MAX_BODY = 12 * 1024;
  let body;
  try {
    const raw = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk.toString();
        if (data.length > MAX_BODY) { req.destroy(); reject(new Error('Payload trop volumineux')); }
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('body invalide');
  } catch {
    return res.status(400).json({ error: 'Corps de la requête invalide (JSON attendu)' });
  }

  const validationErrors = validateRequest(body);
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: 'Paramètres invalides', details: validationErrors });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Configuration serveur manquante (GROQ_API_KEY)' });
  }

  const prompt = buildModifyPrompt({
    existingProgram: body.existingProgram,
    modification:    body.modification.trim(),
    intents:         body.intents ?? [],
    frequence:       body.frequence != null ? Number(body.frequence) : null,
    duree:           body.duree     != null ? Number(body.duree)     : null,
  });

  let apiResponse;
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 30_000);

    apiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: MODIFY_SYSTEM_PROMPT },
          { role: 'user',   content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 4000,
      }),
    });

    clearTimeout(timeoutId);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: "Délai dépassé — l'IA met trop de temps à répondre. Réessaie." });
    }
    return res.status(502).json({ error: "Erreur réseau lors de l'appel à l'IA" });
  }

  if (!apiResponse.ok) {
    const errData = await apiResponse.json().catch(() => ({}));
    const status  = apiResponse.status;
    if (status === 429) return res.status(429).json({ error: 'Quota dépassé. Réessaie dans quelques minutes.' });
    if (status === 401 || status === 403) return res.status(500).json({ error: 'Clé API invalide ou accès refusé' });
    console.error(`[modify-program] Groq error ${status}:`, errData?.error?.message);
    return res.status(502).json({ error: 'Service IA temporairement indisponible' });
  }

  let rawText;
  try {
    const data = await apiResponse.json();
    rawText = data?.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('Champ content absent');
  } catch {
    return res.status(502).json({ error: 'Réponse IA illisible. Réessaie.' });
  }

  let program;
  try {
    program = validateProgramJSON(rawText);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(422).json({ error: 'Programme modifié invalide. Réessaie.' });
    }
    return res.status(500).json({ error: 'Erreur interne lors de la validation' });
  }

  return res.status(200).json({ program });
}
```

- [ ] **Step 2: Test validation error**

```powershell
curl.exe --% -X POST http://localhost:3000/api/modify-program -H "Content-Type: application/json" -d "{\"modification\":\"court\"}"
```

Expected: HTTP 400 with `{"error":"Paramètres invalides","details":[...]}` — listing both missing `existingProgram` and too-short `modification`.

- [ ] **Step 3: Test successful modification**

```powershell
curl.exe --% -X POST http://localhost:3000/api/modify-program -H "Content-Type: application/json" -d "{\"existingProgram\":{\"meta\":{\"label\":\"TEST\",\"units\":\"kg\",\"restDefaultSec\":90,\"repsInReserve\":\"1-2 reps\"},\"sessions\":{\"full-body\":{\"type\":\"lift\",\"name\":\"FULL BODY\",\"accent\":\"gold\",\"subtitle\":\"TEST\",\"exercises\":[{\"id\":\"presse\",\"name\":\"Presse\",\"scheme\":\"8\",\"sets\":4,\"load\":\"100 kg\",\"restSec\":120}]}},\"schedule\":{\"1\":\"full-body\"}},\"modification\":\"Ajoute un exercice pour les épaules à la séance existante\"}"
```

Expected: HTTP 200 with `{"program":{...}}`, programme containing the shoulder exercise.

- [ ] **Step 4: Commit**

```
git add api/modify-program.js
git commit -m "feat(api): add /api/modify-program endpoint for AI-powered program modification"
```

---

### Task 3: HTML — Step 2 toggle + modify panel + step 5 diff slot

**Files:**
- Modify: `index.html` (section `#aiStep2` ~line 3132, section `#aiStep5` ~line 3193)

- [ ] **Step 1: Replace `#aiStep2` content**

Find and replace this exact block:
```html
      <!-- Vue 2 : Matériel (multi-select) -->
      <div class="ai-step is-hidden" id="aiStep2">
        <h2 class="editor-step__title">Matériel</h2>
        <p class="editor-step__subtitle">Quel équipement avez-vous à disposition ? Sélection multiple.</p>
        <div class="ai-options-grid">
          <button class="ai-option-card" data-value="Haltères à la maison">Haltères à la maison</button>
          <button class="ai-option-card" data-value="Salle de sport complète">Salle de sport complète</button>
          <button class="ai-option-card" data-value="Machines guidées uniquement">Machines guidées uniquement</button>
          <button class="ai-option-card" data-value="Élastiques / poids de corps">Élastiques / poids de corps</button>
          <button class="ai-option-card" data-value="Cardio machines (vélo, tapis)">Cardio machines (vélo, tapis)</button>
        </div>
      </div>
```

With:
```html
      <!-- Vue 2 : Matériel (nouveau programme) OU Modifier un programme existant -->
      <div class="ai-step is-hidden" id="aiStep2">

        <!-- Toggle mode -->
        <div class="segmented" id="aiModeToggle" style="margin-bottom: var(--space-md);">
          <button class="segmented__btn segmented__btn--active" data-value="create">Nouveau programme</button>
          <button class="segmented__btn" data-value="modify">Modifier existant</button>
        </div>

        <!-- Panel mode "create" : matériel -->
        <div id="aiStep2Create">
          <h2 class="editor-step__title">Matériel</h2>
          <p class="editor-step__subtitle">Quel équipement avez-vous à disposition ? Sélection multiple.</p>
          <div class="ai-options-grid">
            <button class="ai-option-card" data-value="Haltères à la maison">Haltères à la maison</button>
            <button class="ai-option-card" data-value="Salle de sport complète">Salle de sport complète</button>
            <button class="ai-option-card" data-value="Machines guidées uniquement">Machines guidées uniquement</button>
            <button class="ai-option-card" data-value="Élastiques / poids de corps">Élastiques / poids de corps</button>
            <button class="ai-option-card" data-value="Cardio machines (vélo, tapis)">Cardio machines (vélo, tapis)</button>
          </div>
        </div>

        <!-- Panel mode "modify" : programme existant + instructions -->
        <div id="aiStep2Modify" class="is-hidden stack stack--lg">
          <div>
            <h2 class="editor-step__title">Modifier un programme</h2>
            <p class="editor-step__subtitle">Décris ce que tu veux changer dans ton programme actuel.</p>
          </div>
          <!-- Sélecteur (masqué si 1 seul programme, ou si aucun) -->
          <div class="input-wrapper" id="aiProgramSelectorWrapper">
            <span class="input-label">Programme à modifier</span>
            <select class="input" id="aiProgramSelector"></select>
          </div>
          <!-- Message "aucun programme" -->
          <p id="aiNoProgramsMsg" class="is-hidden"
            style="color:var(--text-dim);font-size:.85rem;text-align:center;padding:var(--space-md) 0;">
            Aucun programme enregistré. Crée d'abord un programme.
          </p>
          <!-- Texte libre -->
          <div class="input-wrapper">
            <label class="input-label" for="aiModificationText">
              Que veux-tu modifier ?
            </label>
            <textarea id="aiModificationText" class="ai-textarea" maxlength="500"
              placeholder="Ex. Ajoute un 4e jour le jeudi axé jambes, remplace le gainage par du gainage dynamique…"></textarea>
            <p style="color:var(--text-dim);font-size:.72rem;margin-top:var(--space-xs);">
              <span id="aiModifCharCount">0</span> / 500 — minimum 10 caractères
            </p>
          </div>
          <!-- Chips d'intention rapide (multi-select, optionnel) -->
          <div class="editor-section">
            <p class="editor-section__label">Intentions rapides <span class="ai-optional">(optionnel)</span></p>
            <div class="ai-chips ai-chips--wrap" id="aiIntentChips">
              <button class="ai-chip" data-value="Ajouter un jour">Ajouter un jour</button>
              <button class="ai-chip" data-value="Supprimer un jour">Supprimer un jour</button>
              <button class="ai-chip" data-value="Changer des exercices">Changer des exercices</button>
              <button class="ai-chip" data-value="Modifier les charges">Modifier les charges</button>
              <button class="ai-chip" data-value="Réduire la durée">Réduire la durée</button>
              <button class="ai-chip" data-value="Plus de cardio">Plus de cardio</button>
            </div>
          </div>
        </div>

      </div>
```

- [ ] **Step 2: Add diff panel slot to `#aiStep5`**

Find:
```html
        <div id="aiAccordion" class="ai-accordion"></div>
        <div class="ai-preview-ctas">
          <button class="btn btn--secondary btn--full" id="aiEditInEditor">MODIFIER DANS L'ÉDITEUR</button>
          <button class="btn btn--primary btn--full" id="aiUseProgram">UTILISER CE PROGRAMME</button>
        </div>
```

Replace with:
```html
        <div id="aiAccordion" class="ai-accordion"></div>
        <div id="aiDiffPanel" class="ai-diff-panel is-hidden">
          <p class="editor-section__label" style="margin-bottom:var(--space-sm);">MODIFICATIONS PROPOSÉES</p>
          <div id="aiDiffList"></div>
        </div>
        <div class="ai-preview-ctas">
          <button class="btn btn--secondary btn--full" id="aiEditInEditor">MODIFIER DANS L'ÉDITEUR</button>
          <button class="btn btn--primary btn--full" id="aiUseProgram">UTILISER CE PROGRAMME</button>
        </div>
```

- [ ] **Step 3: Commit HTML changes**

```
git add index.html
git commit -m "feat(html): add mode toggle and modify panel to step 2, diff slot to step 5"
```

---

### Task 4: CSS — diff view and modify panel styles

**Files:**
- Modify: `index.html` (CSS section)

- [ ] **Step 1: Add styles after `.btn--ai` rules**

Find:
```css
    [data-theme="light"] .btn--ai { background: rgba(212, 162, 60, .05); }

    /* Vues */
    .ai-step {
```

Insert between those two lines:
```css
    /* Chips avec retour à la ligne (intentions rapides) */
    .ai-chips--wrap { flex-wrap: wrap; }

    /* Textarea modification — hauteur min plus généreuse */
    #aiModificationText { min-height: 100px; }

    /* Compteur de caractères : vert si valide, rouge si trop court */
    #aiModifCharCount.is-valid { color: var(--green-done); }
    #aiModifCharCount.is-error { color: var(--red-timer);  }

    /* ── Diff panel (étape 5, mode modify) ───────────────────── */
    .ai-diff-panel { display: flex; flex-direction: column; gap: var(--space-xs); margin-bottom: var(--space-lg); }

    .ai-diff-item {
      display: flex; flex-direction: column; gap: 4px;
      padding: var(--space-sm) var(--space-md);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      border-left: 3px solid var(--border);
    }
    .ai-diff-item--added    { border-left-color: var(--green-done); }
    .ai-diff-item--removed  { border-left-color: var(--red-timer);  }
    .ai-diff-item--modified { border-left-color: var(--gold);       }
    .ai-diff-item--unchanged{ border-left-color: var(--border); opacity: .5; }

    .ai-diff-item__header { display: flex; align-items: center; gap: var(--space-xs); }

    .ai-diff-badge {
      font-size: .62rem; font-weight: 700; letter-spacing: .05em;
      padding: 2px 6px; border-radius: 4px; text-transform: uppercase; flex-shrink: 0;
    }
    .ai-diff-badge--added    { background: rgba(46,125,79,.18);  color: var(--green-done); }
    .ai-diff-badge--removed  { background: rgba(210,58,58,.18);  color: var(--red-timer);  }
    .ai-diff-badge--modified { background: rgba(212,162,60,.18); color: var(--gold);       }
    .ai-diff-badge--unchanged{ background: transparent;          color: var(--text-dim);   }

    .ai-diff-item__day  { font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); }
    .ai-diff-item__name { font-size: .92rem; font-weight: 600; color: var(--text); }

    .ai-diff-item__exos { margin-top: 4px; padding-left: 2px; list-style: none; }
    .ai-diff-item__exos li {
      font-size: .78rem; display: flex; align-items: baseline;
      gap: 6px; padding: 2px 0; color: var(--text-dim);
    }
    .ai-diff-item__exos li::before { content: attr(data-sign); font-weight: 700; width: 10px; flex-shrink: 0; }
    .ai-diff-item__exos li[data-sign="+"] { color: var(--green-done); }
    .ai-diff-item__exos li[data-sign="−"] { color: var(--red-timer);  }
    .ai-diff-item__exos li[data-sign="~"] { color: var(--gold);       }

```

- [ ] **Step 2: Commit**

```
git add index.html
git commit -m "feat(css): add diff view styles and modify panel tweaks"
```

---

### Task 5: JS — AiCoach state, mode toggle, navigation

**Files:**
- Modify: `index.html` (AiCoach `<script>` block, ~line 6042)

- [ ] **Step 1: Add new state variables**

Find:
```js
    /* ── État ──────────────────────────────────────────────────── */
    let aiStep           = 0;
    let aiFormData       = {};
    let aiGeneratedProgram = null;
    let msgInterval      = null;
```

Replace with:
```js
    /* ── État ──────────────────────────────────────────────────── */
    let aiStep             = 0;
    let aiMode             = 'create'; // 'create' | 'modify'
    let aiBaseProgram      = null;     // programme source en mode modify
    let aiFormData         = {};
    let aiModification     = '';       // texte libre (mode modify)
    let aiIntents          = [];       // chips d'intention sélectionnées (mode modify)
    let aiGeneratedProgram = null;
    let msgInterval        = null;
```

- [ ] **Step 2: Update `goToAiStep` — label, dots, and selector population**

Find the full `function goToAiStep(n)` block and replace it:
```js
    function goToAiStep(n) {
      $steps.forEach((s, i) => s.classList.toggle('is-hidden', i !== n));
      aiStep = n;

      const totalSteps      = aiMode === 'modify' ? 3 : 4;
      const isQuestionnaire = n <= (aiMode === 'modify' ? 2 : 3);
      const $progress = document.getElementById('aiProgress');
      $stepLabel.textContent     = isQuestionnaire ? `Étape ${n + 1} / ${totalSteps}` : '';
      $progress.style.visibility = isQuestionnaire ? 'visible' : 'hidden';
      $back.style.visibility     = n >= 4 ? 'hidden' : 'visible';
      $footer.style.display      = isQuestionnaire ? 'block' : 'none';

      /* Dots : 3 en modify mode, 4 en create mode */
      const activeDots = aiMode === 'modify' ? 3 : 4;
      const dots = Array.from(document.querySelectorAll('#aiDots .editor-dot'));
      dots.forEach((dot, i) => {
        dot.style.display = i < activeDots ? '' : 'none';
        dot.classList.toggle('editor-dot--active', i === n);
        dot.classList.toggle('editor-dot--done',   i < n);
        if (i >= n) dot.classList.remove(i === n ? 'editor-dot--done' : 'editor-dot--active');
        if (i > n)  dot.classList.remove('editor-dot--active', 'editor-dot--done');
      });

      /* En mode modify, peupler le sélecteur de programme à l'arrivée en step 2 */
      if (n === 2 && aiMode === 'modify') populateProgramSelector();

      updateNextBtn();
      document.getElementById('aiBody').scrollTop = 0;
    }
```

- [ ] **Step 3: Update `updateNextBtn` for modify mode**

Find `function updateNextBtn()` and replace:
```js
    function updateNextBtn() {
      let valid = false;
      if (aiStep === 0) {
        /* En mode modify : objectif optionnel (non envoyé à l'API) */
        valid = aiMode === 'modify' ? true : !!aiFormData.objectif;
      }
      if (aiStep === 1) {
        /* En mode modify : fréquence/durée optionnelles (contexte supplémentaire) */
        valid = aiMode === 'modify' ? true : (!!aiFormData.frequence && !!aiFormData.duree);
      }
      if (aiStep === 2) {
        valid = aiMode === 'create'
          ? !!(aiFormData.materiel?.length > 0)
          : !!(aiBaseProgram && aiModification.trim().length >= 10);
      }
      if (aiStep === 3) valid = !!aiFormData.niveau;
      $next.disabled = !valid;
    }
```

- [ ] **Step 4: Update `$next` click handler to skip step 3 in modify mode**

Find:
```js
    $next.addEventListener('click', () => {
      if (aiStep < 3) {
        goToAiStep(aiStep + 1);
      } else {
        updateGenerateSummary();
        goToAiStep(4);
      }
    });
```

Replace with:
```js
    $next.addEventListener('click', () => {
      if (aiMode === 'modify' && aiStep === 2) {
        /* Mode modify : sauter l'étape profil (3), aller directement à la génération */
        updateGenerateSummary();
        goToAiStep(4);
      } else if (aiStep < 3) {
        goToAiStep(aiStep + 1);
      } else {
        updateGenerateSummary();
        goToAiStep(4);
      }
    });
```

- [ ] **Step 5: Add mode toggle listener**

After the Vue 2 matériel multi-select listener block (after `/* ── Vue 2 : Matériel (multi-select) ───────────────────────── */` block), add:

```js
    /* ── Vue 2 : Toggle mode create / modify ────────────────────── */
    document.querySelectorAll('#aiModeToggle .segmented__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#aiModeToggle .segmented__btn')
          .forEach(b => b.classList.remove('segmented__btn--active'));
        btn.classList.add('segmented__btn--active');
        aiMode = btn.dataset.value;
        document.getElementById('aiStep2Create').classList.toggle('is-hidden', aiMode === 'modify');
        document.getElementById('aiStep2Modify').classList.toggle('is-hidden', aiMode === 'create');
        if (aiMode === 'modify') populateProgramSelector();
        updateNextBtn();
      });
    });

    /* ── Vue 2 : Texte de modification ──────────────────────────── */
    document.getElementById('aiModificationText').addEventListener('input', function () {
      aiModification = this.value;
      const len     = this.value.length;
      const counter = document.getElementById('aiModifCharCount');
      counter.textContent = len;
      counter.className   = len >= 10 ? 'is-valid' : (len > 0 ? 'is-error' : '');
      updateNextBtn();
    });

    /* ── Vue 2 : Chips d'intention (multi-select) ───────────────── */
    document.querySelectorAll('#aiIntentChips .ai-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('is-selected');
        aiIntents = Array.from(
          document.querySelectorAll('#aiIntentChips .ai-chip.is-selected')
        ).map(c => c.dataset.value);
      });
    });

    /* ── Vue 2 : Sélecteur de programme ─────────────────────────── */
    document.getElementById('aiProgramSelector').addEventListener('change', function () {
      const progs = JSON.parse(localStorage.getItem(LS_PROGRAMS) || '[]');
      aiBaseProgram = progs.find(p => p.id === this.value) || null;
      updateNextBtn();
    });
```

- [ ] **Step 6: Add `populateProgramSelector` function**

Add this function right before `function openAiCoach()`:

```js
    /* Peuple le sélecteur de programmes (mode modify).
       Masque le sélecteur s'il n'y a qu'un seul programme ou aucun. */
    function populateProgramSelector() {
      const progs = JSON.parse(localStorage.getItem(LS_PROGRAMS) || '[]');
      const $sel  = document.getElementById('aiProgramSelector');
      const $wrap = document.getElementById('aiProgramSelectorWrapper');
      const $none = document.getElementById('aiNoProgramsMsg');

      $sel.innerHTML = '';

      if (progs.length === 0) {
        $wrap.style.display = 'none';
        $none.classList.remove('is-hidden');
        aiBaseProgram = null;
        updateNextBtn();
        return;
      }

      $none.classList.add('is-hidden');
      /* Masquer le sélecteur si 1 seul programme (pas de choix à faire) */
      $wrap.style.display = progs.length > 1 ? '' : 'none';

      progs.forEach(p => {
        const opt = document.createElement('option');
        opt.value       = p.id;
        opt.textContent = p.meta?.label || 'Programme';
        $sel.appendChild(opt);
      });

      /* Priorité : programme pré-sélectionné par openAiCoachModify → programme actif → premier */
      const targetId = aiBaseProgram?.id || localStorage.getItem(LS_ACTIVE);
      if (targetId && progs.find(p => p.id === targetId)) $sel.value = targetId;

      aiBaseProgram = progs.find(p => p.id === $sel.value) || progs[0] || null;
      updateNextBtn();
    }
```

- [ ] **Step 7: Update `openAiCoach` reset block**

In `function openAiCoach()`, find the reset block starting with `/* Réinitialise sélections et champs */` and ending before `$overlay.classList.remove('is-hidden');`. Replace it with:

```js
      /* Réinitialise sélections et champs */
      $overlay.querySelectorAll('.ai-option-card, .ai-chip')
        .forEach(el => el.classList.remove('is-selected'));
      $overlay.querySelectorAll('#aiNiveauSegmented .segmented__btn')
        .forEach(b => b.classList.remove('segmented__btn--active'));
      document.getElementById('aiAntecedents').value = '';
      document.getElementById('aiPoids').value  = '';
      document.getElementById('aiTaille').value = '';
      document.getElementById('aiSpinner').classList.add('is-hidden');
      document.getElementById('aiGenerate').classList.remove('is-hidden');
      document.getElementById('aiError').classList.add('is-hidden');
      document.getElementById('aiUseProgram').disabled  = false;
      document.getElementById('aiUseProgram').textContent = 'UTILISER CE PROGRAMME';

      /* Réinitialise le mode modify */
      aiMode         = 'create';
      aiBaseProgram  = null;
      aiModification = '';
      aiIntents      = [];
      document.getElementById('aiModificationText').value = '';
      const counter = document.getElementById('aiModifCharCount');
      counter.textContent = '0';
      counter.className   = '';
      /* Remettre toggle sur "Nouveau programme" */
      document.querySelectorAll('#aiModeToggle .segmented__btn').forEach((b, i) => {
        b.classList.toggle('segmented__btn--active', i === 0);
      });
      document.getElementById('aiStep2Create').classList.remove('is-hidden');
      document.getElementById('aiStep2Modify').classList.add('is-hidden');

      /* Réinitialise le diff panel */
      document.getElementById('aiAccordion').classList.remove('is-hidden');
      document.getElementById('aiDiffPanel').classList.add('is-hidden');
      document.getElementById('aiDiffList').innerHTML = '';
```

- [ ] **Step 8: Add `openAiCoachModify` and update return**

After `function openAiCoach()` closing brace, add:

```js
    /* Point d'entrée depuis les cartes programme (Plan tab).
       Ouvre l'overlay en mode modify avec le programme pré-sélectionné,
       directement à l'étape 1 (disponibilités optionnelles). */
    function openAiCoachModify(program) {
      openAiCoach();              // reset complet (aiMode = 'create')
      aiMode        = 'modify';
      aiBaseProgram = program;
      /* Pré-activer visuellement le toggle "Modifier existant" */
      document.querySelectorAll('#aiModeToggle .segmented__btn').forEach(b => {
        b.classList.toggle('segmented__btn--active', b.dataset.value === 'modify');
      });
      document.getElementById('aiStep2Create').classList.add('is-hidden');
      document.getElementById('aiStep2Modify').classList.remove('is-hidden');
      /* Démarrer à l'étape 1 — l'utilisateur clique Suivant pour arriver à l'étape 2 */
      goToAiStep(1);
    }
```

Update the return at the end of the IIFE:
```js
    return { open: openAiCoach, openModify: openAiCoachModify };
```

- [ ] **Step 9: Commit**

```
git add index.html
git commit -m "feat(js): add aiMode state, mode toggle, updateNextBtn, openAiCoachModify"
```

---

### Task 6: JS — doModify, computeDiff, showDiff, apply

**Files:**
- Modify: `index.html` (AiCoach module, continuation)

- [ ] **Step 1: Update `updateGenerateSummary` for modify mode**

Find `function updateGenerateSummary()` and replace its entire body:
```js
    function updateGenerateSummary() {
      if (aiMode === 'modify' && aiBaseProgram) {
        document.getElementById('aiGenerateSummary').textContent =
          `Modification de "${aiBaseProgram.meta?.label || 'votre programme'}"`;
      } else {
        const dureeLabel = { 30: '30 min', 45: '45 min', 60: '1h', 90: '1h30+' }[aiFormData.duree]
          || `${aiFormData.duree} min`;
        document.getElementById('aiGenerateSummary').textContent =
          `${aiFormData.objectif} · ${aiFormData.frequence} j/sem · ${dureeLabel} · ${aiFormData.niveau}`;
      }
    }
```

- [ ] **Step 2: Update `doGenerate` to branch on mode**

In `async function doGenerate()`, find this section (after the spinner setup):

```js
      const antecedents = document.getElementById('aiAntecedents').value.trim() || null;
      const poidsVal = document.getElementById('aiPoids').value;
      const tailleVal = document.getElementById('aiTaille').value;
      const poids  = poidsVal  ? parseInt(poidsVal, 10)  : null;
      const taille = tailleVal ? parseInt(tailleVal, 10) : null;

      try {
        const res = await fetch('/api/generate-program', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            objectif:  aiFormData.objectif,
            frequence: aiFormData.frequence,
            duree:     aiFormData.duree,
            materiel:  aiFormData.materiel,
            niveau:    aiFormData.niveau,
            poids,
            taille,
            antecedents,
          }),
        });
```

Replace with:
```js
      const antecedents = document.getElementById('aiAntecedents').value.trim() || null;
      const poidsVal = document.getElementById('aiPoids').value;
      const tailleVal = document.getElementById('aiTaille').value;
      const poids  = poidsVal  ? parseInt(poidsVal, 10)  : null;
      const taille = tailleVal ? parseInt(tailleVal, 10) : null;

      /* Sérialisation partielle : exclut warmup/tips/cues/alternatives */
      function slimProgram(prog) {
        const s = { meta: prog.meta, sessions: {}, schedule: prog.schedule };
        for (const [k, sess] of Object.entries(prog.sessions || {})) {
          s.sessions[k] = {
            type: sess.type, name: sess.name, accent: sess.accent, subtitle: sess.subtitle,
            exercises: (sess.exercises || []).map(e => ({
              id: e.id, name: e.name, scheme: e.scheme,
              sets: e.sets, load: e.load, restSec: e.restSec,
            })),
            cardio: sess.cardio ?? null,
          };
        }
        return s;
      }

      const isModify = aiMode === 'modify';
      const endpoint = isModify ? '/api/modify-program' : '/api/generate-program';
      const payload  = isModify
        ? {
            existingProgram: slimProgram(aiBaseProgram),
            modification:    aiModification.trim(),
            intents:         aiIntents,
            frequence:       aiFormData.frequence ?? null,
            duree:           aiFormData.duree     ?? null,
          }
        : {
            objectif:  aiFormData.objectif,
            frequence: aiFormData.frequence,
            duree:     aiFormData.duree,
            materiel:  aiFormData.materiel,
            niveau:    aiFormData.niveau,
            poids,
            taille,
            antecedents,
          };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
```

- [ ] **Step 3: Update success branch in `doGenerate` to branch on mode**

Find:
```js
        aiGeneratedProgram    = json.program;
        aiGeneratedProgram.id = 'prog-' + Date.now();
        clearInterval(msgInterval);
        showPreview();
```

Replace with:
```js
        aiGeneratedProgram = json.program;
        /* En mode modify : conserver l'id existant pour remplacer en place */
        aiGeneratedProgram.id = (isModify && aiBaseProgram?.id)
          ? aiBaseProgram.id
          : 'prog-' + Date.now();
        clearInterval(msgInterval);
        if (isModify) {
          showDiff();
        } else {
          showPreview();
        }
```

- [ ] **Step 4: Add `computeDiff` function**

Add this function directly before `function showPreview()`:

```js
    /* Calcule le diff entre deux programmes (avant/après).
       Retourne un tableau de { day, type, newSess, oldSess, exoDiffs }.
       type : 'added' | 'removed' | 'modified' | 'unchanged' */
    function computeDiff(oldProg, newProg) {
      const oldSchedule = oldProg.schedule || {};
      const newSchedule = newProg.schedule || {};
      const allDays     = new Set([...Object.keys(oldSchedule), ...Object.keys(newSchedule)]);

      return Array.from(allDays)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(day => {
          const oldKey  = oldSchedule[day];
          const newKey  = newSchedule[day];
          const oldSess = oldKey ? oldProg.sessions[oldKey] : null;
          const newSess = newKey ? newProg.sessions[newKey] : null;

          if (!oldKey && newKey) return { day, type: 'added',   newSess, oldSess: null, exoDiffs: [] };
          if (oldKey && !newKey) return { day, type: 'removed', newSess: null, oldSess, exoDiffs: [] };

          /* Même jour : comparer exercices par id */
          const oldExos = oldSess?.exercises || [];
          const newExos = newSess?.exercises || [];
          const oldById = Object.fromEntries(oldExos.map(e => [e.id, e]));
          const newIds  = new Set(newExos.map(e => e.id));

          const exoDiffs = [];
          newExos.forEach(e => {
            if (!oldById[e.id]) {
              exoDiffs.push({ sign: '+', name: e.name, scheme: e.scheme });
            } else {
              const old = oldById[e.id];
              if (old.scheme !== e.scheme || old.sets !== e.sets || old.load !== e.load) {
                exoDiffs.push({ sign: '~', name: e.name, scheme: e.scheme });
              }
            }
          });
          oldExos.forEach(e => {
            if (!newIds.has(e.id)) exoDiffs.push({ sign: '−', name: e.name, scheme: '' });
          });

          const type = exoDiffs.length > 0 ? 'modified' : 'unchanged';
          return { day, type, newSess, oldSess, exoDiffs };
        });
    }
```

- [ ] **Step 5: Add `showDiff` function**

Add this function directly after `showPreview`:

```js
    /* Vue 5 en mode modify : diff avant/après ─────────────────── */
    function showDiff() {
      const prog = aiGeneratedProgram;

      document.getElementById('aiProgName').value =
        prog.meta?.label || aiBaseProgram?.meta?.label || 'Mon programme';

      const diffs        = computeDiff(aiBaseProgram, prog);
      const changesCount = diffs.filter(d => d.type !== 'unchanged').length;
      document.getElementById('aiProgSummary').textContent =
        `${changesCount} modification${changesCount > 1 ? 's' : ''} sur ${diffs.length} jour${diffs.length > 1 ? 's' : ''}`;

      /* Basculer : masquer l'accordéon normal, afficher le diff */
      document.getElementById('aiAccordion').classList.add('is-hidden');
      const $diffPanel = document.getElementById('aiDiffPanel');
      $diffPanel.classList.remove('is-hidden');

      const BADGE = { added: 'Nouveau', removed: 'Supprimé', modified: 'Modifié', unchanged: 'Inchangé' };
      const $list = document.getElementById('aiDiffList');
      $list.innerHTML = '';

      diffs.forEach(({ day, type, newSess, oldSess, exoDiffs }) => {
        const sess    = newSess || oldSess;
        const dayName = DAY_NAMES[parseInt(day)] || `Jour ${day}`;
        const item    = document.createElement('div');
        item.className = `ai-diff-item ai-diff-item--${type}`;

        const exosHtml = exoDiffs.map(e =>
          `<li data-sign="${esc(e.sign)}">${esc(e.name)}${e.scheme
            ? ` <span style="color:var(--text-dim);font-size:.72rem">${esc(e.scheme)}</span>`
            : ''}</li>`
        ).join('');

        item.innerHTML = `
          <div class="ai-diff-item__header">
            <span class="ai-diff-badge ai-diff-badge--${type}">${BADGE[type]}</span>
            <span class="ai-diff-item__day">${esc(dayName)}</span>
          </div>
          <div class="ai-diff-item__name">${esc(sess?.name || '')}</div>
          ${exosHtml ? `<ul class="ai-diff-item__exos">${exosHtml}</ul>` : ''}`;
        $list.appendChild(item);
      });

      document.getElementById('aiUseProgram').textContent = 'APPLIQUER LES MODIFICATIONS';
      goToAiStep(5);
    }
```

- [ ] **Step 6: Update `aiUseProgram` to replace vs. add based on mode**

Find:
```js
      let all = JSON.parse(localStorage.getItem(LS_PROGRAMS) || '[]');
      all.push(aiGeneratedProgram);
      localStorage.setItem(LS_PROGRAMS, JSON.stringify(all));
```

Replace with:
```js
      let all = JSON.parse(localStorage.getItem(LS_PROGRAMS) || '[]');
      if (aiMode === 'modify' && aiBaseProgram) {
        const idx = all.findIndex(p => p.id === aiBaseProgram.id);
        if (idx >= 0) all[idx] = aiGeneratedProgram;
        else all.push(aiGeneratedProgram);
      } else {
        all.push(aiGeneratedProgram);
      }
      localStorage.setItem(LS_PROGRAMS, JSON.stringify(all));
```

- [ ] **Step 7: Commit**

```
git add index.html
git commit -m "feat(js): add computeDiff, showDiff, doModify branching, apply-in-place logic"
```

---

### Task 7: Plan tab — "Modifier avec l'IA" button per program card

**Files:**
- Modify: `index.html` (Plan module, `buildProgramsView` function ~line 3625)

- [ ] **Step 1: Add button to each program card's actions**

In `buildProgramsView`, find:
```js
        const btnDup = mkEl('button', 'btn btn--secondary btn--sm');
        btnDup.textContent = t('plan_duplicate');
        btnDup.addEventListener('click', () => duplicateProgram(prog.id));
        actions.appendChild(btnDup);

        if (programs.length > 1) {
```

After `actions.appendChild(btnDup);` and before `if (programs.length > 1) {`, insert:

```js
        const btnModAi = mkEl('button', 'btn btn--ai btn--sm');
        btnModAi.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2 14.4 9.6 22 12 14.4 14.4 12 22 9.6 14.4 2 12 9.6 9.6Z"/></svg> IA';
        btnModAi.title = 'Modifier avec l\'IA';
        btnModAi.addEventListener('click', () => AiCoach.openModify(prog));
        actions.appendChild(btnModAi);
```

- [ ] **Step 2: End-to-end verification checklist**

With `vercel dev` running, open http://localhost:3000 and verify:

**Create flow (unchanged):**
1. Click "CRÉER AVEC L'IA" → step 0 (Objectif) appears, "Étape 1 / 4"
2. Select an objectif → SUIVANT enables → click
3. Step 1 (Disponibilités) → select freq + durée → SUIVANT
4. Step 2 (Matériel): toggle shows "Nouveau programme" selected, matériel chips visible → select some → SUIVANT
5. Step 3 (Profil) → select niveau → SUIVANT
6. Step 4 (Génération) → click GÉNÉRER → spinner → preview accordion appears
7. Click "UTILISER CE PROGRAMME" → navigates to Today tab

**Modify flow via Plan tab:**
1. Go to Plan tab → verify "IA" button appears on each program card
2. Click "IA" button → overlay opens at step 1, "Étape 2 / 3", toggle shows "Modifier existant"
3. Click SUIVANT (enabled without selecting freq/durée) → step 2 shows modify panel
4. Program is pre-selected in selector (or selector hidden if only 1 program)
5. Type 10+ chars → char counter turns green → SUIVANT enables
6. Optionally select intent chips
7. Click SUIVANT → step 4 shows "Modification de '[nom]'"
8. Click GÉNÉRER → spinner → diff view appears
9. Diff shows added/removed/modified/unchanged days with colored left border
10. Click "APPLIQUER LES MODIFICATIONS" → program updated, Today tab shown

**Edge cases:**
- Toggle to "Modifier existant" when no programs exist → "Aucun programme enregistré" message shown, SUIVANT stays disabled
- Back button from step 2 → returns to step 1 correctly
- Opening create mode after a modify session → "Nouveau programme" toggle, matériel chips visible, diff panel hidden

- [ ] **Step 3: Commit**

```
git add index.html
git commit -m "feat(ui): add 'Modifier avec l'IA' button per program card in Plan tab"
```
