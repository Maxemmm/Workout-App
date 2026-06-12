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
