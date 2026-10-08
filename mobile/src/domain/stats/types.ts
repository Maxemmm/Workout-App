// ============================================================
// Historique pour les stats — produit par db/repos/statsRepo.readHistory.
// Séances terminées uniquement, triées par date puis completedAt puis id.
// ============================================================
import type { Units } from '../program';
import type { Weekday } from '../schedule';

export type HistorySet = { exerciseId: string; performedName: string | null; weight: number | null; reps: number | null };

export type HistoryWorkout = {
  id: string;
  date: string;
  sessionKey: string;
  sessionName: string;
  /** Unité du programme de la séance (poids des séries dans cette unité) */
  units: Units;
  startedAt: string;
  completedAt: string | null;
  /** Séries faites uniquement */
  sets: HistorySet[];
};

/** Programme actif : jours prévus, unité d'affichage, date (locale) de création */
export type ActivePlan = { trainDays: Weekday[]; units: Units; since: string };

export type StatsHistory = {
  workouts: HistoryWorkout[];
  /** exerciseId → nom (programmes même supprimés) */
  exerciseNames: Record<string, string>;
  active: ActivePlan | null;
};
