// ============================================================
// Schéma SQLite (Drizzle) — spec §3
// Le programme est un document JSON validé ; le suivi est relationnel.
// Toutes les tables sauf settings portent les colonnes de sync.
// ============================================================
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Colonnes de synchronisation (spec §3.2) — fonction : instances propres à chaque table */
const syncColumns = () => ({
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  userId: text('user_id'),
});

const notDeleted = sql`deleted_at IS NULL`;

export const programs = sqliteTable('programs', {
  ...syncColumns(),
  definition: text('definition').notNull(),
  source: text('source', { enum: ['manual', 'ai', 'import', 'example'] }).notNull(),
});

export const workouts = sqliteTable(
  'workouts',
  {
    ...syncColumns(),
    programId: text('program_id').notNull().references(() => programs.id),
    sessionKey: text('session_key').notNull(),
    date: text('date').notNull(),
    status: text('status', { enum: ['in_progress', 'completed', 'abandoned'] }).notNull(),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    healthSyncedAt: text('health_synced_at'),
  },
  (t) => [
    uniqueIndex('workouts_program_session_date_uq').on(t.programId, t.sessionKey, t.date).where(notDeleted),
    index('workouts_date_idx').on(t.date),
  ],
);

export const setEntries = sqliteTable(
  'set_entries',
  {
    ...syncColumns(),
    workoutId: text('workout_id').notNull().references(() => workouts.id),
    exerciseId: text('exercise_id').notNull(),
    performedName: text('performed_name'),
    setIndex: integer('set_index').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    weight: real('weight'),
    reps: integer('reps'),
    doneAt: text('done_at'),
  },
  (t) => [
    uniqueIndex('set_entries_workout_exercise_set_uq').on(t.workoutId, t.exerciseId, t.setIndex).where(notDeleted),
    index('set_entries_exercise_idx').on(t.exerciseId),
  ],
);

export const exerciseWeights = sqliteTable(
  'exercise_weights',
  {
    ...syncColumns(),
    exerciseId: text('exercise_id').notNull(),
    weight: real('weight').notNull(),
    unit: text('unit', { enum: ['kg', 'lbs'] }).notNull(),
  },
  (t) => [uniqueIndex('exercise_weights_exercise_uq').on(t.exerciseId).where(notDeleted)],
);

export const sessionLayouts = sqliteTable(
  'session_layouts',
  {
    ...syncColumns(),
    programId: text('program_id').notNull().references(() => programs.id),
    sessionKey: text('session_key').notNull(),
    exerciseOrder: text('exercise_order').notNull().default('[]'),
    swaps: text('swaps').notNull().default('{}'),
  },
  (t) => [uniqueIndex('session_layouts_program_session_uq').on(t.programId, t.sessionKey).where(notDeleted)],
);

/** Réglages propres à l'appareil (non synchronisés) — valeurs JSON */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
