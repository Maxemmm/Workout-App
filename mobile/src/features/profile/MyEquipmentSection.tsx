// Profil · Mon matériel — filtre par défaut de la bibliothèque (« Poids du corps » coché au départ)
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { EQUIPMENT_KEYS, equipmentLabel, isEquipmentKey, type EquipmentKey } from '@/domain/library/equipment';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

const DEFAULT_EQUIPMENT: EquipmentKey[] = ['bodyweight'];

const readMine = (ctx: RepoCtx): EquipmentKey[] => {
  const v = getSetting(ctx, 'myEquipment');
  return Array.isArray(v) ? v.filter(isEquipmentKey) : DEFAULT_EQUIPMENT;
};

function save(ctx: RepoCtx, next: EquipmentKey[], errorMessage: string): void {
  try {
    setSetting(ctx, 'myEquipment', next);
  } catch {
    useToastStore.getState().show(errorMessage);
  }
  usePrefs.getState().bumpData();
}

export function MyEquipmentSection() {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t, lang } = useI18n();
  const mine = useDbQuery(readMine);
  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('profile_my_equipment').toUpperCase()}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('profile_my_equipment_meta')}</Text>
      <View style={styles.wrap}>
        {EQUIPMENT_KEYS.map((e) => {
          const on = mine.includes(e);
          return (
            <Pressable key={e} accessibilityRole="checkbox" accessibilityLabel={equipmentLabel(e, lang)} accessibilityState={{ checked: on }}
              onPress={() => save(ctx, on ? mine.filter((x) => x !== e) : [...mine, e], t('error_not_saved'))}
              style={[styles.tag, { borderRadius: radius.full, borderColor: on ? colors.gold : colors.border, backgroundColor: on ? colors.gold : 'transparent' }]}>
              <Text style={{ color: on ? colors.onGold : colors.text, fontFamily: fonts.uiMedium, fontSize: 13 }}>{equipmentLabel(e, lang)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  section: { fontSize: 13, letterSpacing: 1.5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1 },
});
