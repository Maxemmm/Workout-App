// Stats · records personnels (tout l'historique), badge « Nouveau »
import { StyleSheet, Text, View } from 'react-native';
import type { Units } from '@/domain/program';
import type { PersonalRecord } from '@/domain/stats/records';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDay, formatLoad } from './format';

export function RecordsList({ records, units }: { records: PersonalRecord[]; units: Units }) {
  const { colors, fonts, radius } = useTheme();
  const { t, tList, lang } = useI18n();
  if (records.length === 0) return null;
  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.text, fontFamily: fonts.uiBold }]}>{t('stats_records_title').toUpperCase()}</Text>
      {records.map((r) => (
        <View key={r.key} style={[styles.row, { borderColor: colors.border }]}>
          <View style={styles.flex}>
            <Text style={{ color: colors.text, fontFamily: fonts.uiMedium }}>{r.name}</Text>
            <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>
              {formatDay(r.date, tList('days_short'), tList('months_short'))}
              {r.oneRm !== null ? ` · ${t('stats_onerm')} ${formatLoad(r.oneRm, lang)} ${units}` : ''}
            </Text>
          </View>
          {r.isNew ? (
            <Text style={[styles.badge, { color: '#0a0a0a', backgroundColor: colors.gold, borderRadius: radius.sm, fontFamily: fonts.uiBold }]}>
              {t('stats_new_badge').toUpperCase()}
            </Text>
          ) : null}
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{`${formatLoad(r.weight, lang)} ${units}`}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  section: { fontSize: 13, letterSpacing: 1.5, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, gap: 2 },
  badge: { fontSize: 10, letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
});
