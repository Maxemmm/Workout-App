// Feuille « Être prévenu à la fin du repos » : Activer (demande système) ou Plus tard (ne plus demander)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { BottomSheet } from '@/features/common/BottomSheet';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { answerAlerts } from './permissionFlow';

export function AlertsPermissionSheet({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const answer = async (accept: boolean) => {
    onClose();
    await answerAlerts(ctx, accept).catch(() => false);
    usePrefs.getState().bumpData();
  };
  const actions = (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={() => void answer(false)} style={[styles.btn, { backgroundColor: colors.bgCardSoft, borderRadius: radius.md }]}>
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('alerts_later')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void answer(true)} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
        <Text style={{ color: colors.onGold, fontFamily: fonts.uiBold }}>{t('alerts_enable')}</Text>
      </Pressable>
    </View>
  );
  return (
    <BottomSheet visible={visible} title={t('alerts_sheet_title')} onClose={() => void answer(false)} footer={actions}>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('alerts_sheet_body')}</Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, minHeight: TOUCH_MIN + 4, alignItems: 'center', justifyContent: 'center' },
});
