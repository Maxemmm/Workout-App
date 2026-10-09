/** @jest-environment node */
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { restNotifier } from '@/platform/restNotifier';
import { translate } from '@/i18n/translate';
import { formatNotice } from '../formatNotice';
import { alertsEnabled, answerAlerts, shouldAskForAlerts } from '../permissionFlow';

const t = (k: Parameters<typeof translate>[1], ...a: (string | number)[]) => translate('fr', k, ...a);

describe('parcours d\'autorisation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('on demande seulement si jamais répondu et autorisation jamais demandée', () => {
    const ctx = createTestCtx();
    expect(shouldAskForAlerts(ctx, 'undetermined')).toBe(true);
    expect(shouldAskForAlerts(ctx, 'granted')).toBe(false);
    expect(shouldAskForAlerts(ctx, 'denied')).toBe(false);
    expect(shouldAskForAlerts(ctx, 'unavailable')).toBe(false);
    setSetting(ctx, 'restAlerts', false);
    expect(shouldAskForAlerts(ctx, 'undetermined')).toBe(false);
  });

  it('Activer : réglage écrit puis demande système', async () => {
    const ctx = createTestCtx();
    await expect(answerAlerts(ctx, true)).resolves.toBe(true);
    expect(restNotifier.requestPermission).toHaveBeenCalled();
    expect(getSetting(ctx, 'restAlerts')).toBe(true);
    expect(alertsEnabled(ctx)).toBe(true);
  });

  it('Plus tard : réglage désactivé, pas de demande système', async () => {
    const ctx = createTestCtx();
    await expect(answerAlerts(ctx, false)).resolves.toBe(false);
    expect(restNotifier.requestPermission).not.toHaveBeenCalled();
    expect(alertsEnabled(ctx)).toBe(false);
  });
});

describe('formatNotice', () => {
  it('fin de repos : série suivante avec poids ; exercice suivant ; tout fait ; série chronométrée', () => {
    expect(formatNotice({ kind: 'rest', line: { type: 'same', name: 'Presse', set: 3, total: 4, weight: 100 } }, t, 'kg'))
      .toEqual({ title: 'Repos terminé', body: 'Presse · série 3/4 · 100 kg' });
    expect(formatNotice({ kind: 'rest', line: { type: 'next', name: 'DC', set: 1, total: 3, weight: null } }, t, 'kg').body)
      .toBe('Suivant : DC · série 1/3');
    expect(formatNotice({ kind: 'rest', line: { type: 'done' } }, t, 'kg').body).toBe('Toutes les séries sont faites, termine ta séance');
    expect(formatNotice({ kind: 'work', line: { type: 'same', name: 'Gainage', set: 2, total: 3, weight: null } }, t, 'kg'))
      .toEqual({ title: 'Série terminée', body: 'Gainage · série 2/3' });
  });

  it('poids décimal et lbs', () => {
    expect(formatNotice({ kind: 'rest', line: { type: 'same', name: 'Curl', set: 1, total: 3, weight: 22.5 } }, t, 'lbs').body)
      .toBe('Curl · série 1/3 · 22.5 lbs');
  });
});
