// ============================================================
// Onglet « Exercices » : recherche, pastilles de filtres, liste, nouvel exercice personnalisé
// ============================================================
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRepoCtx } from '@/db/DbContext';
import { EQUIPMENT_KEYS, equipmentLabel, type EquipmentKey } from '@/domain/library/equipment';
import { MUSCLE_KEYS, muscleLabel, type MuscleKey } from '@/domain/library/muscles';
import { searchLibrary } from '@/domain/library/search';
import { NO_FILTERS, type LibraryFilters } from '@/domain/library/types';
import { BottomSheet } from '@/features/common/BottomSheet';
import { TextField } from '@/features/common/TextField';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { toggleFavorite } from './favorites';
import { LibraryList } from './LibraryList';
import { libraryItems, readLibraryUser } from './libraryData';

/** Écriture puis rafraîchissement (fonction de module : compatible React Compiler) */
function write(fn: () => void, errorMessage: string): void {
  try {
    fn();
  } catch {
    useToastStore.getState().show(errorMessage);
  }
  usePrefs.getState().bumpData();
}

export function LibraryContent({ onOpen, onToggleFavorites = true, header }: { onOpen(id: string): void; onToggleFavorites?: boolean; header?: React.ReactElement }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius, spacing } = useTheme();
  const { t, lang } = useI18n();
  const user = useDbQuery(readLibraryUser);
  const [filters, setFilters] = useState<LibraryFilters>(() => ({ ...NO_FILTERS, myEquipmentOnly: user.myEquipment.length > 0 }));
  const [picking, setPicking] = useState<'muscle' | 'equipment' | null>(null);
  const items = searchLibrary(libraryItems(user.customs, lang), filters, user);

  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderRadius: radius.full, borderColor: selected ? colors.gold : colors.border, backgroundColor: selected ? colors.gold : 'transparent' }]}
    >
      <Text style={{ color: selected ? colors.onGold : colors.text, fontFamily: fonts.uiMedium }}>{label}</Text>
    </Pressable>
  );
  const option = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
      style={[styles.option, { backgroundColor: colors.bgCard, borderColor: selected ? colors.borderActive : colors.border, borderRadius: radius.md }]}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{label}</Text>
    </Pressable>
  );

  const top = (
    <View style={{ gap: spacing.sm }}>
      {header}
      <TextField
        testID="lib-search"
        value={filters.query}
        onChangeText={(query) => setFilters((f) => ({ ...f, query }))}
        placeholder={t('lib_search_ph')}
        autoCorrect={false}
        style={[styles.search, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bgCard }]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
        {chip(filters.muscle ? muscleLabel(filters.muscle, lang) : t('lib_filter_muscle'), filters.muscle !== null, () => setPicking('muscle'))}
        {chip(filters.equipment ? equipmentLabel(filters.equipment, lang) : t('lib_filter_equipment'), filters.equipment !== null, () => setPicking('equipment'))}
        {chip(t('lib_filter_favorites'), filters.favoritesOnly, () => setFilters((f) => ({ ...f, favoritesOnly: !f.favoritesOnly })))}
        {user.myEquipment.length > 0 ? chip(t('lib_filter_mine'), filters.myEquipmentOnly, () => setFilters((f) => ({ ...f, myEquipmentOnly: !f.myEquipmentOnly }))) : null}
      </ScrollView>
      <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>{t('lib_count_fmt', items.length)}</Text>
    </View>
  );

  return (
    <>
      <LibraryList
        items={items}
        favorites={user.favorites}
        onOpen={onOpen}
        onToggleFavorite={onToggleFavorites ? (id) => write(() => toggleFavorite(ctx, id), t('error_not_saved')) : undefined}
        header={top}
      />
      <BottomSheet visible={picking !== null} title={picking === 'muscle' ? t('lib_filter_muscle') : t('lib_filter_equipment')} onClose={() => setPicking(null)}>
        {picking === 'muscle'
          ? [option(t('lib_filter_all'), filters.muscle === null, () => { setFilters((f) => ({ ...f, muscle: null })); setPicking(null); }),
             ...MUSCLE_KEYS.map((m: MuscleKey) => option(muscleLabel(m, lang), filters.muscle === m, () => { setFilters((f) => ({ ...f, muscle: m })); setPicking(null); }))]
          : [option(t('lib_filter_all'), filters.equipment === null, () => { setFilters((f) => ({ ...f, equipment: null })); setPicking(null); }),
             ...EQUIPMENT_KEYS.map((e: EquipmentKey) => option(equipmentLabel(e, lang), filters.equipment === e, () => { setFilters((f) => ({ ...f, equipment: e })); setPicking(null); }))]}
      </BottomSheet>
    </>
  );
}

export function LibraryScreen({ onOpen, onNewCustom }: { onOpen(id: string): void; onNewCustom(): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const header = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('lib_title')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('lib_new_custom')} onPress={onNewCustom}
        style={[styles.add, { borderColor: colors.gold, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{`+ ${t('lib_new_custom')}`}</Text>
      </Pressable>
    </View>
  );
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <LibraryContent onOpen={onOpen} header={header} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 44, letterSpacing: -0.5 },
  add: { minHeight: TOUCH_MIN, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1 },
  search: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
  chips: { gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1 },
  option: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
});
