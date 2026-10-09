// Autorisation des alertes de fin de repos : question posée une seule fois, réglage mémorisé
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { restNotifier } from '@/platform/restNotifier';
import type { NotifierPermission } from '@/platform/types';

export const alertsEnabled = (ctx: RepoCtx): boolean => getSetting(ctx, 'restAlerts') === true;

/** Feuille à afficher : jamais répondu et autorisation système jamais demandée */
export function shouldAskForAlerts(ctx: RepoCtx, permission: NotifierPermission): boolean {
  return getSetting(ctx, 'restAlerts') === undefined && permission === 'undetermined';
}

/** Réponse à la feuille ; « Activer » déclenche la demande système et renvoie son résultat */
export async function answerAlerts(ctx: RepoCtx, accept: boolean): Promise<boolean> {
  setSetting(ctx, 'restAlerts', accept);
  if (!accept) return false;
  return restNotifier.requestPermission();
}
