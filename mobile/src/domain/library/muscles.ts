// Muscles de la bibliothèque — liste propre à l'app (calée sur les groupes de MuscleMap pour le M11)
import type { Lang } from '../prefs';

export const MUSCLE_KEYS = [
  'chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'serratus',
  'lats', 'upper_back', 'traps', 'lower_back', 'neck',
  'glutes', 'hip_flexors', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves',
  'cardio', 'full_body',
] as const;
export type MuscleKey = (typeof MUSCLE_KEYS)[number];

const LABELS: Record<MuscleKey, { fr: string; en: string }> = {
  chest: { fr: 'Pectoraux', en: 'Chest' },
  shoulders: { fr: 'Épaules', en: 'Shoulders' },
  biceps: { fr: 'Biceps', en: 'Biceps' },
  triceps: { fr: 'Triceps', en: 'Triceps' },
  forearms: { fr: 'Avant-bras', en: 'Forearms' },
  abs: { fr: 'Abdominaux', en: 'Abs' },
  obliques: { fr: 'Obliques', en: 'Obliques' },
  serratus: { fr: 'Dentelés', en: 'Serratus' },
  lats: { fr: 'Dorsaux', en: 'Lats' },
  upper_back: { fr: 'Haut du dos', en: 'Upper back' },
  traps: { fr: 'Trapèzes', en: 'Traps' },
  lower_back: { fr: 'Lombaires', en: 'Lower back' },
  neck: { fr: 'Cou', en: 'Neck' },
  glutes: { fr: 'Fessiers', en: 'Glutes' },
  hip_flexors: { fr: 'Fléchisseurs de hanche', en: 'Hip flexors' },
  quads: { fr: 'Quadriceps', en: 'Quads' },
  hamstrings: { fr: 'Ischio-jambiers', en: 'Hamstrings' },
  adductors: { fr: 'Adducteurs', en: 'Adductors' },
  abductors: { fr: 'Abducteurs', en: 'Abductors' },
  calves: { fr: 'Mollets', en: 'Calves' },
  cardio: { fr: 'Cardio', en: 'Cardio' },
  full_body: { fr: 'Corps entier', en: 'Full body' },
};

export const isMuscleKey = (v: unknown): v is MuscleKey => typeof v === 'string' && (MUSCLE_KEYS as readonly string[]).includes(v);
export const muscleLabel = (key: MuscleKey, lang: Lang): string => LABELS[key][lang];
