// api/generate-program.js — Vercel Serverless Function (Node.js)
// Génère un programme d'entraînement personnalisé via Groq (Llama 3.3 70B).
// Provider configurable via variable d'environnement : le frontend ne sait jamais
// quel modèle répond. Migration vers Anthropic = changer une variable dans Vercel.
//
// Principe RGPD : les données utilisateur transitent pour la génération mais ne
// sont jamais stockées ni loggées côté serveur.

// ─── Schéma JSON embarqué dans le prompt ───────────────────────────────────
const PROGRAM_SCHEMA = `{
  "meta": {
    "label": "NOM DU PROGRAMME",
    "units": "kg",
    "restDefaultSec": 90,
    "repsInReserve": "1 à 2 reps en réserve"
  },
  "sessions": {
    "cle-seance": {
      "type": "lift",
      "name": "NOM SÉANCE",
      "accent": "gold",
      "subtitle": "GROUPES MUSCULAIRES",
      "note": null,
      "warmup": ["exercice échauffement 1", "exercice échauffement 2"],
      "exercises": [
        {
          "id": "id-en-kebab-case",
          "name": "Nom de l'exercice",
          "scheme": "8-12",
          "sets": 4,
          "load": "charge suggérée",
          "restSec": 90,
          "cue": null,
          "alternatives": []
        }
      ],
      "cardio": { "label": "Type cardio", "detail": "Détail" },
      "bonus": null,
      "tips": null
    }
  },
  "schedule": {
    "1": "cle-seance"
  },
  "rules": ["règle 1", "règle 2"]
}`;

// ─── Prompt système coach ───────────────────────────────────────────────────
const COACH_SYSTEM_PROMPT = `Tu es un coach sportif expert en musculation et préparation physique.
Génère un programme d'entraînement personnalisé au format JSON strict.

Règles absolues :
- Réponds UNIQUEMENT avec le JSON, sans texte avant ni après
- Respecte exactement le schéma fourni
- Les id d'exercices sont en kebab-case, uniques, stables
- Les restSec sont des entiers (60, 90, 120, 180)
- Les sets sont des entiers entre 1 et 6
- Le champ "scheme" contient UNIQUEMENT les reps (ex: "8", "8-12", "MAX", "45 sec") — JAMAIS le format "sets×reps"
- Le schedule utilise les indices Date.getDay() (0=dim … 6=sam)
- Les noms de séances ("name") sont en MAJUSCULES, choisis parmi : FULL BODY, HAUT DU CORPS, BAS DU CORPS, JAMBES, BRAS, DOS, PECS, ÉPAULES, CARDIO, MOBILITÉ, ÉTIREMENTS, RÉCUPÉRATION
- accent : "gold" pour musculation principale, "rust" pour membres inférieurs / force, "blue" pour cardio, "gray" pour repos/mobilité
- Adapte le volume et l'intensité au niveau déclaré
- Prends en compte les antécédents pour exclure les exercices contre-indiqués`;

// ─── Construction du prompt utilisateur ────────────────────────────────────
function buildCoachPrompt({ objectif, frequence, duree, materiel, niveau, poids, taille, antecedents }) {
  const antecedentsSection = antecedents
    ? `\nAntécédents / contre-indications : ${antecedents}`
    : '\nAntécédents : aucun';

  const morphoSection = (poids || taille)
    ? `\nMorphologie : ${poids ? `${poids} kg` : '?'} · ${taille ? `${taille} cm` : '?'}`
    : '';

  const exercicesParSeance = duree <= 30 ? 3 : duree <= 45 ? 4 : duree <= 60 ? 5 : 6;

  return `Génère un programme d'entraînement JSON pour ce profil :
- Objectif : ${objectif}
- Fréquence : ${frequence} jours par semaine
- Durée par séance : ${duree} minutes → environ ${exercicesParSeance} exercices par séance
- Matériel disponible : ${materiel.join(', ')}
- Niveau : ${niveau}${morphoSection}${antecedentsSection}

Utilise exactement ce schéma JSON :
${PROGRAM_SCHEMA}

Distribue les ${frequence} séances sur la semaine (indices 0=dim, 1=lun, 2=mar, 3=mer, 4=jeu, 5=ven, 6=sam).
Adapte le nombre d'exercices à la durée (${duree} min ≈ ${exercicesParSeance} exos).
Réponds UNIQUEMENT avec le JSON valide, rien d'autre.`;
}

