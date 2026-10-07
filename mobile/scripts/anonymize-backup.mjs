// Copie anonymisée d'une sauvegarde PWA pour les tests : libellés de programmes neutralisés,
// structure, clés, dates et poids conservés.
// Usage : node scripts/anonymize-backup.mjs ../docs/workout-backup-2026-10-07.json
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input] = process.argv;
if (!input) throw new Error('chemin de la sauvegarde manquant');
const backup = JSON.parse(readFileSync(input, 'utf8'));
const programs = JSON.parse(backup.programs);
programs.forEach((p, i) => { p.meta.label = `PROGRAMME ${String.fromCharCode(65 + i)}`; });
backup.programs = JSON.stringify(programs);
writeFileSync('src/domain/__fixtures__/pwa-backup.json', `${JSON.stringify(backup, null, 2)}\n`);
console.log(`fixture écrite (${programs.length} programmes)`);
