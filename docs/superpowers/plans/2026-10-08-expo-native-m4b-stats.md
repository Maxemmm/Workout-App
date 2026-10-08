# App native Expo — M4b Stats — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un écran Stats — résumé (série en cours, volume semaine, dernière séance), progression par exercice (courbe Charge max / 1RM estimé, record, meilleure série, volume), assiduité (calendrier 12 semaines + taux), records, filtre de période mémorisé.

**Architecture:** une lecture (`statsRepo.readHistory`) produit un historique à plat ; tous les calculs sont des fonctions pures dans `src/domain/stats/` ; l'écran `features/stats/` assemble des sections ; courbe en SVG maison (`react-native-svg`).

**Tech Stack:** Expo SDK 57, TypeScript strict, Expo Router, expo-sqlite + Drizzle (tests : better-sqlite3), Zustand, Jest (jest-expo) + RNTL 14 (render/fireEvent asynchrones), `react-native-svg` (nouveau, inclus dans Expo Go).

**Spec:** `docs/superpowers/specs/2026-10-08-expo-native-m4b-stats-design.md` (+ `docs/superpowers/specs/2026-10-05-expo-native-foundation-design.md` §4).

Toutes les commandes se lancent depuis `mobile/`.

## Global Constraints

- Moteur générique : aucun nom de jour, de séance, d'exercice ou de couleur en dur ; les jours prévus viennent du planning du programme actif.
- Code et commentaires en français ; chaînes visibles via i18n (fr + en).
- Séances prises en compte : `status = 'completed'`, non supprimées ; séries : `done = true`, non supprimées.
- Exercice suivi = `(exerciseId, performedName)` ; clé `weightKey(exerciseId, performedName)` (`@/domain/exerciseView`).
- Conversion : 1 lb = 0,45359237 kg ; affichage dans l'unité du programme actif (défaut `kg`).
- 1RM Epley `poids × (1 + reps / 30)` pour 1 ≤ reps ≤ 12 et poids > 0 ; reps = 1 → poids.
- Période : `4w` = 28 j, `3m` = 91 j, `1y` = 365 j, `all` ; aujourd'hui inclus ; défaut `3m` ; clé de réglage `statsPeriod`.
- Calendrier : 12 semaines, lundi → dimanche, la dernière contient aujourd'hui.
- Badge « Nouveau » : record de moins de 7 jours (aujourd'hui inclus), jamais pour la première séance d'un exercice.
- Pas de nouveau build : `react-native-svg` est dans Expo Go. Checklist appareil = Expo Go + web.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ; push uniquement sur `expo-native`.

## Review Focus

1. **Programmes en kg et en lbs dans l'historique** : volumes et records convertis dans l'unité active, jamais additionnés bruts (Task 1 et Task 2 — tests).
2. **Deux séances le même jour** : un seul jour « fait » dans le calendrier et la série en cours ; « Dernière séance » = la plus récemment terminée (Task 3 et Task 4 — tests).
3. **Exercice uniquement au poids du corps** : pas de courbe ni de record de charge, message dédié, pas de plantage (Task 2 et Task 8 — tests).
4. **Historique importé antérieur au programme actif** : aucun jour « manqué » avant la date de création du programme (Task 4 — test).
5. **Historique d'un programme supprimé** : ses séances et ses noms d'exercices restent dans les stats (Task 5 — test).

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/domain/stats/types.ts` (créé) | Types de l'historique |
| `src/domain/stats/dates.ts` (créé) | Arithmétique sur les jours `AAAA-MM-JJ` |
| `src/domain/stats/units.ts` (créé) | Conversion, arrondi des charges |
| `src/domain/stats/oneRm.ts` (créé) | 1RM estimé, meilleure série |
| `src/domain/stats/period.ts` (créé) | Périodes |
| `src/domain/stats/exerciseSeries.ts` (créé) | Exercices suivis, courbe, chiffres d'un exercice |
| `src/domain/stats/records.ts` (créé) | Records, records établis par une séance |
| `src/domain/stats/summary.ts` (créé) | Série en cours, volume semaine, dernière séance |
| `src/domain/stats/attendance.ts` (créé) | Calendrier, taux |
| `src/domain/__fixtures__/statsHistory.ts` (créé) | Constructeurs de tests |
| `src/db/repos/statsRepo.ts` (créé) | `readHistory` |
| `src/db/repos/settingsRepo.ts` | Clé `statsPeriod` |
| `src/features/stats/LineChart.tsx`, `AttendanceCalendar.tsx` (créés) | Graphiques |
| `src/features/stats/format.ts` (créé) | Formatage nombres / charges / dates |
| `src/features/stats/SummaryCards.tsx`, `ExerciseSection.tsx`, `AttendanceSection.tsx`, `RecordsList.tsx`, `StatsScreen.tsx` (créés) | Écran |
| `src/app/(tabs)/stats.tsx` | Route |
| `src/i18n/locales/fr.json`, `en.json` | Chaînes |
| `docs/DEVICE_CHECKLIST.md` | Section M4b |

---

### Task 1: Bases du domaine stats — types, jours, unités, 1RM, période

**Files:**
- Create: `mobile/src/domain/stats/types.ts`, `dates.ts`, `units.ts`, `oneRm.ts`, `period.ts`, `mobile/src/domain/__fixtures__/statsHistory.ts`
- Test: `mobile/src/domain/stats/__tests__/basics.test.ts`

**Interfaces:**
- Produces:
  - `type HistorySet = { exerciseId: string; performedName: string | null; weight: number | null; reps: number | null }`
  - `type HistoryWorkout = { id: string; date: string; sessionKey: string; sessionName: string; units: Units; startedAt: string; completedAt: string | null; sets: HistorySet[] }`
  - `type ActivePlan = { trainDays: Weekday[]; units: Units; since: string }`
  - `type StatsHistory = { workouts: HistoryWorkout[]; exerciseNames: Record<string, string>; active: ActivePlan | null }` — `workouts` triées par date puis `completedAt` puis `id` (croissant).
  - `parseDay(key): Date`, `addDays(key, n): string`, `dayDiff(from, to): number` (to − from en jours), `weekdayOfDay(key): Weekday`, `mondayOf(key): string`
  - `toUnit(weight, from: Units, to: Units): number`, `roundLoad(weight): number` (au 0,5)
  - `estimateOneRm(weight: number | null, reps: number | null): number | null`
  - `type BestSet = { weight: number; reps: number; oneRm: number; date: string }`, `bestSet(sets: { weight: number | null; reps: number | null; date: string }[]): BestSet | null`
  - `type StatsPeriod = '4w' | '3m' | '1y' | 'all'`, `STATS_PERIODS`, `DEFAULT_STATS_PERIOD = '3m'`, `isStatsPeriod(v): v is StatsPeriod`, `periodStart(period, today): string | null`
  - Constructeurs de test : `hw(date, sets, o?)`, `hs(exerciseId, weight, reps, performedName?)`, `history(workouts, active?, names?)`.

- [ ] **Step 1: Écrire les constructeurs et les tests**

`mobile/src/domain/__fixtures__/statsHistory.ts` :
```ts
// Constructeurs d'historique pour les tests de stats
import type { ActivePlan, HistorySet, HistoryWorkout, StatsHistory } from '../stats/types';

let seq = 0;

export const hs = (exerciseId: string, weight: number | null, reps: number | null, performedName: string | null = null): HistorySet =>
  ({ exerciseId, performedName, weight, reps });

export function hw(date: string, sets: HistorySet[], o: Partial<HistoryWorkout> = {}): HistoryWorkout {
  seq += 1;
  return {
    id: `w${String(seq).padStart(4, '0')}`, date, sessionKey: 's', sessionName: 'SÉANCE', units: 'kg',
    startedAt: `${date}T10:00:00.000Z`, completedAt: `${date}T11:00:00.000Z`, sets, ...o,
  };
}

export function history(workouts: HistoryWorkout[], active: ActivePlan | null = null, names: Record<string, string> = {}): StatsHistory {
  const sorted = [...workouts].sort((a, b) =>
    a.date.localeCompare(b.date) || (a.completedAt ?? '').localeCompare(b.completedAt ?? '') || a.id.localeCompare(b.id));
  return { workouts: sorted, exerciseNames: names, active };
}
```

`mobile/src/domain/stats/__tests__/basics.test.ts` :
```ts
import { addDays, dayDiff, mondayOf, weekdayOfDay } from '../dates';
import { bestSet, estimateOneRm } from '../oneRm';
import { isStatsPeriod, periodStart } from '../period';
import { roundLoad, toUnit } from '../units';

describe('dates', () => {
  it('addDays traverse les mois et le changement d\'heure', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });
  it('dayDiff, jour de semaine, lundi', () => {
    expect(dayDiff('2026-10-01', '2026-10-07')).toBe(6);
    expect(weekdayOfDay('2026-10-07')).toBe(3); // mercredi
    expect(mondayOf('2026-10-07')).toBe('2026-10-05');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05'); // dimanche → lundi précédent
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
  });
});

describe('units', () => {
  it('Review Focus 1 : conversion kg ↔ lbs, même unité inchangée', () => {
    expect(toUnit(100, 'lbs', 'kg')).toBeCloseTo(45.359237);
    expect(toUnit(45.359237, 'kg', 'lbs')).toBeCloseTo(100);
    expect(toUnit(80, 'kg', 'kg')).toBe(80);
  });
  it('arrondi des charges au 0,5', () => {
    expect(roundLoad(45.36)).toBe(45.5);
    expect(roundLoad(45.2)).toBe(45);
  });
});

describe('1RM', () => {
  it('Epley de 1 à 12 reps ; au-delà, poids nul ou reps absentes → null', () => {
    expect(estimateOneRm(100, 1)).toBe(100);
    expect(estimateOneRm(100, 12)).toBeCloseTo(140);
    expect(estimateOneRm(100, 13)).toBeNull();
    expect(estimateOneRm(0, 5)).toBeNull();
    expect(estimateOneRm(100, null)).toBeNull();
    expect(estimateOneRm(null, 5)).toBeNull();
  });
  it('meilleure série = plus haut 1RM ; égalité → la plus récente', () => {
    expect(bestSet([
      { weight: 100, reps: 8, date: '2026-06-01' },
      { weight: 110, reps: 3, date: '2026-06-02' },
      { weight: 120, reps: 15, date: '2026-06-03' },
    ])).toEqual({ weight: 100, reps: 8, oneRm: 100 * (1 + 8 / 30), date: '2026-06-01' });
    expect(bestSet([{ weight: 100, reps: 5, date: '2026-06-01' }, { weight: 100, reps: 5, date: '2026-06-08' }])?.date).toBe('2026-06-08');
    expect(bestSet([{ weight: null, reps: 10, date: '2026-06-01' }])).toBeNull();
  });
});

