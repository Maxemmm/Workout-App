// Contenu de notification → titre et texte dans la langue de l'app
import type { Units } from '@/domain/program';
import type { NoticeContent } from '@/domain/restNotice';
import { formatWeight } from '@/domain/scheme';
import type { StringKey } from '@/i18n/translate';

type T = (key: StringKey, ...args: (string | number)[]) => string;

export function formatNotice(c: NoticeContent, t: T, units: Units): { title: string; body: string } {
  const title = c.kind === 'work' ? t('notif_work_title') : t('notif_rest_title');
  const l = c.line;
  if (l.type === 'done') return { title, body: t('notif_done') };
  const head = t(l.type === 'next' ? 'notif_next' : 'notif_same', l.name, l.set, l.total);
  return { title, body: l.weight !== null ? `${head} · ${formatWeight(l.weight)} ${units}` : head };
}
