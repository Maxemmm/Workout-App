// Profil · Minuteur — alertes de fin de repos : réglage, état de l'autorisation, lien vers les Réglages iOS
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { setSetting } from '@/db/repos/settingsRepo';
import { useDbQuery } from '@/features/common/useDbQuery';
import { alertsEnabled, answerAlerts } from '@/features/notifications/permissionFlow';
import { useI18n } from '@/i18n/I18nProvider';
import { restNotifier } from '@/platform/restNotifier';
import type { NotifierPermission } from '@/platform/types';
import { usePrefs } from '@/state/prefsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

/** Bascule du réglage (fonction de module : compatible React Compiler) */
async function toggleAlerts(ctx: Parameters<typeof alertsEnabled>[0], on: boolean, permission: NotifierPermission): Promise<void> {
  if (on && permission === 'undetermined') await answerAlerts(ctx, true).catch(() => false);
  else setSetting(ctx, 'restAlerts', on);
  usePrefs.getState().bumpData();
}

export function TimerSection() {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const enabled = useDbQuery(alertsEnabled);
  const [permission, setPermission] = useState<NotifierPermission | null>(null);

  // État réel de l'autorisation : au montage, après un changement de réglage et au retour au premier plan
  useEffect(() => {
    const read = () => { restNotifier.permission().then(setPermission).catch(() => setPermission('unavailable')); };
    read();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') read(); });
    return () => sub.remove();
  }, [enabled]);

  if (permission === null || permission === 'unavailable') return null;
  const denied = permission === 'denied';
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };

  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('profile_timer_section').toUpperCase()}</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={label}>{t('profile_timer_alerts').toUpperCase()}</Text>
          {enabled ? (
            <Text style={{ color: denied ? colors.rust : colors.textDim, fontFamily: fonts.ui }}>
              {denied ? t('profile_timer_alerts_denied') : t('profile_timer_alerts_on')}
            </Text>
          ) : null}
        </View>
        <Switch
          testID="alerts-switch"
          accessibilityLabel={t('profile_timer_alerts')}
          value={enabled}
          onValueChange={(on) => void toggleAlerts(ctx, on, permission)}
        />
      </View>
      {enabled && denied ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile_open_settings')}
          onPress={() => void restNotifier.openSettings().catch(() => {})}
          style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}
        >
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('profile_open_settings')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 4 },
  btn: { minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