describe('période', () => {
  it('bornes incluses ; all → null ; garde de type', () => {
    expect(periodStart('4w', '2026-10-07')).toBe('2026-09-10');
    expect(periodStart('3m', '2026-10-07')).toBe('2026-07-09');
    expect(periodStart('1y', '2026-10-07')).toBe('2025-10-08');
    expect(periodStart('all', '2026-10-07')).toBeNull();
    expect(isStatsPeriod('3m')).toBe(true);
    expect(isStatsPeriod('6m')).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/domain/stats`
Expected: FAIL — modules `../dates`, `../oneRm`, `../period`, `../units` introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/stats/types.ts` :
```ts
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
```

`mobile/src/domain/stats/dates.ts` :
```ts
// Jours locaux « AAAA-MM-JJ » : arithmétique sans fuseau (midi local, puis clé locale)
import { localDateKey, type Weekday } from '../schedule';

export function parseDay(key: string): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)), 12);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return localDateKey(d);
}

const dayNumber = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000;

/** Nombre de jours de `from` à `to` (positif si `to` est après) */
export function dayDiff(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

export function weekdayOfDay(key: string): Weekday {
  return parseDay(key).getDay() as Weekday;
}

/** Lundi de la semaine (lundi → dimanche) contenant ce jour */
export function mondayOf(key: string): string {
  return addDays(key, -((weekdayOfDay(key) + 6) % 7));
}
```

`mobile/src/domain/stats/units.ts` :
```ts
// Conversion des charges entre kg et lbs, arrondi d'affichage
import type { Units } from '../program';

const KG_PER_LB = 0.45359237;

export function toUnit(weight: number, from: Units, to: Units): number {
  if (from === to) return weight;
  return from === 'lbs' ? weight * KG_PER_LB : weight / KG_PER_LB;
}

/** Charge affichée : arrondie au 0,5 */
export function roundLoad(weight: number): number {
  return Math.round(weight * 2) / 2;
}
```

`mobile/src/domain/stats/oneRm.ts` :
```ts
// 1RM estimé (Epley) et meilleure série
export const ONE_RM_MAX_REPS = 12;

export function estimateOneRm(weight: number | null, reps: number | null): number | null {
  if (weight === null || !(weight > 0) || reps === null || reps < 1 || reps > ONE_RM_MAX_REPS) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export type BestSet = { weight: number; reps: number; oneRm: number; date: string };

/** Série au plus haut 1RM estimé ; égalité → la plus récente (date, puis ordre d'entrée) */
export function bestSet(sets: { weight: number | null; reps: number | null; date: string }[]): BestSet | null {
  let best: BestSet | null = null;
  for (const s of sets) {
    const oneRm = estimateOneRm(s.weight, s.reps);
    if (oneRm === null) continue;
    if (!best || oneRm > best.oneRm || (oneRm === best.oneRm && s.date >= best.date)) {
      best = { weight: s.weight as number, reps: s.reps as number, oneRm, date: s.date };
    }
  }
  return best;
}
```

`mobile/src/domain/stats/period.ts` :
```ts
// Période des stats (réglage statsPeriod)
import { addDays } from './dates';

export const STATS_PERIODS = ['4w', '3m', '1y', 'all'] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];
export const DEFAULT_STATS_PERIOD: StatsPeriod = '3m';

const PERIOD_DAYS: Record<Exclude<StatsPeriod, 'all'>, number> = { '4w': 28, '3m': 91, '1y': 365 };

export function isStatsPeriod(v: unknown): v is StatsPeriod {
  return typeof v === 'string' && (STATS_PERIODS as readonly string[]).includes(v);
}

/** Premier jour inclus de la période ; null pour « tout » */
export function periodStart(period: StatsPeriod, today: string): string | null {
  return period === 'all' ? null : addDays(today, -(PERIOD_DAYS[period] - 1));
}
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/domain/stats && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/domain/stats src/domain/__fixtures__/statsHistory.ts
git commit -m "feat(mobile): add stats domain basics (days, units, 1RM, period)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Exercices suivis, courbe, chiffres d'un exercice, records

**Files:**
- Create: `mobile/src/domain/stats/exerciseSeries.ts`, `mobile/src/domain/stats/records.ts`
- Test: `mobile/src/domain/stats/__tests__/exercises.test.ts`

**Interfaces:**
- Consumes: Task 1 (types, `toUnit`, `estimateOneRm`, `bestSet`, `dayDiff`), `weightKey` (`@/domain/exerciseView`).
- Produces:
  - `displayUnits(h: StatsHistory): Units` (= `h.active?.units ?? 'kg'`)
  - `type TrackedExercise = { key: string; exerciseId: string; performedName: string | null; name: string; lastDate: string }`
  - `trackedExercises(h): TrackedExercise[]` — exercices avec ≥ 1 série faite, triés par `lastDate` décroissante puis nom.
  - `type SeriesMetric = 'load' | 'oneRm'` ; `type SeriesPoint = { date: string; workoutId: string; value: number }`
  - `exerciseSeries(h, key, metric, since: string | null): SeriesPoint[]`
  - `type ExerciseStats = { record: { value: number; date: string } | null; best: BestSet | null; volume: number }`
  - `exerciseStats(h, key, since): ExerciseStats` (record et meilleure série sur tout l'historique, volume sur la période ; valeurs dans l'unité d'affichage)
  - `workoutVolume(w: HistoryWorkout, to: Units): number`
  - `type PersonalRecord = { key: string; name: string; weight: number; date: string; oneRm: number | null; isNew: boolean }`
  - `personalRecords(h, today): PersonalRecord[]` (triés par date décroissante puis nom)
  - `recordsSetBy(h, workoutId): string[]` (clés des exercices dont la séance a battu le record)

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/stats/__tests__/exercises.test.ts` :
```ts
import { history, hs, hw } from '../../__fixtures__/statsHistory';
import { exerciseSeries, exerciseStats, trackedExercises, workoutVolume } from '../exerciseSeries';
import { personalRecords, recordsSetBy } from '../records';

const names = { presse: 'Presse', dc: 'Développé couché' };

describe('exercices suivis', () => {
  it('alternative = exercice distinct ; tri par dernière utilisation ; noms', () => {
    const h = history([
      hw('2026-06-01', [hs('presse', 100, 8), hs('dc', 60, 8)]),
      hw('2026-06-03', [hs('dc', 20, 10, 'Développé haltères')]),
    ], null, names);
    expect(trackedExercises(h).map((e) => [e.key, e.name, e.lastDate])).toEqual([
      ['dc::Développé haltères', 'Développé haltères', '2026-06-03'],
      ['dc', 'Développé couché', '2026-06-01'],
      ['presse', 'Presse', '2026-06-01'],
    ]);
  });

  it('nom inconnu → id', () => {
    expect(trackedExercises(history([hw('2026-06-01', [hs('mystere', 10, 5)])]))[0].name).toBe('mystere');
  });
});

describe('courbe', () => {
  const h = history([
    hw('2026-06-01', [hs('presse', 100, 8), hs('presse', 105, 6)]),
    hw('2026-06-08', [hs('presse', null, 10)]),
    hw('2026-06-15', [hs('presse', 110, 13)]),
  ], null, names);

  it('un point par séance avec poids : charge max', () => {
    expect(exerciseSeries(h, 'presse', 'load', null).map((p) => [p.date, p.value])).toEqual([['2026-06-01', 105], ['2026-06-15', 110]]);
  });

  it('1RM : meilleur 1RM de la séance ; séance sans 1RM calculable → pas de point', () => {
    const pts = exerciseSeries(h, 'presse', 'oneRm', null);
    expect(pts.map((p) => p.date)).toEqual(['2026-06-01']);
    expect(pts[0].value).toBeCloseTo(105 * 1.2);
  });

  it('période : seulement les séances depuis since', () => {
    expect(exerciseSeries(h, 'presse', 'load', '2026-06-10').map((p) => p.date)).toEqual(['2026-06-15']);
  });

  it('Review Focus 1 : séances en lbs converties dans l\'unité active', () => {
    const mixed = history([
      hw('2026-06-01', [hs('presse', 100, 8)], { units: 'kg' }),
      hw('2026-06-08', [hs('presse', 220, 8)], { units: 'lbs' }),
    ], { trainDays: [], units: 'kg', since: '2026-01-01' });
    expect(exerciseSeries(mixed, 'presse', 'load', null)[1].value).toBeCloseTo(99.79, 1);
    expect(exerciseStats(mixed, 'presse', null).record).toEqual({ value: 100, date: '2026-06-01' });
  });
});

describe('chiffres d\'un exercice', () => {
  it('record = première atteinte du max ; meilleure série ; volume sur la période', () => {
    const h = history([
      hw('2026-06-01', [hs('presse', 100, 8)]),
      hw('2026-06-08', [hs('presse', 110, 5)]),
      hw('2026-06-15', [hs('presse', 110, 8), hs('presse', 90, 10)]),
    ]);
    const s = exerciseStats(h, 'presse', '2026-06-10');
    expect(s.record).toEqual({ value: 110, date: '2026-06-08' });
    expect(s.best).toMatchObject({ weight: 110, reps: 8, date: '2026-06-15' });
    expect(s.volume).toBe(110 * 8 + 90 * 10);
  });

  it('Review Focus 3 : exercice au poids du corps → pas de record ni de meilleure série, volume 0', () => {
    const h = history([hw('2026-06-01', [hs('gainage', null, 3), hs('gainage', null, 3)])]);
    expect(exerciseStats(h, 'gainage', null)).toEqual({ record: null, best: null, volume: 0 });
    expect(exerciseSeries(h, 'gainage', 'load', null)).toEqual([]);
  });

  it('volume d\'une séance : poids × reps, séries sans poids ou sans reps ignorées, conversion', () => {
    const w = hw('2026-06-01', [hs('a', 100, 10), hs('b', null, 10), hs('c', 50, null)], { units: 'lbs' });
    expect(workoutVolume(w, 'lbs')).toBe(1000);
    expect(workoutVolume(w, 'kg')).toBeCloseTo(453.59, 1);
  });
});

describe('records', () => {
  const TODAY = '2026-10-07';

  it('première séance jamais « nouveau » ; record battu il y a < 7 jours → nouveau', () => {
    const h = history([
      hw('2026-09-20', [hs('presse', 100, 8), hs('dc', 60, 8)]),
      hw('2026-10-01', [hs('presse', 105, 8)]),
      hw('2026-10-02', [hs('dc', 55, 8)]),
    ], null, names);
    const recs = personalRecords(h, TODAY);
    expect(recs.map((r) => [r.key, r.weight, r.date, r.isNew])).toEqual([
      ['presse', 105, '2026-10-01', true],
      ['dc', 60, '2026-09-20', false],
    ]);
  });

  it('badge : 6 jours → nouveau, 7 jours → non', () => {
    const at = (d: string) => personalRecords(history([hw('2026-09-01', [hs('p', 100, 5)]), hw(d, [hs('p', 101, 5)])]), TODAY)[0].isNew;
    expect(at('2026-10-01')).toBe(true);
    expect(at('2026-09-30')).toBe(false);
  });

  it('recordsSetBy : strictement au-dessus de toutes les séances antérieures ; égalité ou première séance → non', () => {
    const w1 = hw('2026-06-01', [hs('presse', 100, 8)]);
    const w2 = hw('2026-06-08', [hs('presse', 100, 8), hs('dc', 50, 8)]);
    const w3 = hw('2026-06-15', [hs('presse', 102.5, 8)]);
    const h = history([w1, w2, w3]);
    expect(recordsSetBy(h, w1.id)).toEqual([]);
    expect(recordsSetBy(h, w2.id)).toEqual([]);
    expect(recordsSetBy(h, w3.id)).toEqual(['presse']);
  });

  it('Review Focus 3 : exercice sans poids absent des records', () => {
    expect(personalRecords(history([hw('2026-06-01', [hs('gainage', null, 3)])]), TODAY)).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/domain/stats/__tests__/exercises.test.ts`
Expected: FAIL — modules `../exerciseSeries` et `../records` introuvables.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/stats/exerciseSeries.ts` :
```ts
// ============================================================
// Progression par exercice — exercices suivis, courbe, record, meilleure série, volume.
// Un exercice suivi = (exerciseId, performedName) ; valeurs dans l'unité d'affichage.
// ============================================================
import type { Units } from '../program';
import { weightKey } from '../exerciseView';
import { bestSet, estimateOneRm, type BestSet } from './oneRm';
import type { HistorySet, HistoryWorkout, StatsHistory } from './types';
import { toUnit } from './units';

export const displayUnits = (h: StatsHistory): Units => h.active?.units ?? 'kg';

export const setKey = (s: HistorySet) => weightKey(s.exerciseId, s.performedName);

export type TrackedExercise = { key: string; exerciseId: string; performedName: string | null; name: string; lastDate: string };

export function trackedExercises(h: StatsHistory): TrackedExercise[] {
  const map = new Map<string, TrackedExercise>();
  for (const w of h.workouts) {
    for (const s of w.sets) {
      const key = setKey(s);
      const name = s.performedName ?? h.exerciseNames[s.exerciseId] ?? s.exerciseId;
      const prev = map.get(key);
      if (!prev || w.date >= prev.lastDate) map.set(key, { key, exerciseId: s.exerciseId, performedName: s.performedName, name, lastDate: w.date });
    }
  }
  return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name));
}

/** Séries d'un exercice dans une séance, poids converti dans l'unité d'affichage */
function setsOf(w: HistoryWorkout, key: string, to: Units): { weight: number | null; reps: number | null }[] {
  return w.sets.filter((s) => setKey(s) === key).map((s) => ({ weight: s.weight === null ? null : toUnit(s.weight, w.units, to), reps: s.reps }));
}

/** Charge max d'une séance pour un exercice (null si aucun poids > 0) */
export function workoutLoad(w: HistoryWorkout, key: string, to: Units): number | null {
  const loads = setsOf(w, key, to).map((s) => s.weight).filter((x): x is number => x !== null && x > 0);
  return loads.length ? Math.max(...loads) : null;
}

export function workoutVolume(w: HistoryWorkout, to: Units): number {
  return w.sets.reduce((sum, s) => (s.weight !== null && s.weight > 0 && s.reps !== null && s.reps > 0 ? sum + toUnit(s.weight, w.units, to) * s.reps : sum), 0);
}

export type SeriesMetric = 'load' | 'oneRm';
export type SeriesPoint = { date: string; workoutId: string; value: number };

export function exerciseSeries(h: StatsHistory, key: string, metric: SeriesMetric, since: string | null): SeriesPoint[] {
  const to = displayUnits(h);
  const points: SeriesPoint[] = [];
  for (const w of h.workouts) {
    if (since !== null && w.date < since) continue;
    let value: number | null;
    if (metric === 'load') value = workoutLoad(w, key, to);
    else {
      const rms = setsOf(w, key, to).map((s) => estimateOneRm(s.weight, s.reps)).filter((x): x is number => x !== null);
      value = rms.length ? Math.max(...rms) : null;
    }
    if (value !== null) points.push({ date: w.date, workoutId: w.id, value });
  }
  return points;
}

export type ExerciseStats = { record: { value: number; date: string } | null; best: BestSet | null; volume: number };

export function exerciseStats(h: StatsHistory, key: string, since: string | null): ExerciseStats {
  const to = displayUnits(h);
  let record: ExerciseStats['record'] = null;
  const all: { weight: number | null; reps: number | null; date: string }[] = [];
  let volume = 0;
  for (const w of h.workouts) {
    const sets = setsOf(w, key, to);
    if (!sets.length) continue;
    const load = workoutLoad(w, key, to);
    if (load !== null && (!record || load > record.value)) record = { value: load, date: w.date };
    for (const s of sets) {
      all.push({ ...s, date: w.date });
      if ((since === null || w.date >= since) && s.weight !== null && s.weight > 0 && s.reps !== null && s.reps > 0) volume += s.weight * s.reps;
    }
  }
  return { record, best: bestSet(all), volume };
}
```

`mobile/src/domain/stats/records.ts` :
```ts
// Records personnels : charge max par exercice (première atteinte), badge « Nouveau » < 7 jours
import { dayDiff } from './dates';
import { displayUnits, exerciseStats, trackedExercises, workoutLoad } from './exerciseSeries';
import type { StatsHistory } from './types';

export const NEW_RECORD_DAYS = 7;

export type PersonalRecord = { key: string; name: string; weight: number; date: string; oneRm: number | null; isNew: boolean };

export function personalRecords(h: StatsHistory, today: string): PersonalRecord[] {
  const to = displayUnits(h);
  const out: PersonalRecord[] = [];
  for (const ex of trackedExercises(h)) {
    const { record, best } = exerciseStats(h, ex.key, null);
    if (!record) continue;
    const firstDate = h.workouts.find((w) => workoutLoad(w, ex.key, to) !== null)?.date;
    const age = dayDiff(record.date, today);
    const isNew = record.date !== firstDate && age >= 0 && age < NEW_RECORD_DAYS;
    out.push({ key: ex.key, name: ex.name, weight: record.value, date: record.date, oneRm: best?.oneRm ?? null, isNew });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/** Exercices pour lesquels cette séance dépasse strictement toutes les séances antérieures */
export function recordsSetBy(h: StatsHistory, workoutId: string): string[] {
  const to = displayUnits(h);
  const index = h.workouts.findIndex((w) => w.id === workoutId);
  if (index < 0) return [];
  const current = h.workouts[index];
  const keys = [...new Set(current.sets.map((s) => (s.performedName ? `${s.exerciseId}::${s.performedName}` : s.exerciseId)))];
  return keys.filter((key) => {
    const load = workoutLoad(current, key, to);
    if (load === null) return false;
    const previous = h.workouts.slice(0, index).map((w) => workoutLoad(w, key, to)).filter((x): x is number => x !== null);
    return previous.length > 0 && load > Math.max(...previous);
  });
}
```

Remplacer la construction de clé inline de `recordsSetBy` par `setKey` (exporté par `exerciseSeries.ts`) : `const keys = [...new Set(current.sets.map(setKey))];` et importer `setKey`.

- [ ] **Step 4: Relancer**

Run: `npx jest src/domain/stats && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/domain/stats
git commit -m "feat(mobile): compute exercise progression and personal records

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Résumé — série en cours, volume de la semaine, dernière séance

**Files:**
- Create: `mobile/src/domain/stats/summary.ts`
- Test: `mobile/src/domain/stats/__tests__/summary.test.ts`

**Interfaces:**
- Consumes: Task 1 (`addDays`, `mondayOf`, `dayDiff`, `weekdayOfDay`), Task 2 (`workoutVolume`, `displayUnits`, `recordsSetBy`).
- Produces:
  - `currentStreak(h: StatsHistory, today: string): number`
  - `type WeekVolume = { current: number; previous: number; deltaPct: number | null }` ; `weekVolume(h, today): WeekVolume`
  - `type LastSession = { workoutId: string; date: string; sessionName: string; sets: number; durationMin: number | null; newRecords: number }` ; `lastSession(h): LastSession | null`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/stats/__tests__/summary.test.ts` :
```ts
import { history, hs, hw } from '../../__fixtures__/statsHistory';
import { currentStreak, lastSession, weekVolume } from '../summary';
import type { ActivePlan } from '../types';

// 2026-10-07 = mercredi ; planning lundi / mercredi / vendredi
const MWF: ActivePlan = { trainDays: [1, 3, 5], units: 'kg', since: '2026-01-01' };
const done = (date: string) => hw(date, [hs('p', 100, 5)]);

describe('série en cours (planning)', () => {
  it('séances prévues consécutives faites ; aujourd\'hui pas encore fait ne casse rien', () => {
    const h = history(['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05'].map(done), MWF);
    expect(currentStreak(h, '2026-10-07')).toBe(4);
  });

  it('un jour prévu manqué depuis la dernière séance → 0', () => {
    expect(currentStreak(history(['2026-09-30', '2026-10-02'].map(done), MWF), '2026-10-07')).toBe(0);
  });

  it('un trou plus ancien coupe la série', () => {
    const h = history(['2026-09-28', '2026-10-02', '2026-10-05', '2026-10-07'].map(done), MWF);
    expect(currentStreak(h, '2026-10-07')).toBe(3);
  });

  it('séance un jour non prévu : ignorée pour la série', () => {
    expect(currentStreak(history(['2026-10-05', '2026-10-06'].map(done), MWF), '2026-10-07')).toBe(1);
  });

  it('Review Focus 2 : deux séances le même jour comptent pour un jour', () => {
    expect(currentStreak(history([done('2026-10-05'), done('2026-10-05')], MWF), '2026-10-07')).toBe(1);
  });
});

describe('série en cours (sans planning)', () => {
  it('jours calendaires consécutifs depuis aujourd\'hui, ou hier', () => {
    expect(currentStreak(history(['2026-10-05', '2026-10-06', '2026-10-07'].map(done)), '2026-10-07')).toBe(3);
    expect(currentStreak(history(['2026-10-05', '2026-10-06'].map(done)), '2026-10-07')).toBe(2);
    expect(currentStreak(history(['2026-10-05'].map(done)), '2026-10-07')).toBe(0);
    expect(currentStreak(history([]), '2026-10-07')).toBe(0);
  });
});

describe('volume de la semaine', () => {
  it('lundi → aujourd\'hui vs même plage la semaine précédente ; écart arrondi', () => {
    const h = history([
      hw('2026-09-28', [hs('p', 100, 10)]), // lun. précédent
      hw('2026-10-01', [hs('p', 100, 10)]), // jeu. précédent : hors plage (lun→mer)
      hw('2026-10-05', [hs('p', 100, 11)]),
      hw('2026-10-07', [hs('p', 50, 2)]),
    ], MWF);
    expect(weekVolume(h, '2026-10-07')).toEqual({ current: 1200, previous: 1000, deltaPct: 20 });
  });

  it('semaine précédente vide → pas d\'écart', () => {
    expect(weekVolume(history([hw('2026-10-06', [hs('p', 10, 10)])]), '2026-10-07')).toEqual({ current: 100, previous: 0, deltaPct: null });
  });

  it('Review Focus 1 : volumes en lbs convertis dans l\'unité active', () => {
    const h = history([hw('2026-10-06', [hs('p', 100, 10)], { units: 'lbs' })], MWF);
    expect(weekVolume(h, '2026-10-07').current).toBeCloseTo(453.59, 1);
  });
});

describe('dernière séance', () => {
  it('Review Focus 2 : la plus récemment terminée ; séries, durée, nouveaux records', () => {
    const h = history([
      hw('2026-10-01', [hs('p', 100, 5)]),
      hw('2026-10-05', [hs('p', 90, 5)], { completedAt: '2026-10-05T09:00:00.000Z', startedAt: '2026-10-05T08:00:00.000Z' }),
      hw('2026-10-05', [hs('p', 110, 5), hs('q', 20, 5)], { sessionName: 'PM', startedAt: '2026-10-05T17:00:00.000Z', completedAt: '2026-10-05T17:45:00.000Z' }),
    ]);
    expect(lastSession(h)).toMatchObject({ date: '2026-10-05', sessionName: 'PM', sets: 2, durationMin: 45, newRecords: 1 });
  });

  it('durée incohérente masquée ; aucune séance → null', () => {
    const odd = history([hw('2026-10-05', [], { startedAt: '2026-10-05T10:00:00.000Z', completedAt: '2026-10-05T17:00:00.000Z' })]);
    expect(lastSession(odd)?.durationMin).toBeNull();
    expect(lastSession(history([]))).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/domain/stats/__tests__/summary.test.ts`
Expected: FAIL — module `../summary` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/stats/summary.ts` :
```ts
// ============================================================
// Résumé des stats — série en cours, volume de la semaine, dernière séance
// ============================================================
import { addDays, dayDiff, mondayOf, weekdayOfDay } from './dates';
import { displayUnits, workoutVolume } from './exerciseSeries';
import { recordsSetBy } from './records';
import type { StatsHistory } from './types';

const MAX_DURATION_MIN = 6 * 60;

const doneDays = (h: StatsHistory) => new Set(h.workouts.map((w) => w.date));

export function currentStreak(h: StatsHistory, today: string): number {
  const days = doneDays(h);
  if (days.size === 0) return 0;
  const train = h.active?.trainDays ?? [];

  if (train.length === 0) {
    // Sans planning : jours calendaires consécutifs depuis aujourd'hui (ou hier)
    let cursor = days.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (days.has(cursor)) {
      n += 1;
      cursor = addDays(cursor, -1);
    }
    return n;
  }

  const isTrain = (d: string) => train.includes(weekdayOfDay(d));
  const anchor = [...days].filter((d) => d <= today && isTrain(d)).sort().pop();
  if (!anchor) return 0;
  // Un jour prévu manqué entre la dernière séance et aujourd'hui (exclu) casse la série
  for (let d = addDays(anchor, 1); d < today; d = addDays(d, 1)) {
    if (isTrain(d) && !days.has(d)) return 0;
  }
  let n = 0;
  let cursor = anchor;
  while (days.has(cursor)) {
    n += 1;
    let prev = addDays(cursor, -1);
    while (!isTrain(prev)) prev = addDays(prev, -1);
    cursor = prev;
  }
  return n;
}

export type WeekVolume = { current: number; previous: number; deltaPct: number | null };

export function weekVolume(h: StatsHistory, today: string): WeekVolume {
  const to = displayUnits(h);
  const monday = mondayOf(today);
  const span = dayDiff(monday, today);
  const prevMonday = addDays(monday, -7);
  const prevEnd = addDays(prevMonday, span);
  let current = 0;
  let previous = 0;
  for (const w of h.workouts) {
    if (w.date >= monday && w.date <= today) current += workoutVolume(w, to);
    else if (w.date >= prevMonday && w.date <= prevEnd) previous += workoutVolume(w, to);
  }
  return { current, previous, deltaPct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null };
}

export type LastSession = { workoutId: string; date: string; sessionName: string; sets: number; durationMin: number | null; newRecords: number };

export function lastSession(h: StatsHistory): LastSession | null {
  const last = h.workouts[h.workouts.length - 1];
  if (!last) return null;
  const minutes = last.completedAt ? Math.round((Date.parse(last.completedAt) - Date.parse(last.startedAt)) / 60_000) : NaN;
  return {
    workoutId: last.id,
    date: last.date,
    sessionName: last.sessionName,
    sets: last.sets.length,
    durationMin: Number.isFinite(minutes) && minutes > 0 && minutes <= MAX_DURATION_MIN ? minutes : null,
    newRecords: recordsSetBy(h, last.id).length,
  };
}
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/domain/stats && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/domain/stats
git commit -m "feat(mobile): compute streak, week volume and last session

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Assiduité — calendrier 12 semaines et taux

**Files:**
- Create: `mobile/src/domain/stats/attendance.ts`
- Test: `mobile/src/domain/stats/__tests__/attendance.test.ts`

**Interfaces:**
- Consumes: Task 1 (`addDays`, `mondayOf`, `weekdayOfDay`).
- Produces:
  - `type DayState = 'done' | 'missed' | 'rest' | 'today' | 'future'` ; `type CalendarDay = { date: string; state: DayState }`
  - `CALENDAR_WEEKS = 12` ; `attendanceCalendar(h, today, weeks = CALENDAR_WEEKS): CalendarDay[][]` (lignes lundi → dimanche, la dernière contient aujourd'hui)
  - `type AttendanceRate = { kind: 'rate'; done: number; planned: number } | { kind: 'count'; sessions: number }` ; `attendanceRate(h, today, since: string | null): AttendanceRate`

- [ ] **Step 1: Écrire les tests**

`mobile/src/domain/stats/__tests__/attendance.test.ts` :
```ts
import { history, hs, hw } from '../../__fixtures__/statsHistory';
import { attendanceCalendar, attendanceRate } from '../attendance';
import type { ActivePlan } from '../types';

const TODAY = '2026-10-07'; // mercredi
const MWF: ActivePlan = { trainDays: [1, 3, 5], units: 'kg', since: '2026-09-01' };
const done = (date: string) => hw(date, [hs('p', 100, 5)]);
const stateOf = (cal: ReturnType<typeof attendanceCalendar>, date: string) => cal.flat().find((d) => d.date === date)?.state;

describe('calendrier', () => {
  it('12 semaines lundi → dimanche, la dernière contient aujourd\'hui', () => {
    const cal = attendanceCalendar(history([], MWF), TODAY);
    expect(cal).toHaveLength(12);
    expect(cal.every((w) => w.length === 7)).toBe(true);
    expect(cal[11][0].date).toBe('2026-10-05');
    expect(cal[0][0].date).toBe('2026-07-20');
  });

  it('fait, manqué, repos, aujourd\'hui, futur', () => {
    const cal = attendanceCalendar(history(['2026-09-30', '2026-10-06'].map(done), MWF), TODAY);
    expect(stateOf(cal, '2026-09-30')).toBe('done');
    expect(stateOf(cal, '2026-10-06')).toBe('done'); // jour non prévu mais fait
    expect(stateOf(cal, '2026-10-02')).toBe('missed');
    expect(stateOf(cal, '2026-10-05')).toBe('missed');
    expect(stateOf(cal, '2026-10-04')).toBe('rest');
    expect(stateOf(cal, TODAY)).toBe('today');
    expect(stateOf(cal, '2026-10-08')).toBe('future');
  });

  it('Review Focus 4 : aucun jour manqué avant la création du programme actif', () => {
    const cal = attendanceCalendar(history([done('2026-07-22')], MWF), TODAY);
    expect(stateOf(cal, '2026-07-22')).toBe('done');
    expect(stateOf(cal, '2026-08-31')).toBe('rest'); // lundi avant since
    expect(stateOf(cal, '2026-09-02')).toBe('missed'); // mercredi après since
  });

  it('Review Focus 2 : deux séances le même jour → un seul jour fait', () => {
    const cal = attendanceCalendar(history([done('2026-10-05'), done('2026-10-05')], MWF), TODAY);
    expect(cal.flat().filter((d) => d.state === 'done')).toHaveLength(1);
  });

  it('sans programme actif : jamais de manqué', () => {
    const cal = attendanceCalendar(history([done('2026-10-05')]), TODAY);
    expect(cal.flat().some((d) => d.state === 'missed')).toBe(false);
  });
});

describe('taux', () => {
  it('jours prévus depuis since (et la création du programme) ; aujourd\'hui compté seulement s\'il est fait', () => {
    const h = history(['2026-09-28', '2026-09-30', '2026-10-05'].map(done), MWF);
    // depuis le 2026-09-28 : lun 28 ✓, mer 30 ✓, ven 2 ✗, lun 5 ✓, mer 7 (aujourd'hui, pas fait → non compté)
    expect(attendanceRate(h, TODAY, '2026-09-28')).toEqual({ kind: 'rate', done: 3, planned: 4 });
    const withToday = history(['2026-09-28', '2026-09-30', '2026-10-05', TODAY].map(done), MWF);
    expect(attendanceRate(withToday, TODAY, '2026-09-28')).toEqual({ kind: 'rate', done: 4, planned: 5 });
  });

  it('période « tout » : à partir de la création du programme', () => {
    const h = history([done('2026-08-03'), done('2026-09-02')], MWF);
    const r = attendanceRate(h, TODAY, null);
    expect(r.kind === 'rate' && r.done).toBe(1);
  });

  it('sans planning : nombre de séances de la période', () => {
    const h = history(['2026-09-01', '2026-10-01', '2026-10-01'].map(done));
    expect(attendanceRate(h, TODAY, '2026-09-10')).toEqual({ kind: 'count', sessions: 2 });
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/domain/stats/__tests__/attendance.test.ts`
Expected: FAIL — module `../attendance` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/domain/stats/attendance.ts` :
```ts
// ============================================================
// Assiduité — calendrier des dernières semaines (lundi → dimanche) et taux faites / prévues.
// Les jours prévus viennent du planning du programme actif, à partir de sa création.
// ============================================================
import { addDays, mondayOf, weekdayOfDay } from './dates';
import type { StatsHistory } from './types';

export type DayState = 'done' | 'missed' | 'rest' | 'today' | 'future';
export type CalendarDay = { date: string; state: DayState };

export const CALENDAR_WEEKS = 12;

function plannedDay(h: StatsHistory) {
  const active = h.active;
  return (d: string) => active !== null && d >= active.since && active.trainDays.includes(weekdayOfDay(d));
}

export function attendanceCalendar(h: StatsHistory, today: string, weeks = CALENDAR_WEEKS): CalendarDay[][] {
  const days = new Set(h.workouts.map((w) => w.date));
  const planned = plannedDay(h);
  const start = addDays(mondayOf(today), -7 * (weeks - 1));
  const rows: CalendarDay[][] = [];
  for (let r = 0; r < weeks; r += 1) {
    const row: CalendarDay[] = [];
    for (let c = 0; c < 7; c += 1) {
      const date = addDays(start, r * 7 + c);
      let state: DayState;
      if (date > today) state = 'future';
      else if (days.has(date)) state = 'done';
      else if (date === today) state = 'today';
      else state = planned(date) ? 'missed' : 'rest';
      row.push({ date, state });
    }
    rows.push(row);
  }
  return rows;
}

export type AttendanceRate = { kind: 'rate'; done: number; planned: number } | { kind: 'count'; sessions: number };

export function attendanceRate(h: StatsHistory, today: string, since: string | null): AttendanceRate {
  const active = h.active;
  if (!active || active.trainDays.length === 0) {
    return { kind: 'count', sessions: h.workouts.filter((w) => (since === null || w.date >= since) && w.date <= today).length };
  }
  const days = new Set(h.workouts.map((w) => w.date));
  const planned = plannedDay(h);
  const start = since === null || since < active.since ? active.since : since;
  let done = 0;
  let total = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (!planned(d)) continue;
    if (d === today && !days.has(d)) continue;
    total += 1;
    if (days.has(d)) done += 1;
  }
  return { kind: 'rate', done, planned: total };
}
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/domain/stats && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/domain/stats
git commit -m "feat(mobile): compute attendance calendar and rate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `statsRepo.readHistory`, réglage `statsPeriod`, vraie sauvegarde

**Files:**
- Create: `mobile/src/db/repos/statsRepo.ts`, `mobile/src/db/__tests__/statsRepo.test.ts`
- Modify: `mobile/src/db/repos/settingsRepo.ts` (clé `statsPeriod`)

**Interfaces:**
- Consumes: Task 1 (`StatsHistory`, `StatsPeriod`), `getActiveProgram`, `resolveDay`, `WEEKDAYS`, `localDateKey`, `parseProgram`.
- Produces: `readHistory(ctx: RepoCtx): StatsHistory` ; `SettingsMap.statsPeriod: StatsPeriod`.

Règle de planning (spec : « jour prévu par le planning ») : un jour est prévu s'il résout vers une séance (`resolveDay`) dont le `type` n'est pas `'rest'` — une séance de repos explicite n'est pas une séance à faire.

- [ ] **Step 1: Écrire les tests**

`mobile/src/db/__tests__/statsRepo.test.ts` :
```ts
/** @jest-environment node */
import example from '@/data/program.example.json';
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { attendanceCalendar } from '@/domain/stats/attendance';
import { exerciseStats, trackedExercises } from '@/domain/stats/exerciseSeries';
import { personalRecords } from '@/domain/stats/records';
import { currentStreak, lastSession } from '@/domain/stats/summary';
import { replaceAll } from '../repos/importRepo';
import { createProgram, setActiveProgram, softDeleteProgram } from '../repos/programsRepo';
import { readHistory } from '../repos/statsRepo';
import { completeWorkout, ensureWorkout, upsertSet } from '../repos/workoutsRepo';
import { createTestCtx } from '../testing/createTestCtx';

describe('statsRepo.readHistory', () => {
  it('séances terminées seulement, séries faites seulement, triées', () => {
    const ctx = createTestCtx('2026-10-01T08:00:00.000Z');
    const p = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, p.id);
    const a = ensureWorkout(ctx, { programId: p.id, sessionKey: 'full-body', date: '2026-10-05' });
    upsertSet(ctx, a.id, 'presse-cuisses', 0, { done: true, weight: 100, reps: 8 });
    upsertSet(ctx, a.id, 'presse-cuisses', 1, { done: false, weight: 100 });
    completeWorkout(ctx, a.id);
    const b = ensureWorkout(ctx, { programId: p.id, sessionKey: 'full-body', date: '2026-10-07' }); // en cours
    upsertSet(ctx, b.id, 'presse-cuisses', 0, { done: true, weight: 110, reps: 8 });

    const h = readHistory(ctx);
    expect(h.workouts.map((w) => w.date)).toEqual(['2026-10-05']);
    expect(h.workouts[0]).toMatchObject({ sessionName: 'FULL BODY', units: 'kg', sets: [{ exerciseId: 'presse-cuisses', performedName: null, weight: 100, reps: 8 }] });
    expect(h.exerciseNames['presse-cuisses']).toBe('Presse à cuisses');
    expect(h.active).toEqual({ trainDays: [1, 3, 5], units: 'kg', since: '2026-10-01' });
  });

  it('Review Focus 5 : historique d\'un programme supprimé conservé, noms compris', () => {
    const ctx = createTestCtx();
    const gone = createProgram(ctx, example, 'example');
    const w = ensureWorkout(ctx, { programId: gone.id, sessionKey: 'full-body', date: '2026-10-05' });
    upsertSet(ctx, w.id, 'presse-cuisses', 0, { done: true, weight: 100, reps: 8 });
    completeWorkout(ctx, w.id);
    softDeleteProgram(ctx, gone.id);
    const h = readHistory(ctx);
    expect(h.workouts).toHaveLength(1);
    expect(h.workouts[0].sessionName).toBe('FULL BODY');
    expect(h.exerciseNames['presse-cuisses']).toBe('Presse à cuisses');
    expect(h.active).toBeNull();
  });

  it('base vide', () => {
    expect(readHistory(createTestCtx())).toEqual({ workouts: [], exerciseNames: {}, active: null });
  });
});

describe('stats sur la vraie sauvegarde (anonymisée)', () => {
  const TODAY = '2026-10-07';
  function restored() {
    const r = parseLegacyBackup(backup as Record<string, unknown>, TODAY);
    if (!r.ok) throw new Error('fixture invalide');
    const ctx = createTestCtx();
    replaceAll(ctx, r.bundle);
    return readHistory(ctx);
  }

  it('7 séances terminées, 21 exercices suivis, dernière séance du 24 juillet sans nouveau record', () => {
    const h = restored();
    expect(h.workouts).toHaveLength(7);
    expect(trackedExercises(h)).toHaveLength(21);
    expect(lastSession(h)).toMatchObject({ date: '2026-07-24', sessionName: 'BAS DU CORPS', newRecords: 0 });
    expect(currentStreak(h, TODAY)).toBe(0);
  });

  it('records : presse 110 kg atteint le 12 juin, tirage vertical 40 kg le 1er juillet ; aucun « nouveau »', () => {
    const h = restored();
    expect(exerciseStats(h, 'presse-cuisses-vend', null).record).toEqual({ value: 110, date: '2026-06-12' });
    expect(exerciseStats(h, 'tirage-vertical', null).record).toEqual({ value: 40, date: '2026-07-01' });
    expect(personalRecords(h, TODAY).some((r) => r.isNew)).toBe(false);
  });

  it('calendrier : la séance du 24 juillet est dans la première semaine affichée', () => {
    const cal = attendanceCalendar(restored(), TODAY);
    expect(cal[0].find((d) => d.date === '2026-07-24')?.state).toBe('done');
  });
});
```

Vérifié dans `src/data/program.example.json` : séance `full-body` = « FULL BODY », exercice `presse-cuisses` = « Presse à cuisses », planning `{1: full-body, 3: haut-du-corps, 5: bas-du-corps}`.

- [ ] **Step 2: Lancer**

Run: `npx jest src/db/__tests__/statsRepo.test.ts`
Expected: FAIL — module `../repos/statsRepo` introuvable.

- [ ] **Step 3: Implémenter**

`settingsRepo.ts` — importer `import type { StatsPeriod } from '@/domain/stats/period';` et ajouter à `SettingsMap` :
```ts
  /** Période des stats */
  statsPeriod: StatsPeriod;
```

`mobile/src/db/repos/statsRepo.ts` :
```ts
// ============================================================
// Stats — lecture de l'historique (séances terminées, séries faites).
// Les programmes supprimés restent lus pour les noms et les unités.
// ============================================================
import { and, asc, eq, isNull } from 'drizzle-orm';
import { parseProgram, type Program } from '@/domain/program';
import { localDateKey, resolveDay, WEEKDAYS } from '@/domain/schedule';
import type { ActivePlan, HistoryWorkout, StatsHistory } from '@/domain/stats/types';
import { programs, setEntries, workouts } from '../schema';
import type { RepoCtx } from '../types';
import { getActiveProgram } from './programsRepo';

function parseDefinition(text: string): Program | null {
  try {
    const parsed = parseProgram(JSON.parse(text));
    return parsed.ok ? parsed.program : null;
  } catch {
    return null;
  }
}

function addNames(names: Record<string, string>, def: Program) {
  for (const s of Object.values(def.sessions)) {
    for (const ex of [...s.exercises, ...(s.bonus?.exercises ?? [])]) names[ex.id] ??= ex.name;
  }
}

export function readHistory(ctx: RepoCtx): StatsHistory {
  const activeStored = getActiveProgram(ctx);
  const defs = new Map<string, Program | null>(
    ctx.db.select({ id: programs.id, definition: programs.definition }).from(programs).all()
      .map((p) => [p.id, parseDefinition(p.definition)]),
  );

  const names: Record<string, string> = {};
  if (activeStored) addNames(names, activeStored.definition);
  for (const def of defs.values()) if (def) addNames(names, def);

  const rows = ctx.db.select().from(workouts)
    .where(and(eq(workouts.status, 'completed'), isNull(workouts.deletedAt)))
    .orderBy(asc(workouts.date), asc(workouts.completedAt), asc(workouts.id)).all();
  const sets = ctx.db.select({
    workoutId: setEntries.workoutId, exerciseId: setEntries.exerciseId, performedName: setEntries.performedName,
    weight: setEntries.weight, reps: setEntries.reps,
  }).from(setEntries)
    .innerJoin(workouts, eq(setEntries.workoutId, workouts.id))
    .where(and(eq(setEntries.done, true), isNull(setEntries.deletedAt), eq(workouts.status, 'completed'), isNull(workouts.deletedAt)))
    .orderBy(asc(setEntries.workoutId), asc(setEntries.exerciseId), asc(setEntries.setIndex)).all();

  const activeUnits = activeStored?.definition.meta.units ?? 'kg';
  const byWorkout = new Map<string, HistoryWorkout>();
  const list: HistoryWorkout[] = rows.map((r) => {
    const def = defs.get(r.programId) ?? null;
    const session = def && Object.hasOwn(def.sessions, r.sessionKey) ? def.sessions[r.sessionKey] : null;
    const w: HistoryWorkout = {
      id: r.id, date: r.date, sessionKey: r.sessionKey, sessionName: session?.name ?? r.sessionKey,
      units: def?.meta.units ?? activeUnits, startedAt: r.startedAt, completedAt: r.completedAt, sets: [],
    };
    byWorkout.set(r.id, w);
    return w;
  });
  for (const s of sets) {
    byWorkout.get(s.workoutId)?.sets.push({ exerciseId: s.exerciseId, performedName: s.performedName, weight: s.weight, reps: s.reps });
  }

  let active: ActivePlan | null = null;
  if (activeStored) {
    const def = activeStored.definition;
    const trainDays = WEEKDAYS.filter((d) => {
      const plan = resolveDay(def, d);
      return plan.kind === 'session' && plan.session.type !== 'rest';
    });
    active = { trainDays, units: def.meta.units, since: localDateKey(new Date(activeStored.createdAt)) };
  }
  return { workouts: list, exerciseNames: names, active };
}
```

- [ ] **Step 4: Relancer**

Run: `npx jest src/db src/domain && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/db src/domain
git commit -m "feat(mobile): read completed workout history for stats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `react-native-svg`, courbe et calendrier

**Files:**
- Create: `mobile/src/features/stats/LineChart.tsx`, `mobile/src/features/stats/AttendanceCalendar.tsx`, `mobile/src/features/stats/__tests__/charts.test.tsx`
- Modify: `mobile/package.json` (via `expo install`)

**Interfaces:**
- Consumes: `CalendarDay` (Task 4), thème, i18n (`tList('days_short')`, indexé dimanche = 0).
- Produces:
  - `LineChart({ points, recordIndex, height? }: { points: { value: number; label: string }[]; recordIndex: number; height?: number })` — un cercle par point (`testID="chart-point"`, le record `testID="chart-record"`), étiquettes du premier, du dernier et du record.
  - `AttendanceCalendar({ weeks }: { weeks: CalendarDay[][] })` — case `testID={`cal-${date}`}` avec `accessibilityLabel` = `${date} ${state}`.

- [ ] **Step 1: Installer**

Run: `npx expo install react-native-svg`
Expected: `react-native-svg` ajouté à `package.json` (version du SDK 57).

- [ ] **Step 2: Écrire les tests**

`mobile/src/features/stats/__tests__/charts.test.tsx` :
```tsx
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { AttendanceCalendar } from '../AttendanceCalendar';
import { LineChart } from '../LineChart';

describe('LineChart', () => {
  it('un point par valeur, le record distinct, étiquettes premier / dernier / record', async () => {
    const points = [{ value: 100, label: '100' }, { value: 120, label: '120' }, { value: 110, label: '110' }];
    await renderWithProviders(<LineChart points={points} recordIndex={1} />);
    expect(screen.getAllByTestId(/^chart-(point|record)$/)).toHaveLength(3);
    expect(screen.getAllByTestId('chart-record')).toHaveLength(1);
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('120')).toBeTruthy();
    expect(screen.getByText('110')).toBeTruthy();
  });

  it('un seul point (record) : pas de plantage, étiquette unique', async () => {
    await renderWithProviders(<LineChart points={[{ value: 80, label: '80' }]} recordIndex={0} />);
    expect(screen.getAllByTestId('chart-record')).toHaveLength(1);
    expect(screen.getAllByText('80')).toHaveLength(1);
  });
});

describe('AttendanceCalendar', () => {
  it('une case par jour, état lisible ; en-tête lundi → dimanche', async () => {
    const weeks = [[
      { date: '2026-10-05', state: 'done' as const }, { date: '2026-10-06', state: 'rest' as const },
      { date: '2026-10-07', state: 'today' as const }, { date: '2026-10-08', state: 'future' as const },
      { date: '2026-10-09', state: 'future' as const }, { date: '2026-10-10', state: 'future' as const },
      { date: '2026-10-11', state: 'future' as const },
    ]];
    await renderWithProviders(<AttendanceCalendar weeks={weeks} />);
    expect(screen.getByTestId('cal-2026-10-05').props.accessibilityLabel).toBe('2026-10-05 done');
    expect(screen.getAllByTestId(/^cal-/)).toHaveLength(7);
    expect(screen.getByText('Lun')).toBeTruthy();
  });
});
```

`days_short` (fr) = « Dim, Lun, Mar, Mer, Jeu, Ven, Sam » (indexé dimanche = 0).

- [ ] **Step 3: Lancer**

Run: `npx jest src/features/stats`
Expected: FAIL — modules `../LineChart` et `../AttendanceCalendar` introuvables.

- [ ] **Step 4: Implémenter**

`mobile/src/features/stats/LineChart.tsx` :
```tsx
// Courbe SVG : ligne, un cercle par point, record en or, étiquettes premier / dernier / record
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  points: { value: number; label: string }[];
  recordIndex: number;
  height?: number;
}

const PAD_X = 24;
const PAD_TOP = 22;
const PAD_BOTTOM = 12;

export function LineChart({ points, recordIndex, height = 160 }: Props) {
  const { colors, fonts } = useTheme();
  // Largeur par défaut avant la mesure (et en test, où onLayout ne se déclenche pas)
  const [width, setWidth] = useState(320);
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => (points.length === 1 ? width / 2 : PAD_X + (i * (width - 2 * PAD_X)) / (points.length - 1));
  const y = (v: number) => (max === min ? height / 2 : PAD_TOP + ((max - v) * (height - PAD_TOP - PAD_BOTTOM)) / (max - min));
  const labelled = [...new Set([0, points.length - 1, recordIndex])].filter((i) => i >= 0 && i < points.length);

  return (
    <View onLayout={(e) => setWidth(Math.max(120, e.nativeEvent.layout.width))} style={{ height }}>
      <Svg width={width} height={height}>
        {points.length > 1 ? (
          <Polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke={colors.goldDim} strokeWidth={2} />
        ) : null}
        {points.map((p, i) => (
          <Circle
            key={i}
            testID={i === recordIndex ? 'chart-record' : 'chart-point'}
            cx={x(i)}
            cy={y(p.value)}
            r={i === recordIndex ? 6 : 4}
            fill={i === recordIndex ? colors.gold : colors.goldDim}
            stroke={i === recordIndex ? colors.text : 'none'}
            strokeWidth={i === recordIndex ? 1.5 : 0}
          />
        ))}
        {labelled.map((i) => (
          <SvgText key={`l${i}`} x={x(i)} y={y(points[i].value) - 10} fill={i === recordIndex ? colors.gold : colors.textDim} fontSize={11} fontFamily={fonts.uiBold} textAnchor="middle">
            {points[i].label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
```

`mobile/src/features/stats/AttendanceCalendar.tsx` :
```tsx
// Calendrier d'assiduité : 7 colonnes (lundi → dimanche) × N semaines
import { StyleSheet, Text, View } from 'react-native';
import type { CalendarDay, DayState } from '@/domain/stats/attendance';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function AttendanceCalendar({ weeks }: { weeks: CalendarDay[][] }) {
  const { colors, fonts, radius } = useTheme();
  const { tList } = useI18n();
  const short = tList('days_short');
  const header = [1, 2, 3, 4, 5, 6, 0].map((d) => short[d] ?? '');

  const cellStyle = (state: DayState) => {
    switch (state) {
      case 'done': return { backgroundColor: colors.gold };
      case 'missed': return { borderWidth: 1.5, borderColor: colors.rust };
      case 'today': return { borderWidth: 1.5, borderColor: colors.gold, backgroundColor: colors.bgCardSoft };
      case 'future': return { borderWidth: 1, borderColor: colors.border };
      default: return { backgroundColor: colors.bgCardSoft };
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        {header.map((h, i) => (
          <Text key={i} style={[styles.head, { color: colors.textDim, fontFamily: fonts.uiBold }]}>{h}</Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0].date} style={styles.row}>
          {week.map((d) => (
            <View
              key={d.date}
              testID={`cal-${d.date}`}
              accessibilityLabel={`${d.date} ${d.state}`}
              style={[styles.cell, { borderRadius: radius.sm / 2 }, cellStyle(d.state)]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  row: { flexDirection: 'row', gap: 4 },
  head: { flex: 1, textAlign: 'center', fontSize: 10, letterSpacing: 1 },
  cell: { flex: 1, aspectRatio: 1 },
});
```

Si `react-native-svg` échoue au rendu sous Jest (module natif introuvable), ajouter dans `src/test/jestSetup.js` un mock qui rend chaque composant SVG comme une `View` en conservant ses props (`testID`, enfants), et ledger la ruling :
```js
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  const make = (name) => {
    const C = ({ children, ...props }) => React.createElement(View, props, children);
    C.displayName = name;
    return C;
  };
  const SvgText = ({ children, ...props }) => React.createElement(Text, props, children);
  return { __esModule: true, default: make('Svg'), Svg: make('Svg'), Circle: make('Circle'), Polyline: make('Polyline'), Text: SvgText };
});
```

- [ ] **Step 5: Relancer**

Run: `npx jest src/features/stats && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.json src/features/stats src/test
git commit -m "feat(mobile): add SVG line chart and attendance calendar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Chaînes M4b (fr/en) et formatage

**Files:**
- Create: `mobile/src/features/stats/format.ts`, `mobile/src/features/stats/__tests__/format.test.ts`
- Modify: `mobile/src/i18n/locales/fr.json`, `mobile/src/i18n/locales/en.json`

**Interfaces:**
- Produces:
  - `formatNumber(n: number, lang: Lang): string` (entier, séparateur de milliers de la langue)
  - `formatLoad(n: number, lang: Lang): string` (arrondi au 0,5 ; virgule décimale en fr, point en en ; pas de `,0`)
  - `formatDay(key: string, daysShort: string[], monthsShort: string[]): string` (via `formatShortDate`)
  - Les clés i18n ci-dessous.

- [ ] **Step 1: Écrire le test**

`mobile/src/features/stats/__tests__/format.test.ts` :
```ts
import { formatDay, formatLoad, formatNumber } from '../format';

describe('formatage stats', () => {
  it('nombres entiers avec séparateur de milliers', () => {
    expect(formatNumber(12450.4, 'en')).toBe('12,450');
    expect(formatNumber(12450.4, 'fr').replace(/\s/g, ' ')).toBe('12 450');
  });
  it('charges au 0,5, virgule en français, sans décimale inutile', () => {
    expect(formatLoad(45.36, 'fr')).toBe('45,5');
    expect(formatLoad(45.36, 'en')).toBe('45.5');
    expect(formatLoad(110, 'fr')).toBe('110');
  });
  it('jour court', () => {
    const days = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
    const months = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];
    expect(formatDay('2026-07-24', days, months)).toBe('VEN, 24 JUIL');
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/stats/__tests__/format.test.ts`
Expected: FAIL — module `../format` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/stats/format.ts` :
```ts
// Formatage des stats selon la langue
import type { Lang } from '@/domain/prefs';
import { parseDay } from '@/domain/stats/dates';
import { roundLoad } from '@/domain/stats/units';
import { formatShortDate } from '@/features/today/formatDate';

const locale = (lang: Lang) => (lang === 'fr' ? 'fr-FR' : 'en-US');

export function formatNumber(n: number, lang: Lang): string {
  return Math.round(n).toLocaleString(locale(lang), { maximumFractionDigits: 0 });
}

export function formatLoad(n: number, lang: Lang): string {
  const v = roundLoad(n);
  const text = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return lang === 'fr' ? text.replace('.', ',') : text;
}

export function formatDay(key: string, daysShort: string[], monthsShort: string[]): string {
  return formatShortDate(parseDay(key), daysShort, monthsShort);
}
```

Clés i18n — ajouter avant `"coming_soon"` dans les deux fichiers (le parité est vérifiée par `translate.test.ts`) :

fr :
```json
  "stats_empty": "Termine ta première séance pour voir tes stats",
  "stats_card_streak": "Série en cours",
  "stats_streak_unit_one": "séance prévue",
  "stats_streak_unit": "séances prévues",
  "stats_streak_unit_days_one": "jour",
  "stats_streak_unit_days": "jours",
  "stats_delta_fmt": "%s vs semaine dernière",
  "stats_sets_fmt": "%s séries",
  "stats_duration_fmt": "%s min",
  "stats_new_records_one": "1 nouveau record",
  "stats_new_records": "%s nouveaux records",
  "stats_period_4w": "4 sem.",
  "stats_period_3m": "3 mois",
  "stats_period_1y": "1 an",
  "stats_period_all": "Tout",
  "stats_metric_load": "Charge max",
  "stats_metric_onerm": "1RM estimé",
  "stats_record_load": "Record de charge",
  "stats_best_set": "Meilleure série",
  "stats_onerm": "1RM estimé",
  "stats_volume_period": "Volume (période)",
  "stats_attendance_title": "Assiduité",
  "stats_rate_fmt": "%s / %s séances prévues (%s %)",
  "stats_count_one": "1 séance sur la période",
  "stats_count_fmt": "%s séances sur la période",
  "stats_records_title": "Records",
  "stats_new_badge": "Nouveau",
  "stats_legend_done": "Fait",
  "stats_legend_missed": "Manqué",
  "stats_legend_rest": "Repos",
```

en :
```json
  "stats_empty": "Finish your first session to see your stats",
  "stats_card_streak": "Current streak",
  "stats_streak_unit_one": "planned session",
  "stats_streak_unit": "planned sessions",
  "stats_streak_unit_days_one": "day",
  "stats_streak_unit_days": "days",
  "stats_delta_fmt": "%s vs last week",
  "stats_sets_fmt": "%s sets",
  "stats_duration_fmt": "%s min",
  "stats_new_records_one": "1 new record",
  "stats_new_records": "%s new records",
  "stats_period_4w": "4 wk",
  "stats_period_3m": "3 mo",
  "stats_period_1y": "1 yr",
  "stats_period_all": "All",
  "stats_metric_load": "Max load",
  "stats_metric_onerm": "Est. 1RM",
  "stats_record_load": "Load record",
  "stats_best_set": "Best set",
  "stats_onerm": "Est. 1RM",
  "stats_volume_period": "Volume (period)",
  "stats_attendance_title": "Attendance",
  "stats_rate_fmt": "%s / %s planned sessions (%s%)",
  "stats_count_one": "1 session in this period",
  "stats_count_fmt": "%s sessions in this period",
  "stats_records_title": "Records",
  "stats_new_badge": "New",
  "stats_legend_done": "Done",
  "stats_legend_missed": "Missed",
  "stats_legend_rest": "Rest",
```

Clés existantes réutilisées : `stats_title`, `stats_week_vol`, `stats_last_session`, `stats_progress_title`, `stats_no_weight`, `days_short`, `months_short`.

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/stats src/i18n && npx tsc --noEmit`
Expected: PASS (dont la parité fr/en), tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/features/stats src/i18n/locales
git commit -m "feat(mobile): add stats strings and formatting helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Écran Stats — sections, période, route

**Files:**
- Create: `mobile/src/features/stats/SummaryCards.tsx`, `ExerciseSection.tsx`, `AttendanceSection.tsx`, `RecordsList.tsx`, `StatsScreen.tsx`, `mobile/src/features/stats/__tests__/StatsScreen.test.tsx`
- Modify: `mobile/src/app/(tabs)/stats.tsx` (remplacement complet)

**Interfaces:**
- Consumes: Tasks 1–7 ; `Segmented` (`@/features/profile/Segmented`) ; `Screen`, `useDbQuery`, `getSetting`/`setSetting`, `usePrefs.bumpData`.
- Produces: `StatsScreen()` ; route Stats.

- [ ] **Step 1: Écrire les tests**

`mobile/src/features/stats/__tests__/StatsScreen.test.tsx` :
```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { replaceAll } from '@/db/repos/importRepo';
import { getSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { StatsScreen } from '../StatsScreen';

function restoredCtx() {
  const ctx = createTestCtx();
  const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
  if (!r.ok) throw new Error('fixture invalide');
  replaceAll(ctx, r.bundle);
  return ctx;
}

describe('StatsScreen', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 7, 10)); // mercredi 7 oct. 2026
    await act(async () => { usePrefs.setState(PREFS_INITIAL); });
  });
  afterEach(() => jest.useRealTimers());

  it('sans séance terminée : message d\'accueil seulement', async () => {
    await renderWithProviders(<StatsScreen />, { ctx: createTestCtx() });
    expect(screen.getByText('Termine ta première séance pour voir tes stats')).toBeTruthy();
    expect(screen.queryByText('Records'.toUpperCase())).toBeNull();
  });

  it('vraie sauvegarde : résumé, dernière séance, records', async () => {
    await renderWithProviders(<StatsScreen />, { ctx: restoredCtx() });
    expect(screen.getByText('BAS DU CORPS')).toBeTruthy();
    expect(screen.getByText('RECORDS')).toBeTruthy();
    expect(screen.getAllByText('Presse à cuisses').length).toBeGreaterThan(0);
  });

  it('période « Tout » mémorisée ; exercice choisi ; 3 points ; bascule 1RM', async () => {
    const ctx = restoredCtx();
    await renderWithProviders(<StatsScreen />, { ctx });
    await fireEvent.press(screen.getByRole('button', { name: 'Tout' }));
    expect(getSetting(ctx, 'statsPeriod')).toBe('all');
    await fireEvent.press(screen.getByRole('button', { name: 'Tirage vertical' }));
    expect(screen.getAllByTestId(/^chart-(point|record)$/)).toHaveLength(3);
    expect(screen.getByText('40 kg')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '1RM estimé' }));
    expect(screen.getAllByTestId(/^chart-(point|record)$/)).toHaveLength(3);
  });

  it('période courte : exercice sans point dans la période → message, pas de courbe', async () => {
    await renderWithProviders(<StatsScreen />, { ctx: restoredCtx() });
    await fireEvent.press(screen.getByRole('button', { name: '4 sem.' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tirage vertical' }));
    expect(screen.queryAllByTestId(/^chart-(point|record)$/)).toHaveLength(0);
  });

  it('Review Focus 3 : exercice au poids du corps → message dédié', async () => {
    await renderWithProviders(<StatsScreen />, { ctx: restoredCtx() });
    await fireEvent.press(screen.getByRole('button', { name: 'Tout' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Gainage' }));
    expect(screen.getByText(/Aucune charge enregistrée/)).toBeTruthy();
  });
});
```

Noms vérifiés dans la fixture : `tirage-vertical` = « Tirage vertical », `gainage-vend` = « Gainage ».

- [ ] **Step 2: Lancer**

Run: `npx jest src/features/stats/__tests__/StatsScreen.test.tsx`
Expected: FAIL — module `../StatsScreen` introuvable.

- [ ] **Step 3: Implémenter**

`mobile/src/features/stats/SummaryCards.tsx` :
```tsx
// Stats · résumé : série en cours, volume de la semaine, dernière séance
import { StyleSheet, Text, View } from 'react-native';
import type { Units } from '@/domain/program';
import type { LastSession, WeekVolume } from '@/domain/stats/summary';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDay, formatNumber } from './format';

interface Props {
  streak: number;
  /** true : la série compte des séances prévues ; false : des jours calendaires */
  plannedStreak: boolean;
  week: WeekVolume;
  last: LastSession | null;
  units: Units;
}

export function SummaryCards({ streak, plannedStreak, week, last, units }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t, tList, lang } = useI18n();
  const card = [styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.lg }];
  const label = [styles.label, { color: colors.textDim, fontFamily: fonts.uiBold }];
  const big = [styles.big, { color: colors.text, fontFamily: fonts.display }];
  const dim = { color: colors.textDim, fontFamily: fonts.ui };
  const streakUnit = plannedStreak
    ? (streak === 1 ? t('stats_streak_unit_one') : t('stats_streak_unit'))
    : (streak === 1 ? t('stats_streak_unit_days_one') : t('stats_streak_unit_days'));
  const delta = week.deltaPct === null ? null : `${week.deltaPct > 0 ? '+' : ''}${week.deltaPct} %`;

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={[card, styles.half]}>
          <Text style={label}>{t('stats_card_streak').toUpperCase()}</Text>
          <Text style={big}>{streak}</Text>
          <Text style={dim}>{streakUnit}</Text>
        </View>
        <View style={[card, styles.half]}>
          <Text style={label}>{t('stats_week_vol').toUpperCase()}</Text>
          <Text style={big}>{`${formatNumber(week.current, lang)} ${units}`}</Text>
          {delta ? <Text style={{ color: (week.deltaPct ?? 0) >= 0 ? colors.gold : colors.rust, fontFamily: fonts.ui }}>{t('stats_delta_fmt', delta)}</Text> : null}
        </View>
      </View>
      {last ? (
        <View style={card}>
          <Text style={label}>{t('stats_last_session').toUpperCase()}</Text>
          <Text style={[styles.session, { color: colors.text, fontFamily: fonts.display }]}>{last.sessionName}</Text>
          <Text style={dim}>
            {[formatDay(last.date, tList('days_short'), tList('months_short')), t('stats_sets_fmt', last.sets), last.durationMin !== null ? t('stats_duration_fmt', last.durationMin) : null]
              .filter(Boolean).join(' · ')}
          </Text>
          {last.newRecords > 0 ? (
            <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>
              {last.newRecords === 1 ? t('stats_new_records_one') : t('stats_new_records', last.newRecords)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  card: { borderWidth: 1, padding: 14, gap: 4 },
  label: { fontSize: 11, letterSpacing: 1.5 },
  big: { fontSize: 30 },
  session: { fontSize: 24 },
});
```

`mobile/src/features/stats/ExerciseSection.tsx` :
```tsx
// Stats · progression par exercice : pastilles, bascule Charge / 1RM, courbe, chiffres
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { displayUnits, exerciseSeries, exerciseStats, trackedExercises, type SeriesMetric } from '@/domain/stats/exerciseSeries';
import type { StatsHistory } from '@/domain/stats/types';
import { Segmented } from '@/features/profile/Segmented';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { formatDay, formatLoad, formatNumber } from './format';
import { LineChart } from './LineChart';

export function ExerciseSection({ history, since }: { history: StatsHistory; since: string | null }) {
  const { colors, fonts, radius } = useTheme();
  const { t, tList, lang } = useI18n();
  const exercises = trackedExercises(history);
  const [selected, setSelected] = useState<string | null>(null);
  const [metric, setMetric] = useState<SeriesMetric>('load');
  const current = exercises.find((e) => e.key === selected) ?? exercises[0];
  if (!current) return null;

  const units = displayUnits(history);
  const series = exerciseSeries(history, current.key, metric, since);
  const stats = exerciseStats(history, current.key, since);
  const recordIndex = series.reduce((best, p, i) => (p.value >= series[best].value ? i : best), 0);
  const day = (key: string) => formatDay(key, tList('days_short'), tList('months_short'));
  const label = [styles.label, { color: colors.textDim, fontFamily: fonts.uiBold }];
  const value = { color: colors.text, fontFamily: fonts.uiBold };

  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('stats_progress_title').toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {exercises.map((e) => {
          const active = e.key === current.key;
          return (
            <Pressable
              key={e.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(e.key)}
              style={[styles.chip, { borderRadius: radius.full, borderColor: active ? colors.gold : colors.border, backgroundColor: active ? colors.gold : 'transparent' }]}
            >
              <Text style={{ color: active ? '#0a0a0a' : colors.text, fontFamily: fonts.uiMedium }}>{e.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {stats.record === null ? (
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('stats_no_weight')}</Text>
      ) : (
        <>
          <Segmented<SeriesMetric>
            options={[{ value: 'load', label: t('stats_metric_load') }, { value: 'oneRm', label: t('stats_metric_onerm') }]}
            value={metric}
            onChange={setMetric}
          />
          {series.length > 0 ? (
            <LineChart points={series.map((p) => ({ value: p.value, label: formatLoad(p.value, lang) }))} recordIndex={recordIndex} />
          ) : (
            <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('stats_no_sessions')}</Text>
          )}
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Text style={label}>{t('stats_record_load').toUpperCase()}</Text>
              <Text style={value}>{`${formatLoad(stats.record.value, lang)} ${units}`}</Text>
              <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{day(stats.record.date)}</Text>
            </View>
            {stats.best ? (
              <View style={styles.cell}>
                <Text style={label}>{t('stats_best_set').toUpperCase()}</Text>
                <Text style={value}>{`${formatLoad(stats.best.weight, lang)} ${units} × ${stats.best.reps}`}</Text>
                <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{`${t('stats_onerm')} ${formatLoad(stats.best.oneRm, lang)} ${units}`}</Text>
              </View>
            ) : null}
            <View style={styles.cell}>
              <Text style={label}>{t('stats_volume_period').toUpperCase()}</Text>
              <Text style={value}>{`${formatNumber(stats.volume, lang)} ${units}`}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { minHeight: TOUCH_MIN, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { minWidth: '45%', flexGrow: 1, gap: 2 },
  label: { fontSize: 10, letterSpacing: 1.2 },
});
```

`mobile/src/features/stats/AttendanceSection.tsx` :
```tsx
// Stats · assiduité : taux sur la période + calendrier 12 semaines
import { StyleSheet, Text, View } from 'react-native';
import { attendanceCalendar, attendanceRate } from '@/domain/stats/attendance';
import type { StatsHistory } from '@/domain/stats/types';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { AttendanceCalendar } from './AttendanceCalendar';

export function AttendanceSection({ history, today, since }: { history: StatsHistory; today: string; since: string | null }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const rate = attendanceRate(history, today, since);
  const text = rate.kind === 'rate'
    ? t('stats_rate_fmt', rate.done, rate.planned, rate.planned > 0 ? Math.round((rate.done / rate.planned) * 100) : 0)
    : rate.sessions === 1 ? t('stats_count_one') : t('stats_count_fmt', rate.sessions);
  const legend = (color: string, key: 'stats_legend_done' | 'stats_legend_missed' | 'stats_legend_rest', outline = false) => (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, outline ? { borderWidth: 1.5, borderColor: color } : { backgroundColor: color }]} />
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t(key)}</Text>
    </View>
  );
  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('stats_attendance_title').toUpperCase()}</Text>
      <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{text}</Text>
      <AttendanceCalendar weeks={attendanceCalendar(history, today)} />
      <View style={styles.legend}>
        {legend(colors.gold, 'stats_legend_done')}
        {legend(colors.rust, 'stats_legend_missed', true)}
        {legend(colors.bgCardSoft, 'stats_legend_rest')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
});
```

`mobile/src/features/stats/RecordsList.tsx` :
```tsx
// Stats · records personnels (tout l'historique), badge « Nouveau »
import { StyleSheet, Text, View } from 'react-native';
import type { Units } from '@/domain/program';
import type { PersonalRecord } from '@/domain/stats/records';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDay, formatLoad } from './format';

export function RecordsList({ records, units }: { records: PersonalRecord[]; units: Units }) {
  const { colors, fonts, radius } = useTheme();
  const { t, tList, lang } = useI18n();
  if (records.length === 0) return null;
  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('stats_records_title').toUpperCase()}</Text>
      {records.map((r) => (
        <View key={r.key} style={[styles.row, { borderColor: colors.border }]}>
          <View style={styles.flex}>
            <Text style={{ color: colors.text, fontFamily: fonts.uiMedium }}>{r.name}</Text>
            <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>
              {formatDay(r.date, tList('days_short'), tList('months_short'))}
              {r.oneRm !== null ? ` · ${t('stats_onerm')} ${formatLoad(r.oneRm, lang)} ${units}` : ''}
            </Text>
          </View>
          {r.isNew ? (
            <Text style={[styles.badge, { color: '#0a0a0a', backgroundColor: colors.gold, borderRadius: radius.sm, fontFamily: fonts.uiBold }]}>
              {t('stats_new_badge').toUpperCase()}
            </Text>
          ) : null}
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{`${formatLoad(r.weight, lang)} ${units}`}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  section: { fontSize: 13, letterSpacing: 1.5, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, gap: 2 },
  badge: { fontSize: 10, letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
});
```

`mobile/src/features/stats/StatsScreen.tsx` :
```tsx
// ============================================================
// STATS — résumé, progression par exercice, assiduité, records.
// Une lecture (readHistory) ; tous les calculs dans domain/stats.
// ============================================================
import { StyleSheet, Text } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { readHistory } from '@/db/repos/statsRepo';
import type { RepoCtx } from '@/db/types';
import { localDateKey } from '@/domain/schedule';
import { displayUnits } from '@/domain/stats/exerciseSeries';
import { DEFAULT_STATS_PERIOD, isStatsPeriod, periodStart, STATS_PERIODS, type StatsPeriod } from '@/domain/stats/period';
import { personalRecords } from '@/domain/stats/records';
import { currentStreak, lastSession, weekVolume } from '@/domain/stats/summary';
import { Screen } from '@/features/common/Screen';
import { useDbQuery } from '@/features/common/useDbQuery';
import { Segmented } from '@/features/profile/Segmented';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { AttendanceSection } from './AttendanceSection';
import { ExerciseSection } from './ExerciseSection';
import { RecordsList } from './RecordsList';
import { SummaryCards } from './SummaryCards';

const readStats = (ctx: RepoCtx) => {
  const stored = getSetting(ctx, 'statsPeriod');
  return { history: readHistory(ctx), period: isStatsPeriod(stored) ? stored : DEFAULT_STATS_PERIOD };
};

/** Écriture de la période puis rafraîchissement (fonction de module : compatible React Compiler) */
function savePeriod(ctx: RepoCtx, period: StatsPeriod, errorMessage: string): void {
  try {
    setSetting(ctx, 'statsPeriod', period);
  } catch {
    useToastStore.getState().show(errorMessage);
  }
  usePrefs.getState().bumpData();
}

export function StatsScreen() {
  const ctx = useRepoCtx();
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  const { history, period } = useDbQuery(readStats);
  const today = localDateKey(new Date());
  const title = <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('stats_title')}</Text>;

  if (history.workouts.length === 0) {
    return (
      <Screen>
        {title}
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('stats_empty')}</Text>
      </Screen>
    );
  }

  const since = periodStart(period, today);
  const units = displayUnits(history);
  return (
    <Screen>
      {title}
      <SummaryCards
        streak={currentStreak(history, today)}
        plannedStreak={(history.active?.trainDays.length ?? 0) > 0}
        week={weekVolume(history, today)}
        last={lastSession(history)}
        units={units}
      />
      <Segmented<StatsPeriod>
        options={STATS_PERIODS.map((p) => ({ value: p, label: t(`stats_period_${p}`) }))}
        value={period}
        onChange={(p) => savePeriod(ctx, p, t('error_not_saved'))}
      />
      <ExerciseSection history={history} since={since} />
      <AttendanceSection history={history} today={today} since={since} />
      <RecordsList records={personalRecords(history, today)} units={units} />
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { fontSize: 44, letterSpacing: -0.5 } });
```

`mobile/src/app/(tabs)/stats.tsx` (remplacement complet) :
```tsx
// Route Stats — ErrorBoundary ; l'écran vit dans features/stats
import { TabErrorBoundary } from '@/features/common/TabErrorBoundary';
import { StatsScreen } from '@/features/stats/StatsScreen';

export default function StatsRoute() {
  return (
    <TabErrorBoundary>
      <StatsScreen />
    </TabErrorBoundary>
  );
}
```

Points à vérifier pendant l'implémentation (types réels du projet, pas des choix de design) : `t(\`stats_period_${p}\`)` doit typer comme `StringKey` (sinon caster `as StringKey`) ; `fonts.uiMedium` et `radius.full` existent (`src/theme/tokens.ts`) ; la clé `stats_no_sessions` existe déjà (« Aucune séance enregistrée. ») et sert de message « aucun point dans la période ».

- [ ] **Step 4: Relancer**

Run: `npx jest src/features/stats && npx tsc --noEmit`
Expected: PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
git add src/features/stats "src/app/(tabs)/stats.tsx"
git commit -m "feat(mobile): add the Stats screen with summary, progression, attendance and records

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Checklist M4b et vérification complète

**Files:**
- Modify: `mobile/docs/DEVICE_CHECKLIST.md`

- [ ] **Step 1: Checklist**

Ajouter à `mobile/docs/DEVICE_CHECKLIST.md` :
```markdown

## M4b — Stats (pas de nouveau build : react-native-svg est dans Expo Go)
- [ ] Expo Go (iPhone) : sans séance terminée, Stats affiche « Termine ta première séance pour voir tes stats ».
- [ ] Après restauration de la sauvegarde : dernière séance « BAS DU CORPS », records (Presse à cuisses 110 kg…), calendrier avec les séances visibles.
- [ ] Période « Tout » : la courbe de Tirage vertical montre 3 points, le record (40 kg) en or ; bascule « 1RM estimé ».
- [ ] La période choisie est conservée après redémarrage.
- [ ] Terminer une séance avec une charge plus haute qu'avant → « 1 nouveau record » dans Dernière séance et badge « Nouveau » dans Records.
- [ ] Planning Lun/Mer/Ven : un jour prévu manqué apparaît avec un contour rouille ; aujourd'hui n'est pas compté manqué.
- [ ] Web : la courbe et le calendrier s'affichent, largeur adaptée à la fenêtre.
- [ ] Thème clair : couleurs lisibles (courbe, calendrier, badges).
```

- [ ] **Step 2: Vérification complète**

Run: `npx jest && npx tsc --noEmit && npx expo export --platform web --output-dir "$TEMP/m4b-web" && npx expo export --platform ios --output-dir "$TEMP/m4b-ios"`
Expected: suite verte, `tsc` propre, deux bundles exportés.

- [ ] **Step 3: Commit**

```bash
git add docs/DEVICE_CHECKLIST.md
git commit -m "docs(mobile): add the M4b device checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Couverture de la spec (auto-revue)

| Exigence (addendum M4b) | Task |
|---|---|
| Séances terminées seulement, séries faites seulement | 5 (repo), 3/4 (calculs) |
| Exercice suivi = (id, alternative), noms (même programme supprimé) | 2, 5 |
| Volume poids × reps, poids du corps exclus | 2, 3 |
| Conversion kg ↔ lbs dans l'unité active | 1, 2, 3 |
| 1RM Epley ≤ 12 reps, meilleure série + égalité | 1, 2 |
| Période 4w / 3m / 1y / all, défaut 3m, mémorisée | 1, 5, 8 |
| Série en cours (planning / sans planning) | 3 |
| Volume semaine + écart | 3 |
| Dernière séance (durée cohérente, nouveaux records) | 3 |
| Courbe Charge / 1RM, record en or, étiquettes | 2, 6, 8 |
| Record de charge, meilleure série, 1RM, volume période | 2, 8 |
| Calendrier 12 semaines (fait / manqué / repos / aujourd'hui / futur, création du programme) | 4, 6 |
| Taux faites / prévues ou nombre de séances | 4, 8 |
| Records + badge « Nouveau » (7 j, pas la première séance) | 2, 8 |
| États vides, exercice sans poids | 2, 8 |
| `react-native-svg`, pas de nouveau build | 6, 9 |
| Vraie sauvegarde | 5, 8 |
| Checklist Expo Go + web | 9 |