// ─── Erreur de validation métier ───────────────────────────────────────────
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ─── validateProgramJSON ────────────────────────────────────────────────────
// Valide et parse la réponse brute de Gemini.
// Lève ValidationError avec un message explicite si la structure est invalide.
function validateProgramJSON(raw) {
  // Gemini enveloppe parfois dans des blocs ```json ... ``` — on les retire
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

  // Champs de premier niveau
  if (!program.meta || typeof program.meta !== 'object' || Array.isArray(program.meta)) {
    throw new ValidationError('Structure invalide : champ "meta" manquant ou invalide');
  }
  if (!program.sessions || typeof program.sessions !== 'object' || Array.isArray(program.sessions)) {
    throw new ValidationError('Structure invalide : champ "sessions" manquant ou invalide');
  }
  if (!program.schedule || typeof program.schedule !== 'object' || Array.isArray(program.schedule)) {
    throw new ValidationError('Structure invalide : champ "schedule" manquant ou invalide');
  }

  // sessions non vide
  if (Object.keys(program.sessions).length === 0) {
    throw new ValidationError('Validation échouée : "sessions" est vide');
  }

  // schedule non vide
  const scheduleKeys = Object.keys(program.schedule);
  if (scheduleKeys.length === 0) {
    throw new ValidationError('Validation échouée : "schedule" est vide');
  }

  // Chaque clé du schedule doit exister dans sessions
  for (const day of scheduleKeys) {
    const dayInt = parseInt(day, 10);
    if (isNaN(dayInt) || dayInt < 0 || dayInt > 6) {
      throw new ValidationError(
        `Schedule invalide : la clé "${day}" n'est pas un indice de jour valide (0-6)`
      );
    }
    const sessionKey = program.schedule[day];
    if (!program.sessions[sessionKey]) {
      throw new ValidationError(
        `Schedule invalide : jour ${day} référence "${sessionKey}" qui n'existe pas dans sessions`
      );
    }
  }

  // Validation de chaque exercice — ids uniques dans tout le programme
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
        throw new ValidationError(
          `Session "${sessionKey}" : un exercice n'a pas de champ "id" valide`
        );
      }
      if (!exo.name || typeof exo.name !== 'string' || exo.name.trim() === '') {
        throw new ValidationError(
          `Session "${sessionKey}" : exercice "${exo.id}" sans champ "name" valide`
        );
      }
      const sets = Number(exo.sets);
      if (!Number.isInteger(sets) || sets < 1) {
        throw new ValidationError(
          `Session "${sessionKey}" : exercice "${exo.id}" a sets=${exo.sets} (entier ≥ 1 requis)`
        );
      }
      if (allIds.has(exo.id)) {
        throw new ValidationError(`Validation échouée : id d'exercice dupliqué "${exo.id}"`);
      }
      allIds.add(exo.id);
    }
  }

  return program;
}

