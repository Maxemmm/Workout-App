// ============================================================
// Programme d'entraînement — schéma, types et validation
// Format identique à celui de la PWA et des fonctions api/.
// Les champs inconnus sont conservés (looseObject) pour ne rien perdre.
// ============================================================
import { z } from 'zod';

/** Chaîne optionnelle pouvant valoir null */
const optText = z.string().nullish();
/** Tableau optionnel : null/undefined → [] */
const listOf = <T extends z.ZodType>(item: T) => z.array(item).nullish().transform((v) => v ?? []);

export const ExerciseSchema = z.looseObject({
  id: z.string().trim().min(1, "id d'exercice manquant"),
  name: z.string().trim().min(1, "nom d'exercice manquant"),
  scheme: z.union([z.string(), z.number()]).transform(String).default(''),
  sets: z.coerce.number().int().min(1, 'sets doit être un entier ≥ 1'),
  timed: z.boolean().optional(),
  load: optText,
  restSec: z.coerce.number().int().positive().nullish(),
  cue: optText,
  alternatives: listOf(z.string()),
});

export const SessionTypeSchema = z.enum(['lift', 'cardio', 'rest', 'mixed']);

export const SessionSchema = z.looseObject({
  type: SessionTypeSchema,
  name: z.string().trim().min(1, 'nom de séance manquant'),
  accent: optText,
  subtitle: optText,
  note: optText,
  warmup: listOf(z.string()),
  exercises: listOf(ExerciseSchema),
  cardio: z.looseObject({ label: z.string(), detail: optText }).nullish(),
  bonus: z.looseObject({ title: optText, exercises: listOf(ExerciseSchema) }).nullish(),
  tips: listOf(z.looseObject({ title: z.string(), body: z.string() })),
});

export const MetaSchema = z.looseObject({
  label: z.string().default(''),
  units: z.enum(['kg', 'lbs']).default('kg'),
  restDefaultSec: z.coerce.number().int().positive().default(90),
  repsInReserve: optText,
});

export const ProgramSchema = z
  .looseObject({
    meta: MetaSchema,
    sessions: z
      .record(z.string(), SessionSchema)
      .refine((s) => Object.keys(s).length > 0, { message: 'sessions est vide' }),
    schedule: z.record(z.string(), z.string().nullable()).default({}),
    rules: listOf(z.string()),
  })
  .superRefine((p, ctx) => {
    // Planning : clés 0-6, références vers des séances existantes
    for (const [day, key] of Object.entries(p.schedule)) {
      if (!/^[0-6]$/.test(day)) {
        ctx.addIssue({ code: 'custom', path: ['schedule', day], message: `jour "${day}" invalide (0-6 attendu)` });
      } else if (key !== null && !(key in p.sessions)) {
        ctx.addIssue({ code: 'custom', path: ['schedule', day], message: `le jour ${day} référence la séance inconnue "${key}"` });
      }
    }
    // Ids d'exercice uniques au sein d'une séance (le suivi est indexé par id)
    for (const [sessionKey, s] of Object.entries(p.sessions)) {
      const seen = new Set<string>();
      for (const ex of [...s.exercises, ...(s.bonus?.exercises ?? [])]) {
        if (seen.has(ex.id)) {
          ctx.addIssue({ code: 'custom', path: ['sessions', sessionKey], message: `id d'exercice dupliqué "${ex.id}"` });
        }
        seen.add(ex.id);
      }
    }
  });

export type Program = z.output<typeof ProgramSchema>;
export type Session = z.output<typeof SessionSchema>;
export type Exercise = z.output<typeof ExerciseSchema>;
export type SessionType = z.output<typeof SessionTypeSchema>;
export type Units = Program['meta']['units'];

export type ProgramParseResult = { ok: true; program: Program } | { ok: false; errors: string[] };

/** Valide et normalise un programme ; ne lève jamais d'exception. */
export function parseProgram(input: unknown): ProgramParseResult {
  const r = ProgramSchema.safeParse(input);
  if (r.success) return { ok: true, program: r.data };
  return {
    ok: false,
    errors: r.error.issues.map((i) => `${i.path.map(String).join('.') || '(racine)'} : ${i.message}`),
  };
}
