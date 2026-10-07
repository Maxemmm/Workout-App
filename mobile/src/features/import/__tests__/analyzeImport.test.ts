import example from '@/data/program.example.json';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { analyzeImport } from '../analyzeImport';

const TODAY = '2026-10-07';

describe('analyzeImport', () => {
  it('vide → empty', () => {
    expect(analyzeImport('   ', TODAY)).toEqual({ kind: 'empty' });
  });
  it('JSON invalide → message dédié', () => {
    expect(analyzeImport('{oops', TODAY)).toEqual({ kind: 'error', message: 'editor_import_err' });
  });
  it('Review Focus 4 : BOM UTF-8 et espaces autour sont tolérés', () => {
    expect(analyzeImport(`﻿  ${JSON.stringify(example)}\n`, TODAY).kind).toBe('program');
  });
  it('programme seul valide / invalide', () => {
    expect(analyzeImport(JSON.stringify(example), TODAY)).toMatchObject({ kind: 'program', program: { meta: { label: 'PROGRAMME SALLE' } } });
    const bad = analyzeImport(JSON.stringify({ meta: { label: 'X' }, sessions: { a: { type: 'nope', name: 'A' } } }), TODAY);
    expect(bad).toMatchObject({ kind: 'error', message: 'import_err_program' });
    if (bad.kind === 'error') expect(bad.details?.length).toBeGreaterThan(0);
  });
  it('sauvegarde PWA → paquet', () => {
    const r = analyzeImport(JSON.stringify(backup), TODAY);
    expect(r.kind).toBe('backup');
    if (r.kind === 'backup') expect(r.bundle.report).toMatchObject({ programs: 2, workouts: 8 });
  });
  it('sauvegarde sans programme valide / format inconnu', () => {
    expect(analyzeImport(JSON.stringify({ programs: '[]', 'weight:x': '1' }), TODAY)).toEqual({ kind: 'error', message: 'import_err_no_program' });
    expect(analyzeImport(JSON.stringify({ foo: 1 }), TODAY)).toEqual({ kind: 'error', message: 'import_err_unknown' });
    expect(analyzeImport('[1,2]', TODAY)).toEqual({ kind: 'error', message: 'import_err_unknown' });
  });
});
