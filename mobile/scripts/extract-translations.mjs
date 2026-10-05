// Extraction UNIQUE des dictionnaires fr/en depuis la PWA (index.html → TRANSLATIONS).
// Après extraction, src/i18n/locales/*.json devient la source de vérité :
// ne pas relancer après avoir modifié les JSON à la main.
// Le HTML est converti : <br/> → saut de ligne, autres balises supprimées.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.resolve(here, '../../index.html'), 'utf8');
const outDir = path.resolve(here, '../src/i18n/locales');

const start = html.indexOf('var TRANSLATIONS = {');
if (start < 0) throw new Error('TRANSLATIONS introuvable dans index.html');
const endMarker = '\n    };';
const end = html.indexOf(endMarker, start) + endMarker.length;

const ctx = {};
vm.runInNewContext(html.slice(start, end).replace('var TRANSLATIONS', 'this.T'), ctx);

const clean = (v) => v.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
mkdirSync(outDir, { recursive: true });
for (const lang of ['fr', 'en']) {
  const dict = Object.fromEntries(
    Object.entries(ctx.T[lang]).map(([k, v]) => [k, Array.isArray(v) ? v.map(clean) : clean(v)]),
  );
  writeFileSync(path.join(outDir, `${lang}.json`), JSON.stringify(dict, null, 2) + '\n');
  console.log(`${lang} : ${Object.keys(dict).length} clés`);
}
