import { detectImportFormat } from '../importFormat';
import backup from '../__fixtures__/pwa-backup.json';

describe('detectImportFormat', () => {
  it('programme seul', () => {
    expect(detectImportFormat({ meta: { label: 'P' }, sessions: {} })).toBe('program');
  });
  it('sauvegarde PWA : marqueur, programmes, programme actif ou clés préfixées', () => {
    expect(detectImportFormat(backup)).toBe('pwa-backup');
    expect(detectImportFormat({ _backupFormat: 1 })).toBe('pwa-backup');
    expect(detectImportFormat({ programs: '[]' })).toBe('pwa-backup');
    expect(detectImportFormat({ activeProgram: 'x' })).toBe('pwa-backup');
    expect(detectImportFormat({ 'weight:presse': '100' })).toBe('pwa-backup');
    expect(detectImportFormat({ meta: {}, sessions: {}, programs: '[]' })).toBe('pwa-backup');
  });
  it('sauvegarde native', () => {
    expect(detectImportFormat({ _format: 'workout-native', _version: 1 })).toBe('native-backup');
  });
  it('inconnu : tableau, null, texte, objet quelconque', () => {
    expect(detectImportFormat([])).toBe('unknown');
    expect(detectImportFormat(null)).toBe('unknown');
    expect(detectImportFormat('x')).toBe('unknown');
    expect(detectImportFormat({ foo: 1 })).toBe('unknown');
  });
});
