// ============================================================
// Schéma d'exercice (« 4×8 », « 3×45 sec »), exercices chronométrés,
// poids suggéré et saisi. Règles reprises de la PWA (index.html).
// ============================================================
import type { Exercise, Units } from './program';

export type SchemeFields = Pick<Exercise, 'scheme' | 'sets' | 'timed'>;

const MAX_WORK_SEC = 600;

/** Partie « reps » : après « × » s'il y en a un, sinon tout le schéma */
export function repsPart(scheme: string): string {
  const raw = scheme.trim();
  return raw.includes('×') ? (raw.split('×')[1] ?? '').trim() : raw;
}

/** Dernière occurrence de « N sec » ; 0 si absente */
export function parseTimedSeconds(scheme: string): number {
  const matches = [...scheme.matchAll(/(\d+)\s*sec/gi)];
  const last = matches[matches.length - 1];
  return last ? parseInt(last[1], 10) : 0;
}

/** timed explicite prioritaire ; sinon ancien format « N sec » */
export function isTimed(ex: SchemeFields): boolean {
  if (ex.timed === true) return true;
  if (ex.timed === false) return false;
  return parseTimedSeconds(ex.scheme) > 0;
}

/** Durée d'effort d'une série chronométrée ; 0 si non chronométrée ou illisible */
export function workSeconds(ex: SchemeFields): number {
  if (!isTimed(ex)) return 0;
  const fromSec = parseTimedSeconds(ex.scheme);
  if (fromSec > 0) return fromSec;
  const n = parseInt(repsPart(ex.scheme), 10);
  return n > 0 && n <= MAX_WORK_SEC ? n : 0;
}

/** Reps d'une série : premier nombre de la partie reps ; null si chronométré ou illisible */
export function schemeReps(ex: SchemeFields): number | null {
  if (isTimed(ex)) return null;
  const m = repsPart(ex.scheme).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Affichage « 4 × 8 » / « 3 × 45 sec » */
export function formatScheme(ex: SchemeFields): string {
  const reps = repsPart(ex.scheme);
  const suffix = isTimed(ex) && reps && !/sec/i.test(reps) ? ' sec' : '';
  return `${ex.sets} × ${reps || '?'}${suffix}`;
}

/** Premier nombre de la charge suggérée (« 100 à 120 kg » → 100) */
export function suggestedWeight(load: string | null | undefined): number | null {
  if (!load) return null;
  const m = load.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const w = parseFloat(m[1].replace(',', '.'));
  return w > 0 ? w : null;
}

/** Saisie libre → poids ; vide, zéro, négatif ou illisible → null */
export function parseWeightInput(text: string): number | null {
  const w = Number(text.trim().replace(',', '.'));
  return Number.isFinite(w) && w > 0 ? w : null;
}

export function weightStep(units: Units): number {
  return units === 'lbs' ? 5 : 2.5;
}

export function formatWeight(w: number): string {
  return String(Math.round(w * 100) / 100);
}
