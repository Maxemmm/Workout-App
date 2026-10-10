// ============================================================
// Génère la bibliothèque d'exercices (une fois, hors app) :
//   exercises-dataset (MIT, données / textes) + workout-guide (MIT ; illustrations CC BY-SA 4.0).
// Sorties versionnées : src/data/library/{catalog.json,names.fr.json,wg-match.json,illustrations.ts}
//                       assets/exercises/<slug>/frame-{1,2,3}.svg + LICENSE-ASSETS.md
// Jamais de média Gym visual. names.fr.json et wg-match.json ne sont jamais écrasés (complétés).
// Usage : node scripts/build-catalog.mjs
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize } from 'svgo';

const DS_SHA = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd';
const WG_SHA = 'aac599224bb9780305239607ef98540b7e0ce389';
const DS_URL = `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${DS_SHA}/data/exercises.json`;
const WG_BASE = `https://raw.githubusercontent.com/bryllim/workout-guide/${WG_SHA}/packages/workout-guide`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache/library-src');
const OUT = path.join(ROOT, 'src/data/library');
const ASSETS = path.join(ROOT, 'assets/exercises');

const MUSCLE = {
  // exercises-dataset (target + secondary_muscles)
  abs: 'abs', abdominals: 'abs', 'lower abs': 'abs', core: 'abs', obliques: 'obliques',
  pectorals: 'chest', chest: 'chest', 'upper chest': 'chest',
  delts: 'shoulders', deltoids: 'shoulders', shoulders: 'shoulders', 'rear deltoids': 'shoulders', 'rotator cuff': 'shoulders',
  biceps: 'biceps', brachialis: 'biceps', triceps: 'triceps',
  forearms: 'forearms', 'grip muscles': 'forearms', hands: 'forearms', wrists: 'forearms', 'wrist flexors': 'forearms', 'wrist extensors': 'forearms',
  lats: 'lats', 'latissimus dorsi': 'lats', 'upper back': 'upper_back', back: 'upper_back', rhomboids: 'upper_back',
  traps: 'traps', trapezius: 'traps', spine: 'lower_back', 'lower back': 'lower_back',
  'levator scapulae': 'neck', sternocleidomastoid: 'neck', 'serratus anterior': 'serratus',
  glutes: 'glutes', 'hip flexors': 'hip_flexors', quads: 'quads', quadriceps: 'quads', hamstrings: 'hamstrings',
  adductors: 'adductors', 'inner thighs': 'adductors', groin: 'adductors', abductors: 'abductors',
  calves: 'calves', soleus: 'calves', shins: 'calves', ankles: 'calves', 'ankle stabilizers': 'calves', feet: 'calves',
  'cardiovascular system': 'cardio',
  // workout-guide (primaryMuscle + secondaryMuscles)
  Chest: 'chest', Shoulders: 'shoulders', 'Rear Delts': 'shoulders', 'Upper Back': 'upper_back', Back: 'upper_back',
  Lats: 'lats', Biceps: 'biceps', Triceps: 'triceps', Forearms: 'forearms', Grip: 'forearms',
  Core: 'abs', 'Lower Back': 'lower_back', Glutes: 'glutes', Hips: 'glutes', Quads: 'quads', Legs: 'quads',
  Hamstrings: 'hamstrings', 'Posterior Chain': 'full_body', Adductors: 'adductors', Groin: 'adductors',
  Calves: 'calves', Cardio: 'cardio', Mobility: 'full_body',
};
const EQUIPMENT = {
  'body weight': 'bodyweight', assisted: 'machine', barbell: 'barbell', 'olympic barbell': 'barbell', 'ez barbell': 'barbell', 'trap bar': 'barbell',
  dumbbell: 'dumbbell', kettlebell: 'kettlebell', cable: 'cable',
  'leverage machine': 'machine', 'smith machine': 'machine', 'sled machine': 'machine',
  band: 'band', 'resistance band': 'band', weighted: 'weighted',
  'stability ball': 'ball', 'medicine ball': 'ball', 'bosu ball': 'ball',
  'stationary bike': 'cardio_machine', 'elliptical machine': 'cardio_machine', 'stepmill machine': 'cardio_machine',
  'skierg machine': 'cardio_machine', 'upper body ergometer': 'cardio_machine',
  rope: 'other', roller: 'other', 'wheel roller': 'other', tire: 'other', hammer: 'other',
  // workout-guide
  Bodyweight: 'bodyweight', Barbell: 'barbell', Dumbbell: 'dumbbell', Kettlebell: 'kettlebell', Cable: 'cable', Machine: 'machine',
  'Resistance Band': 'band', Plate: 'weighted', 'Stability Ball': 'ball', 'Pull-up Bar': 'pullup_bar', Bench: 'bench',
  Cardio: 'cardio_machine', Wall: 'other', Chair: 'other', Doorway: 'other', Towel: 'other', Box: 'other',
};

const fail = (msg) => { throw new Error(msg); };
const muscle = (v, ctx) => MUSCLE[v] ?? fail(`muscle inconnu « ${v} » (${ctx}) : compléter la table MUSCLE`);
const equipment = (v, ctx) => EQUIPMENT[v] ?? fail(`matériel inconnu « ${v} » (${ctx}) : compléter la table EQUIPMENT`);
const uniq = (list, primary) => [...new Set(list)].filter((m) => m !== primary);
const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);
const writeJson = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\bs\b/g, '').trim().replace(/s$/, '');

