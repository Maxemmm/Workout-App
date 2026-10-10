// Liste virtualisée d'exercices : vignette, nom, « muscle · matériel », badge Perso, étoile favori
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { equipmentLabel } from '@/domain/library/equipment';
import { muscleLabel } from '@/domain/library/muscles';
import type { LibraryItem } from '@/domain/library/types';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { Illustration } from './Illustration';

interface Props {
  items: LibraryItem[];
  favorites: string[];
  onOpen(id: string): void;
  onToggleFavorite?(id: string): void;
  header?: ReactElement;
  bottomInset?: number;
}

export function LibraryList({ items, favorites, onOpen, onToggleFavorite, header, bottomInset = 0 }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const { t, lang } = useI18n();
  const fav = new Set(favorites);
  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={20}
      windowSize={10}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: spacing.md, gap: 8, paddingBottom: spacing.md + bottomInset }}
      ListEmptyComponent={<Text style={{ color: colors.textDim, fontFamily: fonts.ui, textAlign: 'center', marginTop: 24 }}>{t('lib_empty')}</Text>}
      renderItem={({ item }) => (
        <Pressable
          testID={`lib-row-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          onPress={() => onOpen(item.id)}
          style={[styles.row, { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.md }]}
        >
          <Illustration slug={item.illustration} muscle={item.primary} size={48} animate={false} />
          <View style={styles.flex}>
            <Text numberOfLines={2} style={{ color: colors.text, fontFamily: fonts.uiBold }}>{item.name}</Text>
            <Text numberOfLines={1} style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 12 }}>
              {`${muscleLabel(item.primary, lang)} · ${equipmentLabel(item.equipment, lang)}`}
            </Text>
          </View>
          {item.custom ? <Text style={[styles.badge, { color: colors.onGold, backgroundColor: colors.gold, borderRadius: radius.sm, fontFamily: fonts.uiBold }]}>{t('lib_custom_badge')}</Text> : null}
          {onToggleFavorite ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={fav.has(item.id) ? t('lib_favorite_remove') : t('lib_favorite_add')}
              onPress={() => onToggleFavorite(item.id)}
              hitSlop={6}
              style={styles.star}
            >
              <Ionicons name={fav.has(item.id) ? 'star' : 'star-outline'} size={20} color={fav.has(item.id) ? colors.gold : colors.textDim} />
            </Pressable>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderWidth: 1, minHeight: TOUCH_MIN + 20 },
  flex: { flex: 1, gap: 2 },
  badge: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  star: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
