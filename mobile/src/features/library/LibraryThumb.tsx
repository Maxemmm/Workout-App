// Vignette d'un exercice lié (cartes Today / éditeur) : ouvre la fiche ; rien si le lien est inconnu
import { Pressable } from 'react-native';
import { useDbQuery } from '@/features/common/useDbQuery';
import { useI18n } from '@/i18n/I18nProvider';
import { Illustration } from './Illustration';
import { findLibraryItem, readLibraryUser } from './libraryData';

interface Props {
  libraryId: string | undefined;
  /** Absent : vignette décorative (éditeur) */
  onOpen?(id: string): void;
  size?: number;
}

export function LibraryThumb({ libraryId, onOpen, size = 36 }: Props) {
  const { t, lang } = useI18n();
  const user = useDbQuery(readLibraryUser);
  const item = libraryId ? findLibraryItem(libraryId, user.customs, lang) : null;
  if (!item) return null;
  const image = <Illustration slug={item.illustration} muscle={item.primary} size={size} animate={false} />;
  if (!onOpen) return image;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('lib_open_sheet')} onPress={() => onOpen(item.id)} hitSlop={4}>
      {image}
    </Pressable>
  );
}