async function cached(url, file) {
  const p = path.join(CACHE, file);
  if (!fs.existsSync(p)) {
    const res = await fetch(url);
    if (!res.ok) fail(`téléchargement impossible : ${url} (${res.status})`);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
  return fs.readFileSync(p, 'utf8');
}

const ds = JSON.parse(await cached(DS_URL, 'exercises.json'));
const wg = JSON.parse(await cached(`${WG_BASE}/manifest.json`, 'manifest.json'));

// Correspondance workout-guide → exercises-dataset : relue à la main, jamais écrasée
const matchFile = path.join(OUT, 'wg-match.json');
const match = readJson(matchFile, {});
const dsByNorm = new Map(ds.map((e) => [norm(e.name), e.id]));
for (const w of wg) if (!(w.slug in match)) match[w.slug] = dsByNorm.get(norm(w.name)) ?? null;
const dsIllustration = new Map(Object.entries(match).filter(([, id]) => id).map(([slug, id]) => [id, slug]));

const entries = [];
for (const e of ds) {
  const primary = muscle(e.target, `ds:${e.id}`);
  entries.push({
    id: `ds:${e.id}`,
    name: { fr: '', en: e.name.charAt(0).toUpperCase() + e.name.slice(1) },
    primary,
    secondary: uniq((e.secondary_muscles ?? []).map((m) => muscle(m, `ds:${e.id}`)), primary),
    equipment: equipment(e.equipment, `ds:${e.id}`),
    steps: { fr: e.instruction_steps?.fr ?? [], en: e.instruction_steps?.en ?? [] },
    illustration: dsIllustration.get(e.id) ?? null,
  });
}
for (const w of wg) {
  if (match[w.slug]) continue; // fusionné dans l'entrée ds:
  const primary = muscle(w.primaryMuscle, `wg:${w.slug}`);
  entries.push({
    id: `wg:${w.slug}`,
    name: { fr: '', en: w.name },
    primary,
    secondary: uniq((w.secondaryMuscles ?? []).map((m) => muscle(m, `wg:${w.slug}`)), primary),
    equipment: equipment(w.equipment, `wg:${w.slug}`),
    steps: null,
    illustration: w.slug,
  });
}
entries.sort((a, b) => a.id.localeCompare(b.id));

// Noms français : table relue à la main, jamais écrasée ; entrée vide = à traduire (repli anglais)
const namesFile = path.join(OUT, 'names.fr.json');
const names = readJson(namesFile, {});
let missing = 0;
for (const e of entries) {
  if (!(e.id in names)) names[e.id] = '';
  if (!names[e.id]) missing += 1;
  e.name.fr = names[e.id] || e.name.en;
}

// Illustrations : 3 images par exercice illustré, optimisées (svgo), remplissage d'origine conservé
const slugs = [...new Set(entries.map((e) => e.illustration).filter(Boolean))].sort();
for (const slug of slugs) {
  for (const n of [1, 2, 3]) {
    const raw = await cached(`${WG_BASE}/assets/${slug}/frame-${n}.svg`, `assets/${slug}/frame-${n}.svg`);
    const out = optimize(raw, { multipass: true, floatPrecision: 0 }).data;
    fs.mkdirSync(path.join(ASSETS, slug), { recursive: true });
    fs.writeFileSync(path.join(ASSETS, slug, `frame-${n}.svg`), out);
  }
}
fs.writeFileSync(path.join(ASSETS, 'LICENSE-ASSETS.md'), `# Illustrations d'exercices

Adaptées (optimisées avec svgo, recolorées à l'affichage) de [workout-guide](https://github.com/bryllim/workout-guide)
par [Bryl Lim](https://bryllim.com), elles-mêmes issues en partie d'[Everkinetic](https://github.com/everkinetic/data).
Licence : [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — ces fichiers adaptés restent sous CC BY-SA 4.0.
`);
fs.writeFileSync(path.join(OUT, 'illustrations.ts'), `// Généré par scripts/build-catalog.mjs — ne pas modifier à la main.
// Illustrations workout-guide (CC BY-SA 4.0, Bryl Lim / Everkinetic) : 3 images par exercice.
export const ILLUSTRATIONS: Record<string, readonly [number, number, number]> = {
${slugs.map((s) => `  '${s}': [require('../../../assets/exercises/${s}/frame-1.svg'), require('../../../assets/exercises/${s}/frame-2.svg'), require('../../../assets/exercises/${s}/frame-3.svg')],`).join('\n')}
};
`);

writeJson(matchFile, Object.fromEntries(Object.entries(match).sort(([a], [b]) => a.localeCompare(b))));
writeJson(namesFile, Object.fromEntries(Object.entries(names).sort(([a], [b]) => a.localeCompare(b))));
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(entries));
const unmatched = Object.values(match).filter((v) => v === null).length;
console.log(`catalogue : ${entries.length} entrées (${slugs.length} illustrées) ; wg sans correspondance : ${unmatched} ; noms FR manquants : ${missing}`);
