/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { isEquipmentKey } from '@/domain/library/equipment';
import { isMuscleKey } from '@/domain/library/muscles';
import type { LibraryEntry } from '@/domain/library/types';
import catalog from '../catalog.json';
import names from '../names.fr.json';
import { ILLUSTRATIONS } from '../illustrations';

const entries = catalog as LibraryEntry[];
const ROOT = path.resolve(__dirname, '../../../../..');

describe('catalogue généré', () => {
  it('1 324 entrées ds: + des entrées wg: propres à workout-guide ; ids uniques', () => {
    expect(entries.filter((e) => e.id.startsWith('ds:'))).toHaveLength(1324);
    expect(entries.filter((e) => e.id.startsWith('wg:')).length).toBeGreaterThan(0);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });

  it('chaque entrée : noms fr / en non vides, muscles et matériel connus, secondaires sans doublon ni principal', () => {
    for (const e of entries) {
      expect(e.name.en.length).toBeGreaterThan(0);
      expect(e.name.fr.length).toBeGreaterThan(0);
      expect(isMuscleKey(e.primary)).toBe(true);
      expect(isEquipmentKey(e.equipment)).toBe(true);
      expect(e.secondary.every(isMuscleKey)).toBe(true);
      expect(new Set(e.secondary).size).toBe(e.secondary.length);
      expect(e.secondary).not.toContain(e.primary);
    }
  });

  it('instructions : entrées ds avec étapes fr et en ; wg sans instructions', () => {
    for (const e of entries.filter((x) => x.id.startsWith('ds:'))) {
      expect(e.steps?.fr.length).toBeGreaterThan(0);
      expect(e.steps?.en.length).toBeGreaterThan(0);
    }
    for (const e of entries.filter((x) => x.id.startsWith('wg:'))) expect(e.steps).toBeNull();
  });

  it('chaque illustration référencée a ses 3 fichiers et sa ligne dans ILLUSTRATIONS', () => {
    for (const e of entries.filter((x) => x.illustration)) {
      for (const n of [1, 2, 3]) {
        expect(fs.existsSync(path.join(ROOT, 'mobile/assets/exercises', e.illustration!, `frame-${n}.svg`))).toBe(true);
      }
      expect(ILLUSTRATIONS[e.illustration!]).toHaveLength(3);
    }
  });

  it('aucun média Gym visual ; tailles maîtrisées', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'mobile/src/data/library/catalog.json'), 'utf8');
    expect(raw).not.toMatch(/gymvisual|images\/|videos\/|\.gif/i);
    expect(raw.length).toBeLessThanOrEqual(3 * 1024 * 1024);
  });

  it('mentions MIT des données embarquées (exercises-dataset, workout-guide) versionnées', () => {
    const f = path.join(ROOT, 'mobile/src/data/library/LICENSE-DATA.md');
    expect(fs.existsSync(f)).toBe(true);
    const text = fs.readFileSync(f, 'utf8');
    expect(text).toContain('Copyright (c) 2026 Hasan Emir Yıldırım');
    expect(text).toContain('Copyright (c) 2026 Bryl Lim');
    expect(text.match(/Permission is hereby granted/g)).toHaveLength(2);
  });

  it('table de noms français : une entrée par exercice', () => {
    for (const e of entries) expect(Object.hasOwn(names, e.id)).toBe(true);
  });
});

describe('noms français', () => {
  it('chaque entrée a une traduction (pas de repli anglais) ; la grande majorité diffère de l\'anglais', () => {
    const table = names as Record<string, string>;
    for (const e of entries) expect(table[e.id]?.trim().length).toBeGreaterThan(0);
    const same = entries.filter((e) => e.name.fr.toLowerCase() === e.name.en.toLowerCase()).length;
    expect(same / entries.length).toBeLessThan(0.05);
  });
});
