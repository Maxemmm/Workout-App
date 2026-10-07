// Erreur de brouillon → message affichable
import type { DraftError } from '@/domain/programRules';
import type { StringKey } from '@/i18n/translate';

type T = (key: StringKey, ...args: (string | number)[]) => string;

const KEYS: Record<Exclude<DraftError['code'], 'schema'>, StringKey> = {
  name_required: 'editor_err_name',
  no_session: 'editor_err_session',
  no_schedule: 'editor_err_schedule',
  session_name_required: 'editor_err_session_name',
};

export function errorMessage(t: T, e: DraftError, sessionName?: string): string {
  if (e.code === 'schema') return sessionName ? `${sessionName} — ${e.detail ?? ''}` : e.detail ?? '';
  return t(KEYS[e.code]);
}
