// Conteneur d'écran : fond du thème, zones de sécurité, défilement, calque flottant optionnel
import type { ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  children: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  scrollEnabled?: boolean;
  /** Élément flottant au-dessus du contenu (barre de repos) */
  overlay?: ReactNode;
  /** Marge basse du contenu pour ne pas être masqué par l'overlay */
  bottomInset?: number;
}

export function Screen({ children, scrollRef, scrollEnabled = true, overlay, bottomInset = 0 }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.md + bottomInset }}
      >
        {children}
      </ScrollView>
      {overlay ? <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>{overlay}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
