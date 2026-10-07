// Texte collé ou fichier choisi → aperçu de l'import (fonction pure)
import type { ImportBundle } from '@/domain/importBundle';
import { detectImportFormat } from '@/domain/importFormat';
import { parseLegacyBackup } from '@/domain/legacyImport';
import { parseNativeBackup } from '@/domain/nativeBackup';
import { parseProgram, type Program } from '@/domain/program';
import type { StringKey } from '@/i18n/translate';

export type Analysis =
  | { kind: 'empty' }
  | { kind: 'error'; message: StringKey; details?: string[] }
  | { kind: 'program'; program: Program; raw: unknown }
  | { kind: 'backup'; bundle: ImportBundle };

export function analyzeImport(text: string, today: string): Analysis {
  // Appelée pendant le rendu : une entrée imprévue ne doit jamais faire tomber l'écran
  try {
    return analyze(text, today);
  } catch {
    return { kind: 'error', message: 'import_err_unknown' };
  }
}

function analyze(text: string, today: string): Analysis {
  const cleaned = text.replace(/^﻿/, '').trim();
  if (!cleaned) return { kind: 'empty' };
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    return { kind: 'error', message: 'editor_import_err' };
  }
  switch (detectImportFormat(value)) {
    case 'program': {
      const r = parseProgram(value);
      return r.ok ? { kind: 'program', program: r.program, raw: value } : { kind: 'error', message: 'import_err_program', details: r.errors };
    }
    case 'pwa-backup': {
      const r = parseLegacyBackup(value as Record<string, unknown>, today);
      return r.ok ? { kind: 'backup', bundle: r.bundle } : { kind: 'error', message: r.error === 'no_valid_program' ? 'import_err_no_program' : 'import_err_unknown' };
    }
    case 'native-backup': {
      const r = parseNativeBackup(value);
      return r.ok ? { kind: 'backup', bundle: r.bundle } : { kind: 'error', message: r.error === 'no_valid_program' ? 'import_err_no_program' : 'import_err_unknown' };
    }
    default:
      return { kind: 'error', message: 'import_err_unknown' };
  }
}
