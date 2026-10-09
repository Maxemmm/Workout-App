// Profil · carte « Programme actif » — ou Créer / Importer s'il n'y en a pas
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Program } from '@/domain/program';
import { programSummary } from '@/features/plan/planStats';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  program: Program | null;
  onManage(): void;
  onCreate(): void;
  onImport(): void;
}

export function ActiveProgramCard({ program, onManage, onCreate, onImport }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const card = [styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.lg }];
  const label = [styles.label, { color: colors.textDim, fontFamily: fonts.uiBold }];
  if (!program) {
    return (
      <View style={card}>
        <Text style={label}>{t('profile_active_program').toUpperCase()}</Text>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('profile_no_active')}</Text>
        <Pressable accessibilityRole="button" onPress={onCreate} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
          <Text style={{ color: colors.onGold, fontFamily: fonts.uiBold }}>{t('today_create_program')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onImport} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('onboarding_import')}</Text>
        </Pressable>
      </View>
    );
  }
  const { days } = programSummary(program);
  const perWeek = days === 1 ? t('profile_sessions_week_one') : t('profile_sessions_week', days);
  return (
    <View style={card}>
      <Text style={label}>{t('profile_active_program').toUpperCase()}</Text>
      <Text style={[styles.name, { color: colors.text, fontFamily: fonts.display }]}>{program.meta.label}</Text>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{`${perWeek} · ${program.meta.units}`}</Text>
      <Pressable accessibilityRole="button" onPress={onManage} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('profile_manage')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 16, gap: 8 },
  label: { fontSize: 11, letterSpacing: 1.5 },
  name: { fontSize: 28 },
  btn: { minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
