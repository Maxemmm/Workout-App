// ============================================================
// Validation du brouillon avant enregistrement : règles de l'éditeur
// (PWA) puis ProgramSchema. Chaque erreur indique l'étape à rouvrir.
// ============================================================
import type { Draft } from './draft';
import { parseProgram, type Program } from './program';

export type DraftErrorCode = 'name_required' | 'no_session' | 'no_schedule' | 'session_name_required' | 'schema';
export type DraftError = { step: 1 | 2 | 3 | 4; code: DraftErrorCode; sessionKey?: string; detail?: string };
export type DraftValidation = { ok: true; program: Program } | { ok: false; errors: DraftError[] };

/** Erreur Zod « chemin : message » → étape (et séance) concernée */
function schemaError(detail: string, sessionKeys: string[]): DraftError {
  const m = detail.match(/^sessions\.([^.\s]+)/);
  if (m && sessionKeys.includes(m[1])) return { step: 4, code: 'schema', sessionKey: m[1], detail };
  if (detail.startsWith('schedule')) return { step: 3, code: 'schema', detail };
  return { step: 1, code: 'schema', detail };
}

export function validateDraft(d: Draft): DraftValidation {
  const p = d.program;
  const keys = Object.keys(p.sessions);
  const errors: DraftError[] = [];

  if (!p.meta.label.trim()) errors.push({ step: 1, code: 'name_required' });
  if (keys.length === 0) errors.push({ step: 2, code: 'no_session' });
  for (const key of keys) {
    if (!p.sessions[key].name.trim()) errors.push({ step: 4, code: 'session_name_required', sessionKey: key });
  }
  const scheduled = Object.values(p.schedule).filter((k) => k != null && Object.hasOwn(p.sessions, k));
  if (scheduled.length === 0) errors.push({ step: 3, code: 'no_schedule' });
  errors.sort((a, b) => a.step - b.step);
  if (errors.length > 0) return { ok: false, errors };

  const parsed = parseProgram(p);
  if (parsed.ok) return { ok: true, program: parsed.program };
  return { ok: false, errors: parsed.errors.map((detail) => schemaError(detail, keys)) };
}
