// Sélecteur d'exercice (éditeur) : même recherche / filtres que l'onglet, « Exercice libre », Annuler
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LibraryItem } from '@/domain/library/types';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { LibraryContent } from './LibraryScreen';
import { findLibraryItem, readLibraryUser } from './libraryData';
import { useDbQuery } from '@/features/common/useDbQuery';

export function ExercisePicker({ onPick, onFree, onCancel }: { onPick(item: LibraryItem): void; onFree(): void; onCancel(): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const user = useDbQuery(readLibraryUser);
  const header = (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.hbtn}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('lib_cancel')}</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('lib_pick_title')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('lib_pick_free')} onPress={onFree}
        style={[styles.free, { borderColor: colors.gold, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('lib_pick_free')}</Text>
      </Pressable>
    </View>
  );
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <LibraryContent
        header={header}
        onToggleFavorites={false}
        onOpen={(id) => { const item = findLibraryItem(id, user.customs, lang); if (item) onPick(item); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row' },
  hbtn: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  title: { fontSize: 32, letterSpacing: -0.5 },
  free: { minHeight: TOUCH_MIN + 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
