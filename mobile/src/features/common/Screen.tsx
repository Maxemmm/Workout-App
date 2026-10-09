// Conteneur d'écran : fond du thème, zones de sécurité, défilement, calque flottant optionnel.
// Le clavier ne masque jamais un champ : le défilement s'ajuste (iOS) et se ferme au glisser.
// Zones de sécurité : marges tirées du provider racine (useSafeAreaInsets), justes dès le premier rendu.
// Pas de SafeAreaView natif : dans une modale native (éditeur, import), il lit ses marges une seule fois,
// avant qu'iOS les ait calculées (0), et ne se met pas à jour → haut d'écran sous la barre d'état au
// premier affichage seulement.
import type { ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    <View
      testID="screen-root"
      style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}
    >
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
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
