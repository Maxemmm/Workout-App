// ============================================================
// Contenu de la notification de fin de minuteur (pur) :
// série suivante sur le même exercice, exercice suivant (ordre affiché), ou séance finie.
// ============================================================
import type { EffectiveExercise } from './exerciseView';
import type { SetTrack } from './progress';

export type NoticeLine =
  | { type: 'same' | 'next'; name: string; set: number; total: number; weight: number | null }
  | { type: 'done' };
export type NoticeContent = { kind: 'rest' | 'work'; line: NoticeLine };

export interface NoticeInput {
  mode: 'rest' | 'work';
  exerciseId: string;
  setIndex: number;
  /** Exercices affichés (ordre, alternatives), bonus exclu */
  exercises: EffectiveExercise[];
  track: SetTrack;
  weightOf(ex: EffectiveExercise): number | null;
}

const firstOpenSet = (ex: EffectiveExercise, track: SetTrack): number => {
  const done = track[ex.id] ?? [];
  for (let i = 0; i < ex.sets; i += 1) if (done[i] !== true) return i;
  return -1;
};

const line = (type: 'same' | 'next', ex: EffectiveExercise, setIndex: number, weightOf: NoticeInput['weightOf']): NoticeLine =>
  ({ type, name: ex.performedName ?? ex.name, set: setIndex + 1, total: ex.sets, weight: weightOf(ex) });

export function restNotice(input: NoticeInput): NoticeContent {
  const { exercises, track, weightOf } = input;
  const index = exercises.findIndex((e) => e.id === input.exerciseId);
  const current = index >= 0 ? exercises[index] : undefined;

  if (input.mode === 'work' && current) {
    return { kind: 'work', line: line('same', current, input.setIndex, weightOf) };
  }
  if (current) {
    const open = firstOpenSet(current, track);
    if (open >= 0) return { kind: input.mode, line: line('same', current, open, weightOf) };
  }
  // Exercice suivant non complet : après l'exercice courant, puis depuis le début
  const order = index >= 0 ? [...exercises.slice(index + 1), ...exercises.slice(0, index)] : exercises;
  for (const ex of order) {
    const open = firstOpenSet(ex, track);
    if (open >= 0) return { kind: input.mode, line: line('next', ex, open, weightOf) };
  }
  return { kind: input.mode, line: { type: 'done' } };
}
