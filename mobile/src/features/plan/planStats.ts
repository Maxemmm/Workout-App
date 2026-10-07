// Résumé d'un programme pour les cartes de Plan
import type { Program } from '@/domain/program';

export function programSummary(p: Program): { days: number; exercises: number } {
  const days = Object.values(p.schedule).filter((k) => k != null && Object.hasOwn(p.sessions, k)).length;
  const exercises = Object.values(p.sessions).reduce((n, s) => n + s.exercises.length, 0);
  return { days, exercises };
}
