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
