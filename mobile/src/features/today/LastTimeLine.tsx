// « Dernière fois : 4 × 8 · 100 kg »
import { Text } from 'react-native';
import type { LastPerformance } from '@/db/repos/historyRepo';
import type { Units } from '@/domain/program';
import { formatWeight } from '@/domain/scheme';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function LastTimeLine({ last, units }: { last: LastPerformance | null; units: Units }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  if (!last) return null;
  const sets = last.reps !== null ? `${last.sets} × ${last.reps}` : t('today_sets_count', last.sets);
  const weight = last.maxWeight !== null ? ` · ${formatWeight(last.maxWeight)} ${units}` : '';
  return <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t('today_last_time', `${sets}${weight}`)}</Text>;
}
