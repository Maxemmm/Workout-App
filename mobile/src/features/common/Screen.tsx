// Conteneur d'écran : fond du thème, zones de sécurité, défilement, calque flottant optionnel.
// Le clavier ne masque jamais un champ : le défilement s'ajuste (iOS) et se ferme au glisser.
import type { ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  children: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  scrollEnabled?: boolean;
  /** Élément flottant au-dessus du contenu (barre de repos) */
  overlay?: ReactNode;
  /** Marge basse du contenu pour ne pas être masqué par l'overlay */
  bottomInset?: number;
  /** Écran sans barre d'onglets (éditeur, import, onboarding) : marge de la barre d'accueil */
  safeBottom?: boolean;
}

export function Screen({ children, scrollRef, scrollEnabled = true, overlay, bottomInset = 0, safeBottom = false }: Props) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const homeIndicator = safeBottom ? Math.max(insets.bottom, spacing.md) : 0;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        testID="screen-scroll"
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.md + bottomInset + homeIndicator }}
      >
        {children}
      </ScrollView>
      {overlay ? <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>{overlay}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
