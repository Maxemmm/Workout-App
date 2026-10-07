// Compteur « SÉRIES FAITES X / N » + barre (N = séries des exercices principaux)
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { accentColors } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';

export function ProgressBar({ done, total, accent }: { done: number; total: number; accent: string | null | undefined }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const ratio = total === 0 ? 0 : Math.min(1, done / total);
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{t('today_sets_done').toUpperCase()}</Text>
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{`${done} / ${total}`}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.bgCardSoft, borderRadius: radius.full }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: accentColors(colors, accent).fill, borderRadius: radius.full }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 6, overflow: 'hidden' },
  fill: { height: 6 },
});