// ─── Validation de la requête entrante ─────────────────────────────────────
function validateRequest(body) {
  const errors = [];

  if (!body.objectif || typeof body.objectif !== 'string') {
    errors.push('"objectif" est requis (string)');
  } else if (body.objectif.trim().length === 0) {
    errors.push('"objectif" ne peut pas être vide');
  } else if (body.objectif.length > 100) {
    errors.push('"objectif" dépasse 100 caractères');
  }

  if (body.frequence === undefined || body.frequence === null) {
    errors.push('"frequence" est requis (entier 2-6)');
  } else {
    const freq = Number(body.frequence);
    if (!Number.isInteger(freq) || freq < 2 || freq > 6) {
      errors.push('"frequence" doit être un entier entre 2 et 6');
    }
  }

  const dureesValides = [30, 45, 60, 90];
  if (body.duree === undefined || body.duree === null) {
    errors.push('"duree" est requis (30 | 45 | 60 | 90)');
  } else {
    const duree = Number(body.duree);
    if (!dureesValides.includes(duree)) {
      errors.push('"duree" doit être 30, 45, 60 ou 90 (minutes)');
    }
  }

  if (!Array.isArray(body.materiel)) {
    errors.push('"materiel" est requis (tableau de chaînes)');
  } else if (body.materiel.length === 0) {
    errors.push('"materiel" doit contenir au moins un élément');
  } else if (!body.materiel.every(m => typeof m === 'string' && m.trim().length > 0)) {
    errors.push('"materiel" doit être un tableau de chaînes non vides');
  }

  const niveaux = ['débutant', 'intermédiaire', 'avancé'];
  if (!body.niveau || !niveaux.includes(body.niveau)) {
    errors.push(`"niveau" est requis : "${niveaux.join('" | "')}"`);
  }

  if (body.poids !== undefined && body.poids !== null) {
    const p = Number(body.poids);
    if (isNaN(p) || p < 30 || p > 300) {
      errors.push('"poids" doit être un nombre entre 30 et 300 (kg, optionnel)');
    }
  }

  if (body.taille !== undefined && body.taille !== null) {
    const t = Number(body.taille);
    if (isNaN(t) || t < 100 || t > 250) {
      errors.push('"taille" doit être un nombre entre 100 et 250 (cm, optionnel)');
    }
  }

  if (body.antecedents !== undefined && body.antecedents !== null) {
    if (typeof body.antecedents !== 'string') {
      errors.push('"antecedents" doit être une chaîne (optionnel)');
    } else if (body.antecedents.length > 300) {
      errors.push('"antecedents" dépasse 300 caractères');
    }
  }

  return errors;
}

// ─── Handler principal (Node.js style) ─────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Lecture du stream brut — bypass le parser automatique de Vercel
  let body;
  try {
    const raw = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk.toString(); });
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

  const { objectif, frequence, duree, materiel, niveau, poids, taille, antecedents } = body;

  // Clé API via variable d'environnement — jamais dans le code
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Configuration serveur manquante (GROQ_API_KEY)' });
  }

  const prompt = buildCoachPrompt({
    objectif: objectif.trim(),
    frequence: Number(frequence),
    duree: Number(duree),
    materiel,
    niveau,
    poids: poids !== undefined && poids !== null ? Number(poids) : null,
    taille: taille !== undefined && taille !== null ? Number(taille) : null,
    antecedents: antecedents?.trim() || null,
  });

  // ─── Appel Groq (Llama 3.3 70B) — timeout 30s ─────────────────────────
  let apiResponse;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

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
          { role: 'system', content: COACH_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
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

  // Erreurs HTTP Groq (quota, auth…)
  if (!apiResponse.ok) {
    const errData = await apiResponse.json().catch(() => ({}));
    const status = apiResponse.status;

    if (status === 429) {
      return res.status(429).json({ error: 'Quota dépassé. Réessaie dans quelques minutes.' });
    }
    if (status === 401 || status === 403) {
      return res.status(500).json({ error: 'Clé API invalide ou accès refusé' });
    }
    return res.status(502).json({ error: `Erreur API (${status})`, detail: errData?.error?.message ?? null });
  }

  // Extraction du texte généré (format OpenAI-compatible)
  let rawText;
  try {
    const data = await apiResponse.json();
    rawText = data?.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('Champ content absent dans la réponse');
  } catch (err) {
    return res.status(502).json({ error: 'Réponse API illisible', detail: err.message });
  }

  // Validation stricte du JSON retourné avant envoi au frontend
  let program;
  try {
    program = validateProgramJSON(rawText);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(422).json({ error: 'Programme généré invalide', detail: err.message });
    }
    return res.status(500).json({ error: 'Erreur interne lors de la validation du programme' });
  }

  // Rien n'est stocké côté serveur — retour direct
  return res.status(200).json({ program });
}
